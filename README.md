# ContextSwitch

> **Git merges your code. ContextSwitch merges your team's AI reasoning.**

ContextSwitch is a shared memory layer for software teams that use different AI coding assistants such as Cursor, Claude Code, Gemini, Antigravity, and GitHub Copilot.

Modern development teams increasingly work with AI agents, but the reasoning generated inside those tools is usually siloed. Git preserves the final code, but it does not reliably preserve why a decision was made, what another teammate already tried, why an approach failed, what is currently blocked, or whether two teammates are making conflicting technical decisions.

ContextSwitch provides a shared project memory that sits between teammates and their AI tools.

---

## Table of Contents

- [1. Problem Statement](#1-problem-statement)
- [2. Objective & Core Principle](#2-objective--core-principle)
- [3. Scope & Supported Entry Types](#3-scope--supported-entry-types)
- [4. Product Architecture](#4-product-architecture)
- [5. Data Model & Firestore Schema](#5-data-model--firestore-schema)
- [6. Core Engine Breakdown](#6-core-engine-breakdown)
  - [6.1 Reconciliation Engine](#61-reconciliation-engine)
  - [6.2 Automated Conflict Detection](#62-automated-conflict-detection)
  - [6.3 Conflict Resolution Workflow](#63-conflict-resolution-workflow)
  - [6.4 Gemini Shared-Chat Import Engine](#64-gemini-shared-chat-import-engine)
  - [6.5 People-Wise Context & Memory Layer](#65-people-wise-context--memory-layer)
  - [6.6 GitHub Evidence Integration](#66-github-evidence-integration)
  - [6.7 Context Export (`cs export`)](#67-context-export-cs-export)
- [7. Codebase Structure](#7-codebase-structure)
- [8. API Reference (FastAPI Backend)](#8-api-reference-fastapi-backend)
- [9. CLI Reference (`cs`)](#9-cli-reference-cs)
- [10. Web Dashboard & Frontend Architecture](#10-web-dashboard--frontend-architecture)
- [11. Technology Stack](#11-technology-stack)
- [12. Reproducible Testing Instructions](#12-reproducible-testing-instructions)
  - [12.1 Environment Configuration](#121-environment-configuration)
  - [12.2 Automated Python Test Suite](#122-automated-python-test-suite)
  - [12.3 Starting the Backend and Frontend](#123-starting-the-backend-and-frontend)
  - [12.4 Reproducible Flow 1: Two-Developer Conflict Detection & Resolution](#124-reproducible-flow-1-two-developer-conflict-detection--resolution)
  - [12.5 Reproducible Flow 2: Gemini Shared Chat Import & Reasoning Ingestion](#125-reproducible-flow-2-gemini-shared-chat-import--reasoning-ingestion)
  - [12.6 Reproducible Flow 3: Context Export into Fresh AI Session](#126-reproducible-flow-3-context-export-into-fresh-ai-session)
- [13. What Has Been Completed](#13-what-has-been-completed)
- [14. Roadmap & Next Steps](#14-roadmap--next-steps)

---

## 1. Problem Statement

Consider two developers working on the same project:

```text
Hariharan + Cursor                 Jeevan + Claude
       |                                 |
       | "Use ChromaDB"                  | "Use Pinecone"
       |                                 |
       +------------ ContextSwitch ------+
                         |
                 Shared Project Memory
                         |
             Automatic Conflict Detection
```

Both developers may be productive individually, but their AI sessions do not naturally share reasoning.

Existing development tools mainly preserve:
- source code,
- commits,
- pull requests,
- issues,
- documentation.

They do not provide a structured shared memory of the team's AI-assisted reasoning.

This creates critical engineering challenges:
- Teammates repeat experiments that have already failed;
- Important reasoning disappears inside individual AI chat sessions;
- Architectural decisions are known only to the person who made them;
- Blockers are not automatically reflected in shared context;
- Two developers can unknowingly make incompatible decisions;
- Starting a new AI session requires manually explaining the project again.

---

## 2. Objective & Core Principle

The objective of ContextSwitch is to create a **team-level memory system for AI-assisted software development**.

The system continuously maintains a structured understanding of:

```text
Project Goal
Completed Work / Progress
Decisions
Failed Attempts
Blockers
Open Questions
Dependencies
Next Actions
Conflicts
Team Activity
```

### Core Principle

> **Code captures outcomes. ContextSwitch captures reasoning.**

The long-term goal is for any teammate, or any AI coding tool used by that teammate, to retrieve the current project context without reconstructing it manually.

---

## 3. Scope & Supported Entry Types

ContextSwitch supports:
1. **Teams & Role Management**
2. **Projects Inside Teams**
3. **Team Members / Workers**
4. **Structured Project Entries**
5. **AI-Assisted Reconciliation** of new entries into shared project state
6. **Automatic Conflict Detection** between teammates
7. **Conflict Persistence and Resolution Support**
8. **Project Snapshots & State History**
9. **Public Gemini Shared-Chat Import** (Playwright + Gemini GenAI SDK)
10. **People-Wise Context & Memory Exploration**
11. **GitHub Evidence Collection & Normalization**
12. **Google Cloud Firestore Persistence**
13. **FastAPI Backend with User-Aware Authorization**
14. **CLI-based Interaction (`cs`)**
15. **Google OAuth Login (Auth.js / NextAuth)**
16. **Web Dashboard backed by real project data**
17. **Light and Dark UI modes with persisted preference**

### Entry Types
- `decision`: Key technical or architectural choices.
- `completed`: Completed tasks, implementations, or experiments.
- `blocker`: Blocker items preventing work progress.
- `failure`: Failed attempts and reasons why not to repeat them.
- `note` / `update`: General technical context or notes.
- `conflict_resolution`: Explicit resolution recorded by a team member.

Example via CLI:
```bash
cs log "Use ChromaDB because Pinecone is too expensive"
```

Structured API entry payload:
```json
{
  "worker_id": "hariharan",
  "entry_type": "decision",
  "content": "Use ChromaDB because Pinecone is too expensive",
  "source": "cursor"
}
```

---

## 4. Product Architecture

```text
                    +------------------------------------------+
                    |                Teammates                 |
                    +------------------------------------------+
                       |              |              |
                    Cursor          Claude         Gemini
                       |              |              |
                       +------- ContextSwitch CLI / Web -------+
                                      |
                                   FastAPI
                                      |
                     +----------------+----------------+
                     |                                 |
              Gemini GenAI / ADK             Playwright Ingestion
              Reconciliation Layer           (Public Gemini Chats)
                     |                                 |
                     +----------------+----------------+
                                      |
                           Conflict Detection Layer
                                      |
                                  Firestore
                                      |
                  +-------------------+-------------------+
                  |                                       |
           Shared Project State                      Raw History
                  |                                       |
        decisions / blockers /                 entries / evidence /
        failures / next actions                 conflicts / snapshots
```

GitHub acts as an additional source of automatic project evidence:

```text
GitHub
  |
commits / PRs / issues / comments
  |
ContextSwitch Evidence Pipeline (Normalization / Deduplication / Ranking)
  |
Shared Project Memory
```

---

## 5. Data Model & Firestore Schema

ContextSwitch is organized around a multi-tenant hierarchy:

```text
Team
 └── Project
      └── Worker
```

### Firestore Structure

```text
teams/
└── {team_id}/
    ├── name
    ├── members/
    │   └── {email}/  (worker_id, name, email, role, added_at)
    └── projects/
        └── {project_id}/
            ├── current_state  (goal, progress, decisions, failures, blockers, ...)
            ├── github_owner
            ├── github_repo
            ├── members/
            │   └── {worker_id}/  (worker_id, name, email, role)
            ├── entries/
            │   └── {entry_id}/   (worker_id, type, content, source, timestamp, metadata)
            ├── evidence/
            │   └── {evidence_id}/ (type, content, source, score, timestamp)
            ├── conflicts/
            │   └── {conflict_id}/ (topic, side_a, side_b, reason, status, resolution)
            ├── snapshots/
            │   └── {snapshot_id}/ (state, snapshot_type, timestamp)
            ├── raw_imports/
            │   └── {import_id}/   (source_url, extracted_items, approved_items, status)
            └── member_memory/
                └── {worker_id}/   (decisions, failures, blockers, risks, assumptions)
```

### Shared Project State Object

```json
{
  "goal": "Build a shared memory layer for AI-assisted developer teams",
  "progress": [
    "Gemini reconciliation engine implemented",
    "Firestore storage connector implemented",
    "Google OAuth frontend integration completed"
  ],
  "decisions": [
    "Use ChromaDB for local vector embeddings",
    "Use FastAPI for backend services"
  ],
  "failures": [
    "Direct Pinecone connection timed out under free tier rate limits"
  ],
  "blockers": [
    "Waiting for Gemini API production quota increase"
  ],
  "open_questions": [
    "Should background sync use Google Cloud Pub/Sub?"
  ],
  "dependencies": [
    "Google Cloud project contextswitch-hackathon-26"
  ],
  "next_actions": [
    "Implement member-wise memory filter UI"
  ]
}
```

---

## 6. Core Engine Breakdown

### 6.1 Reconciliation Engine

When a teammate submits a new entry, the backend does not simply append it to an unstructured feed. Instead, the Gemini-powered reconciliation pipeline processes the state transition:

```text
New Team Entry
      |
      v
Store Raw Entry
      |
      v
Read Existing Shared State & Recent Entries
      |
      v
Gemini Reconciliation Agent
      |
      +--> Update Progress (moves completed items, resolves matching blockers/actions)
      +--> Update Decisions (preserves rationale, updates worker positions)
      +--> Update Failures (records failed approaches with context to prevent repeats)
      +--> Update Blockers & Next Actions
      +--> Analyze Cross-Worker Contradictions
      |
      v
Save New Shared State & Conflict (if detected) & Snapshot
```

#### Reconciliation Rules
1. **No Hallucination**: Do not invent information absent from entries or evidence.
2. **Deduplication**: Prevent repeated duplicate entries in state.
3. **Completed Work Transition**: Completed work moves into `progress` and is cleared from active `next_actions` or `blockers`.
4. **Preserve Rationale**: Retain the *why* behind decisions and failed attempts.
5. **Worker Position Updates**: Newer changes from the same worker update that worker's position.
6. **Cross-Worker Conflict Isolation**: Incompatible positions from different teammates trigger a conflict rather than overwriting silently.

---

### 6.2 Automated Conflict Detection

Conflict detection is a foundational differentiator of ContextSwitch.

#### Real Example:
- **Developer 1 (Hariharan via Cursor)**: `"Use ChromaDB because Pinecone is too expensive"`
- **Developer 2 (Jeevan via Claude)**: `"Use Pinecone because retrieval quality is better"`

Gemini reconciliation detects the contradiction:

```json
{
  "topic": "Vector Database Selection",
  "side_a": {
    "worker_id": "hariharan",
    "position": "Use ChromaDB because Pinecone is too expensive"
  },
  "side_b": {
    "worker_id": "jeevan",
    "position": "Use Pinecone because retrieval quality is better"
  },
  "reason": "The team members have made contradictory decisions regarding the choice of vector database."
}
```

The conflict is persisted with status `unresolved` in Firestore and flagged prominently across the Web Dashboard and Project Details view.

---

### 6.3 Conflict Resolution Workflow

When a team decides on a path forward, any teammate can resolve the conflict directly through the UI or API:

```text
Active Conflict in Dashboard
         │
         ▼
Open Conflict Modal / API Resolve Endpoint
         │
         ▼
Submit Resolution Rationale (e.g. "Use ChromaDB for MVP, evaluate Pinecone in Phase 2")
         │
         ├── Conflict marked as 'resolved' with 'resolved_by' and 'resolved_at'
         ├── Resolution logged as a 'conflict_resolution' project entry
         └── Project current_state updated automatically
```

---

### 6.4 Gemini Shared-Chat Import Engine

In addition to CLI logging, ContextSwitch supports ingesting public **Gemini Shared Chat links** (`chat_import.py`):

1. **URL Validation**: Ensures the URL is a valid public `gemini.google.com/share/...` link.
2. **Headless Browser Rendering**: Uses Playwright to render the conversation content dynamically.
3. **Structured Extraction**: Prompts Gemini to parse:
   - What the user did
   - Decisions made
   - Assumptions & constraints
   - Risk flags
   - Blockers & failures
4. **Review & Approval**: The user reviews extracted items in the web modal, selecting which items to merge into shared team memory.
5. **Reconciliation**: Approved items run through the reconciliation engine, updating project state and member memory.

---

### 6.5 People-Wise Context & Memory Layer

ContextSwitch allows exploring project context by team member:
- Filter entries and decisions by worker (`worker_id`).
- View what each developer has completed, what tools they used (Cursor, Claude, Gemini, Antigravity, CLI), their active blockers, and their rationale.
- API Endpoint: `GET /teams/{team_id}/projects/{project_id}/members/{worker_id}/memory`

---

### 6.6 GitHub Evidence Integration

`contextswitch/connectors/github.py` collects:
- Repository metadata & README
- Commits, changed files, and patch excerpts
- Pull requests and PR review comments
- Issues and issue discussion comments

The pipeline performs:
- **Normalization**: Standardizes GitHub artifacts into common evidence schemas.
- **Deduplication**: Prevents duplicate processing of repeated commits or PR events.
- **Ranking & Linking**: Groups related PRs, commits, and comments as corroborating evidence.

---

### 6.7 Context Export (`cs export`)

ContextSwitch makes project context portable across any AI session:

```bash
cs export
```

Generates structured context ready to paste into **Cursor, Claude Code, Gemini, Antigravity, or Copilot**:

```text
PROJECT: ContextSwitch (contextswitch)
TEAM: team-alpha

PROJECT GOAL:
Build a shared memory layer for teams using different AI coding agents.

COMPLETED WORK:
- Gemini reconciliation engine implemented
- Firestore storage connector implemented
- Google OAuth frontend integration completed

DECISIONS:
- Use ChromaDB for local vector embeddings
- Use FastAPI for backend services

DO NOT REPEAT (FAILURES):
- Direct Pinecone connection timed out under free tier rate limits

BLOCKERS:
- Waiting for Gemini API production quota increase

ACTIVE CONFLICTS:
- Vector Database Selection: Hariharan (ChromaDB) vs Jeevan (Pinecone)

NEXT ACTIONS:
- Implement member-wise memory filter UI
```

---

## 7. Codebase Structure

```text
.
├── .env.example                     # Backend environment configuration template
├── pyproject.toml                   # Python CLI package configuration (pip install -e .)
├── CMDS.md                          # Quick start commands
├── backend.py                       # FastAPI application & REST endpoints
├── chat_import.py                   # Gemini Shared-Chat Playwright + Gemini extraction module
│
├── contextswitch/                   # Core Python package
│   ├── agent.py                     # Gemini reconciliation agent instructions
│   ├── initial_agent.py             # Initial project understanding agent
│   ├── initial_context.py           # Initial state builder from repository evidence
│   ├── reconciliation.py            # State transition reconciliation runner
│   ├── runner.py                    # Google ADK / Gemini GenAI execution runner
│   ├── schemas.py                   # Pydantic schemas (CurrentState, TeamEntry, Conflict, etc.)
│   ├── storage.py                   # Google Cloud Firestore persistence layer
│   ├── team_reconciliation.py       # Team entry prompt builder & conflict parser
│   └── connectors/
│       └── github.py                # GitHub REST API evidence collector
│
├── contextswitch_cli/               # CLI package
│   └── cli.py                       # 'cs' CLI implementation (init, log, done, blocked, export)
│
├── frontend/                        # Next.js Web Application
│   ├── .env.example                 # Frontend environment template
│   ├── package.json                 # Next.js 16 + React 19 + Auth.js
│   ├── auth.ts                      # NextAuth Google OAuth configuration
│   ├── app/
│   │   ├── layout.tsx               # Root layout & theme providers
│   │   ├── page.tsx                 # Root landing / redirect
│   │   ├── login/page.tsx           # Google OAuth sign-in page
│   │   ├── dashboard/page.tsx       # Main user dashboard
│   │   └── projects/
│   │       └── [team_id]/
│   │           └── [project_id]/
│   │               └── page.tsx     # Project Details (Overview, People, Activity, Conflicts)
│   └── components/
│       ├── dashboard-shell.tsx       # Dashboard layout & stats
│       ├── project-details-shell.tsx # Comprehensive project view
│       ├── import-ai-context-modal.tsx # Gemini chat import modal
│       ├── create-team-modal.tsx    # Team creation dialog
│       ├── create-project-modal.tsx # Project creation dialog
│       └── add-member-modal.tsx     # Add teammate dialog
│
├── test_validation.py               # Pydantic schema validation test
├── test_gemini.py                   # Direct Gemini API connectivity test
├── test_github.py                   # GitHub connector & normalization test
├── test_initial_context.py          # Initial repository context agent test
├── test_reconciliation.py           # Multi-source state reconciliation test
└── test_github_resume.py            # GitHub commit evidence reconciliation test
```

---

## 8. API Reference (FastAPI Backend)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status check |
| `GET` | `/me/dashboard` | Returns authenticated user's teams, projects, stats, and conflicts |
| `POST` | `/teams` | Create a new team |
| `POST` | `/teams/{team_id}/members` | Add a member to a team |
| `POST` | `/projects` | Create a new project inside a team |
| `GET` | `/teams/{team_id}/projects/{project_id}` | Fetch project details, members, and state |
| `POST` | `/teams/{team_id}/projects/{project_id}/members` | Add a member to a project |
| `GET` | `/teams/{team_id}/projects/{project_id}/members` | List members of a project |
| `POST` | `/teams/{team_id}/projects/{project_id}/entries` | Submit a new team entry & trigger Gemini reconciliation |
| `GET` | `/teams/{team_id}/projects/{project_id}/entries` | Retrieve project entry history |
| `GET` | `/teams/{team_id}/projects/{project_id}/conflicts` | List project conflicts (active or all) |
| `POST` | `/teams/{team_id}/projects/{project_id}/conflicts/{conflict_id}/resolve` | Resolve an active conflict |
| `GET` | `/teams/{team_id}/projects/{project_id}/export` | Export structured project context for AI assistants |
| `POST` | `/teams/{team_id}/projects/{project_id}/sync-github` | Trigger GitHub evidence synchronization |
| `POST` | `/teams/{team_id}/projects/{project_id}/imports/chat/analyze` | Analyze a public Gemini chat URL via Playwright |
| `POST` | `/teams/{team_id}/projects/{project_id}/imports/{import_id}/approve` | Approve extracted items & reconcile into memory |
| `GET` | `/teams/{team_id}/projects/{project_id}/members/{worker_id}/memory` | Retrieve person-wise memory and history |

---

## 9. CLI Reference (`cs`)

Install CLI in editable mode:
```bash
pip install -e .
```

### Commands

| Command | Usage | Description |
|---|---|---|
| `cs init` | `cs init --team <id> --project <id> --worker <id> [--source <tool>]` | Initialize workspace configuration (`.contextswitch`) |
| `cs log` | `cs log "<message>"` | Log a decision to shared project memory |
| `cs done` | `cs done "<message>"` | Record completed work and update progress |
| `cs blocked` | `cs blocked "<message>"` | Record an active blocker |
| `cs fail` | `cs fail "<message>"` | Record a failed approach with reasons to avoid |
| `cs status` | `cs status` | Fetch and display current shared project state |
| `cs export` | `cs export` | Export prompt-ready markdown for Cursor / Claude / Gemini |

---

## 10. Web Dashboard & Frontend Architecture

The frontend is built with **Next.js 16 (App Router)** and styled with a Google-inspired design system:

- **Google OAuth Authentication**: Login via Auth.js / NextAuth. Frontend passes `X-User-Email` to backend APIs for user-isolated access.
- **Dynamic Dashboard (`/dashboard`)**:
  - Live team & project switching
  - Project stats (total projects, members, unresolved conflicts, blockers)
  - Active conflicts alert banner with 1-click resolution
  - Recent activity timeline across all team members
- **Project Details (`/projects/[team_id]/[project_id]`)**:
  - **Overview Tab**: Current project goal, progress checklist, decisions, blockers, failures, dependencies, and next actions.
  - **People Tab**: Person-wise reasoning and history (what Hariharan decided, what Jeevan tried, tool used).
  - **Activity Tab**: Real-time chronological audit trail of all entries.
  - **Conflicts Tab**: Side-by-side view of conflicting positions, reason for conflict, and resolution controls.
- **AI Chat Import Modal**: Paste a Gemini public share link, inspect extracted knowledge items, select items, and merge with one click.
- **Dark & Light Mode**: Persistent theme toggle matching modern developer workflows.

---

## 11. Technology Stack

- **AI & Reasoning Layer**:
  - Google Gemini API (`gemini-3-flash-preview` / `gemini-2.5-flash`)
  - Google GenAI SDK (`google-genai` 2.20.0)
  - Google Agent Development Kit (`google-adk` 2.8.0)
- **Backend Framework**:
  - Python 3.10+
  - FastAPI 0.141.1
  - Pydantic v2
  - Uvicorn
  - Playwright 1.62.0 (Headless Chromium chat extraction)
- **Database & Cloud**:
  - Google Cloud Firestore
  - Google Cloud Project: `contextswitch-hackathon-26`
- **Frontend Framework**:
  - Next.js 16.3.3 (App Router)
  - React 19.2.8
  - TypeScript 5
  - Tailwind CSS v4
  - Auth.js / NextAuth (Google OAuth)
  - Lucide Icons

---

## 12. Reproducible Testing Instructions

Follow these exact steps to verify the entire system, run the automated test suite, launch the services, and reproduce the end-to-end multi-agent conflict detection flow.

---

### 12.1 Environment Configuration

#### 1. Backend Environment Setup (`.env`)
Create a `.env` file in the root workspace directory:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GITHUB_TOKEN=your_optional_github_token_here
GOOGLE_CLOUD_PROJECT=contextswitch-hackathon-26
```

> **Note on Firestore credentials**: Ensure you are authenticated with Google Cloud CLI (`gcloud auth application-default login`) or set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`.

#### 2. Python Virtual Environment Setup
```bash
# Create virtual environment if needed
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies & CLI
pip install -r <(pip list --format=freeze)  # or use the active venv
pip install -e .
playwright install chromium
```

#### 3. Frontend Environment Setup (`frontend/.env.local`)
In `frontend/.env.local`:
```env
AUTH_SECRET=a_random_32_character_secret_here
AUTH_GOOGLE_ID=your_google_oauth_client_id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=false
```

---

### 12.2 Automated Python Test Suite

The repository contains standalone automated test scripts to validate individual modules independently:

#### Test 1: Pydantic Validation & Schema Integrity
Validates that incoming reconciliation outputs and state transition structures conform strictly to Pydantic schemas without relying on external network calls.
```bash
python test_validation.py
```
**Expected Output:**
```text
VALID
Goal: Compare scalar and vector gating using perplexity, effective rank, and slot utilization.
Next action: Calculate effective rank and slot utilization for scalar and vector gate checkpoints.
```

#### Test 2: Gemini API Connectivity Test
Validates that the Google GenAI SDK can authenticate with Gemini and generate responses.
```bash
python test_gemini.py
```
**Expected Output:**
```text
ContextSwitch Gemini connection works.
```

#### Test 3: GitHub Connector & Normalization Test
Validates fetching commits from GitHub REST API and normalizing them into structured evidence items.
```bash
python test_github.py
```
**Expected Output:**
```text
Evidence dictionaries printed with commit hash, author, commit message, and normalized metadata.
```

#### Test 4: Initial Project Context Agent Test
Validates extracting full project state (goal, progress, blockers, next actions) directly from a GitHub repository README and commits.
```bash
python test_initial_context.py
```
**Expected Output:**
```text
PROJECT GOAL
...
PROGRESS
- ...
BLOCKERS
- ...
NEXT ACTIONS
- ...
```

#### Test 5: State Reconciliation Engine Test
Validates reconciling a previous project state with multi-source evidence (GitHub commit, experiment metric, guide email).
```bash
python test_reconciliation.py
```
**Expected Output:**
```text
VALID RESULT
Goal: Compare scalar and vector gating...
Next action: Calculate effective rank and slot utilization...
Reason: The project guide requested these metrics.
```

#### Test 6: GitHub Resume & State Transition Test
Validates fetching live commits since a snapshot and executing automated task completion/outdated detection.
```bash
python test_github_resume.py
```

---

### 12.3 Starting the Backend and Frontend

Run the backend and frontend in separate terminal windows:

#### Terminal 1 — Backend (FastAPI)
```bash
# Activate venv
source venv/bin/activate

# Start FastAPI server on port 8000
python -m uvicorn backend:app --reload --host 127.0.0.1 --port 8000
```
- API Docs available at: `http://127.0.0.1:8000/docs`
- Health check: `curl http://127.0.0.1:8000/`

#### Terminal 2 — Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- Web Application available at: `http://localhost:3000`

---

### 12.4 Reproducible Flow 1: Two-Developer Conflict Detection & Resolution

This test demonstrates the core value proposition: **two developers in different AI tools making contradictory technical decisions, with ContextSwitch detecting and resolving the conflict.**

#### Step 1: Create Team & Project
You can create these via the Web UI (`http://localhost:3000`) or via `curl`:

```bash
# 1. Create team
curl -X POST http://127.0.0.1:8000/teams \
  -H "Content-Type: application/json" \
  -d '{"team_id": "team-alpha", "name": "Alpha Engineering"}'

# 2. Create project
curl -X POST http://127.0.0.1:8000/projects \
  -H "Content-Type: application/json" \
  -H "X-User-Email: test@example.com" \
  -d '{"team_id": "team-alpha", "project_id": "contextswitch", "name": "ContextSwitch"}'
```

#### Step 2: Developer 1 (Hariharan via Cursor) Logs Decision
Initialize CLI as Developer 1:
```bash
cs init --team team-alpha --project contextswitch --worker hariharan --source cursor
```
Log the vector database decision:
```bash
cs log "Use ChromaDB because Pinecone is too expensive"
```
**Output:**
```text
✓ DECISION logged
Entry ID: ...
```

#### Step 3: Developer 2 (Jeevan via Claude) Logs Contradictory Decision
Re-initialize CLI as Developer 2:
```bash
cs init --team team-alpha --project contextswitch --worker jeevan --source claude
```
Log the contradictory decision:
```bash
cs log "Use Pinecone because retrieval quality is better"
```

**Output:**
```text
✓ DECISION logged
Entry ID: ...

⚠ CONFLICT DETECTED
Topic: Vector Database Selection
Side A (hariharan): Use ChromaDB because Pinecone is too expensive
Side B (jeevan): Use Pinecone because retrieval quality is better
```

#### Step 4: Verify Conflict on Dashboard & Project Details
1. Open `http://localhost:3000/dashboard` in your browser.
2. The **Active Conflicts** banner displays:
   - **Topic**: `Vector Database Selection`
   - **Side A**: `hariharan (Cursor)` — *Use ChromaDB because Pinecone is too expensive*
   - **Side B**: `jeevan (Claude)` — *Use Pinecone because retrieval quality is better*
3. Click the conflict card to open the resolution dialog.

#### Step 5: Resolve Conflict
Resolve via the Web UI or via API:
```bash
# List conflicts to obtain the conflict_id
curl http://127.0.0.1:8000/teams/team-alpha/projects/contextswitch/conflicts

# Resolve the conflict
curl -X POST http://127.0.0.1:8000/teams/team-alpha/projects/contextswitch/conflicts/<CONFLICT_ID>/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "Use ChromaDB for local MVP development, re-evaluate Pinecone before production deployment.",
    "resolved_by": "hariharan"
  }'
```

#### Step 6: Verify Unified Project Context
Run:
```bash
cs status
```
or
```bash
cs export
```
The active conflict is marked resolved, the decision is updated in shared state, and the rationale is permanently recorded.

---

### 12.5 Reproducible Flow 2: Gemini Shared Chat Import & Reasoning Ingestion

This test verifies the Playwright + Gemini extraction pipeline for ingesting public Gemini chat conversations:

1. Open `http://localhost:3000/dashboard` and click into your project.
2. Click **"Import AI Context"** in the top navigation.
3. Paste any public Gemini share link (e.g., `https://gemini.google.com/share/...`).
4. Click **"Analyze Chat"**.
5. The backend launches Playwright, extracts the conversation transcript, and prompts Gemini to categorize decisions, completed items, blockers, failures, and risks.
6. Check the items you want to adopt into project memory and click **"Approve & Merge"**.
7. The approved items are instantly reconciled into the shared project state.

---

### 12.6 Reproducible Flow 3: Context Export into Fresh AI Session

1. Run the export command:
```bash
cs export
```
2. Copy the formatted output.
3. Open a fresh session in **Cursor, Claude Code, Gemini, Antigravity, or Copilot**.
4. Paste the export block.
5. The AI agent immediately knows:
   - What the project is (`goal`)
   - What has already been built (`progress`)
   - Architectural decisions and constraints (`decisions`)
   - What approaches failed and why (`do not repeat / failures`)
   - Current blockers (`blockers`)
   - What to do next (`next_actions`)

---

## 13. What Has Been Completed

### Core Foundation
- [x] Shared-memory model: Team → Project → Worker
- [x] Structured project state schemas (Pydantic v2)
- [x] Google Cloud Firestore persistent storage
- [x] Member storage & user-isolated dashboard querying
- [x] Raw team entries & snapshot history
- [x] Conflict persistence & resolution tracking
- [x] GitHub connector with evidence normalization and deduplication

### AI Reasoning & Reconciliation
- [x] Google GenAI SDK & ADK execution runner
- [x] Team reconciliation prompt engine
- [x] Automatic cross-worker conflict detection
- [x] State transition reasoning (progress, decisions, blockers, failures, next actions)
- [x] Public Gemini Shared-Chat import with Playwright + Gemini extraction
- [x] Member-wise memory extraction & profiling

### CLI
- [x] CLI package `cs` with subcommands: `init`, `log`, `done`, `blocked`, `fail`, `status`, `export`
- [x] Local configuration caching in `.contextswitch`
- [x] Instant contradiction warnings in CLI output

### Web Application
- [x] Next.js 16 App Router interface
- [x] Google OAuth authentication (Auth.js)
- [x] Protected dashboard connected to real Firestore data
- [x] Comprehensive Project Details page (`/projects/[team_id]/[project_id]`)
  - Overview tab (Goal, Progress, Decisions, Blockers, Failures, Next Actions)
  - People tab (Worker-specific memory and AI tool attribution)
  - Activity tab (Chronological audit feed)
  - Conflicts tab (Side-by-side conflict comparison & resolution modal)
- [x] Create Team, Create Project, and Add Member modals
- [x] AI Chat Import modal for Gemini share links
- [x] Light and dark modes with persistent theme toggle

---

## 14. Roadmap & Next Steps

1. **Native IDE Plugins**: Direct plugins for Cursor, VS Code, and JetBrains to automatically log decisions without manual CLI commands.
2. **Automated Background Sync**: Cloud Scheduler / Pub/Sub workers for continuous GitHub and issue tracking.
3. **Cloud Run Production Deployment**: Containerize FastAPI backend and deploy to Google Cloud Run with Secret Manager.
4. **Vector Search / Semantic Retrieval**: Firestore vector search over historical decisions and failed experiments.

---

## Project Tagline

> **Git merges your code. ContextSwitch merges your team's AI reasoning.**
