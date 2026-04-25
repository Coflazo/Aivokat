from fastapi import APIRouter

router = APIRouter(prefix="/api/mega-brain", tags=["mega-brain"])


@router.get("/_phase")
async def phase_marker() -> dict[str, str]:
    return {"module": "mega_brain", "status": "scaffolded"}
