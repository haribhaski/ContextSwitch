from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


# ============================================================
# SHARED PROJECT STATE
# ============================================================

class CurrentState(BaseModel):
    goal: str = ""

    progress: List[str] = Field(
        default_factory=list
    )

    decisions: List[str] = Field(
        default_factory=list
    )

    failures: List[str] = Field(
        default_factory=list
    )

    blockers: List[str] = Field(
        default_factory=list
    )

    open_questions: List[str] = Field(
        default_factory=list
    )

    dependencies: List[str] = Field(
        default_factory=list
    )

    next_actions: List[str] = Field(
        default_factory=list
    )


# ============================================================
# TEAM MEMBER ENTRY
# ============================================================

class TeamEntry(BaseModel):
    """
    One piece of information submitted
    by one team member.

    Examples:

    cs log
    cs done
    cs blocked
    """

    entry_id: Optional[str] = None

    worker_id: str

    entry_type: str

    content: str

    source: str = "cli"

    metadata: Dict[str, Any] = Field(
        default_factory=dict
    )


# ============================================================
# CONFLICT
# ============================================================

class ConflictSide(BaseModel):
    worker_id: str

    position: str

    entry_id: Optional[str] = None


class Conflict(BaseModel):
    """
    Conflict detected between two
    team members.
    """

    topic: str

    side_a: ConflictSide

    side_b: ConflictSide

    reason: str = ""

    status: str = "unresolved"

    resolution: Optional[str] = None


# ============================================================
# TEAM RECONCILIATION RESULT
# ============================================================

class TeamReconciliationResult(BaseModel):
    """
    Result returned after Gemini merges
    a new team entry into project state.
    """

    updated_state: CurrentState

    conflict: Optional[Conflict] = None


# ============================================================
# OLD RESUME MODELS
#
# Keep these temporarily because your existing
# reconciliation.py may still import them.
# We can delete these once the new team workflow
# fully replaces resume mode.
# ============================================================

class TaskUpdate(BaseModel):
    task: str

    previous_status: str

    current_status: str

    reason: str

    evidence_ids: List[str] = Field(
        default_factory=list
    )


class Change(BaseModel):
    type: str

    description: str

    source: str

    evidence_id: str


class WhereYouLeftOff(BaseModel):
    goal: str

    previous_next_actions: List[str] = Field(
        default_factory=list
    )


class NextAction(BaseModel):
    action: str

    reason: str


class ReconciliationResult(BaseModel):
    where_you_left_off: WhereYouLeftOff

    changes: List[Change] = Field(
        default_factory=list
    )

    task_updates: List[TaskUpdate] = Field(
        default_factory=list
    )

    current_state: CurrentState

    next_action: NextAction