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


def clean_json_output(raw_output: str) -> str:
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

    return cleaned.strip()


def validate_reconciliation(
    raw_output: str
) -> ReconciliationResult:

    cleaned = clean_json_output(raw_output)
    data = json.loads(cleaned)

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