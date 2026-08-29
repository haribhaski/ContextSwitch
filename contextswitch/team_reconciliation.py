import json
from typing import Any

from contextswitch.runner import run_contextswitch_agent


# ============================================================
# PROMPT BUILDER
# ============================================================

def build_team_reconciliation_prompt(
    current_state: dict,
    new_entry: dict,
    recent_entries: list[dict],
) -> str:
    """
    Build the prompt that asks Gemini to merge a new
    teammate update into the shared project state.

    It also checks whether the new update conflicts with
    decisions made by other teammates.
    """

    return f"""
You are the shared memory manager for a software development team.

Your job is to maintain ONE consistent shared project state
across multiple developers and AI coding tools.

You will receive:

1. The current shared project state
2. A new entry submitted by one team member
3. Recent entries from other team members

You must update the project state and detect conflicts.


============================================================
CURRENT SHARED PROJECT STATE
============================================================

{json.dumps(current_state, indent=2, default=str)}


============================================================
NEW TEAM ENTRY
============================================================

{json.dumps(new_entry, indent=2, default=str)}


============================================================
RECENT TEAM ENTRIES
============================================================

{json.dumps(recent_entries, indent=2, default=str)}


============================================================
YOUR TASK
============================================================

First classify the new entry.

Possible entry types include:

- decision
- completed
- blocker
- failure
- note
- conflict_resolution


Then update the shared project state.

The shared state contains:

- goal
- progress
- decisions
- failures
- blockers
- open_questions
- dependencies
- next_actions


RULES:

1. Do not invent information.

2. Do not duplicate information already present.

3. If entry type is "completed":
   - add it to progress
   - remove matching items from blockers or next_actions
     when appropriate

4. If entry type is "blocker":
   - add it to blockers

5. If entry type is "failure":
   - add it to failures
   - preserve WHY it failed if provided

6. If entry type is "decision":
   - add or update the relevant decision

7. If a NEWER entry from the SAME worker changes an older
   decision from that same worker:
   - treat it as an update
   - do NOT create a conflict

8. If TWO DIFFERENT workers hold incompatible positions
   about the same project topic:
   - create a conflict

Example:

Hariharan:
"Use ChromaDB because Pinecone is too expensive"

Jeevan:
"Use Pinecone because retrieval quality is better"

These are conflicting decisions about the same topic.

9. Do NOT flag different opinions as a conflict unless they
   actually cannot both be true or followed at the same time.

Example:

"Use FastAPI"
and
"Add caching"

are NOT conflicts.

10. A completed or resolved task should not remain as a
    next action.

11. Preserve useful reasoning.

Bad:
"Redis rejected"

Better:
"Redis rejected because latency increased to 800ms under load."

12. The newest evidence should be preferred when project
    state clearly changed.


============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

Return exactly this structure:

{{
  "updated_state": {{
    "goal": "",
    "progress": [],
    "decisions": [],
    "failures": [],
    "blockers": [],
    "open_questions": [],
    "dependencies": [],
    "next_actions": []
  }},

  "conflict": null
}}

If a conflict is detected, return:

{{
  "updated_state": {{
    "goal": "",
    "progress": [],
    "decisions": [],
    "failures": [],
    "blockers": [],
    "open_questions": [],
    "dependencies": [],
    "next_actions": []
  }},

  "conflict": {{
    "topic": "",
    "side_a": {{
      "worker_id": "",
      "position": "",
      "entry_id": ""
    }},
    "side_b": {{
      "worker_id": "",
      "position": "",
      "entry_id": ""
    }},
    "reason": ""
  }}
}}

IMPORTANT:

If there is no genuine conflict:

"conflict": null

Do not return markdown.
Do not return explanations outside the JSON.
"""


# ============================================================
# JSON CLEANUP
# ============================================================

def clean_json_output(raw_output: str) -> str:
    """
    Gemini sometimes wraps JSON in ```json ... ```.
    Remove that safely.
    """

    cleaned = raw_output.strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json"):]

    elif cleaned.startswith("```"):
        cleaned = cleaned[len("```"):]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    return cleaned.strip()


# ============================================================
# VALIDATION
# ============================================================

def validate_team_reconciliation(
    raw_output: str,
) -> dict[str, Any]:
    """
    Parse and perform lightweight validation.
    """

    cleaned = clean_json_output(
        raw_output
    )

    try:
        result = json.loads(cleaned)

    except json.JSONDecodeError as exc:

        raise ValueError(
            "Gemini returned invalid JSON:\n"
            f"{cleaned}"
        ) from exc

    if "updated_state" not in result:

        raise ValueError(
            "Gemini response missing "
            "'updated_state'"
        )

    state = result["updated_state"]

    required_state_fields = [
        "goal",
        "progress",
        "decisions",
        "failures",
        "blockers",
        "open_questions",
        "dependencies",
        "next_actions",
    ]

    for field in required_state_fields:

        if field not in state:

            raise ValueError(
                "Gemini updated_state missing "
                f"'{field}'"
            )

    if "conflict" not in result:

        result["conflict"] = None

    return result


# ============================================================
# MAIN TEAM RECONCILIATION FUNCTION
# ============================================================

async def reconcile_team_entry(
    current_state: dict,
    new_entry: dict,
    recent_entries: list[dict],
) -> dict:
    """
    Main function used by backend.py.

    Flow:

    current shared state
            +
    new teammate entry
            +
    recent teammate history
            ↓
         Gemini
            ↓
    updated shared state
            +
    optional conflict
    """

    prompt = build_team_reconciliation_prompt(
        current_state=current_state,
        new_entry=new_entry,
        recent_entries=recent_entries,
    )

    raw_output = await run_contextswitch_agent(
        prompt
    )

    result = validate_team_reconciliation(
        raw_output
    )

    return result