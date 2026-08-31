"use client";

import ImportAIContextModal from "@/components/import-ai-context-modal";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  Copy,
  GitBranch,
  Layers,
  RefreshCw,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";


/* =========================================================
   TYPES
========================================================= */

type ProjectState = {
  goal?: string;

  progress?: string[];

  decisions?: string[];

  failures?: string[];

  blockers?: string[];

  open_questions?: string[];

  dependencies?: string[];

  next_actions?: string[];

  assumptions?: string[];

  risk_flags?: string[];
};


type Member = {
  id: string;

  worker_id: string;

  name: string;

  email?: string;

  joined_at?: string;
};


type Conflict = {
  id: string;

  conflict_id: string;

  topic: string;

  side_a: {
    worker_id: string;
    position: string;
  };

  side_b: {
    worker_id: string;
    position: string;
  };

  status: string;

  resolution?: string;
};


type Entry = {
  id: string;

  worker_id: string;

  type: string;

  entry_type?: string;

  content: string;

  source: string;

  timestamp?: string;
};


/*
 * THIS is where MemoryItem belongs.
 *
 * It belongs OUTSIDE the component,
 * together with your other TypeScript types.
 */
type MemoryItem = {
  id: string;

  memory_id?: string;

  worker_id: string;

  worker_name?: string;

  type: string;

  title: string;

  content: string;

  reason?: string;

  evidence?: string;

  confidence?: number;

  explicitness?:
    | "explicit"
    | "inferred";

  severity?:
    | "low"
    | "medium"
    | "high"
    | "critical";

  likelihood?:
    | "low"
    | "medium"
    | "high";

  impact?: string;

  what_breaks_if_false?: string;

  validation_step?: string;

  source?: string;

  source_url?: string;
};


type ProjectDetailsShellProps = {
  teamId: string;

  projectId: string;
};


/* =========================================================
   CONFIG
========================================================= */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";


/* =========================================================
   COMPONENT
========================================================= */

