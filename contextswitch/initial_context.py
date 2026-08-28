import json

from contextswitch.runner import run_initial_context_agent
from contextswitch.schemas import CurrentState


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
    data = json.loads(raw_output)
    return CurrentState.model_validate(data)