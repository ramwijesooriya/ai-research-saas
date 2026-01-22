"""
Production FastAPI Server
Handles API requests, Database (Supabase), AI Agent, and Stripe Payments
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import stripe

# Load environment variables
load_dotenv()

# Stripe Setup
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

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
        # Check if user exists
        response = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        user_data = response.data

        if not user_data:
            # If user doesn't exist yet, return default
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


# --- PAYMENT ENDPOINTS (NEW) ---

@app.post("/create-checkout-session")
async def create_checkout_session(request: Request):
    """
    Create a Stripe Checkout Session for upgrading to Pro
    """
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required")

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Pro Plan - 50 AI Research Credits',
                        'description': 'Unlock deep research mode and 50 credits.',
                    },
                    'unit_amount': 1000,  # $10.00 (in cents)
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{FRONTEND_URL}/',
            metadata={
                "user_id": user_id
            }
        )
        return {"url": checkout_session.url}
    except Exception as e:
        print(f"Stripe Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/verify-payment")
def verify_payment(session_id: str):
    """
    Verify payment success and add credits
    """
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
            user_id = session.metadata["user_id"]
            
            # Get current credits
            response = supabase.table("user_profiles").select("credits").eq("user_id", user_id).execute()
            
            if response.data:
                current_credits = response.data[0]["credits"]
                new_credits = current_credits + 50
                
                # Update credits
                supabase.table("user_profiles").update({
                    "credits": new_credits,
                    "tier": "Pro"  # Optional: Mark them as Pro
                }).eq("user_id", user_id).execute()
                
                return {"status": "success", "new_credits": new_credits}
            else:
                return {"status": "error", "message": "User not found"}
        else:
            return {"status": "pending"}
            
    except Exception as e:
        print(f"Payment Verification Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        # Supabase එකට Insert කිරීම
        response = supabase.table("research_history").insert(data).execute()
        return {"status": "saved", "data": response.data}
    except Exception as e:
        print(f"Error saving history: {str(e)}")
        # Error එකක් ආවත් App එක කඩන් වැටෙන්න දෙන්න බෑ, ඒ නිසා නිකන් ඉන්නවා
        return {"status": "error", "detail": str(e)}

@app.get("/history/{user_id}")
async def get_history(user_id: str):
    try:
        # අලුත් ඒවා උඩින් එන විදියට Sort කරලා ගන්නවා
        response = supabase.table("research_history")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return response.data
    except Exception as e:
        print(f"Error fetching history: {str(e)}")
        return []



# --- Run Locally ---

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )