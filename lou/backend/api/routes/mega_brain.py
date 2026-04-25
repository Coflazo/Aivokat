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


def _cross_island_edges(islands: list[MegaBrainIslandView]) -> list[BrainEdgeView]:
    """Create light visual links between islands without merging them."""
    edges: list[BrainEdgeView] = []
    for left_index, left in enumerate(islands):
        for right in islands[left_index + 1:]:
            matches = _matching_topics(left, right)
            for left_node, right_node, score in matches[:2]:
                edges.append(BrainEdgeView(
                    source=left_node,
                    target=right_node,
                    similarity=score,
                    relationship="cross_playbook_topic_similarity",
                    edge_scope="cross_island",
                ))
    return edges


def _matching_topics(left: MegaBrainIslandView, right: MegaBrainIslandView) -> list[tuple[str, str, float]]:
    matches: list[tuple[str, str, float]] = []
    for left_node in left.nodes:
        left_terms = set(left_node.label.lower().split())
        for right_node in right.nodes:
            right_terms = set(right_node.label.lower().split())
            if not left_terms or not right_terms:
                continue
            overlap = len(left_terms & right_terms) / len(left_terms | right_terms)
            if overlap > 0:
                matches.append((left_node.id, right_node.id, overlap))
    return sorted(matches, key=lambda item: item[2], reverse=True)
