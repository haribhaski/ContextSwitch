import json

from contextswitch.schemas import ReconciliationResult
from contextswitch.runner import run_contextswitch_agent


def build_reconciliation_prompt(
    previous_state: dict,
    new_evidence: list
) -> str:

    return f"""
PREVIOUS_WORK_STATE

{json.dumps(previous_state, indent=2)}

NEW_EVIDENCE

{json.dumps(new_evidence, indent=2)}
"""


def validate_reconciliation(
    raw_output: str
) -> ReconciliationResult:

    data = json.loads(raw_output)

    return ReconciliationResult.model_validate(data)


async def reconcile_state(
    previous_state: dict,
    new_evidence: list
) -> ReconciliationResult:

    prompt = build_reconciliation_prompt(
        previous_state,
        new_evidence
    )

    raw_output = await run_contextswitch_agent(prompt)

    result = validate_reconciliation(raw_output)

    return result