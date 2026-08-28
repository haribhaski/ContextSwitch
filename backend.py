from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contextswitch.connectors.github import get_initial_project_evidence
from contextswitch.initial_context import build_initial_state
from contextswitch.storage import (
    create_workspace as save_workspace,
    save_snapshot,
)

from fastapi import HTTPException

from contextswitch.storage import (
    get_workspace,
    save_snapshot,
)

from contextswitch.connectors.github import (
    get_commits_since,
    normalize_commits,
)

from contextswitch.reconciliation import reconcile_state

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class WorkspaceCreateRequest(BaseModel):
    name: str
    github_owner: str
    github_repo: str


@app.get("/")
async def root():
    return {
        "status": "ContextSwitch backend running"
    }


@app.post("/workspaces")
async def create_workspace(
    request: WorkspaceCreateRequest
):

    evidence = get_initial_project_evidence(
        request.github_owner,
        request.github_repo
    )

    state = await build_initial_state(
        evidence
    )

    state_dict = state.model_dump()

    workspace_id = save_workspace(
        name=request.name,
        github_owner=request.github_owner,
        github_repo=request.github_repo,
        state=state_dict,
    )

    save_snapshot(
        workspace_id=workspace_id,
        state=state_dict,
        snapshot_type="initial",
    )

    return {
        "workspace": {
            "id": workspace_id,
            "name": request.name,
            "github": (
                f"{request.github_owner}/"
                f"{request.github_repo}"
            )
        },
        "state": state_dict
    }
    
@app.post("/workspaces/{workspace_id}/resume")
async def resume_workspace(workspace_id: str):

    workspace = get_workspace(workspace_id)

    if not workspace:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found"
        )

    last_snapshot_at = workspace["last_snapshot_at"]

    since_iso = last_snapshot_at.isoformat()

    commits = get_commits_since(
        owner=workspace["github_owner"],
        repo=workspace["github_repo"],
        since_iso=since_iso,
    )

    evidence = normalize_commits(commits)

    # No new activity
    if not evidence:
        return {
            "workspace_id": workspace_id,
            "new_evidence_count": 0,
            "message": "No new GitHub activity since your last snapshot.",
            "state": workspace["current_state"],
        }

    result = await reconcile_state(
        previous_state=workspace["current_state"],
        new_evidence=evidence,
    )

    new_state = result.current_state.model_dump()

    save_snapshot(
        workspace_id=workspace_id,
        state=new_state,
        snapshot_type="resume",
    )

    return {
        "workspace_id": workspace_id,
        "new_evidence_count": len(evidence),
        "resume": result.model_dump(),
    }