import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from backend.core.config import settings
from backend.services.evolution import process_new_contract

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


@router.post("/upload")
async def upload_contract(
    file: UploadFile = File(...),
    lawyer_name: str = Form("Anonymous"),
):
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = file.filename.replace(" ", "_")
    dest = os.path.join(settings.upload_dir, safe_name)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        proposed = await process_new_contract(dest, safe_name, lawyer_name)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Contract processing error: {e}")

    return {
        "proposed_commits": len(proposed),
        "items": [p.model_dump() for p in proposed],
    }
