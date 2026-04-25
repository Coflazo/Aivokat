from fastapi import APIRouter

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])


@router.get("/_phase")
async def phase_marker() -> dict[str, str]:
    return {"module": "playbooks", "status": "scaffolded"}
