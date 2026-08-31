import os
import aiohttp
from dotenv import load_dotenv

load_dotenv()

# Patch aiohttp for google-genai SDK compatibility
if not hasattr(aiohttp, "ClientConnectorDNSError"):
    setattr(aiohttp, "ClientConnectorDNSError", getattr(aiohttp, "ClientConnectorError", Exception))

if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")
if os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("GOOGLE_API_KEY")

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

import asyncio

async def _call_initial_agent(prompt: str) -> str:
    session_id = "contextswitch_initial_session"

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
        parts=[types.Part(text=prompt)],
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
            text = getattr(part, "text", None)
            if text:
                final_response = text

    return final_response


async def run_initial_context_agent(
    prompt: str,
) -> str:
    """
    Run the Gemini agent used while initially
    understanding a GitHub project with retries for temporary 503 high demand.
    """
    max_retries = 3
    delay = 2.0
    last_exc = None

    for attempt in range(max_retries):
        try:
            return await _call_initial_agent(prompt)
        except Exception as exc:
            last_exc = exc
            err_str = str(exc).lower()
            if "503" in err_str or "unavailable" in err_str or "high demand" in err_str:
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
            raise exc

    if last_exc:
        raise last_exc
    return ""