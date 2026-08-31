"""
ContextSwitch - Gemini shared-chat import feature.

Install:
    pip install google-genai playwright
    playwright install chromium

This module accepts ONLY public Gemini share links.

Flow:
1. Validate Gemini share URL
2. Render Gemini public page using Playwright
3. Extract detailed reasoning with Gemini
4. Save a pending import to Firestore
5. Let user approve selected items
6. Save approved memory items
7. Feed each approved item through the SAME reconciliation flow
   used by normal ContextSwitch entries
8. Expose member-wise memory
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Header, HTTPException
from google import genai
from google.genai import types
from playwright.async_api import async_playwright
from pydantic import BaseModel, Field

from contextswitch.storage import (
    add_entry,
    db,
    get_entries,
    get_project,
    save_conflict,
    save_snapshot,
    update_project_state,
)

from contextswitch.team_reconciliation import (
    reconcile_team_entry,
)


router = APIRouter()


# ============================================================
# CONFIG
# ============================================================

ALLOWED_EXTRACT_TYPES = {
    "decision",
    "micro_decision",
    "completed",
    "failure",
    "rejected_alternative",
    "assumption",
    "constraint",
    "blocker",
    "open_question",
    "todo",
    "technical_discovery",
    "dependency",
    "architecture_change",
    "do_not_repeat",
    "risk_flag",
    "idea",
}

MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.6-flash",
)

MAX_CHAT_CHARS = int(
    os.getenv(
        "CONTEXTSWITCH_MAX_CHAT_CHARS",
        "120000",
    )
)


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class AnalyzeChatRequest(BaseModel):
    source: Literal["gemini"] = "gemini"

    url: str

    worker_id: str = Field(
        min_length=1,
        max_length=256,
    )

    extract: list[str] = Field(
        default_factory=lambda: sorted(
            ALLOWED_EXTRACT_TYPES
        )
    )


class ApproveImportRequest(BaseModel):
    approved_item_ids: list[str] = Field(
        min_length=1
    )


class ExtractedItem(BaseModel):
    id: str

    type: str

    title: str

    content: str

    reason: str | None = None

    evidence: str | None = None

    confidence: float = 0.5

    explicitness: Literal[
        "explicit",
        "inferred",
    ] | None = None

    severity: Literal[
        "low",
        "medium",
        "high",
        "critical",
    ] | None = None

    likelihood: Literal[
        "low",
        "medium",
        "high",
    ] | None = None

    impact: str | None = None

    what_breaks_if_false: str | None = None

    validation_step: str | None = None

    alternatives: list[str] = Field(
        default_factory=list
    )

    tags: list[str] = Field(
        default_factory=list
    )


class ExtractionResult(BaseModel):
    conversation_title: str | None = None

    summary: str | None = None

    items: list[ExtractedItem] = Field(
        default_factory=list
    )


# ============================================================
# HELPERS
# ============================================================

def utc_now() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def project_ref(
    team_id: str,
    project_id: str,
):
    return (
        db.collection("teams")
        .document(team_id)
        .collection("projects")
        .document(project_id)
    )


import re
from urllib.parse import urlparse

GEMINI_SHARE_URL_PATTERN = re.compile(
    r"^https://(?:"
    r"share\.gemini\.google/[A-Za-z0-9_-]+"
    r"|"
    r"g\.co/gemini/share/[A-Za-z0-9_-]+"
    r")/?$",
    re.IGNORECASE,
)


def validate_gemini_share_url(url: str) -> str:
    url = url.strip()

    if not GEMINI_SHARE_URL_PATTERN.match(url):
        raise ValueError(
            "Only public Gemini share URLs like "
            "https://share.gemini.google/u6QHQZhANgrA "
            "or https://g.co/gemini/share/abcxyz are supported."
        )

    parsed = urlparse(url)

    allowed_hosts = {
        "share.gemini.google",
        "g.co",
    }

    if parsed.scheme != "https":
        raise ValueError(
            "Gemini share URL must use HTTPS."
        )

    if parsed.hostname not in allowed_hosts:
        raise ValueError(
            "Unsupported Gemini share URL."
        )

    return url


async def fetch_gemini_share_text(url: str) -> tuple[str, str, str]:
    from playwright.async_api import (
        async_playwright,
        TimeoutError as PlaywrightTimeoutError,
    )

    print(f"[Gemini Import] Opening: {url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
        )

        context = await browser.new_context(
            viewport={
                "width": 1440,
                "height": 1200,
            },
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            ),
        )

        page = await context.new_page()

        try:
            # -------------------------------------------------
            # OPEN GEMINI SHARE PAGE
            # -------------------------------------------------

            response = await page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=60000,
            )

            print(
                "[Gemini Import] HTTP status:",
                response.status if response else "unknown",
            )

            final_url = page.url

            print(
                "[Gemini Import] Final URL:",
                final_url,
            )

            # Gemini can keep network requests alive,
            # so don't fail if networkidle times out.
            try:
                await page.wait_for_load_state(
                    "networkidle",
                    timeout=15000,
                )
            except PlaywrightTimeoutError:
                pass

            # Give client-side rendering a little extra time.
            await page.wait_for_timeout(4000)

            browser_title = (await page.title()).strip()

            print(
                "[Gemini Import] Page title:",
                browser_title,
            )

            # -------------------------------------------------
            # HANDLE COOKIE / CONSENT POPUPS
            # -------------------------------------------------

            possible_buttons = [
                "Accept all",
                "I agree",
                "Accept",
                "Continue",
                "Got it",
            ]

            for button_text in possible_buttons:
                try:
                    button = page.get_by_role(
                        "button",
                        name=button_text,
                    )

                    if await button.count() > 0:
                        first_button = button.first

                        if await first_button.is_visible():
                            print(
                                f"[Gemini Import] Clicking consent button: "
                                f"{button_text}"
                            )

                            await first_button.click()

                            await page.wait_for_timeout(
                                1200
                            )

                except Exception:
                    pass

            # -------------------------------------------------
            # GET FULL RENDERED BODY TEXT
            # -------------------------------------------------

            body_text = ""

            try:
                body_text = await page.locator(
                    "body"
                ).inner_text(
                    timeout=10000
                )
            except Exception as exc:
                print(
                    "[Gemini Import] Failed to read body text:",
                    exc,
                )

            body_text = (
                body_text or ""
            ).strip()

            print(
                "[Gemini Import] Body text length:",
                len(body_text),
            )

            print(
                "[Gemini Import] Body preview:"
            )

            print(
                body_text[:2000]
            )

            # -------------------------------------------------
            # FALLBACK SELECTOR EXTRACTION
            # -------------------------------------------------

            selectors = [
                "main",
                "[role='main']",
                "article",
                "[data-test-id]",
                ".conversation",
                ".response-container",
                ".model-response-text",
                ".query-text",
            ]

            extracted_parts = []

            for selector in selectors:
                try:
                    elements = page.locator(
                        selector
                    )

                    count = await elements.count()

                    for index in range(
                        min(count, 100)
                    ):
                        try:
                            text = (
                                await elements.nth(
                                    index
                                ).inner_text(
                                    timeout=2000
                                )
                            ).strip()

                            if (
                                text
                                and len(text) > 20
                                and text not in extracted_parts
                            ):
                                extracted_parts.append(
                                    text
                                )

                        except Exception:
                            continue

                except Exception:
                    continue

            selector_text = "\n\n".join(
                extracted_parts
            ).strip()

            print(
                "[Gemini Import] Selector extracted length:",
                len(selector_text),
            )

            # -------------------------------------------------
            # IMPORTANT:
            # Prefer body_text.
            #
            # Gemini's selector tree can contain duplicate
            # copies of the same conversation.
            # -------------------------------------------------

            if len(body_text) >= 200:
                conversation_text = body_text

            elif len(selector_text) >= 200:
                conversation_text = selector_text

            else:
                conversation_text = ""

            # -------------------------------------------------
            # DETECT ACTUAL FAILURE PAGES
            # -------------------------------------------------

            lowered = conversation_text.lower()

            failure_markers = [
                "page not found",
                "conversation not found",
                "this shared conversation is unavailable",
                "this conversation is unavailable",
                "the requested conversation could not be found",
            ]

            if len(conversation_text) < 100:
                print(
                    "[Gemini Import] Conversation text is too short."
                )

                print(
                    "[Gemini Import] Final rendered text:"
                )

                print(
                    conversation_text[:3000]
                )

                raise ValueError(
                    "The Gemini share page opened, but no readable "
                    "conversation was found."
                )

            if any(
                marker in lowered
                for marker in failure_markers
            ):
                print(
                    "[Gemini Import] Gemini returned an unavailable "
                    "conversation page."
                )

                print(
                    conversation_text[:3000]
                )

                raise ValueError(
                    "This Gemini conversation is unavailable "
                    "or has been removed."
                )

            # -------------------------------------------------
            # CLEAN GEMINI PAGE CHROME
            # -------------------------------------------------

            lines = [
                line.strip()
                for line in conversation_text.splitlines()
                if line.strip()
            ]

            skip_exact = {
                "Gemini",
                "About Gemini",
                "Get Gemini App",
                "Subscriptions",
                "For Business",
                "Sign in",
                "Google Privacy Policy",
                "Google Terms of Service",
                "Your privacy & Gemini Apps",
                "Opens in a new window",
                (
                    "Gemini may display inaccurate info, including "
                    "about people, so double-check its responses."
                ),
            }

            cleaned_lines = []

            for line in lines:
                if line in skip_exact:
                    continue

                cleaned_lines.append(
                    line
                )

            conversation_text = "\n".join(
                cleaned_lines
            ).strip()

            # -------------------------------------------------
            # FINAL VALIDATION
            # -------------------------------------------------

            if len(conversation_text) < 100:
                raise ValueError(
                    "Gemini conversation was found, but there was "
                    "not enough readable content to import."
                )

            print(
                "[Gemini Import] Successfully extracted",
                len(conversation_text),
                "characters",
            )

            print(
                "[Gemini Import] Cleaned preview:"
            )

            print(
                conversation_text[:2000]
            )

            return (
                final_url,
                browser_title,
                conversation_text,
            )

        finally:
            await context.close()
            await browser.close()


# ============================================================
# EXTRACTION PROMPT
# ============================================================

def extraction_prompt(
    *,
    project_state: dict[str, Any],
    worker_id: str,
    extract_types: list[str],
    conversation_text: str,
) -> str:

    types_text = ", ".join(
        extract_types
    )

    return f"""