export default function ProjectDetailsShell({
  teamId,
  projectId,
}: ProjectDetailsShellProps) {

  /* =======================================================
     NORMAL PAGE STATE
  ======================================================= */

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    | "overview"
    | "people"
    | "activity"
    | "conflicts"
  >("overview");


  const [
    syncing,
    setSyncing,
  ] = useState(false);


  const [
    syncToast,
    setSyncToast,
  ] = useState<string | null>(
    null
  );


  const [
    exportModalOpen,
    setExportModalOpen,
  ] = useState(false);


  const [
    copied,
    setCopied,
  ] = useState(false);


  /*
   * FIX:
   *
   * This MUST be inside the React component.
   *
   * You previously had this above your imports,
   * which causes the hook error.
   */
  const [
    importContextOpen,
    setImportContextOpen,
  ] = useState(false);


  /* =======================================================
     PEOPLE / MEMBER MEMORY
  ======================================================= */

  const [
    selectedMember,
    setSelectedMember,
  ] = useState<string | null>(
    null
  );


  const [
    memberMemory,
    setMemberMemory,
  ] = useState<MemoryItem[]>(
    []
  );


  const [
    memberMemoryLoading,
    setMemberMemoryLoading,
  ] = useState(false);


  /* =======================================================
     CONFLICT RESOLUTION
  ======================================================= */

  const [
    resolvingId,
    setResolvingId,
  ] = useState<string | null>(
    null
  );


  const [
    resolutionText,
    setResolutionText,
  ] = useState("");


  /* =======================================================
     FIRESTORE/BACKEND DATA
  ======================================================= */

  const [
    projectName,
    setProjectName,
  ] = useState("");


  const [
    githubRepo,
    setGithubRepo,
  ] = useState("");


  const [
    currentState,
    setCurrentState,
  ] = useState<ProjectState>({});


  const [
    members,
    setMembers,
  ] = useState<Member[]>([]);


  const [
    entries,
    setEntries,
  ] = useState<Entry[]>([]);


  const [
    conflicts,
    setConflicts,
  ] = useState<Conflict[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );


  /* =======================================================
     LOAD PROJECT
  ======================================================= */

  async function loadProjectData() {

    setLoading(true);

    setError(null);

    try {

      const [
        projectRes,
        entriesRes,
      ] = await Promise.all([
        fetch(
          `${API_URL}/teams/${teamId}/projects/${projectId}`,
          {
            cache:
              "no-store",
          }
        ),

        fetch(
          `${API_URL}/teams/${teamId}/projects/${projectId}/entries`,
          {
            cache:
              "no-store",
          }
        ),
      ]);


      if (!projectRes.ok) {

        const body =
          await projectRes.text();

        throw new Error(
          `Failed to load project (${projectRes.status}): ${
            body ||
            projectRes.statusText
          }`
        );
      }


      if (!entriesRes.ok) {

        const body =
          await entriesRes.text();

        throw new Error(
          `Failed to load entries (${entriesRes.status}): ${
            body ||
            entriesRes.statusText
          }`
        );
      }


      const data =
        await projectRes.json();


      const entriesData =
        await entriesRes.json();


      if (!data.project) {

        throw new Error(
          "Project not found"
        );
      }


      const state =
        data.project
          .current_state ||
        {};


      setProjectName(
        data.project.name ||
        projectId
      );


      setGithubRepo(
        data.project.github_owner &&
        data.project.github_repo

          ? `${data.project.github_owner}/${data.project.github_repo}`

          : ""
      );


      setCurrentState({
        goal:
          state.goal ||
          "",

        progress:
          state.progress ||
          state.completed ||
          [],

        decisions:
          state.decisions ||
          [],

        failures:
          state.failures ||
          state.failed ||
          [],

        blockers:
          state.blockers ||
          [],

        open_questions:
          state.open_questions ||
          [],

        dependencies:
          state.dependencies ||
          [],

        next_actions:
          state.next_actions ||
          [],

        assumptions:
          state.assumptions ||
          [],

        risk_flags:
          state.risk_flags ||
          [],
      });


      setMembers(
        Array.isArray(
          data.members
        )
          ? data.members
          : []
      );


      setConflicts(
        Array.isArray(
          data.active_conflicts
        )
          ? data.active_conflicts
          : []
      );


      setEntries(
        Array.isArray(
          entriesData.entries
        )
          ? entriesData.entries
          : []
      );

    } catch (err) {

      console.error(
        "Failed to load project data:",
        err
      );


      setProjectName("");

      setGithubRepo("");

      setCurrentState({});

      setMembers([]);

      setEntries([]);

      setConflicts([]);


      setError(
        err instanceof Error
          ? err.message
          : "Failed to load project data"
      );

    } finally {

      setLoading(false);
    }
  }


  useEffect(() => {

    void loadProjectData();

  }, [
    teamId,
    projectId,
  ]);


  /* =======================================================
     MEMBER-WISE ENTRIES
  ======================================================= */

  const memberFilteredEntries =
    selectedMember

      ? entries.filter(
          (entry) =>
            entry.worker_id
              .toLowerCase() ===
            selectedMember
              .toLowerCase()
        )

      : entries;


  /* =======================================================
     LOAD MEMBER-WISE MEMORY

     This gives you:

     - assumptions
     - risks
     - open questions
     - decisions
     - failures
     - etc

     for ONE teammate.
  ======================================================= */

  useEffect(() => {

    async function loadMemberMemory() {

      if (!selectedMember) {

        setMemberMemory([]);

        return;
      }


      setMemberMemoryLoading(
        true
      );


      try {

        const response =
          await fetch(
            `${API_URL}/teams/${teamId}/projects/${projectId}/members/${encodeURIComponent(
              selectedMember
            )}/memory`,
            {
              cache:
                "no-store",
            }
          );


        if (!response.ok) {

          const body =
            await response.text();

          throw new Error(
            `Failed to load member memory (${response.status}): ${
              body ||
              response.statusText
            }`
          );
        }


        const data =
          await response.json();


        setMemberMemory(
          Array.isArray(
            data.items
          )
            ? data.items
            : []
        );

      } catch (err) {

        console.error(
          "Failed to load member memory:",
          err
        );


        setMemberMemory([]);

      } finally {

        setMemberMemoryLoading(
          false
        );
      }
    }


    void loadMemberMemory();

  }, [
    selectedMember,
    teamId,
    projectId,
  ]);


  /* =======================================================
     GITHUB SYNC
  ======================================================= */

  async function handleSyncGitHub() {

    setSyncing(true);

    setSyncToast(null);


    try {

      const response =
        await fetch(
          `${API_URL}/teams/${teamId}/projects/${projectId}/sync-github`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );


      if (!response.ok) {

        const body =
          await response.text();

        throw new Error(
          `GitHub sync failed (${response.status}): ${
            body ||
            response.statusText
          }`
        );
      }


      const data =
        await response.json();


      await loadProjectData();


      setSyncToast(
        `GitHub sync complete. ${
          data.evidence_count ??
          0
        } evidence item(s) processed.`
      );

    } catch (err) {

      console.error(
        "GitHub sync failed:",
        err
      );


      setSyncToast(
        err instanceof Error
          ? err.message
          : "GitHub sync failed"
      );

    } finally {

      setSyncing(false);


      setTimeout(
        () =>
          setSyncToast(null),
        5000
      );
    }
  }


  /* =======================================================
     RESOLVE CONFLICT
  ======================================================= */

  async function handleResolveConflict(
    conflictId: string
  ) {

    if (
      !resolutionText.trim()
    ) {
      return;
    }


    try {

      const response =
        await fetch(
          `${API_URL}/teams/${teamId}/projects/${projectId}/conflicts/${conflictId}/resolve`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                resolution:
                  resolutionText.trim(),

                resolved_by:
                  "web-dashboard",
              }),
          }
        );


      if (!response.ok) {

        const body =
          await response.text();

        throw new Error(
          `Conflict resolution failed (${response.status}): ${
            body ||
            response.statusText
          }`
        );
      }


      setResolvingId(null);

      setResolutionText("");


      await loadProjectData();

    } catch (err) {

      console.error(
        "Failed to resolve conflict:",
        err
      );


      setSyncToast(
        err instanceof Error
          ? err.message
          : "Failed to resolve conflict"
      );


      setTimeout(
        () =>
          setSyncToast(null),
        5000
      );
    }
  }


  /* =======================================================
     COUNTS
  ======================================================= */

  const unresolvedConflictsCount =
    conflicts.filter(
      (conflict) =>
        conflict.status ===
        "unresolved"
    ).length;


  /* =======================================================
     EXPORT
  ======================================================= */

  const exportPacket =
