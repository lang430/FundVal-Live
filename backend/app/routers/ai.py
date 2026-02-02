from fastapi import APIRouter, Body
from typing import List, Dict, Any
from ..services.ai import ai_service

router = APIRouter()

@router.post("/ai/analyze_fund")
async def analyze_fund(fund_info: Dict[str, Any] = Body(...)):
    return await ai_service.analyze_fund(fund_info)