You are ContextSwitch's forensic reasoning extraction agent.

Your job is NOT to merely summarize this AI conversation.

Your job is to reconstruct the smallest useful units of
project reasoning that another teammate or AI assistant
would need later.

CONVERSATION OWNER / TEAMMATE:
{worker_id}

CURRENT SHARED PROJECT STATE:
{json.dumps(project_state, ensure_ascii=False, indent=2)}

ALLOWED EXTRACTION TYPES:
{types_text}

============================================================
EXTRACTION RULES
============================================================

1. MICRO-DECISIONS

Extract small implementation choices such as:
- temporary decisions
- defaults
- scope cuts
- naming choices
- interface choices
- sequencing choices
- local architectural choices
- "for now" decisions
- implementation details that later work may depend on

Do NOT only extract major architecture decisions.


2. ASSUMPTIONS — GO VERY HARD HERE

Search aggressively for assumptions.

Assumptions may be:

- explicitly stated
- implied by a proposed implementation
- hidden behind a recommendation
- environmental assumptions
- authentication assumptions
- authorization assumptions
- permission assumptions
- data/schema assumptions
- API behavior assumptions
- scale assumptions
- performance assumptions
- cost assumptions
- team ownership assumptions
- deployment assumptions
- runtime assumptions
- dependency assumptions
- sequencing assumptions
- product assumptions
- user-behaviour assumptions
- version / compatibility assumptions
- security / trust assumptions

