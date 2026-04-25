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


class RuleType(str, Enum):
    STANDARD = "standard"
    FALLBACK = "fallback"
    RED_LINE = "red_line"
    ESCALATION = "escalation"


class PlaybookStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ClauseAnalysisStatus(str, Enum):
    CLEAN = "clean"
    WARNING = "warning"
    ISSUE = "issue"


class IssueSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class PlaybookIssueType(str, Enum):
    HIERARCHY_INVERSION = "hierarchy_inversion"
    VAGUE_RED_LINE = "vague_red_line"
    MISSING_ESCALATION = "missing_escalation"
    DUPLICATE_POSITION = "duplicate_position"
    FALLBACK_TOO_STRICT = "fallback_too_strict"
    RED_LINE_TOO_SOFT = "red_line_too_soft"
    UNCLEAR_BUSINESS_LANGUAGE = "unclear_business_language"


class Rule(SQLModel, table=True):
    id: Optional[int] = SQLField(default=None, primary_key=True)
    rule_id: str = SQLField(unique=True, index=True)
    topic: str
    category: str
    rule_type: RuleType = RuleType.STANDARD
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


# ── Playbook API Engine tables ────────────────────────────────────────────────

class Playbook(SQLModel, table=True):
    """Primary playbook object for the pivot product.

    A Playbook is a governed API module. It starts as a draft uploaded by a
    lawyer, becomes published only through an explicit commit, and can later be
    indexed into the company mega brain.
    """

    id: Optional[int] = SQLField(default=None, primary_key=True)
    playbook_id: str = SQLField(unique=True, index=True)
    name: str
    description: str = ""
    owner: str
    status: PlaybookStatus = PlaybookStatus.DRAFT
    version: int = 1
    source_filename: str
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None


class PlaybookClause(SQLModel, table=True):
    """One structured row from a playbook spreadsheet."""

    id: Optional[int] = SQLField(default=None, primary_key=True)
    playbook_id: str = SQLField(index=True)
    clause_id: str = SQLField(index=True)
    clause_number: str
    clause_name: str
    why_it_matters: str = ""
    preferred_position: str = ""
    fallback_1: Optional[str] = None
    fallback_2: Optional[str] = None
    red_line: Optional[str] = None
    escalation_trigger: Optional[str] = None
    rewritten_fields: str = "{}"  # JSON object keyed by field name
    analysis_status: ClauseAnalysisStatus = ClauseAnalysisStatus.CLEAN
    analysis_summary: Optional[str] = None
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)

    def rewritten_fields_dict(self) -> dict:
        return json.loads(self.rewritten_fields or "{}")


class PlaybookIssue(SQLModel, table=True):
    """A proposed logic/business-language issue found in a draft playbook."""

    id: Optional[int] = SQLField(default=None, primary_key=True)
    playbook_id: str = SQLField(index=True)
    clause_id: str = SQLField(index=True)
    field_name: str
    severity: IssueSeverity
    issue_type: PlaybookIssueType
    explanation: str
    proposed_fix: Optional[str] = None
    accepted: bool = False
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None


class PlaybookCommit(SQLModel, table=True):
    """Immutable publish/change record for a playbook API version."""

    id: Optional[int] = SQLField(default=None, primary_key=True)
    playbook_id: str = SQLField(index=True)
    version: int
    commit_hash: str = SQLField(unique=True, index=True)
    comment: str
    committed_by: str
    committed_at: datetime = SQLField(default_factory=datetime.utcnow)
    diff_json: str = "{}"

    def diff(self) -> dict:
        return json.loads(self.diff_json or "{}")


class MegaBrainEntry(SQLModel, table=True):
    """Vector index/provenance entry for a published playbook clause."""

    id: Optional[int] = SQLField(default=None, primary_key=True)
    playbook_id: str = SQLField(index=True)
    playbook_version: int
    topic: str = SQLField(index=True)
    vector_id: str = SQLField(index=True)
    metadata_json: str = "{}"
    created_at: datetime = SQLField(default_factory=datetime.utcnow)

    def metadata_dict(self) -> dict:
        return json.loads(self.metadata_json or "{}")


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
    retrieved_rules: list[str] = Field(default_factory=list)


class PlaybookIssueView(BaseModel):
    id: Optional[int] = None
    clause_id: str
    field_name: str
    severity: IssueSeverity
    issue_type: PlaybookIssueType
    explanation: str
    proposed_fix: Optional[str] = None
    accepted: bool = False
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None


class PlaybookClauseView(BaseModel):
    clause_id: str
    clause_number: str
    clause_name: str
    why_it_matters: str = ""
    preferred_position: str = ""
    fallback_1: Optional[str] = None
    fallback_2: Optional[str] = None
    red_line: Optional[str] = None
    escalation_trigger: Optional[str] = None
    rewritten_fields: dict = Field(default_factory=dict)
    analysis_status: ClauseAnalysisStatus = ClauseAnalysisStatus.CLEAN
    analysis_summary: Optional[str] = None
    issues: list[PlaybookIssueView] = Field(default_factory=list)


class PlaybookApiView(BaseModel):
    playbook_id: str
    name: str
    description: str = ""
    owner: str
    version: int
    status: PlaybookStatus
    source_filename: str
    created_at: str
    updated_at: str
    published_at: Optional[str] = None
    clauses: list[PlaybookClauseView]


class PlaybookUploadResponse(BaseModel):
    playbook: PlaybookApiView
    clauses_created: int


class PlaybookClausePatch(BaseModel):
    field_name: str
    value: str
    edited_by: str = "Anonymous"


class PlaybookClausePatchResponse(BaseModel):
    playbook: PlaybookApiView
    updated_clause: PlaybookClauseView
    draft_diff: dict


class SegmentedClause(BaseModel):
    clause_id: str
    heading: Optional[str] = None
    text: str
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    boundary_confidence: float = Field(ge=0.0, le=1.0)
    boundary_reason: str
    extraction_method: str


class SegmentedContract(BaseModel):
    source_filename: str
    clauses: list[SegmentedClause]
    segmentation_summary: str
    low_confidence_count: int = 0


class GraphNode(BaseModel):
    id: str
    label: str
    topic: str
    category: str
    rule_type: RuleType = RuleType.STANDARD
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
    lifecycle: str = "active"  # "active" | "staged" | "approved"


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
