import os
import sys
import asyncio
import aiohttp
from dotenv import load_dotenv

load_dotenv()

# Fix Windows asyncio subprocess event loop policy for Playwright
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Patch aiohttp for google-genai SDK compatibility
if not hasattr(aiohttp, "ClientConnectorDNSError"):
    setattr(aiohttp, "ClientConnectorDNSError", getattr(aiohttp, "ClientConnectorError", Exception))

# Ensure both GEMINI_API_KEY and GOOGLE_API_KEY are set for google-genai / Google ADK
if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")
if os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("GOOGLE_API_KEY")

from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    FastAPI,
    Header,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contextswitch.team_reconciliation import (
    reconcile_team_entry,
)

from contextswitch.connectors.github import (
    get_initial_project_evidence,
)

from contextswitch.initial_context import (
    build_initial_state,
)

from contextswitch.storage import (
    # Teams
    create_team,
    get_team,
    add_team_member,
    get_team_by_member_email,
    get_team_members,

    # Projects
    create_project,
    get_project,
    get_team_projects,
    update_project_state,

    # Project members
    add_member,
    get_members,

    # Entries
    add_entry,
    get_entries,
    get_team_recent_entries,

    # Conflicts
    save_conflict,
    get_conflicts,
    resolve_conflict,

    # Snapshots / evidence
    save_snapshot,
    save_github_evidence_batch,
)

from chat_import import router as chat_import_router
# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ContextSwitch API",
    version="0.3.0",
)
app.include_router(chat_import_router)

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"http://.*:(3000|3001)",
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
    """
    IMPORTANT:

    Creator identity is intentionally NOT accepted here.

    Do not send:
        creator_worker_id
        creator_email

    The backend gets the creator from X-User-Email.
    """

    team_id: str
    project_id: str
    name: str

    github_owner: Optional[str] = None
    github_repo: Optional[str] = None


class MemberAddRequest(BaseModel):
    worker_id: Optional[str] = None
    name: Optional[str] = None
    email: str
    role: Optional[str] = "member"


class EntryCreateRequest(BaseModel):
    worker_id: str

    entry_type: str
    content: str

    source: str = "cli"

    metadata: Optional[dict] = None


class ConflictResolveRequest(BaseModel):
    resolution: str
    resolved_by: str


# ============================================================
# AUTH / IDENTITY HELPERS
# ============================================================

def normalize_email(
    email: Optional[str],
) -> str:
    if not email:
        return ""

    return (
        email
        .strip()
        .lower()
    )


def require_current_user(
    x_user_email: Optional[str],
    x_user_name: Optional[str] = None,
):
    """
    Temporary hackathon authentication bridge.

    Next.js / NextAuth sends:

        X-User-Email
        X-User-Name

    IMPORTANT:
    The frontend DOES NOT decide:
        creator_worker_id
        creator_email

    Backend derives identity here.

    Later this should be replaced with verification of
    the actual NextAuth / Google authentication token.
    """

    email = normalize_email(
        x_user_email
    )

    if not email:
        raise HTTPException(
            status_code=401,
            detail="User email is required",
        )

    name = (
        x_user_name.strip()
        if x_user_name
        and x_user_name.strip()
        else email.split("@")[0]
    )

    return {
        # For the current hackathon architecture,
        # normalized email is our stable worker ID.
        "worker_id": email,
        "email": email,
        "name": name,
    }


def user_belongs_to_team(
    team_id: str,
    email: str,
) -> bool:
    """
    Check official team membership using email.

    We deliberately compare email instead of relying only
    on worker_id so legacy Firestore members can still work.
    """

    normalized = normalize_email(
        email
    )

    members = get_team_members(
        team_id=team_id,
    )

    for member in members:

        member_email = normalize_email(
            member.get("email")
        )

        if (
            member_email
            and member_email
            == normalized
        ):
            return True

    return False


