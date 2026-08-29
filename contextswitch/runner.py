from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from contextswitch.agent import root_agent
from contextswitch.initial_agent import initial_context_agent


# ============================================================
# CONSTANTS
# ============================================================

APP_NAME = "contextswitch"

USER_ID = "contextswitch_user"


# ============================================================
# SESSION SERVICE
# ============================================================

session_service = InMemorySessionService()


# ============================================================
# MAIN CONTEXTSWITCH RUNNER
# ============================================================

runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
)


# ============================================================
# INITIAL CONTEXT RUNNER
# ============================================================

initial_runner = Runner(
    agent=initial_context_agent,
    app_name=APP_NAME,
    session_service=session_service,
)


# ============================================================
# RUN MAIN AGENT
# ============================================================

async def run_contextswitch_agent(
    prompt: str,
) -> str:
    """
    Run the main ContextSwitch Gemini agent
    and return the final text response.
    """

    session_id = (
        "contextswitch_main_session"
    )

    # --------------------------------------------
    # Create session if it doesn't already exist
    # --------------------------------------------

    try:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=USER_ID,
            session_id=session_id,
        )
    except Exception:
        # Session probably already exists.
        pass

    # --------------------------------------------
    # Build user message
    # --------------------------------------------

    message = types.Content(
        role="user",
        parts=[
            types.Part(
                text=prompt
            )
        ],
    )

    final_response = ""

    # --------------------------------------------
    # Run agent
    # --------------------------------------------

    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=message,
    ):

        if not event.content:
            continue

        if not event.content.parts:
            continue

        for part in event.content.parts:

            text = getattr(
                part,
                "text",
                None,
            )

            if text:
                final_response = text

    return final_response


# ============================================================
# RUN INITIAL PROJECT CONTEXT AGENT
# ============================================================

async def run_initial_context_agent(
    prompt: str,
) -> str:
    """
    Run the Gemini agent used while initially
    understanding a GitHub project.
    """

    session_id = (
        "contextswitch_initial_session"
    )

    try:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=USER_ID,
            session_id=session_id,
        )
    except Exception:
        pass

    message = types.Content(
        role="user",
        parts=[
            types.Part(
                text=prompt
            )
        ],
    )

    final_response = ""

    async for event in initial_runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=message,
    ):

        if not event.content:
            continue

        if not event.content.parts:
            continue

        for part in event.content.parts:

            text = getattr(
                part,
                "text",
                None,
            )

            if text:
                final_response = text

    return final_response