For EVERY assumption:

- say whether it is explicit or inferred
- provide evidence from the conversation
- assign confidence from 0.0 to 1.0
- state what breaks if the assumption is false
- provide a concrete validation step

Do NOT claim an inferred assumption was explicitly stated.

Do NOT invent assumptions with no textual basis.

Prefer several small specific assumptions over one vague assumption.


3. RISK FLAGS

Identify risks even if nobody literally says "risk".

Look for:

- security problems
- auth/authz problems
- cross-team data leakage
- fragile hardcoded values
- hidden coupling
- race conditions
- concurrent Firestore writes
- destructive overwrites
- stale state
- missing validation
- missing error handling
- deployment differences
- cost/scaling problems
- dependency/API instability
- privacy exposure
- user-error risk
- confusing UX
- technical debt
- demo-breaking fragility
- single-machine assumptions
- credentials/configuration mismatches

Every risk_flag must include:

severity:
    low | medium | high | critical

likelihood:
    low | medium | high

impact:
    what specifically goes wrong


4. OPEN QUESTIONS

Extract:

- direct unanswered questions
- deferred decisions
- uncertain alternatives
- missing information
- unresolved implementation details
- questions answered only speculatively
- decisions that still require validation

Do NOT keep a question open if the later conversation
clearly resolves it.


