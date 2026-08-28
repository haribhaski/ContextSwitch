import json
from contextswitch.schemas import ReconciliationResult

raw_output = """
{
  "where_you_left_off": {
    "goal": "Compare scalar gating and vector gating in our memory-augmented GPT-2 model.",
    "previous_next_actions": [
      "Implement scalar gate"
    ]
  },

  "changes": [
    {
      "type": "task_completed",
      "description": "Scalar gate implemented and added to training pipeline.",
      "source": "github",
      "evidence_id": "github_8f32a1"
    }
  ],

  "task_updates": [
    {
      "task": "Implement scalar gate",
      "previous_status": "pending",
      "current_status": "completed",
      "reason": "The GitHub commit shows that the scalar gate was implemented."
    }
  ],

  "current_state": {
    "goal": "Compare scalar and vector gating using perplexity, effective rank, and slot utilization.",
    "progress": [
      "GPT-2 baseline completed.",
      "Vector gate experiment completed.",
      "Scalar gate experiment completed."
    ],
    "decisions": [
      "Use identical hyperparameters for both gate types."
    ],
    "failures": [
      "Optimizer state mismatch while resuming checkpoint."
    ],
    "blockers": [
      "75% of memory slots are unused."
    ],
    "open_questions": [
      "Does vector gating reduce slot collapse?"
    ],
    "dependencies": []
  },

  "next_action": {
    "action": "Calculate effective rank and slot utilization for scalar and vector gate checkpoints.",
    "reason": "The project guide requested these metrics."
  }
}
"""

data = json.loads(raw_output)

result = ReconciliationResult.model_validate(data)

print("VALID")
print("Goal:", result.current_state.goal)
print("Next action:", result.next_action.action)