`=== CONTEXTSWITCH PORTABLE WORKSPACE PACKET ===

Project: ${projectName}
Team: ${teamId}
Project ID: ${projectId}

Repository:
${githubRepo || "Not connected"}

GOAL
${currentState.goal || "Not specified"}

BEST NEXT ACTIONS
${(
  currentState.next_actions ||
  []
)
  .map(
    (value, index) =>
      `${index + 1}. ${value}`
  )
  .join("\n")}

BLOCKERS
${(
  currentState.blockers ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

DECISIONS
${(
  currentState.decisions ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

ASSUMPTIONS
${(
  currentState.assumptions ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

RISK FLAGS
${(
  currentState.risk_flags ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

OPEN QUESTIONS
${(
  currentState.open_questions ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

FAILED ATTEMPTS
${(
  currentState.failures ||
  []
)
  .map(
    (value) =>
      `- ${value}`
  )
  .join("\n")}

ACTIVE CONFLICTS
${
  unresolvedConflictsCount === 0

    ? "- None"

    : conflicts
        .filter(
          (conflict) =>
            conflict.status ===
            "unresolved"
        )
        .map(
          (conflict) =>
            `- ${conflict.topic}: ${conflict.side_a.worker_id} vs ${conflict.side_b.worker_id}`
        )
        .join("\n")
}

=================================================`;


  function copyToClipboard() {

    void navigator.clipboard
      .writeText(
        exportPacket
      );


    setCopied(true);


    setTimeout(
      () =>
        setCopied(false),
      2000
    );
  }


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {

    return (
      <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">

        <div className="flex min-h-screen items-center justify-center">

          <div className="text-center">

            <RefreshCw
              className="
                mx-auto
                h-7 w-7
                animate-spin
                text-[#38bdf8]
              "
            />

            <p className="mt-3 text-sm text-[#94a3b8]">
              Loading project context...
            </p>

          </div>

        </div>

      </div>
    );
  }


  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {

    return (
      <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">

        <div className="flex min-h-screen items-center justify-center px-6">

          <div className="w-full max-w-lg rounded-xl border border-red-500/30 bg-[#161a24] p-7 text-center">

            <XCircle
              className="
                mx-auto
                h-8 w-8
                text-red-500
              "
            />

            <h2 className="mt-4 text-lg font-semibold text-white">
              Unable to load project
            </h2>

            <p className="mt-2 text-sm text-[#94a3b8]">
              {error}
            </p>

            <div className="mt-5 flex justify-center gap-3">

              <button
                onClick={() =>
                  void loadProjectData()
                }
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
              >
                Retry
              </button>

              <Link
                href="/dashboard"
                className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs text-[#94a3b8]"
              >
                Dashboard
              </Link>

            </div>

          </div>

        </div>

      </div>
    );
  }


  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">

      {/* TOAST */}

      {syncToast && (

        <div className="bg-[#0284c7] px-6 py-2.5 text-center text-xs font-semibold text-white">

          <div className="flex items-center justify-center gap-2">

            <Sparkles
              className="h-4 w-4"
            />

            {syncToast}

          </div>

        </div>
      )}


      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-[#222734] bg-[#0f1117]/95 px-6 py-3 backdrop-blur">

        <div className="flex items-center gap-4">

          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-[#2a3040] bg-[#161a24] px-3 py-1.5 text-xs text-[#94a3b8]"
          >
            <ArrowLeft
              className="h-3.5 w-3.5"
            />

            Back
          </Link>


          <div>

            <div className="flex items-center gap-2">

              <h1 className="text-base font-semibold text-white">
                {projectName}
              </h1>

              <span className="rounded bg-[#1e293b] px-2 py-0.5 text-[10px] font-mono text-[#38bdf8]">
                {teamId}
              </span>

            </div>


            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#64748b]">

              <GitBranch
                className="h-3 w-3"
              />

              {githubRepo ||
                "No GitHub repository"}

            </div>

          </div>

        </div>


        <div className="flex flex-wrap items-center gap-2">

          <button
            onClick={
              handleSyncGitHub
            }
            disabled={
              syncing
            }
            className="flex items-center gap-2 rounded-lg border border-[#2a3040] bg-[#161a24] px-3 py-2 text-xs text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#38bdf8] ${
                syncing
                  ? "animate-spin"
                  : ""
              }`}
            />

            {syncing
              ? "Syncing..."
              : "Sync GitHub"}
          </button>


          {/* NEW GEMINI IMPORT BUTTON */}

          <button
            onClick={() =>
              setImportContextOpen(
                true
              )
            }
            className="flex items-center gap-2 rounded-lg border border-[#2a3040] bg-[#161a24] px-3 py-2 text-xs text-white"
          >
            <Brain
              className="h-3.5 w-3.5 text-[#a78bfa]"
            />

            Import AI Context
          </button>


          <button
            onClick={() =>
              setExportModalOpen(
                true
              )
            }
            className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-medium text-white"
          >
            <Copy
              className="h-3.5 w-3.5"
            />

            Export Context
          </button>

        </div>

      </header>


      {/* ===================================================
          TABS
      =================================================== */}

      <div className="border-b border-[#222734] bg-[#141721] px-6">

        <nav className="flex gap-8 overflow-x-auto">

          {[
            {
              id:
                "overview",
              label:
                "Overview",
              icon:
                Layers,
            },

            {
              id:
                "people",
              label:
                "People-Wise Context",
              icon:
                Users,
            },

            {
              id:
                "activity",
              label:
                "Activity",
              icon:
                Activity,
            },

            {
              id:
                "conflicts",
              label:
                `Conflicts (${unresolvedConflictsCount})`,
              icon:
                AlertTriangle,
            },
          ].map(
            (tab) => {

              const Icon =
                tab.icon;


              const selected =
                activeTab ===
                tab.id;


              return (
                <button
                  key={
                    tab.id
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.id as
                        | "overview"
                        | "people"
                        | "activity"
                        | "conflicts"
                    )
                  }
                  className={`flex items-center gap-2 border-b-2 py-4 text-sm ${
                    selected
                      ? "border-[#38bdf8] text-[#38bdf8]"
                      : "border-transparent text-[#94a3b8]"
                  }`}
                >
                  <Icon
                    className="h-4 w-4"
                  />

                  {tab.label}

                </button>
              );
            }
          )}

        </nav>

      </div>


      {/* ===================================================
          CONTENT
      =================================================== */}

      <main className="mx-auto max-w-7xl px-6 py-8">


        {/* =================================================
            OVERVIEW
        ================================================= */}

        {activeTab ===
          "overview" && (

          <div className="space-y-6">

            <ContextSection
              title="Project Goal"
              items={
                currentState.goal
                  ? [
                      currentState.goal,
                    ]
                  : []
              }
              empty="No project goal recorded."
            />


            <div className="grid gap-6 md:grid-cols-2">

              <ContextSection
                title="Best Next Actions"
                items={
                  currentState.next_actions ||
                  []
                }
                empty="No next actions."
              />


              <ContextSection
                title="Active Blockers"
                items={
                  currentState.blockers ||
                  []
                }
                empty="No blockers."
                danger
              />

            </div>


            <div className="grid gap-6 md:grid-cols-2">

              <ContextSection
                title="Decisions"
                items={
                  currentState.decisions ||
                  []
                }
                empty="No decisions recorded."
              />


              <ContextSection
                title="Progress"
                items={
                  currentState.progress ||
                  []
                }
                empty="No completed progress recorded."
              />

            </div>


            {/* NEW PROJECT LEVEL CONTEXT */}

            <div className="grid gap-6 lg:grid-cols-3">

              <ContextSection
                title="Assumptions"
                items={
                  currentState.assumptions ||
                  []
                }
                empty="No active assumptions."
                warning
              />


              <ContextSection
                title="Risk Flags"
                items={
                  currentState.risk_flags ||
                  []
                }
                empty="No active risk flags."
                danger
              />


              <ContextSection
                title="Open Questions"
                items={
                  currentState.open_questions ||
                  []
                }
                empty="No open questions."
              />

            </div>

          </div>
        )}


        {/* =================================================
            PEOPLE
        ================================================= */}

        {activeTab ===
          "people" && (

          <div className="grid gap-8 md:grid-cols-[260px_1fr]">


            {/* MEMBER LIST */}

            <div>

              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                Team Members
              </h3>


              <div className="mt-4 space-y-2">

                <button
                  onClick={() =>
                    setSelectedMember(
                      null
                    )
                  }
                  className={`w-full rounded-lg p-3 text-left text-sm ${
                    selectedMember ===
                    null

                      ? "bg-[#2563eb] text-white"

                      : "bg-[#161a24] text-[#94a3b8]"
                  }`}
                >
                  All Teammates
                </button>


                {members.map(
                  (member) => {

                    const selected =
                      selectedMember?.toLowerCase() ===
                      member.worker_id.toLowerCase();


                    return (
                      <button
                        key={
                          member.id ||
                          member.worker_id
                        }
                        onClick={() =>
                          setSelectedMember(
                            member.worker_id
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg p-3 text-left text-sm ${
                          selected
                            ? "bg-[#2563eb] text-white"
                            : "bg-[#161a24] text-[#94a3b8]"
                        }`}
                      >
                        <span>
                          {member.name ||
                            member.worker_id}
                        </span>

                        <ChevronRight
                          className="h-4 w-4"
                        />

                      </button>
                    );
                  }
                )}

              </div>

            </div>


            {/* MEMBER CONTEXT */}

            <div className="space-y-6">

              <div className="rounded-xl border border-[#222734] bg-[#161a24] p-5">

                <h2 className="font-semibold text-white">

                  {selectedMember
                    ? `Context for ${selectedMember}`
                    : "All teammate contributions"}

                </h2>

                <p className="mt-1 text-xs text-[#64748b]">

                  See what each member decided,
                  assumed, discovered, attempted,
                  questioned and risked.

                </p>

              </div>


              {/* IMPORTANT NEW MEMBER-WISE CARDS */}

              {selectedMember && (

                <div className="grid gap-4 lg:grid-cols-3">

                  <MemberMemorySummary
                    title="Assumptions"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                          "assumption"
                      )
                    }
                    loading={
                      memberMemoryLoading
                    }
                  />


                  <MemberMemorySummary
                    title="Risk Flags"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                          "risk_flag"
                      )
                    }
                    loading={
                      memberMemoryLoading
                    }
                  />


                  <MemberMemorySummary
                    title="Open Questions"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                          "open_question"
                      )
                    }
                    loading={
                      memberMemoryLoading
                    }
                  />

                </div>
              )}


              {selectedMember && (

                <div className="grid gap-4 md:grid-cols-2">

                  <MemberMemoryList
                    title="Decisions & Micro-Decisions"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                            "decision" ||
                          item.type ===
                            "micro_decision"
                      )
                    }
                  />


                  <MemberMemoryList
                    title="What They Did"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                            "completed" ||
                          item.type ===
                            "technical_discovery" ||
                          item.type ===
                            "architecture_change"
                      )
                    }
                  />


                  <MemberMemoryList
                    title="Failures / Do Not Repeat"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                            "failure" ||
                          item.type ===
                            "do_not_repeat" ||
                          item.type ===
                            "rejected_alternative"
                      )
                    }
                  />


                  <MemberMemoryList
                    title="TODOs & Blockers"
                    values={
                      memberMemory.filter(
                        (item) =>
                          item.type ===
                            "todo" ||
                          item.type ===
                            "blocker"
                      )
                    }
                  />

                </div>
              )}


              {/* RAW ENTRIES */}

              <div>

                <h3 className="mb-3 text-sm font-semibold text-white">
                  Activity / Entries
                </h3>


                <div className="space-y-3">

                  {memberFilteredEntries.length ===
                  0 ? (

                    <EmptyState
                      text="No entries found."
                    />

                  ) : (

                    memberFilteredEntries.map(
                      (
                        entry,
                        index
                      ) => (

                        <div
                          key={
                            entry.id ||
                            index
                          }
                          className="rounded-xl border border-[#222734] bg-[#161a24] p-5"
                        >

                          <div className="flex items-center justify-between gap-3">

                            <div className="flex items-center gap-2">

                              <span className="rounded bg-[#1e293b] px-2 py-1 text-xs text-white">
                                {
                                  entry.worker_id
                                }
                              </span>

                              <span className="rounded bg-[#2563eb]/10 px-2 py-1 text-[10px] uppercase text-[#38bdf8]">
                                {
                                  entry.entry_type ||
                                  entry.type
                                }
                              </span>

                            </div>

                            <span className="text-xs text-[#64748b]">
                              {
                                entry.source
                              }
                            </span>

                          </div>


                          <p className="mt-3 text-sm text-[#cbd5e1]">
                            {
                              entry.content
                            }
                          </p>

                        </div>
                      )
                    )
                  )}

                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            ACTIVITY
        ================================================= */}

        {activeTab ===
          "activity" && (

          <div className="space-y-3">

            <h2 className="mb-5 text-lg font-semibold text-white">
              Project Activity
            </h2>


            {entries.length ===
            0 ? (

              <EmptyState
                text="No activity recorded."
              />

            ) : (

              entries.map(
                (
                  entry,
                  index
                ) => (

                  <div
                    key={
                      entry.id ||
                      index
                    }
                    className="rounded-xl border border-[#222734] bg-[#161a24] p-4"
                  >

                    <div className="flex items-center justify-between">

                      <strong className="text-sm text-[#38bdf8]">
                        {
                          entry.worker_id
                        }
                      </strong>

                      <span className="text-xs text-[#64748b]">
                        {
                          entry.source
                        }
                      </span>

                    </div>

                    <p className="mt-2 text-sm text-[#cbd5e1]">
                      {
                        entry.content
                      }
                    </p>

                  </div>
                )
              )
            )}

          </div>
        )}


        {/* =================================================
            CONFLICTS
        ================================================= */}

        {activeTab ===
          "conflicts" && (

          <div className="space-y-5">

            <h2 className="text-lg font-semibold text-white">
              Team Decision Conflicts
            </h2>


            {conflicts.length ===
            0 ? (

              <EmptyState
                text="No unresolved conflicts."
              />

            ) : (

              conflicts.map(
                (conflict) => (

                  <div
                    key={
                      conflict.id ||
                      conflict.conflict_id
                    }
                    className="rounded-xl border border-red-500/30 bg-[#161a24] p-6"
                  >

                    <div className="flex items-center gap-2 text-sm font-semibold text-red-300">

                      <AlertTriangle
                        className="h-4 w-4"
                      />

                      {
                        conflict.topic
                      }

                    </div>


                    <div className="mt-4 grid gap-4 md:grid-cols-2">

                      <ConflictSide
                        worker={
                          conflict.side_a.worker_id
                        }
                        position={
                          conflict.side_a.position
                        }
                      />


                      <ConflictSide
                        worker={
                          conflict.side_b.worker_id
                        }
                        position={
                          conflict.side_b.position
                        }
                      />

                    </div>


                    {conflict.status ===
                    "resolved" ? (

                      <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-300">

                        <strong>
                          Resolution:
                        </strong>{" "}

                        {
                          conflict.resolution
                        }

                      </div>

                    ) : resolvingId ===
                      (
                        conflict.conflict_id ||
                        conflict.id
                      ) ? (

                      <div className="mt-4">

                        <textarea
                          value={
                            resolutionText
                          }
                          onChange={
                            (event) =>
                              setResolutionText(
                                event.target.value
                              )
                          }
                          rows={3}
                          placeholder="Enter final team resolution..."
                          className="w-full rounded-lg border border-[#2a3040] bg-[#11141c] p-3 text-sm text-white outline-none focus:border-[#38bdf8]"
                        />


                        <div className="mt-3 flex gap-2">

                          <button
                            onClick={() =>
                              void handleResolveConflict(
                                conflict.conflict_id ||
                                conflict.id
                              )
                            }
                            className="rounded-lg bg-green-500 px-4 py-2 text-xs font-semibold text-black"
                          >
                            Save Resolution
                          </button>


                          <button
                            onClick={() =>
                              setResolvingId(
                                null
                              )
                            }
                            className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs text-[#94a3b8]"
                          >
                            Cancel
                          </button>

                        </div>

                      </div>

                    ) : (

                      <button
                        onClick={() =>
                          setResolvingId(
                            conflict.conflict_id ||
                            conflict.id
                          )
                        }
                        className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#38bdf8]"
                      >
                        <CheckCircle2
                          className="h-4 w-4"
                        />

                        Resolve Conflict
                      </button>
                    )}

                  </div>
                )
              )
            )}

          </div>
        )}

      </main>


      {/* ===================================================
          GEMINI IMPORT MODAL
      =================================================== */}

      <ImportAIContextModal
        isOpen={
          importContextOpen
        }

        onClose={() =>
          setImportContextOpen(
            false
          )
        }

        teamId={
          teamId
        }

        projectId={
          projectId
        }

        members={
          members
        }

        onImported={() => {

          setImportContextOpen(
            false
          );


          setSyncToast(
            "Gemini context merged into shared project memory."
          );


          void loadProjectData();


          if (
            selectedMember
          ) {

            /*
             * Selecting the same member again won't
             * trigger the effect, so toggle briefly.
             */

            const worker =
              selectedMember;


            setSelectedMember(
              null
            );


            setTimeout(
              () =>
                setSelectedMember(
                  worker
                ),
              50
            );
          }


          setTimeout(
            () =>
              setSyncToast(
                null
              ),
            5000
          );
        }}
      />


      {/* ===================================================
          EXPORT MODAL
      =================================================== */}

      {exportModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="w-full max-w-2xl rounded-2xl border border-[#2a3040] bg-[#161a24] p-6">

            <div className="flex items-center justify-between">

              <h3 className="font-semibold text-white">
                Portable Context Packet
              </h3>


              <button
                onClick={() =>
                  setExportModalOpen(
                    false
                  )
                }
                className="text-[#94a3b8]"
              >
                ✕
              </button>

            </div>


            <pre className="mt-4 max-h-[500px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#0d1017] p-4 text-xs text-[#38bdf8]">

              {exportPacket}

            </pre>


            <div className="mt-4 flex justify-end">

              <button
                onClick={
                  copyToClipboard
                }
                className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
              >
                <Copy
                  className="h-4 w-4"
                />

                {copied
                  ? "Copied!"
                  : "Copy Context"}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function ContextSection({
  title,
  items,
  empty,
  danger = false,
  warning = false,
}: {
  title: string;

  items: string[];

  empty: string;

  danger?: boolean;

  warning?: boolean;
}) {

  return (
    <section
      className={`rounded-xl border p-5 ${
        danger
          ? "border-red-500/20 bg-red-500/5"

          : warning
          ? "border-amber-500/20 bg-amber-500/5"

          : "border-[#222734] bg-[#161a24]"
      }`}
    >

      <h3 className="text-sm font-semibold text-white">
        {title}
      </h3>


      {items.length ===
      0 ? (

        <p className="mt-3 text-xs text-[#64748b]">
          {empty}
        </p>

      ) : (

        <div className="mt-3 space-y-2">

          {items.map(
            (
              item,
              index
            ) => (

              <div
                key={
                  index
                }
                className="rounded-lg border border-[#262c3a] bg-[#11141c] p-3 text-sm text-[#cbd5e1]"
              >
                {item}
              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}


function MemberMemorySummary({
  title,
  values,
  loading,
}: {
  title: string;

  values: MemoryItem[];

  loading: boolean;
}) {

  return (
    <div className="rounded-xl border border-[#222734] bg-[#161a24] p-4">

      <div className="flex items-center justify-between">

        <h3 className="text-sm font-semibold text-white">
          {title}
        </h3>

        <span className="rounded bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#94a3b8]">
          {values.length}
        </span>

      </div>


      <div className="mt-3 space-y-2">

        {loading ? (

          <div className="flex items-center gap-2 text-xs text-[#64748b]">

            <RefreshCw
              className="h-3.5 w-3.5 animate-spin"
            />

            Loading...

          </div>

        ) : values.length ===
          0 ? (

          <p className="text-xs text-[#64748b]">
            None extracted yet.
          </p>

        ) : (

          values
            .slice(
              0,
              8
            )
            .map(
              (item) => (

                <div
                  key={
                    item.id ||
                    item.memory_id
                  }
                  className="rounded-lg border border-[#262c3a] bg-[#11141c] p-3"
                >

                  <div className="text-xs font-medium text-[#cbd5e1]">
                    {
                      item.title ||
                      item.content
                    }
                  </div>


                  {item.type ===
                    "assumption" &&
                    item.explicitness && (

                    <div className="mt-1 text-[10px] uppercase text-amber-300">

                      {
                        item.explicitness
                      }{" "}
                      assumption

                      {" · "}

                      {
                        Math.round(
                          (
                            item.confidence ||
                            0
                          ) *
                            100
                        )
                      }
                      % confidence

                    </div>
                  )}


                  {item.type ===
                    "assumption" &&
                    item.what_breaks_if_false && (

                    <p className="mt-2 text-[11px] leading-4 text-amber-400">

                      If false:{" "}
                      {
                        item.what_breaks_if_false
                      }

                    </p>
                  )}


                  {item.type ===
                    "risk_flag" &&
                    item.severity && (

                    <div className="mt-1 text-[10px] uppercase text-red-300">

                      {
                        item.severity
                      }{" "}
                      risk

                      {item.likelihood
                        ? ` · ${item.likelihood} likelihood`
                        : ""}

                    </div>
                  )}


                  {item.type ===
                    "risk_flag" &&
                    item.impact && (

                    <p className="mt-2 text-[11px] leading-4 text-red-400">

                      Impact:{" "}
                      {
                        item.impact
                      }

                    </p>
                  )}


                  {item.reason && (

                    <p className="mt-2 text-[11px] leading-4 text-[#64748b]">
                      {
                        item.reason
                      }
                    </p>
                  )}

                </div>
              )
            )
        )}

      </div>

    </div>
  );
}


function MemberMemoryList({
  title,
  values,
}: {
  title: string;

  values: MemoryItem[];
}) {

  return (
    <section className="rounded-xl border border-[#222734] bg-[#161a24] p-4">

      <h3 className="text-sm font-semibold text-white">
        {title}
      </h3>


      <div className="mt-3 space-y-2">

        {values.length ===
        0 ? (

          <p className="text-xs text-[#64748b]">
            Nothing extracted yet.
          </p>

        ) : (

          values.map(
            (item) => (

              <div
                key={
                  item.id ||
                  item.memory_id
                }
                className="rounded-lg border border-[#262c3a] bg-[#11141c] p-3"
              >

                <div className="text-xs font-semibold text-[#cbd5e1]">
                  {
                    item.title ||
                    item.content
                  }
                </div>


                {item.content &&
                  item.title !==
                    item.content && (

                  <p className="mt-1 text-xs text-[#94a3b8]">
                    {
                      item.content
                    }
                  </p>
                )}


                {item.source && (

                  <div className="mt-2 text-[10px] uppercase text-[#38bdf8]">
                    Source:{" "}
                    {
                      item.source
                    }
                  </div>
                )}

              </div>
            )
          )
        )}

      </div>

    </section>
  );
}


function ConflictSide({
  worker,
  position,
}: {
  worker: string;

  position: string;
}) {

  return (
    <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">

      <strong className="text-xs text-[#38bdf8]">
        {worker}
      </strong>

      <p className="mt-2 text-sm text-[#cbd5e1]">
        {position}
      </p>

    </div>
  );
}


function EmptyState({
  text,
}: {
  text: string;
}) {

  return (
    <div className="rounded-xl border border-dashed border-[#2a3040] p-6 text-center text-sm text-[#64748b]">
      {text}
    </div>
  );
}