5. MEMBER-WISE ATTRIBUTION

Everything extracted from this conversation belongs to:
{worker_id}

Focus on what this teammate:

- decided
- implemented
- completed
- attempted
- rejected
- discovered
- is blocked by
- assumes
- still needs to answer
- is exposed to as a risk


6. DECISION VS IDEA

Statements like:

"maybe..."
"could..."
"we might..."
"what if..."

are ideas unless the conversation later commits to them.

Do not convert brainstorming into decisions.


7. FAILURE VS REJECTED ALTERNATIVE

failure:
    actually attempted and it failed or produced
    an unacceptable result

rejected_alternative:
    considered but deliberately not chosen


8. DO-NOT-REPEAT

Extract a do_not_repeat item if the conversation shows
that an approach should not be tried again unless some
condition changes.

Preserve why it failed.


9. TECHNICAL DISCOVERY

Extract useful technical findings such as:

- why a bug occurred
- API behavior
- framework limitation
- permission behavior
- schema discovery
- integration discovery
- unexpected runtime behavior


10. EVIDENCE

Evidence must be short.

Use a concise paraphrase or short excerpt-like fragment.

Do NOT dump large portions of the conversation.


11. DEDUPLICATION

Do not emit duplicates.

However, one passage can legitimately create:

- a decision
- an assumption
- a risk

because these serve different memory purposes.


12. CURRENT PROJECT STATE COMPARISON

Compare new reasoning against the existing project state.

If the conversation appears to:

- supersede an old decision
- invalidate an assumption
- contradict another teammate
- make an old task obsolete
- resolve an old question
- introduce a new risk

extract the relevant memory item.

Do NOT silently rewrite history.


============================================================
RETURN FORMAT
============================================================

Return STRICT JSON ONLY.

No markdown.

Use:

{{
  "conversation_title": "short title or null",
  "summary": "2-4 sentence reasoning-focused summary",
  "items": [
    {{
      "id": "tmp-1",
      "type": "one allowed extraction type",
      "title": "short label",
      "content": "atomic reusable project-memory statement",
      "reason": "why / rationale if known",
      "evidence": "short evidence from the chat",
      "confidence": 0.0,
      "explicitness": "explicit|inferred|null",
      "severity": "low|medium|high|critical|null",
      "likelihood": "low|medium|high|null",
      "impact": "risk impact or null",
      "what_breaks_if_false": "for assumptions or null",
      "validation_step": "for assumptions or null",
      "alternatives": [],
      "tags": []
    }}
  ]
}}

============================================================
CONVERSATION
============================================================

