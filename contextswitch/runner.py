from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from contextswitch.initial_agent import initial_context_agent


APP_NAME = "contextswitch"
USER_ID = "local_user"


session_service = InMemorySessionService()

async def run_initial_context_agent(prompt: str) -> str:

    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
    )

    message = types.Content(
        role="user",
        parts=[
            types.Part(text=prompt)
        ],
    )

    final_text = ""

    async for event in initial_runner.run_async(
        user_id=USER_ID,
        session_id=session.id,
        new_message=message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    final_text += part.text

    return final_text

initial_runner = Runner(
    app_name=APP_NAME,
    agent=initial_context_agent,
    session_service=session_service,
)


async def run_contextswitch_agent(prompt: str) -> str:
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
    )

    message = types.Content(
        role="user",
        parts=[
            types.Part(text=prompt)
        ],
    )

    final_text = ""

    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session.id,
        new_message=message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    final_text += part.text

    return final_text