from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
import json
from pydantic import BaseModel, Field
from sqlmodel import SQLModel, Field as SQLField


class ChangeType(str, Enum):
    INITIAL = "initial"
    CONFIRMS = "confirms"
    CONTRADICTS = "contradicts"
    EXTENDS = "extends"
    NEW_RULE = "new_rule"
    MANUAL = "manual"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Rule(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    rule_id: str = SQLField(unique=True, index=True)
    topic: str
    category: str
    standard_position: str
    fallback_position: Optional[str] = None
    red_line: Optional[str] = None
    reasoning: str
    suggested_language: Optional[str] = None
    decision_logic: Optional[str] = None
    sources: str = "[]"           # JSON list of source doc names
    confidence: float = 1.0
    version: int = 1
    committed_by: str = "Seed"
    committed_at: datetime = SQLField(default_factory=datetime.utcnow)
    is_active: bool = True
    chroma_id: Optional[str] = None

    def sources_list(self) -> list[str]:
        return json.loads(self.sources)


class Commit(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    commit_hash: str = SQLField(unique=True, index=True)
    rule_id: str = SQLField(index=True)
    topic: str = ""               # denormalized for query speed
    change_type: ChangeType
    old_value: Optional[str] = None
    new_value: str
    source_document: Optional[str] = None
    source_clause: Optional[str] = None
    lawyer_note: Optional[str] = None
    committed_by: str
    committed_at: datetime = SQLField(default_factory=datetime.utcnow)
    approval_status: ApprovalStatus = ApprovalStatus.APPROVED


class ProposedCommit(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    rule_id: str = SQLField(index=True)
    topic: str = ""
    change_type: ChangeType
    existing_rule_snapshot: Optional[str] = None
    proposed_change: str
    source_document: str
    source_clause: str
    cosine_similarity: float
    ai_reasoning: str
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    lawyer_note: Optional[str] = None
    created_at: datetime = SQLField(default_factory=datetime.utcnow)


# ── API models ────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    lawyer_name: str = "Anonymous"


class SourceCitation(BaseModel):
    rule_id: str
    topic: str
    excerpt: str
    confidence: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]


class GraphNode(BaseModel):
    id: str
    label: str
    topic: str
    category: str
    confidence: float
    version: int
    committed_by: str
    committed_at: str
    standard_position: str
    fallback_position: Optional[str] = None
    red_line: Optional[str] = None
    reasoning: str
    decision_logic: Optional[str] = None
    sources: list[str]
    lifecycle: str  # "active" | "staged" | "approved"


class GraphEdge(BaseModel):
    source: str
    target: str
    similarity: float


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ApprovalRequest(BaseModel):
    decision: ApprovalStatus       # only APPROVED or REJECTED accepted
    lawyer_name: str
    lawyer_note: Optional[str] = None
    proposed_text: Optional[str] = None   # lawyer may edit text before approving
