from datetime import datetime, timezone
from typing import Optional
import hashlib
import logging
import uuid

from google.cloud import firestore


# ============================================================
# FIRESTORE INITIALIZATION
# ============================================================

try:
    db = firestore.Client(
        project="contextswitch-hackathon-26"
    )

except Exception as e:
    logging.warning(
        "Firestore credentials unavailable (%s). "
        "Using local in-memory storage.",
        e,
    )

    # ========================================================
    # LOCAL FIRESTORE MOCK
    # ========================================================

    class MockDoc:
        def __init__(
            self,
            doc_id,
            data=None,
        ):
            self.id = doc_id
            self._data = data or {}
            self.exists = data is not None
            self._subcollections = {}

        @property
        def reference(self):
            """
            Real Firestore DocumentSnapshot has .reference.

            Returning self keeps old helper code compatible
            with the local mock.
            """
            return self

        def to_dict(self):
            return dict(self._data)

        def set(
            self,
            data,
            merge=False,
        ):
            if merge:
                self._data.update(data)
            else:
                self._data = dict(data)

            self.exists = True

        def update(self, data):
            if not self.exists:
                raise KeyError(
                    f"Document {self.id} does not exist"
                )

            self._data.update(data)
            self.exists = True

        def get(self):
            return self

        def collection(
            self,
            collection_name,
        ):
            if (
                collection_name
                not in self._subcollections
            ):
                self._subcollections[
                    collection_name
                ] = MockCollection()

            return self._subcollections[
                collection_name
            ]

    class MockQuery:
        def __init__(
            self,
            documents,
        ):
            self._documents = list(
                documents
            )

        def where(
            self,
            field,
            op,
            value,
        ):
            if op == "==":
                self._documents = [
                    doc
                    for doc
                    in self._documents
                    if (
                        doc.to_dict()
                        .get(field)
                        == value
                    )
                ]

            return self

        def order_by(
            self,
            field,
            direction=None,
        ):
            reverse = (
                direction
                == firestore.Query.DESCENDING
            )

            def sort_value(doc):
                value = (
                    doc.to_dict()
                    .get(field)
                )

                if value is None:
                    return (
                        datetime.min.replace(
                            tzinfo=timezone.utc
                        )
                    )

                return value

            self._documents.sort(
                key=sort_value,
                reverse=reverse,
            )

            return self

        def limit(self, count):
            self._documents = (
                self._documents[:count]
            )
            return self

        def stream(self):
            return [
                doc
                for doc
                in self._documents
                if doc.exists
            ]

    class MockCollection:
        def __init__(self):
            self.docs = {}

        def document(
            self,
            doc_id=None,
        ):
            if not doc_id:
                doc_id = str(
                    uuid.uuid4()
                )

            if (
                doc_id
                not in self.docs
            ):
                self.docs[
                    doc_id
                ] = MockDoc(
                    doc_id
                )

            return self.docs[
                doc_id
            ]

        def stream(self):
            return [
                doc
                for doc
                in self.docs.values()
                if doc.exists
            ]

        def where(
            self,
            field,
            op,
            value,
        ):
            return MockQuery(
                self.stream()
            ).where(
                field,
                op,
                value,
            )

        def order_by(
            self,
            field,
            direction=None,
        ):
            return MockQuery(
                self.stream()
            ).order_by(
                field,
                direction,
            )

        def limit(self, count):
            return MockQuery(
                self.stream()
            ).limit(count)

    class InMemoryFirestore:
        def __init__(self):
            self.collections = {}

        def collection(
            self,
            name,
        ):
            if (
                name
                not in self.collections
            ):
                self.collections[
                    name
                ] = MockCollection()

            return self.collections[
                name
            ]

    db = InMemoryFirestore()


# ============================================================
# GENERIC HELPERS
# ============================================================

def _now():
    return datetime.now(
        timezone.utc
    )


def _normalize_email(
    email: Optional[str],
):
    if not email:
        return None

    return (
        email
        .strip()
        .lower()
    )


def _email_index_id(
    email: str,
):
    """
    Do not use raw email addresses as Firestore
    document IDs.

    Use a stable SHA-256 hash instead.
    """

    normalized = (
        email
        .strip()
        .lower()
    )

    return hashlib.sha256(
        normalized.encode(
            "utf-8"
        )
    ).hexdigest()


def _team_ref(
    team_id: str,
):
    return (
        db.collection("teams")
        .document(team_id)
    )


def _project_ref(
    team_id: str,
    project_id: str,
):
    """
    teams/{team_id}/projects/{project_id}
    """

    return (
        _team_ref(team_id)
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
    Create a team only if it does not already exist.

    IMPORTANT:
    Calling create_team() again will NOT reset
    created_at and will NOT replace the existing
    team name unless a new name is explicitly supplied.
    """

    if not team_id:
        raise ValueError(
            "team_id is required"
        )

    team_id = team_id.strip()

    team_ref = _team_ref(
        team_id
    )

    existing = (
        team_ref.get()
    )

    if existing.exists:
        payload = {
            "team_id": team_id,
            "updated_at": _now(),
        }

        if (
            name
            and name.strip()
        ):
            payload["name"] = (
                name.strip()
            )

        team_ref.set(
            payload,
            merge=True,
        )

        return team_id

    now = _now()

    team_ref.set({
        "team_id": team_id,

        "name": (
            name.strip()
            if name
            and name.strip()
            else team_id
        ),

        "created_at": now,
        "updated_at": now,
    })

    return team_id


def get_team(
    team_id: str,
):
    if not team_id:
        return None

    doc = (
        _team_ref(team_id)
        .get()
    )

    if not doc.exists:
        return None

    data = (
        doc.to_dict()
        or {}
    )

    data["id"] = doc.id

    data["team_id"] = (
        data.get("team_id")
        or doc.id
    )

    return data


# ============================================================
# TEAM MEMBERSHIP
# ============================================================

def add_team_member(
    team_id: str,
    worker_id: str,
    email: str,
    name: Optional[str] = None,
    role: str = "member",
):
    """
    Add a user to the TEAM itself.

    This is different from add_member(), which adds
    the user to a specific project.

    Structure:

        teams/
            {team_id}/
                members/
                    {worker_id}
    """

    if not team_id:
        raise ValueError(
            "team_id is required"
        )

    if not worker_id:
        raise ValueError(
            "worker_id is required"
        )

    normalized_email = (
        _normalize_email(email)
    )

    if not normalized_email:
        raise ValueError(
            "email is required"
        )

    team = get_team(
        team_id
    )

    if not team:
        raise ValueError(
            f"Team '{team_id}' does not exist"
        )

    now = _now()

    member_ref = (
        _team_ref(team_id)
        .collection("members")
        .document(worker_id)
    )

    existing = (
        member_ref.get()
    )

    payload = {
        "team_id": team_id,
        "worker_id": worker_id,
        "email": normalized_email,
        "name": (
            name
            or normalized_email
        ),
        "role": role,
        "updated_at": now,
    }

    if not existing.exists:
        payload[
            "joined_at"
        ] = now

    member_ref.set(
        payload,
        merge=True,
    )

    # --------------------------------------------------------
    # FAST USER → TEAM LOOKUP INDEX
    # --------------------------------------------------------

    index_id = (
        _email_index_id(
            normalized_email
        )
    )

    db.collection(
        "user_team_index"
    ).document(
        index_id
    ).set(
        {
            "email":
                normalized_email,

            "team_id":
                team_id,

            "worker_id":
                worker_id,

            "updated_at":
                now,
        },
        merge=True,
    )

    return worker_id


def get_team_member(
    team_id: str,
    worker_id: str,
):
    doc = (
        _team_ref(team_id)
        .collection("members")
        .document(worker_id)
        .get()
    )

    if not doc.exists:
        return None

    data = (
        doc.to_dict()
        or {}
    )

    data["id"] = doc.id

    return data


def get_team_members(
    team_id: str,
):
    """
    Return official TEAM members.

    For old Firestore data that predates team-level
    membership, fall back to project membership.
    """

    member_docs = (
        _team_ref(team_id)
        .collection("members")
        .stream()
    )

    members = []

    for doc in member_docs:
        data = (
            doc.to_dict()
            or {}
        )

        data["id"] = (
            doc.id
        )

        data["worker_id"] = (
            data.get(
                "worker_id"
            )
            or doc.id
        )

        data["team_id"] = (
            team_id
        )

        members.append(
            data
        )

    # New schema has members.
    if members:
        return members

    # --------------------------------------------------------
    # LEGACY FALLBACK
    #
    # Old projects stored members only under projects.
    # This keeps your existing Firestore data usable.
    # --------------------------------------------------------

    return (
        _get_project_members_for_team(
            team_id
        )
    )


def is_team_member(
    team_id: str,
    worker_id: str,
):
    return (
        get_team_member(
            team_id,
            worker_id,
        )
        is not None
    )


# ============================================================
# FAST USER → TEAM LOOKUP
# ============================================================

def get_team_by_member_email(
    email: str,
):
    """
    Find the team for an authenticated user's email.

    NEW FAST PATH:
        user_team_index/{hashed_email}

    LEGACY FALLBACK:
        scan existing team-level / project-level members.

    There is NEVER a default team such as team-alpha.
    """

    normalized_email = (
        _normalize_email(email)
    )

    if not normalized_email:
        return None

    # --------------------------------------------------------
    # FAST PATH
    # --------------------------------------------------------

    index_id = (
        _email_index_id(
            normalized_email
        )
    )

    index_doc = (
        db.collection(
            "user_team_index"
        )
        .document(
            index_id
        )
        .get()
    )

    if index_doc.exists:
        index_data = (
            index_doc.to_dict()
            or {}
        )

        team_id = (
            index_data.get(
                "team_id"
            )
        )

        if team_id:
            team = get_team(
                team_id
            )

            if team:
                return team

    # --------------------------------------------------------
    # LEGACY FALLBACK
    #
    # Needed for Firestore documents created before the
    # user_team_index collection was introduced.
    # --------------------------------------------------------

    for team_doc in (
        db.collection("teams")
        .stream()
    ):
        team_id = (
            team_doc.id
        )

        # ----------------------------------------------------
        # Check official team members first
        # ----------------------------------------------------

        team_members = (
            _team_ref(team_id)
            .collection("members")
            .stream()
        )

        for member_doc in team_members:
            member = (
                member_doc.to_dict()
                or {}
            )

            member_email = (
                _normalize_email(
                    member.get(
                        "email"
                    )
                )
            )

            if (
                member_email
                == normalized_email
            ):
                worker_id = (
                    member.get(
                        "worker_id"
                    )
                    or member_doc.id
                )

                # Self-heal the new index.
                db.collection(
                    "user_team_index"
                ).document(
                    index_id
                ).set({
                    "email":
                        normalized_email,

                    "team_id":
                        team_id,

                    "worker_id":
                        worker_id,

                    "updated_at":
                        _now(),
                })

                return (
                    get_team(
                        team_id
                    )
                )

        # ----------------------------------------------------
        # Check legacy project members
        # ----------------------------------------------------

        projects = (
            _team_ref(team_id)
            .collection("projects")
            .stream()
        )

        for project_doc in projects:
            project_ref = (
                _project_ref(
                    team_id,
                    project_doc.id,
                )
            )

            members = (
                project_ref
                .collection("members")
                .stream()
            )

            for member_doc in members:
                member = (
                    member_doc.to_dict()
                    or {}
                )

                member_email = (
                    _normalize_email(
                        member.get(
                            "email"
                        )
                    )
                )

                if (
                    member_email
                    != normalized_email
                ):
                    continue

                worker_id = (
                    member.get(
                        "worker_id"
                    )
                    or member_doc.id
                )

                # ------------------------------------------------
                # MIGRATE LEGACY MEMBER INTO TEAM MEMBERSHIP
                # ------------------------------------------------

                add_team_member(
                    team_id=team_id,

                    worker_id=
                        worker_id,

                    email=
                        normalized_email,

                    name=
                        member.get(
                            "name"
                        )
                        or worker_id,

                    role=
                        member.get(
                            "role"
                        )
                        or "member",
                )

                return (
                    get_team(
                        team_id
                    )
                )

    return None


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
    Create a project.

    IMPORTANT:
    This function DOES NOT create the team automatically.

    Team creation and project creation must be separate
    operations so a typo cannot silently create another team.
    """

    if not team_id:
        raise ValueError(
            "team_id is required"
        )

    if not project_id:
        raise ValueError(
            "project_id is required"
        )

    if not name:
        raise ValueError(
            "project name is required"
        )

    team = get_team(
        team_id
    )

    if not team:
        raise ValueError(
            f"Team '{team_id}' does not exist"
        )

    project_ref = (
        _project_ref(
            team_id,
            project_id,
        )
    )

    existing = (
        project_ref.get()
    )

    if existing.exists:
        raise ValueError(
            f"Project '{project_id}' already exists "
            f"in team '{team_id}'"
        )

    now = _now()

    initial_state = (
        state
        if state is not None
        else {
            "goal": "",
            "completed": [],
            "progress": [],
            "failed": [],
            "failures": [],
            "decisions": [],
            "blockers": [],
            "next_actions": [],
            "conflicts": [],
        }
    )

    project_ref.set({
        "team_id":
            team_id,

        "project_id":
            project_id,

        "name":
            name.strip(),

        "github_owner":
            github_owner,

        "github_repo":
            github_repo,

        "status":
            "ready",

        "created_at":
            now,

        "updated_at":
            now,

        "last_snapshot_at":
            None,

        "current_state":
            initial_state,
    })

    return project_id


def get_project(
    team_id: str,
    project_id: str,
):
    doc = (
        _project_ref(
            team_id,
            project_id,
        )
        .get()
    )

    if not doc.exists:
        return None

    data = (
        doc.to_dict()
        or {}
    )

    data["id"] = (
        doc.id
    )

    data["project_id"] = (
        data.get(
            "project_id"
        )
        or doc.id
    )

    data["team_id"] = (
        team_id
    )

    return data


def update_project_state(
    team_id: str,
    project_id: str,
    state: dict,
):
    project_ref = (
        _project_ref(
            team_id,
            project_id,
        )
    )

    project = (
        project_ref.get()
    )

    if not project.exists:
        raise ValueError(
            f"Project '{project_id}' does not exist"
        )

    project_ref.update({
        "current_state":
            state,

        "updated_at":
            _now(),
    })


# ============================================================
# PROJECT MEMBERS
# ============================================================

def add_member(
    team_id: str,
    project_id: str,
    worker_id: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: Optional[str] = None,
):
    """
    Add/update membership for ONE PROJECT.

    Existing email and role are never erased when
    omitted from subsequent updates.
    """

    project = (
        get_project(
            team_id,
            project_id,
        )
    )

    if not project:
        raise ValueError(
            f"Project '{project_id}' does not exist"
        )

    if not worker_id:
        raise ValueError(
            "worker_id is required"
        )

    member_ref = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection("members")
        .document(worker_id)
    )

    existing = (
        member_ref.get()
    )

    now = _now()

    payload = {
        "team_id":
            team_id,

        "project_id":
            project_id,

        "worker_id":
            worker_id,

        "updated_at":
            now,
    }

    # --------------------------------------------------------
    # DO NOT overwrite useful existing values with defaults.
    # --------------------------------------------------------

    if name:
        payload[
            "name"
        ] = name

    elif not existing.exists:
        payload[
            "name"
        ] = worker_id

    normalized_email = (
        _normalize_email(
            email
        )
    )

    if normalized_email:
        payload[
            "email"
        ] = normalized_email

    if role:
        payload[
            "role"
        ] = role

    elif not existing.exists:
        payload[
            "role"
        ] = "member"

    if not existing.exists:
        payload[
            "joined_at"
        ] = now

    member_ref.set(
        payload,
        merge=True,
    )

    return worker_id


def get_members(
    team_id: str,
    project_id: str,
):
    docs = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection("members")
        .stream()
    )

    members = []

    for doc in docs:
        data = (
            doc.to_dict()
            or {}
        )

        data["id"] = (
            doc.id
        )

        data["worker_id"] = (
            data.get(
                "worker_id"
            )
            or doc.id
        )

        data["team_id"] = (
            team_id
        )

        data["project_id"] = (
            project_id
        )

        members.append(
            data
        )

    return members


def _get_project_members_for_team(
    team_id: str,
):
    """
    Legacy helper.

    Deduplicates members that exist under projects.
    """

    project_docs = (
        _team_ref(team_id)
        .collection("projects")
        .stream()
    )

    unique = {}

    for project_doc in project_docs:
        project_id = (
            project_doc.id
        )

        members = (
            _project_ref(
                team_id,
                project_id,
            )
            .collection("members")
            .stream()
        )

        for member_doc in members:
            member = (
                member_doc.to_dict()
                or {}
            )

            worker_id = (
                member.get(
                    "worker_id"
                )
                or member_doc.id
            )

            member["id"] = (
                member_doc.id
            )

            member["worker_id"] = (
                worker_id
            )

            member["team_id"] = (
                team_id
            )

            existing = (
                unique.get(
                    worker_id
                )
            )

            if existing:
                unique[
                    worker_id
                ] = {
                    **existing,

                    **{
                        key: value
                        for key, value
                        in member.items()
                        if value
                        is not None
                    },
                }

            else:
                unique[
                    worker_id
                ] = member

    return list(
        unique.values()
    )


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
    project = (
        get_project(
            team_id,
            project_id,
        )
    )

    if not project:
        raise ValueError(
            f"Project '{project_id}' does not exist"
        )

    now = _now()

    entry_ref = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection("entries")
        .document()
    )

    entry_ref.set({
        "entry_id":
            entry_ref.id,

        "team_id":
            team_id,

        "project_id":
            project_id,

        "worker_id":
            worker_id,

        "type":
            entry_type,

        "content":
            content,

        "source":
            source,

        "timestamp":
            now,

        "metadata":
            metadata or {},
    })

    return (
        entry_ref.id
    )


def get_entries(
    team_id: str,
    project_id: str,
    limit: int = 100,
):
    query = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection("entries")
        .order_by(
            "timestamp",
            direction=
                firestore.Query.DESCENDING,
        )
        .limit(limit)
    )

    entries = []

    for doc in query.stream():
        data = (
            doc.to_dict()
            or {}
        )

        data["id"] = (
            doc.id
        )

        data["entry_id"] = (
            data.get(
                "entry_id"
            )
            or doc.id
        )

        entries.append(
            data
        )

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
    now = _now()

    conflict_ref = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection(
            "conflicts"
        )
        .document()
    )

    conflict_ref.set({
        "conflict_id":
            conflict_ref.id,

        "team_id":
            team_id,

        "project_id":
            project_id,

        "topic":
            topic,

        "side_a":
            side_a,

        "side_b":
            side_b,

        "status":
            status,

        "resolution":
            None,

        "created_at":
            now,

        "resolved_at":
            None,

        "resolved_by":
            None,
    })

    return (
        conflict_ref.id
    )


def get_conflicts(
    team_id: str,
    project_id: str,
    only_unresolved: bool = False,
):
    query = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection(
            "conflicts"
        )
    )

    if only_unresolved:
        query = query.where(
            "status",
            "==",
            "unresolved",
        )

    conflicts = []

    for doc in query.stream():
        data = (
            doc.to_dict()
            or {}
        )

        data["id"] = (
            doc.id
        )

        data["conflict_id"] = (
            data.get(
                "conflict_id"
            )
            or doc.id
        )

        data["team_id"] = (
            team_id
        )

        data["project_id"] = (
            project_id
        )

        conflicts.append(
            data
        )

    return conflicts


def resolve_conflict(
    team_id: str,
    project_id: str,
    conflict_id: str,
    resolution: str,
    resolved_by: Optional[str] = None,
):
    conflict_ref = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection(
            "conflicts"
        )
        .document(
            conflict_id
        )
    )

    existing = (
        conflict_ref.get()
    )

    if not existing.exists:
        raise ValueError(
            f"Conflict '{conflict_id}' does not exist"
        )

    conflict_ref.update({
        "status":
            "resolved",

        "resolution":
            resolution,

        "resolved_by":
            resolved_by,

        "resolved_at":
            _now(),
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
    now = _now()

    project_ref = (
        _project_ref(
            team_id,
            project_id,
        )
    )

    snapshot_ref = (
        project_ref
        .collection(
            "snapshots"
        )
        .document()
    )

    snapshot_ref.set({
        "snapshot_id":
            snapshot_ref.id,

        "type":
            snapshot_type,

        "created_at":
            now,

        "state":
            state,
    })

    project_ref.update({
        "current_state":
            state,

        "updated_at":
            now,

        "last_snapshot_at":
            now,
    })

    return (
        snapshot_ref.id
    )


# ============================================================
# GITHUB EVIDENCE
# ============================================================

def add_github_evidence(
    team_id: str,
    project_id: str,
    evidence: dict,
) -> str:
    evidence_id = (
        evidence.get("id")
        or str(uuid.uuid4())
    )

    evidence_ref = (
        _project_ref(
            team_id,
            project_id,
        )
        .collection(
            "evidence"
        )
        .document(
            evidence_id
        )
    )

    payload = {
        **evidence,

        "team_id":
            team_id,

        "project_id":
            project_id,

        "stored_at":
            _now(),
    }

    evidence_ref.set(
        payload,
        merge=True,
    )

    return evidence_id


def save_github_evidence_batch(
    team_id: str,
    project_id: str,
    evidence_items: list[dict],
):
    for evidence in evidence_items:
        add_github_evidence(
            team_id=
                team_id,

            project_id=
                project_id,

            evidence=
                evidence,
        )

    return len(
        evidence_items
    )


# ============================================================
# DASHBOARD PROJECTS
# ============================================================

def get_team_projects(
    team_id: str,
):
    """
    Return projects belonging ONLY to this team.

    Does not use DocumentSnapshot.reference so this works
    with both real Firestore and the local mock.
    """

    docs = (
        _team_ref(team_id)
        .collection("projects")
        .stream()
    )

    projects = []

    for doc in docs:
        data = (
            doc.to_dict()
            or {}
        )

        project_id = (
            data.get(
                "project_id"
            )
            or doc.id
        )

        data["id"] = (
            doc.id
        )

        data["project_id"] = (
            project_id
        )

        data["team_id"] = (
            team_id
        )

        project_ref = (
            _project_ref(
                team_id,
                project_id,
            )
        )

        # ----------------------------------------------------
        # MEMBERS
        # ----------------------------------------------------

        project_members = []

        for member_doc in (
            project_ref
            .collection(
                "members"
            )
            .stream()
        ):
            member = (
                member_doc.to_dict()
                or {}
            )

            member["id"] = (
                member_doc.id
            )

            member["worker_id"] = (
                member.get(
                    "worker_id"
                )
                or member_doc.id
            )

            member["team_id"] = (
                team_id
            )

            member["project_id"] = (
                project_id
            )

            project_members.append(
                member
            )

        data["members"] = (
            project_members
        )

        # ----------------------------------------------------
        # CONFLICT COUNT
        # ----------------------------------------------------

        conflict_count = 0

        for conflict_doc in (
            project_ref
            .collection(
                "conflicts"
            )
            .stream()
        ):
            conflict = (
                conflict_doc.to_dict()
                or {}
            )

            if (
                conflict.get(
                    "status"
                )
                == "unresolved"
            ):
                conflict_count += 1

        data[
            "conflict_count"
        ] = conflict_count

        blockers = (
            data.get(
                "current_state",
                {},
            )
            .get(
                "blockers",
                [],
            )
            or []
        )

        data[
            "blocker_count"
        ] = len(
            blockers
        )

        projects.append(
            data
        )

    return projects


# ============================================================
# DASHBOARD RECENT ENTRIES
# ============================================================

def get_team_recent_entries(
    team_id: str,
    limit: int = 50,
):
    """
    Collect project activity belonging ONLY to this team.
    """

    project_docs = (
        _team_ref(team_id)
        .collection("projects")
        .stream()
    )

    entries = []

    for project_doc in project_docs:
        project = (
            project_doc.to_dict()
            or {}
        )

        project_id = (
            project.get(
                "project_id"
            )
            or project_doc.id
        )

        project_name = (
            project.get(
                "name"
            )
            or project_id
        )

        project_ref = (
            _project_ref(
                team_id,
                project_id,
            )
        )

        entry_docs = (
            project_ref
            .collection(
                "entries"
            )
            .stream()
        )

        for entry_doc in entry_docs:
            entry = (
                entry_doc.to_dict()
                or {}
            )

            entry["id"] = (
                entry_doc.id
            )

            entry["entry_id"] = (
                entry.get(
                    "entry_id"
                )
                or entry_doc.id
            )

            entry["team_id"] = (
                team_id
            )

            entry["project_id"] = (
                project_id
            )

            entry["project_name"] = (
                project_name
            )

            entries.append(
                entry
            )

    def timestamp_value(
        entry,
    ):
        value = (
            entry.get(
                "timestamp"
            )
        )

        if isinstance(
            value,
            datetime,
        ):
            # Ensure timezone-aware comparison.
            if (
                value.tzinfo
                is None
            ):
                return value.replace(
                    tzinfo=timezone.utc
                )

            return value

        return (
            datetime.min.replace(
                tzinfo=timezone.utc
            )
        )

    entries.sort(
        key=timestamp_value,
        reverse=True,
    )

    return entries[
        :limit
    ]