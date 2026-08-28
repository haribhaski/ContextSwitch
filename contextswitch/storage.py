from datetime import datetime, timezone
from google.cloud import firestore


db = firestore.Client(
    project="contextswitch-hackathon-26"
)


def create_workspace(
    name: str,
    github_owner: str,
    github_repo: str,
    state: dict,
) -> str:

    doc_ref = db.collection("workspaces").document()

    now = datetime.now(timezone.utc)

    doc_ref.set({
        "name": name,
        "github_owner": github_owner,
        "github_repo": github_repo,
        "created_at": now,
        "last_snapshot_at": now,
        "current_state": state,
    })

    return doc_ref.id


def get_workspace(workspace_id: str):

    doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .get()
    )

    if not doc.exists:
        return None

    data = doc.to_dict()

    data["id"] = doc.id

    return data

def save_snapshot(
    workspace_id: str,
    state: dict,
    snapshot_type: str = "initial",
):

    now = datetime.now(timezone.utc)

    snapshot_ref = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("snapshots")
        .document()
    )

    snapshot_ref.set({
        "type": snapshot_type,
        "created_at": now,
        "state": state,
    })

    db.collection("workspaces").document(
        workspace_id
    ).update({
        "current_state": state,
        "last_snapshot_at": now,
    })

    return snapshot_ref.id

def update_workspace_state(
    workspace_id: str,
    state: dict,
):

    now = datetime.now(timezone.utc)

    db.collection("workspaces").document(
        workspace_id
    ).update({
        "current_state": state,
        "last_snapshot_at": now,
    })