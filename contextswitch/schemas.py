from typing import List
from pydantic import BaseModel
from typing import List

class TaskUpdate(BaseModel):
    task: str
    previous_status: str
    current_status: str
    reason: str
    evidence_ids: List[str] = []

class Change(BaseModel):
    type: str
    description: str
    source: str
    evidence_id: str

class WhereYouLeftOff(BaseModel):
    goal: str
    previous_next_actions: List[str]


class CurrentState(BaseModel):
    goal: str
    progress: List[str]
    decisions: List[str]
    failures: List[str]
    blockers: List[str]
    open_questions: List[str]
    dependencies: List[str]
    next_actions: List[str] = []


class NextAction(BaseModel):
    action: str
    reason: str


class ReconciliationResult(BaseModel):
    where_you_left_off: WhereYouLeftOff
    changes: List[Change]
    task_updates: List[TaskUpdate]
    current_state: CurrentState
    next_action: NextAction