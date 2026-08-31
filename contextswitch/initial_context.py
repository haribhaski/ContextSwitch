import json
import re

from contextswitch.runner import run_initial_context_agent
from contextswitch.schemas import CurrentState


def clean_json_output(raw_output: str) -> str:
    """
    Gemini sometimes wraps JSON in ```json ... ``` or includes trailing markdown text.
    Clean and extract the JSON object safely.
    """
    cleaned = raw_output.strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json"):]
    elif cleaned.startswith("```"):
        cleaned = cleaned[len("```"):]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    cleaned = cleaned.strip()

    if not (cleaned.startswith("{") and cleaned.endswith("}")):
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            cleaned = cleaned[first_brace:last_brace + 1]

    return cleaned


async def build_initial_state(
    evidence: list
) -> CurrentState:

    prompt = f"""
You are creating the FIRST ContextSwitch snapshot
for a newly connected project.

There is no previous project state.

Analyze the available evidence and infer ONLY what
the evidence supports.

EVIDENCE:

{json.dumps(evidence, indent=2)}

Determine:

- project goal
- progress already made
- important decisions
- known failures
- blockers
- open questions
- dependencies
- likely next actions

Do NOT invent missing information.

If something cannot be determined, use an empty list.

Return ONLY valid JSON:

{{
  "goal": "",
  "progress": [],
  "decisions": [],
  "failures": [],
  "blockers": [],
  "open_questions": [],
  "dependencies": [],
  "next_actions": []
}}
"""

    raw_output = await run_initial_context_agent(prompt)
    cleaned = clean_json_output(raw_output)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        data = {
            "goal": "Initial repository context generated",
            "progress": [],
            "decisions": [],
            "failures": [],
            "blockers": [],
            "open_questions": [],
            "dependencies": [],
            "next_actions": [],
        }

    return CurrentState.model_validate(data)