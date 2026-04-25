from fastapi import APIRouter
from fastapi.responses import Response
from sqlmodel import Session, select

from backend.core.database import engine
from backend.core.schema import Rule, Commit
from backend.services.exporter import generate_excel

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/excel")
async def export_excel():
    with Session(engine) as session:
        rules = session.exec(select(Rule).where(Rule.is_active == True)).all()
        commits = session.exec(select(Commit)).all()

    data = generate_excel(list(rules), list(commits))
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=lou_playbook_export.xlsx"},
    )
