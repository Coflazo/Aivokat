from fastapi import APIRouter

router = APIRouter(prefix="/api/public", tags=["public-playbook-api"])


@router.get("/_phase")
async def phase_marker() -> dict[str, str]:
    return {"module": "api_console", "status": "scaffolded"}
