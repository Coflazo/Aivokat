import json
from fastapi import APIRouter
from sqlmodel import Session, select

from backend.core.database import engine
from backend.core.schema import ApprovalStatus, GraphData, GraphNode, GraphEdge, ProposedCommit, Rule
from backend.services.vector_store import get_all_rules, compute_all_similarities

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("", response_model=GraphData)
async def get_graph() -> GraphData:
    chroma_rules = get_all_rules()

    with Session(engine) as session:
        db_rules = {r.rule_id: r for r in session.exec(select(Rule).where(Rule.is_active == True)).all()}
        pending_rule_ids = set(session.exec(
            select(ProposedCommit.rule_id).where(ProposedCommit.approval_status == ApprovalStatus.PENDING)
        ).all())
        approved_rule_ids = set(session.exec(
            select(ProposedCommit.rule_id).where(ProposedCommit.approval_status == ApprovalStatus.APPROVED)
        ).all())

    nodes: list[GraphNode] = []
    for r in chroma_rules:
        rule_id = r["rule_id"]
        db_rule = db_rules.get(rule_id)

        sources = r.get("sources", [])
        if isinstance(sources, str):
            sources = json.loads(sources)
        lifecycle = "active"
        if rule_id in pending_rule_ids:
            lifecycle = "staged"
        elif rule_id in approved_rule_ids:
            lifecycle = "approved"

        nodes.append(GraphNode(
            id=rule_id,
            label=r["topic"],
            topic=r["topic"],
            category=r["category"],
            rule_type=r["rule_type"],
            confidence=r.get("confidence", 1.0),
            version=db_rule.version if db_rule else r.get("version", 1),
            committed_by=r.get("committed_by", ""),
            committed_at=r.get("committed_at", ""),
            standard_position=r["standard_position"],
            fallback_position=db_rule.fallback_position if db_rule else r.get("fallback_position"),
            red_line=db_rule.red_line if db_rule else r.get("red_line"),
            reasoning=db_rule.reasoning if db_rule else r.get("reasoning", ""),
            decision_logic=db_rule.decision_logic if db_rule else r.get("decision_logic"),
            sources=sources,
            lifecycle=lifecycle,
        ))

    sim_pairs = compute_all_similarities(threshold=0.35)
    edges = [GraphEdge(source=a, target=b, similarity=s) for a, b, s in sim_pairs]

    return GraphData(nodes=nodes, edges=edges)