def require_team_membership(
    team_id: str,
    email: str,
):
    team = get_team(
        team_id
    )

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found",
        )

    if not user_belongs_to_team(
        team_id=team_id,
        email=email,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not a member "
                "of this team"
            ),
        )

    return team


# ============================================================
# EMPTY PROJECT STATE
# ============================================================

def empty_project_state():
    return {
        "goal": "",
        "completed": [],
        "progress": [],
        "failed": [],
        "failures": [],
        "decisions": [],
        "blockers": [],
        "open_questions": [],
        "dependencies": [],
        "next_actions": [],
        "conflicts": [],
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
async def root():
    return {
        "status":
            "ContextSwitch backend running",

        "version":
            "0.3.0",

        "mode":
            "team-shared-memory",
    }


# ============================================================
# CREATE TEAM
# ============================================================

@app.post("/teams")
async def create_team_endpoint(
    request: TeamCreateRequest,

    x_user_email: Optional[str] = Header(
        default=None,
        alias="X-User-Email",
    ),

    x_user_name: Optional[str] = Header(
        default=None,
        alias="X-User-Name",
    ),
):
    """
    Correct team creation flow:

        logged-in user
              ↓
        create team
              ↓
        automatically add logged-in user
        as TEAM OWNER
              ↓
        dashboard can immediately discover team
    """

    user = require_current_user(
        x_user_email,
        x_user_name,
    )

    team_id = (
        request.team_id
        .strip()
    )

    if not team_id:
        raise HTTPException(
            status_code=400,
            detail="team_id is required",
        )

    try:

        # ----------------------------------------------------
        # Prevent accidentally hijacking an existing team.
        # ----------------------------------------------------

        existing_team = get_team(
            team_id
        )

        if existing_team:

            if user_belongs_to_team(
                team_id=team_id,
                email=user["email"],
            ):
                return {
                    "team_id":
                        team_id,

                    "name":
                        existing_team.get(
                            "name"
                        )
                        or team_id,

                    "role":
                        "member",

                    "already_exists":
                        True,
                }

            raise HTTPException(
                status_code=409,
                detail=(
                    f"Team '{team_id}' "
                    "already exists"
                ),
            )

        # ----------------------------------------------------
        # 1. Create team
        # ----------------------------------------------------

        create_team(
            team_id=team_id,
            name=request.name,
        )

        # ----------------------------------------------------
        # 2. CRITICAL:
        #    automatically make creator team owner
        # ----------------------------------------------------

        add_team_member(
            team_id=team_id,

            worker_id=
                user["worker_id"],

            email=
                user["email"],

            name=
                user["name"],

            role=
                "owner",
        )

        # ----------------------------------------------------
        # 3. Response
        # ----------------------------------------------------

        return {
            "team_id":
                team_id,

            "name":
                request.name
                or team_id,

            "role":
                "owner",

            "creator": {
                "worker_id":
                    user[
                        "worker_id"
                    ],

                "name":
                    user["name"],

                "email":
                    user["email"],
            },
        }

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

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

    x_user_email: Optional[str] = Header(
        default=None,
        alias="X-User-Email",
    ),

    x_user_name: Optional[str] = Header(
        default=None,
        alias="X-User-Name",
    ),
):
    """
    FAST PROJECT CREATION.

    OLD BAD FLOW:

        GitHub API
            ↓
        Gemini
            ↓
        evidence
            ↓
        Firestore
            ↓
        return response

    NEW FLOW:

        validate user
            ↓
        create Firestore project
            ↓
        add actual logged-in user
            ↓
        save initial snapshot
            ↓
        RETURN IMMEDIATELY

    GitHub/Gemini initialization happens through
    /sync-github after the project page has opened.
    """

    user = require_current_user(
        x_user_email,
        x_user_name,
    )

    team_id = (
        request.team_id
        .strip()
    )

    project_id = (
        request.project_id
        .strip()
    )

    name = (
        request.name
        .strip()
    )

    if not team_id:
        raise HTTPException(
            status_code=400,
            detail="team_id is required",
        )

    if not project_id:
        raise HTTPException(
            status_code=400,
            detail="project_id is required",
        )

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Project name is required",
        )

    # --------------------------------------------------------
    # CRITICAL:
    # The project can only be created inside a team that
    # the CURRENT LOGGED-IN USER actually belongs to.
    # --------------------------------------------------------

    require_team_membership(
        team_id=team_id,
        email=user["email"],
    )

    try:

        existing_project = get_project(
            team_id=team_id,
            project_id=project_id,
        )

        if existing_project:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Project '{project_id}' "
                    "already exists"
                ),
            )

        state = (
            empty_project_state()
        )

        # ----------------------------------------------------
        # 1. CREATE PROJECT IMMEDIATELY
        # ----------------------------------------------------

        created_project_id = (
            create_project(
                team_id=team_id,

                project_id=
                    project_id,

                name=
                    name,

                github_owner=
                    request.github_owner,

                github_repo=
                    request.github_repo,

                state=
                    state,
            )
        )

        # ----------------------------------------------------
        # 2. ADD ACTUAL LOGGED-IN USER AS PROJECT OWNER
        #
        # NO "Harsha"
        # NO creator_worker_id FROM FRONTEND
        # ----------------------------------------------------

        add_member(
            team_id=team_id,

            project_id=
                created_project_id,

            worker_id=
                user["worker_id"],

            name=
                user["name"],

            email=
                user["email"],

            role=
                "owner",
        )

        # ----------------------------------------------------
        # 3. INITIAL SNAPSHOT
        #
        # This is a Firestore operation only.
        # No Gemini call.
        # ----------------------------------------------------

        save_snapshot(
            team_id=team_id,

            project_id=
                created_project_id,

            state=
                state,

            snapshot_type=
                "initial",
        )

        # ----------------------------------------------------
        # 4. RETURN FAST
        # ----------------------------------------------------

        github_connected = bool(
            request.github_owner
            and request.github_repo
        )

        return {
            "project": {
                "team_id":
                    team_id,

                "project_id":
                    created_project_id,

                "name":
                    name,

                "github_owner":
                    request.github_owner,

                "github_repo":
                    request.github_repo,

                "github_connected":
                    github_connected,

                "needs_github_sync":
                    github_connected,

                "status":
                    "ready",
            },

            "creator": {
                "worker_id":
                    user[
                        "worker_id"
                    ],

                "name":
                    user["name"],

                "email":
                    user["email"],
            },

            "state":
                state,
        }

    except HTTPException:
        raise

    except ValueError as exc:

        message = str(exc)

        # Storage raises ValueError for duplicate project.
        if "already exists" in message:
            raise HTTPException(
                status_code=409,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )

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
        "project":
            project,

        "members":
            members,

        "active_conflicts":
            conflicts,
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
    """
    Add user to BOTH:

        team membership
        +
        project membership

    This keeps dashboard/team/project membership consistent.
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

    email = normalize_email(
        request.email
    )

    if not email:
        raise HTTPException(
            status_code=400,
            detail=(
                "Member email is required"
            ),
        )

    worker_id = (
        request.worker_id
        or email
    )

    name = (
        request.name
        or email.split("@")[0]
    )

    role = (
        request.role
        or "member"
    )

    try:

        # ----------------------------------------------------
        # TEAM MEMBERSHIP
        # ----------------------------------------------------

        add_team_member(
            team_id=team_id,

            worker_id=
                worker_id,

            email=
                email,

            name=
                name,

            role=
                role,
        )

        # ----------------------------------------------------
        # PROJECT MEMBERSHIP
        # ----------------------------------------------------

        add_member(
            team_id=team_id,

            project_id=
                project_id,

            worker_id=
                worker_id,

            name=
                name,

            email=
                email,

            role=
                role,
        )

        return {
            "message":
                "Member added",

            "worker_id":
                worker_id,

            "email":
                email,

            "team_id":
                team_id,

            "project_id":
                project_id,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

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
        "members":
            members,
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
    Shared-memory ingestion flow:

        save raw entry
             ↓
        Gemini reconciliation
             ↓
        save updated state
             ↓
        save conflict if found
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

        # ----------------------------------------------------
        # 1. Ensure project member exists
        #
        # add_member() no longer destroys existing
        # email / role when they are omitted.
        # ----------------------------------------------------

        add_member(
            team_id=team_id,

            project_id=
                project_id,

            worker_id=
                request.worker_id,

            name=
                request.worker_id,
        )

        # ----------------------------------------------------
        # 2. Store raw entry first
        # ----------------------------------------------------

        entry_id = add_entry(
            team_id=team_id,

            project_id=
                project_id,

            worker_id=
                request.worker_id,

            entry_type=
                request.entry_type,

            content=
                request.content,

            source=
                request.source,

            metadata=
                request.metadata,
        )

        # ----------------------------------------------------
        # 3. New Gemini evidence
        # ----------------------------------------------------

        new_entry = {
            "entry_id":
                entry_id,

            "worker_id":
                request.worker_id,

            "type":
                request.entry_type,

            "content":
                request.content,

            "source":
                request.source,

            "metadata":
                request.metadata
                or {},
        }

        # ----------------------------------------------------
        # 4. Previous entries
        # ----------------------------------------------------

        recent_entries = (
            get_entries(
                team_id=
                    team_id,

                project_id=
                    project_id,

                limit=
                    30,
            )
        )

        recent_entries = [
            entry
            for entry
            in recent_entries
            if (
                entry.get("id")
                != entry_id
                and
                entry.get(
                    "entry_id"
                )
                != entry_id
            )
        ]

        # ----------------------------------------------------
        # 5. Existing state
        # ----------------------------------------------------

        current_state = (
            project.get(
                "current_state"
            )
            or {}
        )

        # ----------------------------------------------------
        # 6. Gemini reconciliation
        # ----------------------------------------------------

        result = (
            await reconcile_team_entry(
                current_state=
                    current_state,

                new_entry=
                    new_entry,

                recent_entries=
                    recent_entries,
            )
        )

        updated_state = (
            result[
                "updated_state"
            ]
        )

        conflict = (
            result.get(
                "conflict"
            )
        )

        # ----------------------------------------------------
        # 7. Save updated state
        # ----------------------------------------------------

        update_project_state(
            team_id=team_id,

            project_id=
                project_id,

            state=
                updated_state,
        )

        # ----------------------------------------------------
        # 8. Save detected conflict
        # ----------------------------------------------------

        conflict_id = None

        if conflict:

            conflict_id = (
                save_conflict(
                    team_id=
                        team_id,

                    project_id=
                        project_id,

                    topic=
                        conflict[
                            "topic"
                        ],

                    side_a=
                        conflict[
                            "side_a"
                        ],

                    side_b=
                        conflict[
                            "side_b"
                        ],

                    status=
                        "unresolved",
                )
            )

        # ----------------------------------------------------
        # 9. Snapshot
        # ----------------------------------------------------

        save_snapshot(
            team_id=team_id,

            project_id=
                project_id,

            state=
                updated_state,

            snapshot_type=
                "team_entry",
        )

        return {
            "message":
                "Entry logged and merged",

            "entry_id":
                entry_id,

            "team_id":
                team_id,

            "project_id":
                project_id,

            "worker_id":
                request.worker_id,

            "type":
                request.entry_type,

            "updated_state":
                updated_state,

            "conflict_detected":
                conflict is not None,

            "conflict_id":
                conflict_id,

            "conflict":
                conflict,
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
        "entries":
            entries,

        "count":
            len(entries),
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
        "conflicts":
            conflicts,

        "count":
            len(conflicts),
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

            project_id=
                project_id,

            conflict_id=
                conflict_id,

            resolution=
                request.resolution,

            resolved_by=
                request.resolved_by,
        )

        entry_id = add_entry(
            team_id=team_id,

            project_id=
                project_id,

            worker_id=
                request.resolved_by,

            entry_type=
                "conflict_resolution",

            content=
                request.resolution,

            source=
                "web",

            metadata={
                "conflict_id":
                    conflict_id,
            },
        )

        return {
            "message":
                "Conflict resolved",

            "conflict_id":
                conflict_id,

            "resolution_entry_id":
                entry_id,
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
    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    state = (
        project.get(
            "current_state"
        )
        or {}
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
        "team_id":
            team_id,

        "project_id":
            project_id,

        "project_name":
            project.get(
                "name"
            ),

        "state":
            state,

        "members":
            members,

        "active_conflicts":
            conflicts,
    }


# ============================================================
# SYNC GITHUB
# ============================================================

@app.post(
    "/teams/{team_id}/projects/{project_id}/sync-github"
)
async def sync_github_endpoint(
    team_id: str,
    project_id: str,

    x_user_email: Optional[str] = Header(
        default=None,
        alias="X-User-Email",
    ),
):
    """
    THIS is where the slower GitHub + Gemini work happens.

    It no longer blocks POST /projects.
    """

    user = require_current_user(
        x_user_email
    )

    require_team_membership(
        team_id=team_id,
        email=user["email"],
    )

    project = get_project(
        team_id=team_id,
        project_id=project_id,
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    owner = project.get(
        "github_owner"
    )

    repo = project.get(
        "github_repo"
    )

    if not owner or not repo:
        raise HTTPException(
            status_code=400,
            detail=(
                "No GitHub repository "
                "associated with this project"
            ),
        )

    try:

        # ----------------------------------------------------
        # 1. Fetch GitHub
        # ----------------------------------------------------

        evidence = (
            get_initial_project_evidence(
                owner=owner,
                repo=repo,
            )
        )

        # ----------------------------------------------------
        # 2. Store evidence
        # ----------------------------------------------------

        if evidence:

            save_github_evidence_batch(
                team_id=team_id,

                project_id=
                    project_id,

                evidence_items=
                    evidence,
            )

            # ------------------------------------------------
            # 3. Gemini builds the initial understanding
            #
            # THIS happens after the project already exists.
            # ------------------------------------------------

            state = (
                await build_initial_state(
                    evidence
                )
            )

            updated_state = (
                state.model_dump()
            )

            # ------------------------------------------------
            # 4. Snapshot stores + updates current state
            # ------------------------------------------------

            save_snapshot(
                team_id=team_id,

                project_id=
                    project_id,

                state=
                    updated_state,

                snapshot_type=
                    "github_sync",
            )

        else:

            updated_state = (
                project.get(
                    "current_state"
                )
                or {}
            )

        return {
            "message":
                "GitHub synced successfully",

            "evidence_count":
                len(evidence),

            "state":
                updated_state,

            "synced_at":
                datetime.now(
                    timezone.utc
                ).isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "GitHub sync failed: "
                f"{str(exc)}"
            ),
        )


# ============================================================
# CURRENT USER DASHBOARD
# ============================================================

@app.get("/me/dashboard")
async def get_my_dashboard(
    x_user_email: Optional[str] = Header(
        default=None,
        alias="X-User-Email",
    ),
):
    """
    Return ONLY data belonging to the current user.

    No team-alpha.
    No fallback team.
    """

    user = require_current_user(
        x_user_email
    )

    try:

        # ----------------------------------------------------
        # 1. FAST email → team lookup
        # ----------------------------------------------------

        team = (
            get_team_by_member_email(
                email=
                    user["email"]
            )
        )

        if not team:

            # IMPORTANT:
            #
            # User IS logged in.
            # They simply have no team.
            #
            # Frontend handles this 404 as onboarding.
            raise HTTPException(
                status_code=404,
                detail=(
                    "No ContextSwitch team "
                    "found for this user"
                ),
            )

        team_id = (
            team.get(
                "team_id"
            )
        )

        if not team_id:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Team has no team_id"
                ),
            )

        # ----------------------------------------------------
        # 2. PROJECTS
        # ----------------------------------------------------

        projects = (
            get_team_projects(
                team_id=
                    team_id
            )
        )

        # ----------------------------------------------------
        # 3. TEAM MEMBERS
        #
        # New storage.py reads official:
        #
        # teams/{team_id}/members
        # ----------------------------------------------------

        members = (
            get_team_members(
                team_id=
                    team_id
            )
        )

        # ----------------------------------------------------
        # 4. ACTIVITY
        # ----------------------------------------------------

        recent_entries = (
            get_team_recent_entries(
                team_id=
                    team_id,

                limit=
                    50,
            )
        )

        # ----------------------------------------------------
        # 5. CONFLICTS
        # ----------------------------------------------------

        conflicts = []

        for project in projects:

            project_id = (
                project.get(
                    "project_id"
                )
            )

            if not project_id:
                continue

            project_conflicts = (
                get_conflicts(
                    team_id=
                        team_id,

                    project_id=
                        project_id,

                    only_unresolved=
                        True,
                )
            )

            for conflict in (
                project_conflicts
            ):

                conflict[
                    "team_id"
                ] = team_id

                conflict[
                    "project_id"
                ] = project_id

                conflict[
                    "project_name"
                ] = (
                    conflict.get(
                        "project_name"
                    )
                    or
                    project.get(
                        "name"
                    )
                    or
                    project_id
                )

                conflicts.append(
                    conflict
                )

        # ----------------------------------------------------
        # 6. BLOCKERS
        # ----------------------------------------------------

        blocker_count = 0

        for project in projects:

            state = (
                project.get(
                    "current_state"
                )
                or {}
            )

            blockers = (
                state.get(
                    "blockers"
                )
                or []
            )

            project[
                "blocker_count"
            ] = len(
                blockers
            )

            blocker_count += (
                len(blockers)
            )

            project[
                "team_id"
            ] = team_id

        # ----------------------------------------------------
        # 7. EXTRA TEAM PROTECTION
        # ----------------------------------------------------

        for member in members:
            member[
                "team_id"
            ] = team_id

        for entry in recent_entries:
            entry[
                "team_id"
            ] = team_id

        # ----------------------------------------------------
        # 8. RESPONSE
        # ----------------------------------------------------

        return {
            "team_id":
                team_id,

            "team_name":
                team.get(
                    "name"
                )
                or team_id,

            "projects":
                projects,

            "members":
                members,

            "recent_entries":
                recent_entries,

            "conflicts":
                conflicts,

            "stats": {
                "projects":
                    len(projects),

                "members":
                    len(members),

                "unresolved_conflicts":
                    len(conflicts),

                "blockers":
                    blocker_count,
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to load dashboard: "
                f"{str(exc)}"
            ),
        )
        
# ============================================================
# ADD TEAM MEMBER
# ============================================================

@app.post(
    "/teams/{team_id}/members"
)
async def add_team_member_endpoint(
    team_id: str,
    request: MemberAddRequest,

    x_user_email: Optional[str] = Header(
        default=None,
        alias="X-User-Email",
    ),
):
    current_user = (
        require_current_user(
            x_user_email
        )
    )

    require_team_membership(
        team_id=team_id,
        email=current_user["email"],
    )

    email = (
        request.email
        .strip()
        .lower()
        if request.email
        else ""
    )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Member email is required",
        )

    worker_id = (
        request.worker_id
        or email
    )

    name = (
        request.name
        or email.split("@")[0]
    )

    try:
        add_team_member(
            team_id=team_id,
            worker_id=worker_id,
            email=email,
            name=name,
            role=request.role or "member",
        )

        return {
            "message":
                "Team member added",

            "team_id":
                team_id,

            "worker_id":
                worker_id,

            "name":
                name,

            "email":
                email,

            "role":
                request.role
                or "member",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to add team member: "
                f"{str(exc)}"
            ),
        )
        