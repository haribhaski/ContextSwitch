from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contextswitch.connectors.github import (
    get_initial_project_evidence,
    get_resume_project_evidence,
)

from contextswitch.initial_context import (
    build_initial_state,
)

from contextswitch.reconciliation import (
    reconcile_state,
)

from contextswitch.storage import (
    create_workspace as save_workspace,
    get_workspace,
    save_snapshot,
)


app = FastAPI(
    title="ContextSwitch API",
    version="0.1.0",
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

class WorkspaceCreateRequest(BaseModel):
    name: str
    github_owner: str
    github_repo: str


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    return {
        "status": "ContextSwitch backend running"
    }


# ============================================================
# CREATE WORKSPACE
# ============================================================

@app.post("/workspaces")
async def create_workspace(
    request: WorkspaceCreateRequest,
):

    try:
        # ----------------------------------------------------
        # 1. Collect rich GitHub evidence
        # ----------------------------------------------------

        evidence = get_initial_project_evidence(
            owner=request.github_owner,
            repo=request.github_repo,
        )

        # ----------------------------------------------------
        # 2. Build first project state
        # ----------------------------------------------------

        state = await build_initial_state(
            evidence
        )

        state_dict = state.model_dump()

        # ----------------------------------------------------
        # 3. Save workspace
        # ----------------------------------------------------

        workspace_id = save_workspace(
            name=request.name,
            github_owner=request.github_owner,
            github_repo=request.github_repo,
            state=state_dict,
        )

        # ----------------------------------------------------
        # 4. Save initial snapshot
        # ----------------------------------------------------

        save_snapshot(
            workspace_id=workspace_id,
            state=state_dict,
            snapshot_type="initial",
        )

        # ----------------------------------------------------
        # 5. Response
        # ----------------------------------------------------

        return {
            "workspace": {
                "id": workspace_id,
                "name": request.name,
                "github": (
                    f"{request.github_owner}/"
                    f"{request.github_repo}"
                ),
            },
            "evidence_count": len(evidence),
            "state": state_dict,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create workspace: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# RESUME WORKSPACE
# ============================================================

@app.post(
    "/workspaces/{workspace_id}/resume"
)
async def resume_workspace(
    workspace_id: str,
):

    # --------------------------------------------------------
    # 1. Load workspace
    # --------------------------------------------------------

    workspace = get_workspace(
        workspace_id
    )

    if not workspace:
        raise HTTPException(
            status_code=404,
            detail="Workspace not found",
        )

    try:
        # ----------------------------------------------------
        # 2. Determine when we last saw the project
        # ----------------------------------------------------

        last_snapshot_at = workspace[
            "last_snapshot_at"
        ]

        since_iso = (
            last_snapshot_at
            .isoformat()
        )

        # ----------------------------------------------------
        # 3. Collect NEW GitHub evidence
        # ----------------------------------------------------

        evidence = (
            get_resume_project_evidence(
                owner=workspace[
                    "github_owner"
                ],
                repo=workspace[
                    "github_repo"
                ],
                since=since_iso,
            )
        )

        # ----------------------------------------------------
        # 4. Nothing happened
        # ----------------------------------------------------

        if not evidence:
            return {
                "workspace_id": workspace_id,
                "new_evidence_count": 0,
                "message": (
                    "No new GitHub activity "
                    "since your last snapshot."
                ),
                "state": workspace[
                    "current_state"
                ],
            }

        # ----------------------------------------------------
        # 5. Reconcile old state with new evidence
        # ----------------------------------------------------

        result = await reconcile_state(
            previous_state=workspace[
                "current_state"
            ],
            new_evidence=evidence,
        )

        # ----------------------------------------------------
        # 6. Build new current state
        # ----------------------------------------------------

        new_state = (
            result.current_state
            .model_dump()
        )

        # ----------------------------------------------------
        # 7. Defensive next-action sync
        #
        # Makes sure the primary next action
        # also exists inside current_state.
        # ----------------------------------------------------

        primary_next_action = (
            result.next_action.action
        )

        if primary_next_action:

            existing_actions = (
                new_state.get(
                    "next_actions",
                    [],
                )
                or []
            )

            filtered_actions = [
                action
                for action
                in existing_actions
                if action
                != primary_next_action
            ]

            new_state[
                "next_actions"
            ] = [
                primary_next_action,
                *filtered_actions,
            ]

        # ----------------------------------------------------
        # 8. Save resume snapshot
        # ----------------------------------------------------

        save_snapshot(
            workspace_id=workspace_id,
            state=new_state,
            snapshot_type="resume",
        )

        # ----------------------------------------------------
        # 9. Response
        # ----------------------------------------------------

        return {
            "workspace_id": workspace_id,
            "new_evidence_count": (
                len(evidence)
            ),
            "resume": (
                result.model_dump()
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to resume workspace: "
                f"{str(exc)}"
            ),
        )