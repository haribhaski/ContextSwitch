import asyncio

from contextswitch.connectors.github import (
    get_initial_project_evidence
)

from contextswitch.initial_context import (
    build_initial_state
)


async def main():

    evidence = get_initial_project_evidence(
        owner = "haribhaski",
                repo = "Financial-Specific-CHAT-BOT-Using-Hybrid-RAG-System-with-Citation-Enforcement",
            )

    state = await build_initial_state(
        evidence
    )

    print("\nPROJECT GOAL")
    print(state.goal)

    print("\nPROGRESS")

    for item in state.progress:
        print("-", item)

    print("\nBLOCKERS")

    for item in state.blockers:
        print("-", item)

    print("\nNEXT ACTIONS")

    for item in state.next_actions:
        print("-", item)


asyncio.run(main())