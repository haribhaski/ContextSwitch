from datetime import datetime, timezone
from typing import Optional

from google.cloud import firestore


import logging

try:
    db = firestore.Client(
        project="contextswitch-hackathon-26"
    )
except Exception as e:
    logging.warning(f"Firestore Client default credentials not found ({e}). Falling back to local in-memory storage.")
    
    class MockDoc:
        def __init__(self, doc_id, data=None):
            self.id = doc_id
            self._data = data or {}
            self.exists = bool(data)
            self._subcollections = {}

        def to_dict(self):
            return dict(self._data)

        def set(self, data, merge=False):
            if merge:
                self._data.update(data)
            else:
                self._data = dict(data)
            self.exists = True

        def update(self, data):
            self._data.update(data)
            self.exists = True

        def get(self):
            return self

        def collection(self, col_name):
            if col_name not in self._subcollections:
                self._subcollections[col_name] = MockCollection()
            return self._subcollections[col_name]

    class MockCollection:
        def __init__(self):
            self.docs = {}

        def document(self, doc_id=None):
            if not doc_id:
                import uuid
                doc_id = str(uuid.uuid4())
            if doc_id not in self.docs:
                self.docs[doc_id] = MockDoc(doc_id)
            return self.docs[doc_id]

        def stream(self):
            return [doc for doc in self.docs.values() if doc.exists]

        def order_by(self, field, direction=None):
            return self

        def limit(self, count):
            return self

        def where(self, field, op, val):
            return self

    class InMemoryFirestore:
        def __init__(self):
            self.collections = {}

        def collection(self, name):
            if name not in self.collections:
                self.collections[name] = MockCollection()
            return self.collections[name]

    db = InMemoryFirestore()



# ============================================================
# HELPERS
# ============================================================

def _project_ref(team_id: str, project_id: str):
    """
    Returns:
    teams/{team_id}/projects/{project_id}
    """
    return (
        db.collection("teams")
        .document(team_id)
        .collection("projects")
        .document(project_id)
    )


# ============================================================
# TEAM
# ============================================================

def create_team(
    team_id: str,
    name: Optional[str] = None,
) -> str:
    """
    Create a team document.

    Example:
        team_id = "team-alpha"
    """

    now = datetime.now(timezone.utc)

    team_ref = (
        db.collection("teams")
        .document(team_id)
    )

    team_ref.set(
        {
            "team_id": team_id,
            "name": name or team_id,
            "created_at": now,
        },
        merge=True,
    )

    return team_id


def get_team(team_id: str):

    doc = (
        db.collection("teams")
        .document(team_id)
        .get()
    )

    if not doc.exists:
        return None

    data = doc.to_dict()
    data["id"] = doc.id

    return data


# ============================================================
# PROJECT
# ============================================================

def create_project(
    team_id: str,
    project_id: str,
    name: str,
    github_owner: Optional[str] = None,
    github_repo: Optional[str] = None,
    state: Optional[dict] = None,
) -> str:
    """
    Create a project inside a team.

    Structure:

    teams/
        team-alpha/
            projects/
                fin-rag-chatbot/
    """

    now = datetime.now(timezone.utc)

    # Make sure team exists.
    create_team(team_id)

    project_ref = _project_ref(
        team_id=team_id,
        project_id=project_id,
    )

    initial_state = state or {
        "goal": "",
        "completed": [],
        "failed": [],
        "decisions": [],
        "blockers": [],
        "next_actions": [],
        "conflicts": [],
    }

    project_ref.set({
        "team_id": team_id,
        "project_id": project_id,
        "name": name,

        "github_owner": github_owner,
        "github_repo": github_repo,

        "created_at": now,
        "updated_at": now,
        "last_snapshot_at": now,

        "current_state": initial_state,
    })

    return project_id


def get_project(
    team_id: str,
    project_id: str,
):

    doc = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .get()
    )

    if not doc.exists:
        return None

    data = doc.to_dict()

    data["id"] = doc.id

    return data


def update_project_state(
    team_id: str,
    project_id: str,
    state: dict,
):
    """
    Update the merged/shared current project state.
    """

    now = datetime.now(timezone.utc)

    _project_ref(
        team_id=team_id,
        project_id=project_id,
    ).update({
        "current_state": state,
        "updated_at": now,
    })


# ============================================================
# MEMBERS
# ============================================================

def add_member(
    team_id: str,
    project_id: str,
    worker_id: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: str = "member",
):
    """
    Add a worker/member to a project with optional email and role (owner, admin, member).
    """

    now = datetime.now(timezone.utc)

    member_ref = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("members")
        .document(worker_id)
    )

    member_ref.set(
        {
            "worker_id": worker_id,
            "name": name or worker_id,
            "email": email,
            "role": role,
            "joined_at": now,
        },
        merge=True,
    )

    return worker_id


def get_members(
    team_id: str,
    project_id: str,
):
    """
    Return all members of a project.
    """

    docs = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("members")
        .stream()
    )

    members = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        members.append(data)

    return members


