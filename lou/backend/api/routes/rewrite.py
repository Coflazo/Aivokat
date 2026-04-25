from fastapi import APIRouter

router = APIRouter(prefix="/api/rewrite", tags=["rewrite"])


@router.get("/_phase")
async def phase_marker() -> dict[str, str]:
    return {"module": "rewrite", "status": "scaffolded"}
