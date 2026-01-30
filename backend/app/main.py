"""
Production FastAPI Server
Handles API requests, Database (Supabase), AI Agent, and Lemon Squeezy Webhooks
"""
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
import hmac
import hashlib
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Import your agent
from app.agent import get_agent

# --- Supabase Setup ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ WARNING: Supabase keys are missing! Database features won't work.")

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="AI Research API",
    description="Production-grade AI research report generator",
    version="1.0.0"
)

# CORS - Allow your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---

class GenerateRequest(BaseModel):
    """Request body for /generate endpoint"""
    topic: str = Field(..., min_length=5, max_length=200, description="Research topic")
    user_id: str = Field(..., description="Clerk user ID")

class HistoryItem(BaseModel):
    user_id: str
    topic: str
    report: str
    sources: list

class GenerateResponse(BaseModel):
    """Response from /generate endpoint"""
    status: str
    report: str
    sources: List[str]
    credits_left: int
    generated_at: str
    user_id: str

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {
        "status": "active", 
        "message": "AI Research API is running 🚀",
        "version": "1.0.0"
    }

@app.get("/profile/{user_id}")
def get_user_profile(user_id: str):
    """
    Get user profile details (Credits & Tier)
    """
    try:
        response = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        user_data = response.data

        if not user_data:
            return {"credits": 3, "tier": "Free"}
        
        return {
            "credits": user_data[0]["credits"],
            "tier": user_data[0]["tier"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=GenerateResponse)
async def generate_report(request: GenerateRequest):
    """
    Generate Report with Credit System
    """
    print(f"👤 Processing request for User: {request.user_id}")

    try:
        # --- 1. DB CHECK (User & Credits) ---
        response = supabase.table("user_profiles").select("*").eq("user_id", request.user_id).execute()
        user_data = response.data

        current_credits = 0

        if not user_data:
            print("✨ New user detected! Creating profile...")
            new_user = {"user_id": request.user_id, "credits": 3, "tier": "Free"}
            supabase.table("user_profiles").insert(new_user).execute()
            current_credits = 3
        else:
            current_credits = user_data[0]["credits"]
        
        if current_credits <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits! Please upgrade.")

        # --- 2. AI GENERATION ---
        agent = get_agent()
        result = await agent.generate_report(request.topic)
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["report"])

        # --- 3. DB UPDATE (Save & Deduct) ---
        report_data = {
            "user_id": request.user_id,
            "topic": request.topic,
            "content": result["report"]
        }
        supabase.table("reports").insert(report_data).execute()

        new_credits = current_credits - 1
        supabase.table("user_profiles").update({"credits": new_credits}).eq("user_id", request.user_id).execute()
        
        print(f"✅ Report saved. Credits remaining: {new_credits}")

        return GenerateResponse(
            status=result["status"],
            report=result["report"],
            sources=result["sources"],
            credits_left=new_credits,
            generated_at=datetime.utcnow().isoformat(),
            user_id=request.user_id
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Server Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

# --- LEMON SQUEEZY WEBHOOK (NEW) ---

@app.post("/webhook")
async def lemon_squeezy_webhook(request: Request, x_signature: str = Header(None)):
    """
    Listens for Lemon Squeezy payment notifications.
    When a payment is successful, it adds 50 credits to the user.
    """
    
    # 1. Get the raw body (message) and the secret key
    raw_body = await request.body()
    # IMPORTANT: Add 'LEMON_SQUEEZY_WEBHOOK_SECRET' to your Hugging Face Secrets!
    secret = os.getenv("LEMON_SQUEEZY_WEBHOOK_SECRET", "my_super_secret_password")
    
    # 2. Verify Security
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    
    if not x_signature or not hmac.compare_digest(digest, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse the message
    data = await request.json()
    event_name = data.get("meta", {}).get("event_name")
    
    print(f"🔔 Event Received: {event_name}")

    # 4. Handle 'order_created'
    if event_name == "order_created":
        # Get the User ID sent from Frontend
        custom_data = data.get('meta', {}).get('custom_data', {})
        user_id = custom_data.get('user_id')
        
        print(f"💰 Payment success for User: {user_id}")
        
        if user_id:
            try:
                # First, get current credits from 'user_profiles' table
                response = supabase.table("user_profiles").select("credits").eq("user_id", user_id).execute()
                
                if response.data:
                    current_credits = response.data[0]['credits']
                    new_credits = current_credits + 50
                    
                    # Update credits & Tier
                    supabase.table("user_profiles").update({
                        "credits": new_credits, 
                        "tier": "Pro"
                    }).eq("user_id", user_id).execute()
                    
                    print(f"✅ Added 50 credits to {user_id}. New Balance: {new_credits}")
                else:
                    print(f"⚠️ User {user_id} not found in DB. Could not add credits.")
                
            except Exception as e:
                print(f"❌ Database Error: {str(e)}")
                
    return {"status": "received"}

# --- History Endpoints ---

@app.post("/history")
async def save_history(item: HistoryItem):
    try:
        data = {
            "user_id": item.user_id,
            "topic": item.topic,
            "report": item.report,
            "sources": item.sources
        }
        response = supabase.table("research_history").insert(data).execute()
        return {"status": "saved", "data": response.data}
    except Exception as e:
        print(f"Error saving history: {str(e)}")
        return {"status": "error", "detail": str(e)}

@app.get("/history/{user_id}")
async def get_history(user_id: str):
    try:
        response = supabase.table("research_history")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return response.data
    except Exception as e:
        print(f"Error fetching history: {str(e)}")
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )