# ContextSwitch

> **Your projects remember where you left off.**

ContextSwitch is an agentic AI workspace designed to help developers and teams resume interrupted projects without manually reconstructing context.

Instead of simply summarizing documents or GitHub activity, ContextSwitch maintains a structured representation of a project's **work state** and reasons about how that state changes over time.

When a user returns to a project, ContextSwitch answers:

* Where did I leave off?
* What happened while I was away?
* Which tasks were completed?
* Which tasks are now outdated?
* What decisions were made?
* What blockers remain?
* What changed?
* What should I do next?

---

# 1. Core Idea

Normal AI assistants answer:

> "What happened?"

ContextSwitch tries to answer:

> **"Given where I was before and everything that happened since, what is the project state now and what should I do next?"**

The core reasoning operation is:

```text
Previous Work State
        +
New Evidence
        ↓
State Reconciliation
        ↓
Current Work State
        ↓
Best Next Action
```

Example:

```text
Previous next action:
"Implement scalar gate"

        ↓

New GitHub evidence:
"Teammate implemented scalar gate"

        ↓

New project requirement:
"Compare scalar and vector gate using effective rank"

        ↓

ContextSwitch detects:

Old task → COMPLETED / OUTDATED

New next action →
"Evaluate scalar and vector gate checkpoints
using effective rank and slot utilization"
```

This state-transition reasoning is the central idea behind ContextSwitch.

---

# 2. Current User Flow

The currently implemented workflow is:

```text
User
 ↓
Create Workspace
 ↓
Enter GitHub Repository
 ↓
ContextSwitch analyzes repository
 ↓
Initial Context Agent
 ↓
Initial Project Snapshot
 ↓
Store Snapshot in Firestore
 ↓
Display Project Dashboard
 ↓

User leaves project

        ...

User returns
 ↓
RESUME PROJECT
 ↓
Load previous snapshot from Firestore
 ↓
Fetch GitHub activity after snapshot
 ↓
Reconciliation Agent
 ↓
Detect project state changes
 ↓
Generate updated project state
 ↓
Generate best next action
 ↓
Save new snapshot
 ↓
Display Resume View
```

---

# 3. Tech Stack

## Frontend

* Next.js
* TypeScript
* Tailwind CSS
* App Router

## Backend

* Python
* FastAPI
* Pydantic
* Uvicorn

## AI

* Google Agent Development Kit (ADK)
* Gemini
* `gemini-3-flash-preview`
* Google GenAI SDK

## Storage

* Google Cloud Firestore

## Current Integration

* GitHub REST API

## Planned Integrations

* Gmail
* Google Drive
* Google Calendar

## Future Google Cloud Infrastructure

* Cloud Run
* Pub/Sub
* Cloud Scheduler
* Secret Manager
* Firebase Authentication
* Vertex AI / embeddings
* Firestore vector search

---

# 4. Current Architecture

```text
                    USER
                      │
                      ▼
               Next.js Frontend
                      │
                      ▼
                 FastAPI API
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
     GitHub Connector        Firestore
          │                       │
          ▼                       │
   Evidence Normalizer            │
          │                       │
          ▼                       │
   Normalized Evidence            │
          │                       │
          ├───────────────────────┘
          │
          ▼
       Google ADK
          │
          ▼
        Gemini
          │
    ┌─────┴─────────┐
    │               │
    ▼               ▼
Initial Context   Reconciliation
    Agent             Agent
    │                  │
    ▼                  ▼
Initial State     Updated State
    │                  │
    └────────┬─────────┘
             ▼
         Firestore
             │
             ▼
      Next.js Dashboard
```

---

# 5. Agent Architecture

ContextSwitch currently uses two separate AI agents.

## 5.1 Initial Context Agent

Used when a project is connected for the first time.

Input:

```text
Repository metadata
+
README
+
Recent commits
```

Output:

```json
{
  "goal": "",
  "progress": [],
  "decisions": [],
  "failures": [],
  "blockers": [],
  "open_questions": [],
  "dependencies": [],
  "next_actions": []
}
```

This becomes **Snapshot #1**.

---

## 5.2 Reconciliation Agent

Used when the user returns to an existing project.

Input:

```text
PREVIOUS_WORK_STATE

+

NEW_EVIDENCE
```

Output:

```json
{
  "where_you_left_off": {},
  "changes": [],
  "task_updates": [],
  "current_state": {},
  "next_action": {}
}
```

The agent detects:

* completed tasks
* outdated tasks
* changed tasks
* new results
* new decisions
* resolved dependencies
* new dependencies
* new blockers
* resolved blockers
* new requirements

---

# 6. What Has Been Completed

## Phase 1 — Gemini Integration

Completed.

Gemini Developer API is connected and working.

Environment variables are loaded from `.env`.

The project currently uses:

```text
gemini-3-flash-preview
```

---

## Phase 2 — Google ADK

Completed.

Google ADK is installed and operational.

Current installed version during development:

```text
google-adk 2.8.0
```

Programmatic execution works through the ADK Runner.

The application no longer requires manually pasting prompts into ADK Web.

---

## Phase 3 — Structured Reconciliation

Completed.

The reconciliation agent receives:

```text
Previous State
+
New Evidence
```

and produces structured JSON describing the project transition.

A successful test detected:

```text
Previous task:
Implement scalar gate

New evidence:
Scalar gate was implemented.

Guide feedback:
Compare effective rank and slot utilization.

Result:
Old task → completed

New next action →
Calculate effective rank and slot utilization.
```

---

# 7. Pydantic Validation

Completed.

AI responses are validated before being used by the application.

Important schemas include:

```text
Change
TaskUpdate
WhereYouLeftOff
CurrentState
NextAction
ReconciliationResult
```

This prevents malformed Gemini responses from silently entering the application.

---

# 8. Reconciliation Service

Completed.

Current logical flow:

```text
reconcile_state()
       ↓
build_reconciliation_prompt()
       ↓
ADK Runner
       ↓
Gemini
       ↓
JSON
       ↓
Pydantic
       ↓
ReconciliationResult
```

---

# 9. GitHub Integration

Completed for MVP.

ContextSwitch can currently retrieve:

### Repository metadata

Including:

* repository name
* description
* primary language
* topics

### README

README content is extracted and provided as project evidence.

### Recent commits

GitHub commits are fetched using the GitHub REST API.

Raw GitHub data is normalized into ContextSwitch evidence.

Example:

```json
{
  "id": "github_8f32a1",
  "source": "github",
  "type": "commit",
  "timestamp": "...",
  "content": "Developer committed: Implemented scalar gate"
}
```

---

# 10. Evidence Normalization

Completed for GitHub commits.

External information is converted into a common evidence representation:

```text
External Source
      ↓
Connector
      ↓
Normalizer
      ↓
Evidence
```

Example:

```json
{
  "id": "github_a92fb13",
  "source": "github",
  "type": "commit",
  "timestamp": "...",
  "content": "Added LangSmith tracing"
}
```

This architecture will later allow Gmail, Drive, Calendar and other sources to use the same reasoning engine.

---

# 11. Automatic Project Onboarding

Completed.

Previously, the project state was manually hardcoded:

```text
Goal:
Compare scalar and vector gating
```

This has now been removed.

ContextSwitch can analyze an arbitrary GitHub repository and automatically generate its first project state.

This was successfully tested using a separate finance chatbot repository.

ContextSwitch automatically inferred a goal similar to:

> Build a production-ready domain-specific finance chatbot using Hybrid RAG, citation enforcement, knowledge graphs and evaluation-driven CI.

It also detected progress including:

* Hybrid BM25 + vector retrieval
* Cohere reranking
* LangSmith tracing
* Neo4j knowledge graphs
* RAGAS evaluation
* GitHub Actions
* Streamlit interface

No information from the previous GPT-2 project leaked into the new workspace.

Therefore project onboarding is now **dynamic**.

---

# 12. FastAPI Backend

Completed for the current MVP.

The backend runs using:

```bash
python -m uvicorn backend:app --reload
```

Development API:

```text
http://127.0.0.1:8000
```

Swagger interface:

```text
http://127.0.0.1:8000/docs
```

Implemented endpoint:

```text
POST /workspaces
```

Example request:

```json
{
  "name": "Finance Chatbot",
  "github_owner": "username",
  "github_repo": "repository"
}
```

The backend:

```text
receives repository
       ↓
fetches GitHub evidence
       ↓
runs Initial Context Agent
       ↓
validates state
       ↓
stores workspace
       ↓
returns project state
```

---

# 13. Firestore Persistence

Completed.

ContextSwitch now has persistent project memory.

Current logical structure:

```text
workspaces/
    workspace_id/
        name
        github_owner
        github_repo
        created_at
        last_snapshot_at
        current_state

        snapshots/
            snapshot_1/
                type
                created_at
                state

            snapshot_2/
                type
                created_at
                state
```

This allows ContextSwitch to maintain multiple versions of project state.

It also provides the foundation for the future:

**Context Time Machine**

feature.

---

# 14. Resume Backend

Completed.

ContextSwitch can:

1. Load a workspace from Firestore.
2. Read `last_snapshot_at`.
3. Fetch GitHub commits after that timestamp.
4. Normalize the new commits.
5. Load the previous project state.
6. Send previous state + new evidence to the Reconciliation Agent.
7. Generate an updated project state.
8. Save another snapshot to Firestore.

Current flow:

```text
Firestore Snapshot #1
        +
GitHub changes since Snapshot #1
        ↓
Reconciliation Agent
        ↓
Current State
        ↓
Snapshot #2
        ↓
Firestore
```

If nothing changed, the backend returns:

```text
No new GitHub activity since your last snapshot.
```

---

# 15. Next.js Frontend

Implemented for the MVP.

The frontend currently supports:

## Create Workspace

The user enters:

```text
Project Name

GitHub Repository
```

and selects:

```text
CREATE WORKSPACE
```

The frontend calls FastAPI.

---

## Project Dashboard

The generated project snapshot displays:

### Current Goal

### Progress

### Next Actions

### Decisions

### Blockers

### Open Questions

### Failures

---

## Resume Project

The UI includes:

```text
RESUME PROJECT
```

The button is connected to:

```text
POST /workspaces/{workspace_id}/resume
```

The resume interface can display:

### Where You Left Off

The previous project goal/state.

### While You Were Away

Meaningful changes detected from new evidence.

### Task Updates

Example:

```text
Implement scalar gate

pending → completed
```

### What You Should Do Next

The highest-value next action generated after reconciliation.

---

# 16. What Currently Works End-to-End

The following complete workflow is operational:

```text
USER
 ↓
Next.js
 ↓
Create Workspace
 ↓
FastAPI
 ↓
GitHub API
 ↓
Repository + README + commits
 ↓
Evidence Normalization
 ↓
Initial Context Agent
 ↓
Gemini
 ↓
Pydantic Validation
 ↓
Initial Project State
 ↓
Firestore
 ↓
Project Dashboard
```

And the resume workflow:

```text
USER RETURNS
 ↓
RESUME PROJECT
 ↓
FastAPI
 ↓
Firestore Previous State
 ↓
last_snapshot_at
 ↓
GitHub New Commits
 ↓
Evidence Normalization
 ↓
Reconciliation Agent
 ↓
Gemini
 ↓
Pydantic Validation
 ↓
Updated State
 ↓
New Snapshot
 ↓
Firestore
 ↓
Resume UI
```

This represents the current functional ContextSwitch MVP.

---

# 17. Current Project Structure

Approximate current structure:

```text
gemini hackahon/
│
├── backend.py
│
├── test_validation.py
├── test_reconciliation.py
├── test_github.py
├── test_github_resume.py
├── test_initial_context.py
│
├── contextswitch/
│   │
│   ├── __init__.py
│   ├── agent.py
│   ├── initial_agent.py
│   ├── runner.py
│   ├── reconciliation.py
│   ├── initial_context.py
│   ├── schemas.py
│   ├── storage.py
│   │
│   └── connectors/
│       ├── __init__.py
│       └── github.py
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │       └── page.tsx
│   └── ...
│
├── .env
└── venv/
```

---

# 18. What Is Left To Build

The core engine works, but several features are still required for the full hackathon vision.

## Priority 1 — Improve Resume Experience

The Resume screen exists, but it should become the strongest part of the demo.

Improve visual distinction between:

```text
NEW
COMPLETED
OUTDATED
BLOCKED
RESOLVED
CHANGED
```

Outdated tasks should be particularly prominent because this is one of ContextSwitch's main differentiators.

---

## Priority 2 — Stronger GitHub Evidence

Currently the GitHub integration primarily uses:

```text
README
repository metadata
commits
```

Add:

```text
Pull Requests
Issues
PR comments
Issue comments
Changed files
Commit diffs
```

This will make reconciliation significantly more accurate.

A commit message alone may say:

```text
Fix authentication
```

while the diff and PR discussion can explain exactly what changed and why.

---

## Priority 3 — Gmail Integration

Add Google OAuth and Gmail access.

Relevant project emails should become evidence:

```json
{
  "id": "gmail_...",
  "source": "gmail",
  "type": "email",
  "timestamp": "...",
  "content": "..."
}
```

Examples:

```text
Professor changed project requirements

Client approved design

Teammate reported blocker

Reviewer requested modifications
```

This is important because many project decisions never appear in GitHub.

---

## Priority 4 — Google Drive Integration

Analyze project-related:

```text
Docs
PDFs
meeting notes
requirements
reports
design documents
```

Drive evidence should pass through the same evidence normalization layer.

---

## Priority 5 — Calendar Integration

Calendar can provide context about:

```text
meetings
deadlines
reviews
presentations
milestones
```

Example:

```text
Project review tomorrow
```

could influence the next action generated by the Action Planner.

---

# 19. Outdated Task Detection

This should become an explicit first-class feature.

Example:

```text
Previous Task

"Implement authentication"
```

New evidence:

```text
GitHub:
Teammate merged authentication implementation.
```

ContextSwitch should show:

```text
OUTDATED TASK

Implement authentication

Reason:
Authentication has already been implemented
and merged by another team member.
```

This is much stronger than simply showing a GitHub summary.

---

# 20. Decision Memory

Still to be expanded.

ContextSwitch should maintain:

```text
Decision
Why it was made
Evidence
Timestamp
Current validity
```

Example:

```text
Decision

Use Chroma instead of FAISS.

Why

Existing application already uses persistent
Chroma collections.

Source

Architecture discussion / commit / email
```

Later ContextSwitch can detect when a decision becomes invalid.

---

# 21. Contradiction Detection

Still to be implemented.

Example:

```text
Previous decision:

Use Chroma.

New README:

Vector database migrated to Qdrant.
```

ContextSwitch should detect:

```text
CONTRADICTION / DECISION CHANGE
```

instead of preserving both as valid decisions.

---

# 22. Context Time Machine

Firestore snapshots already provide the foundation.

Future UI:

```text
Project History

Aug 25
↓
Snapshot

Aug 27
↓
Snapshot

Aug 29
↓
Current
```

Selecting an old snapshot should show:

```text
Goal at that time
Progress
Decisions
Blockers
Next actions
```

This provides a historical view of how the project evolved.

---

# 23. Project-Aware Chat

Still to be implemented.

Example questions:

```text
Why did we choose Neo4j?

What happened with evaluation?

What was I supposed to do next?

When did we introduce LangSmith?

What is currently blocking deployment?
```

Answers should be grounded in project evidence and snapshots.

---

# 24. Continue For Me

Planned agentic feature.

ContextSwitch should eventually allow safe actions such as:

```text
Draft email reply

Create GitHub issue

Create task

Prepare status update

Draft implementation plan

Create meeting agenda
```

All write operations should require explicit user approval.

---

# 25. Critic Agent

Still to be implemented.

Proposed flow:

```text
Previous State
+
Evidence
 ↓
Reconciliation Agent
 ↓
Draft State
 ↓
Critic Agent
 ↓
Check:

Is every conclusion supported?

Was evidence missed?

Are there contradictions?

Was anything invented?

 ↓
Validated State
```

This will improve reliability and reduce hallucination.

---

# 26. Provenance

Partially implemented through `source` and `evidence_id`.

Needs to become visible in the UI.

Example:

```text
✓ Authentication completed

Evidence:
GitHub commit 8f32a1
```

Users should be able to understand **why ContextSwitch believes something changed**.

This is important for trust.

---

# 27. Project Health

Planned feature.

Possible indicators:

```text
2 unresolved blockers

3 outdated tasks

1 unresolved dependency

No activity for 8 days

4 major changes since last session
```

Potential output:

```text
PROJECT HEALTH

Needs Attention

2 blockers
1 stale dependency
3 outdated tasks
```

---

# 28. Authentication

Not yet implemented.

Planned:

```text
Firebase Authentication
+
Google OAuth
```

Users should eventually sign in and own their individual workspaces.

---

# 29. GitHub OAuth

Current MVP uses a GitHub Personal Access Token.

For the final application this should be replaced with:

```text
Connect GitHub
```

using OAuth or a GitHub App.

Users should not manually provide API tokens.

---

# 30. Background Synchronization

Not implemented yet.

Current evidence is fetched when required.

Future architecture:

```text
GitHub
Gmail
Drive
Calendar
     ↓
Background Sync
     ↓
Pub/Sub
     ↓
Evidence Store
```

Possible infrastructure:

```text
Google Cloud Pub/Sub
Cloud Scheduler
Cloud Run
```

---

# 31. Deployment

Currently local.

Development:

```text
Frontend
localhost:3000

Backend
localhost:8000
```

Planned deployment:

```text
Next.js
   ↓
Cloud deployment

FastAPI
   ↓
Google Cloud Run
```

Cloud Run and other billing-dependent infrastructure can be enabled when hackathon credits or billing are available.

---

# 32. Semantic Retrieval

Not implemented yet.

Future plan:

```text
Project evidence
 ↓
Vertex AI Embeddings
 ↓
Firestore Vector Search
 ↓
Relevant evidence retrieval
 ↓
Gemini
```

This becomes important when projects contain thousands of:

```text
commits
emails
documents
messages
decisions
```

Instead of putting all project history into every Gemini prompt, ContextSwitch will retrieve only relevant evidence.

---

# 33. Evidence Layer — Future Unified Schema

All connectors should eventually produce a common structure:

```json
{
  "id": "",
  "workspace_id": "",
  "source": "",
  "type": "",
  "timestamp": "",
  "actor": "",
  "content": "",
  "url": "",
  "metadata": {}
}
```

Possible sources:

```text
github
gmail
drive
calendar
manual
```

This allows the reasoning engine to remain independent of the source.

---

# 34. Recommended Next Development Order

The recommended sequence from the current working MVP is:

```text
CURRENT STATE
   │
   ├── Initial Context Agent       ✓
   ├── Reconciliation Agent        ✓
   ├── Gemini / ADK                ✓
   ├── GitHub                      ✓
   ├── Firestore                   ✓
   ├── FastAPI                     ✓
   ├── Next.js                     ✓
   └── Resume workflow             ✓
            │
            ▼
1. Improve Resume UI
            │
            ▼
2. Explicit Outdated Task Detection
            │
            ▼
3. GitHub PR + Issue Evidence
            │
            ▼
4. Provenance / Evidence Links
            │
            ▼
5. Gmail Integration
            │
            ▼
6. Drive Integration
            │
            ▼
7. Critic Agent
            │
            ▼
8. Context Time Machine
            │
            ▼
9. Project-Aware Chat
            │
            ▼
10. Continue For Me
            │
            ▼
11. Authentication + OAuth
            │
            ▼
12. Background Sync
            │
            ▼
13. Cloud Deployment
```

---

# 35. Current MVP Status

| Component                   | Status                 |
| --------------------------- | ---------------------- |
| Gemini API                  | ✅ Working              |
| Google ADK                  | ✅ Working              |
| Programmatic Agent Runner   | ✅ Working              |
| Initial Context Agent       | ✅ Working              |
| Reconciliation Agent        | ✅ Working              |
| Structured JSON Output      | ✅ Working              |
| Pydantic Validation         | ✅ Working              |
| GitHub Repository Metadata  | ✅ Working              |
| GitHub README               | ✅ Working              |
| GitHub Commits              | ✅ Working              |
| Evidence Normalization      | ✅ Working              |
| Dynamic Project Onboarding  | ✅ Working              |
| FastAPI Backend             | ✅ Working              |
| Firestore                   | ✅ Working              |
| Snapshot Storage            | ✅ Working              |
| Resume Backend              | ✅ Working              |
| Next.js UI                  | ✅ Working              |
| Create Workspace UI         | ✅ Working              |
| Project Dashboard           | ✅ Working              |
| Resume UI                   | ✅ Working              |
| Outdated Task Detection     | 🟡 Basic agent support |
| GitHub PRs                  | ❌ Pending              |
| GitHub Issues               | ❌ Pending              |
| Provenance UI               | ❌ Pending              |
| Gmail                       | ❌ Pending              |
| Google Drive                | ❌ Pending              |
| Calendar                    | ❌ Pending              |
| Critic Agent                | ❌ Pending              |
| Context Time Machine        | ❌ Pending              |
| Project-Aware Chat          | ❌ Pending              |
| Continue For Me             | ❌ Pending              |
| Firebase Authentication     | ❌ Pending              |
| GitHub OAuth/App            | ❌ Pending              |
| Background Sync             | ❌ Pending              |
| Cloud Deployment            | ❌ Pending              |
| Semantic / Vector Retrieval | ❌ Pending              |

---

# 36. Hackathon Demo Vision

A strong final demo should look like this:

### Step 1 — Create Workspace

```text
Project:
Finance Chatbot

GitHub:
haribhaski/finance-chatbot
```

Click:

```text
CREATE WORKSPACE
```

---

### Step 2 — ContextSwitch Reconstructs Project

Without manually explaining the repository, ContextSwitch displays:

```text
GOAL

Build a production-ready finance chatbot...

PROGRESS

✓ Hybrid retrieval implemented
✓ Citation enforcement implemented
✓ Neo4j graph persistence added
✓ LangSmith tracing integrated

NEXT ACTIONS

→ Expand evaluation dataset
→ Add deployment API
```

---

### Step 3 — User Leaves

A teammate makes changes.

For example:

```text
Commit:
Added FastAPI deployment layer
```

Potentially an email arrives:

```text
Guide:
Focus next on evaluation reliability.
```

---

### Step 4 — User Returns

Click:

```text
RESUME PROJECT
```

ContextSwitch displays:

```text
WELCOME BACK

WHERE YOU LEFT OFF

You were preparing the finance chatbot
for deployment and improving evaluation.


WHILE YOU WERE AWAY

✓ FastAPI deployment layer added
✓ Evaluation requirements changed


OUTDATED TASK

Develop FastAPI API

Reason:
Already implemented in GitHub.


WHAT YOU SHOULD DO NEXT

Expand the evaluation dataset and run
the RAGAS evaluation suite against the
new deployment pipeline.
```

This is the key demonstration of ContextSwitch.

---

# 37. Main Differentiator

ContextSwitch should never be presented simply as:

> "AI that summarizes your GitHub repository."

The real idea is:

> **ContextSwitch maintains and reconciles project state across interruptions.**

The important equation is:

```text
Previous Work State
        +
New Evidence
        ↓
State Transition Reasoning
        ↓
Current Work State
        ↓
Best Next Action
```

GitHub, Gmail, Drive and Calendar are evidence sources.

The **work-state reconciliation engine** is the product.

---

# 38. Final Vision

ContextSwitch aims to become a persistent AI layer across project tools.

```text
GitHub ──────┐
             │
Gmail ───────┤
             │
Drive ───────┼──→ Evidence Layer
             │          ↓
Calendar ────┤    Work-State Engine
             │          ↓
Docs ────────┘    Current Project State
                        ↓
                 ContextSwitch Agent
                        ↓
            ┌───────────┼────────────┐
            ↓           ↓            ↓
          Resume      Explain      Continue
```

The long-term goal is simple:

> **A user should never have to manually reconstruct the mental state of a project after being away from it.**

---

## Current Milestone

**ContextSwitch now has a functioning end-to-end MVP for GitHub-based project onboarding, persistent snapshots, and project-state reconciliation.**

The immediate focus should shift from proving the architecture to strengthening the **Resume experience, outdated-task detection, provenance, and multi-source evidence ingestion**.
