import asyncio

from contextswitch.connectors.github import (
    get_recent_commits,
    normalize_commits
)

from contextswitch.reconciliation import reconcile_state


previous_state = {
    "goal": "Compare scalar and vector gating",
    "progress": [
        "Vector gate experiment completed"
    ],
    "decisions": [],
    "failures": [],
    "blockers": [],
    "open_questions": [],
    "dependencies": [],
    "next_actions": [
        "Implement scalar gate"
    ]
}


async def main():

    commits = get_recent_commits(
        owner = "haribhaski",
        repo = "Financial-Specific-CHAT-BOT-Using-Hybrid-RAG-System-with-Citation-Enforcement",
        limit=10
    )

    evidence = normalize_commits(commits)

    result = await reconcile_state(
        previous_state,
        evidence
    )

    print("\nCURRENT GOAL:")
    print(result.current_state.goal)

    print("\nNEXT ACTION:")
    print(result.next_action.action)

    print("\nCHANGES:")

    for change in result.changes:
        print("-", change.description)


asyncio.run(main())