# ============================================================
# RAW TEAM ENTRIES
# ============================================================

def add_entry(
    team_id: str,
    project_id: str,
    worker_id: str,
    entry_type: str,
    content: str,
    source: str = "cli",
    metadata: Optional[dict] = None,
) -> str:
    """
    Store every raw update submitted by a team member.

    Examples:

        cs log ...
            entry_type = "decision"

        cs done ...
            entry_type = "completed"

        cs blocked ...
            entry_type = "blocker"

    These raw entries are NEVER deleted.

    Gemini can use them later when reconstructing
    project state or detecting conflicts.
    """

    now = datetime.now(timezone.utc)

    entry_ref = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("entries")
        .document()
    )

    entry_ref.set({
        "entry_id": entry_ref.id,

        "worker_id": worker_id,

        "type": entry_type,

        "content": content,

        "source": source,

        "timestamp": now,

        "metadata": metadata or {},
    })

    return entry_ref.id


def get_entries(
    team_id: str,
    project_id: str,
    limit: int = 100,
):
    """
    Read recent raw entries.

    Newest entries come first.
    """

    query = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("entries")
        .order_by(
            "timestamp",
            direction=firestore.Query.DESCENDING,
        )
        .limit(limit)
    )

    entries = []

    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        entries.append(data)

    return entries


# ============================================================
# CONFLICTS
# ============================================================

def save_conflict(
    team_id: str,
    project_id: str,
    topic: str,
    side_a: dict,
    side_b: dict,
    status: str = "unresolved",
) -> str:
    """
    Store a conflict detected by Gemini.

    Example:

    side_a = {
        "worker_id": "hariharan",
        "position": "Use Chroma"
    }

    side_b = {
        "worker_id": "jeevan",
        "position": "Use Pinecone"
    }
    """

    now = datetime.now(timezone.utc)

    conflict_ref = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("conflicts")
        .document()
    )

    conflict_ref.set({
        "conflict_id": conflict_ref.id,

        "topic": topic,

        "side_a": side_a,
        "side_b": side_b,

        "status": status,

        "resolution": None,

        "created_at": now,
        "resolved_at": None,
    })

    return conflict_ref.id


def get_conflicts(
    team_id: str,
    project_id: str,
    only_unresolved: bool = False,
):

    query = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("conflicts")
    )

    if only_unresolved:
        query = query.where(
            "status",
            "==",
            "unresolved",
        )

    conflicts = []

    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        conflicts.append(data)

    return conflicts


def resolve_conflict(
    team_id: str,
    project_id: str,
    conflict_id: str,
    resolution: str,
    resolved_by: Optional[str] = None,
):
    """
    Resolve an existing team conflict.
    """

    now = datetime.now(timezone.utc)

    conflict_ref = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("conflicts")
        .document(conflict_id)
    )

    conflict_ref.update({
        "status": "resolved",

        "resolution": resolution,

        "resolved_by": resolved_by,

        "resolved_at": now,
    })


# ============================================================
# SNAPSHOTS
# ============================================================

def save_snapshot(
    team_id: str,
    project_id: str,
    state: dict,
    snapshot_type: str = "merge",
):
    """
    Store a historical version of the project state.

    This preserves your existing Context Time Machine idea.
    """

    now = datetime.now(timezone.utc)

    project_ref = _project_ref(
        team_id=team_id,
        project_id=project_id,
    )

    snapshot_ref = (
        project_ref
        .collection("snapshots")
        .document()
    )

    snapshot_ref.set({
        "snapshot_id": snapshot_ref.id,

        "type": snapshot_type,

        "created_at": now,

        "state": state,
    })

    project_ref.update({
        "current_state": state,

        "updated_at": now,

        "last_snapshot_at": now,
    })

    return snapshot_ref.id


# ============================================================
# GITHUB EVIDENCE
# ============================================================

def add_github_evidence(
    team_id: str,
    project_id: str,
    evidence: dict,
) -> str:
    """
    Store normalized GitHub evidence.

    Your existing GitHub connector can call this
    without needing to be rewritten.
    """

    evidence_id = (
        evidence.get("id")
        or db.collection("_").document().id
    )

    evidence_ref = (
        _project_ref(
            team_id=team_id,
            project_id=project_id,
        )
        .collection("evidence")
        .document(evidence_id)
    )

    payload = {
        **evidence,
        "stored_at": datetime.now(timezone.utc),
    }

    evidence_ref.set(payload, merge=True)

    return evidence_id


def save_github_evidence_batch(
    team_id: str,
    project_id: str,
    evidence_items: list[dict],
):
    """
    Save several normalized GitHub evidence items.

    Returns number of evidence items stored.
    """

    for evidence in evidence_items:
        add_github_evidence(
            team_id=team_id,
            project_id=project_id,
            evidence=evidence,
        )

    return len(evidence_items)