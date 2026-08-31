from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextswitch.team_reconciliation import (
    reconcile_team_entry,
)

from contextswitch.storage import (
    update_project_state,
    save_conflict,
)
from contextswitch.connectors.github import (
    get_initial_project_evidence,
)

from contextswitch.initial_context import (
    build_initial_state,
)

from contextswitch.storage import (
    create_team,
    create_project,
    get_project,
    add_member,
    get_members,
    add_entry,
    get_entries,
    get_conflicts,
    resolve_conflict,
    save_snapshot,
    save_github_evidence_batch,
)


app = FastAPI(
    title="ContextSwitch API",
    version="0.2.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class TeamCreateRequest(BaseModel):
    team_id: str
    name: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    team_id: str
    project_id: str
    name: str

    github_owner: Optional[str] = None
    github_repo: Optional[str] = None

    creator_worker_id: str


class MemberAddRequest(BaseModel):
    worker_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "member"


class EntryCreateRequest(BaseModel):
    worker_id: str

    # Examples:
    # decision
    # completed
    # blocker
    # note
    # failure
    entry_type: str

    content: str

    # Example:
    # cli
    # cursor
    # claude
    # antigravity
    # web
    source: str = "cli"

    metadata: Optional[dict] = None


class ConflictResolveRequest(BaseModel):
    resolution: str
    resolved_by: str


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    return {
        "status": "ContextSwitch backend running",
        "version": "0.2.0",
        "mode": "team-shared-memory",
    }


# ============================================================
# CREATE TEAM
# ============================================================

@app.post("/teams")
async def create_team_endpoint(
    request: TeamCreateRequest,
):
    try:

        team_id = create_team(
            team_id=request.team_id,
            name=request.name,
        )

        return {
            "team_id": team_id,
            "name": (
                request.name
                or request.team_id
            ),
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create team: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# CREATE PROJECT
# ============================================================

@app.post("/projects")
async def create_project_endpoint(
    request: ProjectCreateRequest,
):
    """
    Create a new shared ContextSwitch project.

    If GitHub details are provided:

    1. Read repository evidence
    2. Ask Gemini to build initial project state
    3. Save GitHub evidence
    4. Create shared project
    5. Add creator as first member
    6. Save initial snapshot
    """

    try:

        # ----------------------------------------------------
        # 1. Default empty project state
        # ----------------------------------------------------

        state_dict = {
            "goal": "",
            "progress": [],
            "decisions": [],
            "failures": [],
            "blockers": [],
            "open_questions": [],
            "dependencies": [],
            "next_actions": [],
        }

        evidence = []

        # ----------------------------------------------------
        # 2. Build initial state from GitHub if connected
        # ----------------------------------------------------

        if (
            request.github_owner
            and request.github_repo
        ):

            evidence = (
                get_initial_project_evidence(
                    owner=request.github_owner,
                    repo=request.github_repo,
                )
            )

            state = await build_initial_state(
                evidence
            )

            state_dict = state.model_dump()

        # ----------------------------------------------------
        # 3. Create project
        # ----------------------------------------------------

        project_id = create_project(
            team_id=request.team_id,
            project_id=request.project_id,
            name=request.name,
            github_owner=request.github_owner,
            github_repo=request.github_repo,
            state=state_dict,
        )

        # ----------------------------------------------------
        # 4. Add project creator as first member
        # ----------------------------------------------------

        add_member(
            team_id=request.team_id,
            project_id=request.project_id,
            worker_id=request.creator_worker_id,
            name=request.creator_worker_id,
        )

        # ----------------------------------------------------
        # 5. Save GitHub evidence
        # ----------------------------------------------------

        if evidence:

            save_github_evidence_batch(
                team_id=request.team_id,
                project_id=request.project_id,
                evidence_items=evidence,
            )

        # ----------------------------------------------------
        # 6. Save initial project snapshot
        # ----------------------------------------------------

        save_snapshot(
            team_id=request.team_id,
            project_id=request.project_id,
            state=state_dict,
            snapshot_type="initial",
        )

        # ----------------------------------------------------
        # 7. Response
        # ----------------------------------------------------

        return {
            "project": {
                "team_id": request.team_id,
                "project_id": project_id,
                "name": request.name,
                "github": (
                    f"{request.github_owner}/"
                    f"{request.github_repo}"
                    if (
                        request.github_owner
                        and request.github_repo
                    )
                    else None
                ),
            },
            "creator": (
                request.creator_worker_id
            ),
            "evidence_count": len(evidence),
            "state": state_dict,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create project: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# GET PROJECT
# ============================================================

@app.get(
    "/teams/{team_id}/projects/{project_id}"
)
async def get_project_endpoint(
    team_id: str,
    project_id: str,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    members = get_members(
        team_id=team_id,
        project_id=project_id,
    )

    conflicts = get_conflicts(
        team_id=team_id,
        project_id=project_id,
        only_unresolved=True,
    )

    return {
        "project": project,
        "members": members,
        "active_conflicts": conflicts,
    }


# ============================================================
# ADD MEMBER
# ============================================================

@app.post(
    "/teams/{team_id}/projects/{project_id}/members"
)
async def add_member_endpoint(
    team_id: str,
    project_id: str,
    request: MemberAddRequest,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    try:

        worker_id = add_member(
            team_id=team_id,
            project_id=project_id,
            worker_id=request.worker_id,
            name=request.name,
            email=request.email,
            role=request.role or "member",
        )

        return {
            "message": "Member added",
            "worker_id": worker_id,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to add member: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# GET MEMBERS
# ============================================================

@app.get(
    "/teams/{team_id}/projects/{project_id}/members"
)
async def get_members_endpoint(
    team_id: str,
    project_id: str,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    members = get_members(
        team_id=team_id,
        project_id=project_id,
    )

    return {
        "members": members,
    }


# ============================================================
# ADD PROJECT ENTRY
# ============================================================

@app.post(
    "/teams/{team_id}/projects/{project_id}/entries"
)
async def add_project_entry_endpoint(
    team_id: str,
    project_id: str,
    request: EntryCreateRequest,
):
    """
    Main shared-memory ingestion endpoint.

    Flow:

    teammate entry
        ↓
    save raw entry
        ↓
    Gemini reconciliation
        ↓
    update shared project state
        ↓
    detect/save conflict
        ↓
    snapshot
    """

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    try:

        # ====================================================
        # 1. Ensure worker exists
        # ====================================================

        add_member(
            team_id=team_id,
            project_id=project_id,
            worker_id=request.worker_id,
            name=request.worker_id,
        )

        # ====================================================
        # 2. Save raw entry
        # ====================================================

        entry_id = add_entry(
            team_id=team_id,
            project_id=project_id,
            worker_id=request.worker_id,
            entry_type=request.entry_type,
            content=request.content,
            source=request.source,
            metadata=request.metadata,
        )

        # ====================================================
        # 3. Build new entry object for Gemini
        # ====================================================

        new_entry = {
            "entry_id": entry_id,
            "worker_id": request.worker_id,
            "type": request.entry_type,
            "content": request.content,
            "source": request.source,
            "metadata": (
                request.metadata or {}
            ),
        }

        # ====================================================
        # 4. Get recent project history
        #
        # We exclude the newest entry because Gemini already
        # receives it separately as new_entry.
        # ====================================================

        recent_entries = get_entries(
            team_id=team_id,
            project_id=project_id,
            limit=30,
        )

        recent_entries = [
            entry
            for entry in recent_entries
            if entry.get("id") != entry_id
            and entry.get("entry_id") != entry_id
        ]

        # ====================================================
        # 5. Current shared state
        # ====================================================

        current_state = (
            project.get(
                "current_state",
                {},
            )
            or {}
        )

        # ====================================================
        # 6. Gemini team reconciliation
        # ====================================================

        result = await reconcile_team_entry(
            current_state=current_state,
            new_entry=new_entry,
            recent_entries=recent_entries,
        )

        updated_state = result[
            "updated_state"
        ]

        conflict = result.get(
            "conflict"
        )

        # ====================================================
        # 7. Update shared state
        # ====================================================

        update_project_state(
            team_id=team_id,
            project_id=project_id,
            state=updated_state,
        )

        # ====================================================
        # 8. Save conflict if Gemini found one
        # ====================================================

        conflict_id = None

        if conflict:

            conflict_id = save_conflict(
                team_id=team_id,
                project_id=project_id,
                topic=conflict[
                    "topic"
                ],
                side_a=conflict[
                    "side_a"
                ],
                side_b=conflict[
                    "side_b"
                ],
                status="unresolved",
            )

        # ====================================================
        # 9. Save project snapshot
        # ====================================================

        save_snapshot(
            team_id=team_id,
            project_id=project_id,
            state=updated_state,
            snapshot_type="team_entry",
        )

        # ====================================================
        # 10. Response
        # ====================================================

        return {
            "message": "Entry logged and merged",
            "entry_id": entry_id,

            "team_id": team_id,
            "project_id": project_id,

            "worker_id": (
                request.worker_id
            ),

            "type": (
                request.entry_type
            ),

            "updated_state": (
                updated_state
            ),

            "conflict_detected": (
                conflict is not None
            ),

            "conflict_id": (
                conflict_id
            ),

            "conflict": conflict,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Gemini reconciliation failed: "
                f"{str(exc)}"
            ),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to process team entry: "
                f"{str(exc)}"
            ),
        )

# ============================================================
# GET PROJECT ENTRIES
# ============================================================

@app.get(
    "/teams/{team_id}/projects/{project_id}/entries"
)
async def get_project_entries_endpoint(
    team_id: str,
    project_id: str,
    limit: int = 100,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    entries = get_entries(
        team_id=team_id,
        project_id=project_id,
        limit=limit,
    )

    return {
        "entries": entries,
        "count": len(entries),
    }


# ============================================================
# GET CONFLICTS
# ============================================================

@app.get(
    "/teams/{team_id}/projects/{project_id}/conflicts"
)
async def get_project_conflicts_endpoint(
    team_id: str,
    project_id: str,
    unresolved_only: bool = False,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    conflicts = get_conflicts(
        team_id=team_id,
        project_id=project_id,
        only_unresolved=unresolved_only,
    )

    return {
        "conflicts": conflicts,
        "count": len(conflicts),
    }


# ============================================================
# RESOLVE CONFLICT
# ============================================================

@app.post(
    "/teams/{team_id}/projects/"
    "{project_id}/conflicts/{conflict_id}/resolve"
)
async def resolve_project_conflict_endpoint(
    team_id: str,
    project_id: str,
    conflict_id: str,
    request: ConflictResolveRequest,
):

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    try:

        resolve_conflict(
            team_id=team_id,
            project_id=project_id,
            conflict_id=conflict_id,
            resolution=request.resolution,
            resolved_by=request.resolved_by,
        )

        # Update persisted project current_state with resolved decision
        current_state = project.get("current_state", {})
        decisions = current_state.get("decisions", [])
        res_decision = f"[Resolved Decision] {request.resolution} (Resolved by {request.resolved_by})"
        if res_decision not in decisions:
            decisions.append(res_decision)
            current_state["decisions"] = decisions
            update_project_state(team_id=team_id, project_id=project_id, state=current_state)

        # ----------------------------------------------------
        # Also save the resolution as project history.
        # ----------------------------------------------------

        entry_id = add_entry(
            team_id=team_id,
            project_id=project_id,
            worker_id=request.resolved_by,
            entry_type="conflict_resolution",
            content=request.resolution,
            source="web",
            metadata={
                "conflict_id": conflict_id,
            },
        )

        return {
            "message": "Conflict resolved",
            "conflict_id": conflict_id,
            "resolution_entry_id": entry_id,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to resolve conflict: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# EXPORT PROJECT CONTEXT
# ============================================================

@app.get(
    "/teams/{team_id}/projects/{project_id}/export"
)
async def export_project_context(
    team_id: str,
    project_id: str,
):
    """
    This is what the future:

        cs export

    command will call.
    """

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    state = project.get(
        "current_state",
        {},
    )

    members = get_members(
        team_id=team_id,
        project_id=project_id,
    )

    conflicts = get_conflicts(
        team_id=team_id,
        project_id=project_id,
        only_unresolved=True,
    )

    return {
        "team_id": team_id,
        "project_id": project_id,
        "project_name": project.get(
            "name"
        ),
        "state": state,
        "members": members,
        "active_conflicts": conflicts,
    }


# ============================================================
# SYNC GITHUB EVIDENCE
# ============================================================

@app.post(
    "/teams/{team_id}/projects/{project_id}/sync-github"
)
async def sync_github_endpoint(
    team_id: str,
    project_id: str,
):
    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    owner = project.get("github_owner")
    repo = project.get("github_repo")

    if not owner or not repo:
        raise HTTPException(
            status_code=400,
            detail="No GitHub repository associated with this project",
        )

    try:
        evidence = get_initial_project_evidence(
            owner=owner,
            repo=repo,
        )

        if evidence:
            save_github_evidence_batch(
                team_id=team_id,
                project_id=project_id,
                evidence_items=evidence,
            )

            current_state = project.get("current_state", {})
            result = await reconcile_team_entry(
                current_state=current_state,
                new_entry={
                    "entry_id": "github_sync",
                    "worker_id": "github_sync",
                    "type": "github_sync",
                    "content": f"GitHub sync fetched {len(evidence)} evidence items from {owner}/{repo}",
                    "source": "github",
                },
                recent_entries=[],
            )

            updated_state = result["updated_state"]
            update_project_state(
                team_id=team_id,
                project_id=project_id,
                state=updated_state,
            )

        return {
            "message": "GitHub synced successfully",
            "evidence_count": len(evidence),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"GitHub sync failed: {str(exc)}",
        )