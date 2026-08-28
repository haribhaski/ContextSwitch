import asyncio

from contextswitch.reconciliation import reconcile_state


previous_state = {
    "goal": "Compare scalar and vector gating",
    "progress": [
        "GPT-2 baseline completed",
        "Vector gate experiment completed"
    ],
    "decisions": [
        "Use identical hyperparameters"
    ],
    "failures": [
        "Optimizer state mismatch"
    ],
    "blockers": [
        "75% memory slots unused"
    ],
    "open_questions": [
        "Does vector gating reduce slot collapse?"
    ],
    "dependencies": [
        "Waiting for guide feedback"
    ],
    "next_actions": [
        "Implement scalar gate"
    ]
}


new_evidence = [
    {
        "id": "github_8f32a1",
        "source": "github",
        "type": "commit",
        "content": "Jeevan implemented scalar gate."
    },

    {
        "id": "experiment_scalar_001",
        "source": "experiment",
        "type": "result",
        "content": "Scalar gate validation perplexity: 31.84."
    },

    {
        "id": "email_guide_001",
        "source": "gmail",
        "type": "email",
        "content": "Compare effective rank and slot utilization."
    }
]


async def main():
    result = await reconcile_state(
        previous_state,
        new_evidence
    )

    print("\nVALID RESULT\n")

    print("Goal:")
    print(result.current_state.goal)

    print("\nNext action:")
    print(result.next_action.action)

    print("\nReason:")
    print(result.next_action.reason)


asyncio.run(main())