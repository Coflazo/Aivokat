from fastapi import APIRouter
from backend.core.schema import ChatRequest, ChatResponse
from backend.services.rag import answer_question

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return await answer_question(
        question=request.message,
        history=request.history,
        n_rules=5,
    )
