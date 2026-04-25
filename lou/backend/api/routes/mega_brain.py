from __future__ import annotations

from fastapi import APIRouter, Query
from sqlmodel import Session, select

from backend.api.routes.playbooks import _build_playbook_brain
from backend.core.database import engine
from backend.core.schema import (
    BrainEdgeView,
    MegaBrainEntry,
    MegaBrainIslandView,
    MegaBrainModuleView,
    MegaBrainSearchResult,
    MegaBrainView,
    Playbook,
    PlaybookStatus,
)
from backend.services.vector_store import search_mega_brain

router = APIRouter(prefix="/api/mega-brain", tags=["mega-brain"])


@router.get("", response_model=MegaBrainView)
async def get_mega_brain() -> MegaBrainView:
    """Return company brain as islands of published playbook mini brains."""

    with Session(engine) as session:
        playbooks = session.exec(
            select(Playbook)
            .where(Playbook.status == PlaybookStatus.PUBLISHED)
            .order_by(Playbook.updated_at.desc())
        ).all()

    islands: list[MegaBrainIslandView] = []
    modules: list[MegaBrainModuleView] = []
    all_nodes = []
    all_edges: list[BrainEdgeView] = []
    for playbook in playbooks:
        brain = _build_playbook_brain(playbook.playbook_id)
        island_nodes = [
            node.model_copy(update={"id": f"{playbook.playbook_id}:{node.id}", "island_id": playbook.playbook_id})
            for node in brain.nodes
        ]
        island_edges = [
            edge.model_copy(update={
                "source": f"{playbook.playbook_id}:{edge.source}",
                "target": f"{playbook.playbook_id}:{edge.target}",
                "edge_scope": "island",
            })
            for edge in brain.edges
        ]
        islands.append(MegaBrainIslandView(
            playbook_id=playbook.playbook_id,
            playbook_version=playbook.version,
            name=playbook.name,
            owner=playbook.owner,
            nodes=island_nodes,
            edges=island_edges,
        ))
        modules.append(MegaBrainModuleView(
            playbook_id=playbook.playbook_id,
            playbook_version=playbook.version,
            name=playbook.name,
            owner=playbook.owner,
            topics=[node.label for node in island_nodes],
            node_count=len(island_nodes),
        ))
        all_nodes.extend(island_nodes)
        all_edges.extend(island_edges)

    all_edges.extend(_cross_island_edges(islands))
    return MegaBrainView(
        modules=modules,
        islands=islands,
        nodes=all_nodes,
        edges=all_edges,
    )


@router.get("/search", response_model=list[MegaBrainSearchResult])
async def search(q: str = Query(..., min_length=2)) -> list[MegaBrainSearchResult]:
    results = search_mega_brain(q, n_results=8)
    output: list[MegaBrainSearchResult] = []
    for item in results:
        metadata = item["metadata"]
        output.append(MegaBrainSearchResult(
            playbook_id=str(metadata.get("playbook_id", "")),
            playbook_version=int(metadata.get("playbook_version", 1)),
            clause_id=str(metadata.get("clause_id", "")),
            topic=str(metadata.get("topic", "")),
            document=item["document"],
            similarity=float(item["similarity"]),
        ))
    return output


_TOPIC_CLUSTERS: dict[str, set[str]] = {
    "liability": {"liability", "damages", "cap", "unlimited", "indemnif", "loss", "consequential", "direct"},
    "confidentiality": {"confidential", "disclosure", "secret", "nda", "information", "proprietary"},
    "ip": {"ip", "intellectual", "property", "patent", "copyright", "trademark", "ownership", "know-how", "license"},
    "term": {"term", "duration", "period", "survival", "survive", "perpetual", "expir"},
    "law": {"governing", "law", "jurisdiction", "dispute", "arbitration", "litigation", "forum"},
    "return": {"return", "destroy", "destruction", "copies", "deletion", "erase"},
    "audit": {"audit", "inspection", "verify", "compliance", "record", "access"},
    "security": {"security", "encrypt", "protection", "breach", "iso", "soc", "technical"},
    "subcontractor": {"subcontract", "subprocessor", "third party", "supplier", "affiliate"},
    "termination": {"terminat", "cancel", "exit", "wind", "consequence"},
    "penalty": {"penalty", "liquidated", "contractual", "fine", "sanction"},
    "publication": {"publish", "academic", "disclosure", "announce", "paper"},
    "scope": {"scope", "purpose", "field", "use", "grant", "license"},
    "payment": {"payment", "royalt", "fee", "consideration", "invoice"},
}


def _topic_cluster(label: str) -> set[str]:
    label_lower = label.lower()
    clusters: set[str] = set()
    for cluster, keywords in _TOPIC_CLUSTERS.items():
        if any(kw in label_lower for kw in keywords):
            clusters.add(cluster)
    return clusters


def _cross_island_edges(islands: list[MegaBrainIslandView]) -> list[BrainEdgeView]:
    """Create semantically meaningful links between conceptually related clause nodes across islands."""
    edges: list[BrainEdgeView] = []
    for left_index, left in enumerate(islands):
        for right in islands[left_index + 1:]:
            # Only connect clause-type nodes to avoid visual noise from hierarchy children
            left_clauses = [n for n in left.nodes if n.node_type == "clause"]
            right_clauses = [n for n in right.nodes if n.node_type == "clause"]

            best: list[tuple[str, str, float, str]] = []
            for ln in left_clauses:
                lc = _topic_cluster(ln.label)
                if not lc:
                    continue
                for rn in right_clauses:
                    rc = _topic_cluster(rn.label)
                    shared = lc & rc
                    if shared:
                        # Score = Jaccard on clusters, boosted by number of shared clusters
                        score = len(shared) / len(lc | rc) + len(shared) * 0.08
                        best.append((ln.id, rn.id, min(score, 1.0), list(shared)[0]))

            # Take top-3 edges per island pair to avoid visual noise
            best.sort(key=lambda x: x[2], reverse=True)
            seen_left: set[str] = set()
            seen_right: set[str] = set()
            for lnid, rnid, score, cluster in best:
                if lnid in seen_left or rnid in seen_right:
                    continue
                edges.append(BrainEdgeView(
                    source=lnid,
                    target=rnid,
                    similarity=round(score, 4),
                    relationship=f"cross_concept:{cluster}",
                    edge_scope="cross_island",
                ))
                seen_left.add(lnid)
                seen_right.add(rnid)
                if len([e for e in edges if e.source.startswith(left.playbook_id) or e.target.startswith(left.playbook_id)]) >= 6:
                    break
    return edges
