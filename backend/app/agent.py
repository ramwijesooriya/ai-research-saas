"""
Production-Grade AI Research Agent
Uses Google Gemini 2.5 Flash + Tavily Search
"""
import os
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class ResearchAgent:
    """Singleton agent for generating research reports"""
    
    def __init__(self, google_key: str, tavily_key: str):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,  # Slightly creative but factual
            google_api_key=google_key,
            convert_system_message_to_human=True,
            max_output_tokens=2048
        )
        
        self.search_tool = TavilySearchResults(
            max_results=5,  # More results = better quality
            tavily_api_key=tavily_key,
            search_depth="advanced"  # Deep search mode
        )
        
        # Professional report template
        self.prompt = ChatPromptTemplate.from_template(
            """You are a senior market research analyst at a top consulting firm.

USER REQUEST: {topic}

SEARCH RESULTS:
{context}

YOUR TASK:
Write a comprehensive, professional research report in markdown format.

REQUIRED STRUCTURE:
# [Compelling Title]

## Executive Summary
A 3-sentence overview of key findings.

## Market Overview
Current state and recent developments.

## Key Findings
- Finding 1 (with data/evidence)
- Finding 2 (with data/evidence)
- Finding 3 (with data/evidence)

## Deep Analysis
Detailed examination of trends, challenges, and opportunities.

## Future Outlook
Predictions and implications for stakeholders.

## Conclusion
Actionable insights and recommendations.

---
*Sources: [List the sources used]*

GUIDELINES:
- Use professional business language
- Include specific data points and statistics from search results
- Be objective and balanced
- Cite sources naturally in text
- Keep total length 800-1200 words
"""
        )
        
        self.chain = self.prompt | self.llm | StrOutputParser()
    
    async def generate_report(self, topic: str) -> Dict[str, Any]:
        """
        Generate a research report
        
        Returns:
            Dict with 'report' (str), 'sources' (list), 'status' (str)
        """
        try:
            # Step 1: Search
            print(f"🔎 Searching: {topic}")
            search_results = self.search_tool.invoke(topic)
            
            if not search_results:
                return {
                    "status": "error",
                    "report": "No search results found. Try a different topic.",
                    "sources": []
                }
            
            # Step 2: Format context
            context = "\n\n".join([
                f"Source {i+1}: {r.get('content', 'N/A')}\nURL: {r.get('url', 'N/A')}"
                for i, r in enumerate(search_results)
            ])
            
            # Step 3: Generate report
            print("✍️ Generating report...")
            report = self.chain.invoke({
                "topic": topic,
                "context": context
            })
            
            # Extract source URLs
            sources = [r.get('url') for r in search_results if r.get('url')]
            
            return {
                "status": "success",
                "report": report,
                "sources": sources
            }
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return {
                "status": "error",
                "report": f"Generation failed: {str(e)}",
                "sources": []
            }


# Global agent instance (initialized on startup)
_agent_instance = None

def get_agent() -> ResearchAgent:
    """Get or create the agent singleton"""
    global _agent_instance
    if _agent_instance is None:
        google_key = os.getenv("GOOGLE_API_KEY")
        tavily_key = os.getenv("TAVILY_API_KEY")
        
        if not google_key or not tavily_key:
            raise ValueError("Missing API keys in environment")
        
        _agent_instance = ResearchAgent(google_key, tavily_key)
    
    return _agent_instance