{conversation_text}
"""


# ============================================================
# EXTRACTION NORMALIZATION
# ============================================================

def normalize_extracted_result(
    result: ExtractionResult,
    requested_types: set[str],
) -> ExtractionResult:

    cleaned: list[
        ExtractedItem
    ] = []

    seen: set[
        tuple[str, str]
    ] = set()

    for item in result.items:

        if (
            item.type
            not in requested_types
        ):
            continue

        item.confidence = max(
            0.0,
            min(
                1.0,
                float(
                    item.confidence
                ),
            ),
        )

        normalized_content = re.sub(
            r"\s+",
            " ",
            item.content
            .strip()
            .lower(),
        )

        key = (
            item.type,
            normalized_content,
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        if (
            item.type
            == "assumption"
        ):

            if not item.explicitness:
                item.explicitness = (
                    "inferred"
                )

            if not item.evidence:
                item.confidence = min(
                    item.confidence,
                    0.45,
                )

        cleaned.append(
            item
        )

    return ExtractionResult(
        conversation_title=
            result.conversation_title,

        summary=
            result.summary,

        items=
            cleaned,
    )


# ============================================================
# CALL GEMINI
# ============================================================

async def extract_with_gemini(
    *,
    project_state: dict[str, Any],
    worker_id: str,
    extract_types: list[str],
    conversation_text: str,
) -> ExtractionResult:

    client = genai.Client()

    prompt = extraction_prompt(
        project_state=
            project_state,

        worker_id=
            worker_id,

        extract_types=
            extract_types,

        conversation_text=
            conversation_text,
    )

    response = (
        client.models.generate_content(
            model=
                MODEL,

            contents=
                prompt,

            config=
                types.GenerateContentConfig(
                    response_mime_type=
                        "application/json",

                    temperature=
                        0.15,
                ),
        )
    )

    raw = (
        response.text
        or "{}"
    )

    try:

        parsed = json.loads(
            raw
        )

    except json.JSONDecodeError as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned invalid "
                f"structured JSON: {exc}"
            ),
        ) from exc

    result = (
        ExtractionResult
        .model_validate(
            parsed
        )
    )

    return (
        normalize_extracted_result(
            result,
            set(
                extract_types
            ),
        )
    )


# ============================================================
# MEMBER LOOKUP
# ============================================================

def find_member(
    team_id: str,
    project_id: str,
    worker_id: str,
) -> dict[str, Any] | None:

    # First check project membership.
    member_doc = (
        project_ref(
            team_id,
            project_id,
        )
        .collection(
            "members"
        )
        .document(
            worker_id
        )
        .get()
    )

    if member_doc.exists:
        return {
            "id":
                member_doc.id,

            **(
                member_doc.to_dict()
                or {}
            ),
        }

    # Then team-level membership.
    team_member_doc = (
        db.collection(
            "teams"
        )
        .document(
            team_id
        )
        .collection(
            "members"
        )
        .document(
            worker_id
        )
        .get()
    )

    if team_member_doc.exists:
        return {
            "id":
                team_member_doc.id,

            **(
                team_member_doc
                .to_dict()
                or {}
            ),
        }

    return None


# ============================================================
# ANALYZE GEMINI CHAT
# ============================================================

@router.post(
    "/teams/{team_id}/projects/"
    "{project_id}/imports/chat/analyze"
)
async def analyze_chat_import(
    team_id: str,
    project_id: str,
    payload: AnalyzeChatRequest,

    x_user_email: str | None =
        Header(
            default=None,
            alias="X-User-Email",
        ),
):

    try:
        url = validate_gemini_share_url(
            payload.url
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    invalid = [
        value
        for value
        in payload.extract
        if value
        not in ALLOWED_EXTRACT_TYPES
    ]

    if invalid:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported extraction "
                f"types: {invalid}"
            ),
        )

    member = find_member(
        team_id=
            team_id,

        project_id=
            project_id,

        worker_id=
            payload.worker_id,
    )

    if not member:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{payload.worker_id!r} "
                "is not a member of this "
                "team/project. Add the "
                "teammate first."
            ),
        )

    p_ref = project_ref(
        team_id,
        project_id,
    )

    p_doc = (
        p_ref.get()
    )

    if not p_doc.exists:
        raise HTTPException(
            status_code=404,
            detail=(
                "Project not found."
            ),
        )

    project = (
        p_doc.to_dict()
        or {}
    )

    current_state = (
        project.get(
            "current_state"
        )
        or {}
    )

    try:
        (
            final_url,
            browser_title,
            conversation_text,
        ) = await fetch_gemini_share_text(
            url
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        print(
            "[Gemini Import] Failed to read Gemini share page:",
            repr(exc),
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Failed to read the Gemini share page. "
                "Check that the public link still works and that "
                "Playwright Chromium is installed."
            ),
        ) from exc

    content_hash = hashlib.sha256(
        conversation_text.encode(
            "utf-8"
        )
    ).hexdigest()

    # Duplicate import detection.
    same_imports = (
        p_ref
        .collection(
            "imports"
        )
        .where(
            "content_hash",
            "==",
            content_hash,
        )
        .limit(1)
        .stream()
    )

    existing = next(
        iter(
            same_imports
        ),
        None,
    )

    if existing is not None:

        existing_data = (
            existing.to_dict()
            or {}
        )

        if (
            existing_data.get(
                "status"
            )
            == "approved"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This Gemini conversation "
                    "snapshot has already been "
                    "imported."
                ),
            )

    extraction = (
        await extract_with_gemini(
            project_state=
                current_state,

            worker_id=
                payload.worker_id,

            extract_types=
                payload.extract,

            conversation_text=
                conversation_text,
        )
    )

    import_id = (
        "imp_"
        + uuid.uuid4().hex[
            :16
        ]
    )

    now = utc_now()

    items: list[
        dict[str, Any]
    ] = []

    for index, item in enumerate(
        extraction.items,
        start=1,
    ):

        item_dict = (
            item.model_dump()
        )

        item_dict[
            "id"
        ] = (
            f"{import_id}_item_"
            f"{index:03d}"
        )

        item_dict[
            "worker_id"
        ] = (
            payload.worker_id
        )

        item_dict[
            "worker_name"
        ] = (
            member.get(
                "name"
            )
            or
            payload.worker_id
        )

        item_dict[
            "source"
        ] = "gemini"

        item_dict[
            "source_url"
        ] = final_url

        item_dict[
            "import_id"
        ] = import_id

        items.append(
            item_dict
        )

    counts = dict(
        Counter(
            item["type"]
            for item
            in items
        )
    )

    p_ref.collection(
        "imports"
    ).document(
        import_id
    ).set({
        "import_id":
            import_id,

        "source":
            "gemini",

        "source_url":
            final_url,

        "original_url":
            url,

        "browser_title":
            browser_title,

        "conversation_title":
            extraction.conversation_title,

        "summary":
            extraction.summary,

        "worker_id":
            payload.worker_id,

        "worker_name":
            (
                member.get(
                    "name"
                )
                or
                payload.worker_id
            ),

        "requested_types":
            payload.extract,

        "items":
            items,

        "counts":
            counts,

        "content_hash":
            content_hash,

        "status":
            "pending_review",

        "created_at":
            now,

        "created_by_email":
            (
                x_user_email
                or ""
            )
            .strip()
            .lower()
            or None,

        # We intentionally do NOT
        # save the whole raw conversation.
        "raw_char_count":
            len(
                conversation_text
            ),
    })

    return {
        "import_id":
            import_id,

        "source":
            "gemini",

        "source_url":
            final_url,

        "worker_id":
            payload.worker_id,

        "worker_name":
            (
                member.get(
                    "name"
                )
                or
                payload.worker_id
            ),

        "conversation_title":
            (
                extraction
                .conversation_title
                or
                browser_title
            ),

        "summary":
            extraction.summary,

        "items":
            items,

        "counts":
            counts,
    }


# ============================================================
# IMPORT ITEM -> NORMAL ENTRY TYPE
# ============================================================

ENTRY_TYPE_MAP = {
    "decision":
        "decision",

    "micro_decision":
        "decision",

    "completed":
        "completed",

    "failure":
        "failure",

    "rejected_alternative":
        "failure",

    "assumption":
        "assumption",

    "constraint":
        "constraint",

    "blocker":
        "blocker",

    "open_question":
        "open_question",

    "todo":
        "update",

    "technical_discovery":
        "update",

    "dependency":
        "dependency",

    "architecture_change":
        "decision",

    "do_not_repeat":
        "failure",

    "risk_flag":
        "risk_flag",

    "idea":
        "update",
}


def item_to_entry_content(
    item: dict[str, Any],
) -> str:

    parts = [
        item["content"]
    ]

    if item.get(
        "reason"
    ):
        parts.append(
            "Reason: "
            + item["reason"]
        )

    if (
        item["type"]
        == "assumption"
    ):

        if item.get(
            "explicitness"
        ):
            parts.append(
                "Assumption type: "
                + item[
                    "explicitness"
                ]
            )

        if item.get(
            "what_breaks_if_false"
        ):
            parts.append(
                "If false: "
                + item[
                    "what_breaks_if_false"
                ]
            )

        if item.get(
            "validation_step"
        ):
            parts.append(
                "Validate by: "
                + item[
                    "validation_step"
                ]
            )

    if (
        item["type"]
        == "risk_flag"
    ):

        if item.get(
            "severity"
        ):
            parts.append(
                "Severity: "
                + item[
                    "severity"
                ]
            )

        if item.get(
            "likelihood"
        ):
            parts.append(
                "Likelihood: "
                + item[
                    "likelihood"
                ]
            )

        if item.get(
            "impact"
        ):
            parts.append(
                "Impact: "
                + item[
                    "impact"
                ]
            )

    return "\n".join(
        parts
    )


# ============================================================
# APPROVE IMPORT
# ============================================================

@router.post(
    "/teams/{team_id}/projects/"
    "{project_id}/imports/"
    "{import_id}/approve"
)
async def approve_chat_import(
    team_id: str,
    project_id: str,
    import_id: str,
    payload: ApproveImportRequest,

    x_user_email: str | None =
        Header(
            default=None,
            alias="X-User-Email",
        ),
):

    p_ref = project_ref(
        team_id,
        project_id,
    )

    i_ref = (
        p_ref
        .collection(
            "imports"
        )
        .document(
            import_id
        )
    )

    i_doc = (
        i_ref.get()
    )

    if not i_doc.exists:
        raise HTTPException(
            status_code=404,
            detail=(
                "Import not found."
            ),
        )

    imported = (
        i_doc.to_dict()
        or {}
    )

    if (
        imported.get(
            "status"
        )
        == "approved"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "This import has already "
                "been approved."
            ),
        )

    items = (
        imported.get(
            "items"
        )
        or []
    )

    by_id = {
        item["id"]:
            item
        for item
        in items
    }

    unknown = [
        item_id
        for item_id
        in payload.approved_item_ids
        if item_id
        not in by_id
    ]

    if unknown:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown extracted "
                f"item IDs: {unknown}"
            ),
        )

    approved_items = [
        by_id[
            item_id
        ]
        for item_id
        in payload.approved_item_ids
    ]

    now = utc_now()

    processed_memory_ids = []

    # --------------------------------------------------------
    # Process each accepted context item
    # --------------------------------------------------------

    for item in approved_items:

        memory_id = (
            "mem_"
            + uuid.uuid4().hex[
                :16
            ]
        )

        memory_payload = {
            **item,

            "memory_id":
                memory_id,

            "status":
                "active",

            "approved_at":
                now,

            "approved_by_email":
                (
                    x_user_email
                    or ""
                )
                .strip()
                .lower()
                or None,
        }

        # 1. Save rich reasoning item.
        p_ref.collection(
            "memory_items"
        ).document(
            memory_id
        ).set(
            memory_payload
        )

        processed_memory_ids.append(
            memory_id
        )

        # 2. Convert rich item into normal entry.
        entry_type = (
            ENTRY_TYPE_MAP.get(
                item["type"],
                "update",
            )
        )

        content = (
            item_to_entry_content(
                item
            )
        )

        metadata = {
            "import_id":
                import_id,

            "memory_item_id":
                memory_id,

            "original_type":
                item["type"],

            "source_url":
                item.get(
                    "source_url"
                ),

            "confidence":
                item.get(
                    "confidence"
                ),

            "evidence":
                item.get(
                    "evidence"
                ),

            "title":
                item.get(
                    "title"
                ),

            "explicitness":
                item.get(
                    "explicitness"
                ),

            "severity":
                item.get(
                    "severity"
                ),

            "likelihood":
                item.get(
                    "likelihood"
                ),

            "impact":
                item.get(
                    "impact"
                ),
        }

        entry_id = add_entry(
            team_id=
                team_id,

            project_id=
                project_id,

            worker_id=
                item["worker_id"],

            entry_type=
                entry_type,

            content=
                content,

            source=
                "gemini-import",

            metadata=
                metadata,
        )

        # 3. Reload authoritative state.
        project = get_project(
            team_id=
                team_id,

            project_id=
                project_id,
        )

        if not project:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Project disappeared "
                    "during import."
                ),
            )

        current_state = (
            project.get(
                "current_state"
            )
            or {}
        )

        # 4. Read recent history.
        recent_entries = (
            get_entries(
                team_id=
                    team_id,

                project_id=
                    project_id,

                limit=
                    30,
            )
        )

        recent_entries = [
            entry
            for entry
            in recent_entries
            if (
                entry.get(
                    "id"
                )
                != entry_id
                and
                entry.get(
                    "entry_id"
                )
                != entry_id
            )
        ]

        # 5. Build SAME shape as normal ContextSwitch entry.
        new_entry = {
            "entry_id":
                entry_id,

            "worker_id":
                item[
                    "worker_id"
                ],

            "type":
                entry_type,

            "content":
                content,

            "source":
                "gemini-import",

            "metadata":
                metadata,
        }

        # 6. Use your EXISTING Gemini reconciliation.
        result = (
            await reconcile_team_entry(
                current_state=
                    current_state,

                new_entry=
                    new_entry,

                recent_entries=
                    recent_entries,
            )
        )

        updated_state = (
            result[
                "updated_state"
            ]
        )

        conflict = (
            result.get(
                "conflict"
            )
        )

        # 7. Save reconciled state.
        update_project_state(
            team_id=
                team_id,

            project_id=
                project_id,

            state=
                updated_state,
        )

        # 8. Save conflict if Gemini found one.
        if conflict:

            save_conflict(
                team_id=
                    team_id,

                project_id=
                    project_id,

                topic=
                    conflict[
                        "topic"
                    ],

                side_a=
                    conflict[
                        "side_a"
                    ],

                side_b=
                    conflict[
                        "side_b"
                    ],

                status=
                    "unresolved",
            )

        # 9. Snapshot after each accepted item.
        save_snapshot(
            team_id=
                team_id,

            project_id=
                project_id,

            state=
                updated_state,

            snapshot_type=
                "gemini_import",
        )

    # --------------------------------------------------------
    # Mark import approved
    # --------------------------------------------------------

    i_ref.update({
        "status":
            "approved",

        "approved_item_ids":
            payload.approved_item_ids,

        "approved_count":
            len(
                approved_items
            ),

        "memory_item_ids":
            processed_memory_ids,

        "approved_at":
            now,

        "approved_by_email":
            (
                x_user_email
                or ""
            )
            .strip()
            .lower()
            or None,
    })

    # --------------------------------------------------------
    # Add one compact import activity record.
    # --------------------------------------------------------

    activity_ref = (
        p_ref
        .collection(
            "entries"
        )
        .document()
    )

    activity_ref.set({
        "id":
            activity_ref.id,

        "entry_id":
            activity_ref.id,

        "team_id":
            team_id,

        "project_id":
            project_id,

        "worker_id":
            imported.get(
                "worker_id"
            ),

        "type":
            "chat_import",

        "entry_type":
            "chat_import",

        "content":
            (
                "Imported Gemini conversation: "
                f"{len(approved_items)} "
                "reasoning item(s) accepted "
                "into shared memory."
            ),

        "source":
            "gemini",

        "source_url":
            imported.get(
                "source_url"
            ),

        "import_id":
            import_id,

        "timestamp":
            datetime.now(
                timezone.utc
            ),
    })

    return {
        "ok":
            True,

        "import_id":
            import_id,

        "approved_count":
            len(
                approved_items
            ),

        "memory_item_ids":
            processed_memory_ids,
    }


# ============================================================
# MEMBER-WISE MEMORY
# ============================================================

@router.get(
    "/teams/{team_id}/projects/"
    "{project_id}/members/"
    "{worker_id}/memory"
)
async def get_member_memory(
    team_id: str,
    project_id: str,
    worker_id: str,

    x_user_email: str | None =
        Header(
            default=None,
            alias="X-User-Email",
        ),
):
    """
    Return everything extracted for one teammate.

    This powers the People-Wise Context screen:
    - what they did
    - decisions
    - assumptions
    - risk flags
    - open questions
    - failures
    - blockers
    - etc.
    """

    p_ref = project_ref(
        team_id,
        project_id,
    )

    docs = (
        p_ref
        .collection(
            "memory_items"
        )
        .where(
            "worker_id",
            "==",
            worker_id,
        )
        .stream()
    )

    items = [
        {
            "id":
                doc.id,

            **(
                doc.to_dict()
                or {}
            ),
        }
        for doc
        in docs
    ]

    groups: dict[
        str,
        list[
            dict[
                str,
                Any,
            ]
        ],
    ] = {}

    for item in items:

        item_type = (
            item.get(
                "type"
            )
            or "other"
        )

        groups.setdefault(
            item_type,
            [],
        ).append(
            item
        )

    counts = dict(
        Counter(
            (
                item.get(
                    "type"
                )
                or "other"
            )
            for item
            in items
        )
    )

    return {
        "worker_id":
            worker_id,

        "total":
            len(
                items
            ),

        "counts":
            counts,

        "groups":
            groups,

        "items":
            items,
    }
