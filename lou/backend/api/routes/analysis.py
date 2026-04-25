from fastapi import APIRouter

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/_phase")
async def phase_marker() -> dict[str, str]:
    return {"module": "analysis", "status": "scaffolded"}
