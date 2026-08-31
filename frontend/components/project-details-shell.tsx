"use client";

import ImportAIContextModal from "@/components/import-ai-context-modal";

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  Copy,
  GitBranch,
  HelpCircle,
  Layers,
  Lightbulb,
  ListTodo,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";


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

  role?: string;

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

  actor?: string;

  email?: string;

  metadata?: {
    actor?: string;
    email?: string;
  };
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
  const { data: session } = useSession();

  const userEmail =
    session?.user?.email?.trim().toLowerCase() ||
    "dev@contextswitch.ai";

  const userName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Developer";

  const hasAutoSynced = useRef(false);

  function getAuthHeaders(customHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      ...customHeaders,
    };

    if (userEmail) {
      headers["X-User-Email"] = userEmail;
    }
    if (userName) {
      headers["X-User-Name"] = userName;
    }

    return headers;
  }

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

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Developer");
  const [addingMember, setAddingMember] = useState(false);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setAddingMember(true);
    try {
      const res = await fetch(`${API_URL}/teams/${teamId}/projects/${projectId}/members`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: newMemberName.trim() || newMemberEmail.split("@")[0],
          email: newMemberEmail.trim(),
          role: newMemberRole.trim() || "Developer",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to add member");
      }

      await loadProjectData();
      setAddMemberOpen(false);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("Developer");
      setSyncToast(`Added new team member: ${newMemberName || newMemberEmail}`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: unknown) {
      alert(`Error adding member: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setAddingMember(false);
    }
  }


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
            headers: getAuthHeaders({
              Accept: "application/json",
            }),
          }
        ),

        fetch(
          `${API_URL}/teams/${teamId}/projects/${projectId}/entries`,
          {
            cache:
              "no-store",
            headers: getAuthHeaders({
              Accept: "application/json",
            }),
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

      const needsSync =
        data.project.needs_github_sync ||
        (data.project.github_owner &&
          data.project.github_repo &&
          !state.goal &&
          (!state.next_actions || state.next_actions.length === 0));

      if (needsSync && !hasAutoSynced.current) {
        hasAutoSynced.current = true;
        setTimeout(() => {
          void handleSyncGitHub();
        }, 100);
      }

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

  const memberFilteredEntries = selectedMember
    ? entries.filter((entry) => {
        const selected = selectedMember.toLowerCase();
        const wId = (entry.worker_id || "").toLowerCase();
        const actor = (entry.actor || entry.metadata?.actor || "").toLowerCase();
        const email = (entry.email || entry.metadata?.email || "").toLowerCase();
        return (
          wId.includes(selected) ||
          (wId && selected.includes(wId)) ||
          actor.includes(selected) ||
          (actor && selected.includes(actor)) ||
          email.includes(selected) ||
          (email && selected.includes(email))
        );
      })
    : entries;


  const selectedMemberRecord = members.find(
    (member) =>
      member.worker_id.toLowerCase() ===
      selectedMember?.toLowerCase()
  );


  function displayMemberName(
    workerId: string,
  ) {
    const normalized = workerId.toLowerCase();
    const member = members.find((candidate) => {
      const id = (candidate.worker_id || "").toLowerCase();
      const email = (candidate.email || "").toLowerCase();
      const name = (candidate.name || "").toLowerCase();
      return normalized === id || normalized === email || normalized === name;
    });

    return member?.name || workerId;
  }


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
              headers: getAuthHeaders({
                Accept: "application/json",
              }),
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

            headers: getAuthHeaders({
              "Content-Type":
                "application/json",
            }),
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

            headers: getAuthHeaders({
              "Content-Type":
                "application/json",
            }),

            body:
              JSON.stringify({
                resolution:
                  resolutionText.trim(),

                resolved_by:
                  userEmail || "web-dashboard",
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

        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI STATS BAR */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-[#121c2d] to-[#0f1420] p-4 shadow-md transition-all hover:border-sky-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">Next Actions</span>
                  <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
                    <ListTodo className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  {(currentState.next_actions || []).length}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-[#11241c] to-[#0d1714] p-4 shadow-md transition-all hover:border-emerald-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Completed Progress</span>
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  {(currentState.progress || []).length}
                </div>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-[#1c162b] to-[#120f1c] p-4 shadow-md transition-all hover:border-purple-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Key Decisions</span>
                  <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  {(currentState.decisions || []).length}
                </div>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-[#26141a] to-[#170e12] p-4 shadow-md transition-all hover:border-rose-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Active Blockers</span>
                  <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-white">
                  {(currentState.blockers || []).length}
                </div>
              </div>
            </div>

            {/* PROJECT GOAL HERO */}
            <ContextSection
              title="Project Goal"
              icon={Target}
              type="goal"
              items={currentState.goal ? [currentState.goal] : []}
              empty="No project goal recorded."
            />

            {/* NEXT ACTIONS & BLOCKERS */}
            <div className="grid gap-6 md:grid-cols-2">
              <ContextSection
                title="Best Next Actions"
                icon={ListTodo}
                type="next_actions"
                items={currentState.next_actions || []}
                empty="No next actions required."
              />

              <ContextSection
                title="Active Blockers"
                icon={AlertOctagon}
                type="blockers"
                items={currentState.blockers || []}
                empty="No active blockers reported."
              />
            </div>

            {/* DECISIONS & PROGRESS */}
            <div className="grid gap-6 md:grid-cols-2">
              <ContextSection
                title="Decisions Made"
                icon={Lightbulb}
                type="decisions"
                items={currentState.decisions || []}
                empty="No architectural or project decisions recorded yet."
              />

              <ContextSection
                title="Completed Progress"
                icon={CheckCircle2}
                type="progress"
                items={currentState.progress || []}
                empty="No completed progress items logged yet."
              />
            </div>

            {/* ASSUMPTIONS, RISKS & QUESTIONS */}
            <div className="grid gap-6 lg:grid-cols-3">
              <ContextSection
                title="Assumptions"
                icon={HelpCircle}
                type="assumptions"
                items={currentState.assumptions || []}
                empty="No active assumptions recorded."
              />

              <ContextSection
                title="Risk Flags"
                icon={ShieldAlert}
                type="risk_flags"
                items={currentState.risk_flags || []}
                empty="No risk flags identified."
              />

              <ContextSection
                title="Open Questions"
                icon={HelpCircle}
                type="open_questions"
                items={currentState.open_questions || []}
                empty="No unresolved questions."
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

              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Team Members ({members.length})
                </h3>
                <button
                  onClick={() => setAddMemberOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-[#2563eb] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </button>
              </div>


              <div className="space-y-2">

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
                        <span className="min-w-0">
                          <span className="block truncate text-white">
                            {member.name || member.email || member.worker_id}
                          </span>
                          <span className="block truncate text-[10px] text-[#64748b]">
                            {member.email || member.role || "Team member"}
                          </span>
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
                    ? `Context for ${selectedMemberRecord?.name || selectedMember}`
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
                                  displayMemberName(entry.worker_id)
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
                          displayMemberName(entry.worker_id)
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
          ADD MEMBER MODAL
      =================================================== */}
      {addMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2a3040] bg-[#161a24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#38bdf8]" />
                <h3 className="font-semibold text-white">Add Team Member</h3>
              </div>
              <button
                onClick={() => setAddMemberOpen(false)}
                className="text-[#94a3b8] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8]">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Chen"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#2a3040] bg-[#0f1117] px-3.5 py-2.5 text-sm text-white placeholder-[#64748b] focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8]">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#2a3040] bg-[#0f1117] px-3.5 py-2.5 text-sm text-white placeholder-[#64748b] focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8]">Role</label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Lead, ML Engineer"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#2a3040] bg-[#0f1117] px-3.5 py-2.5 text-sm text-white placeholder-[#64748b] focus:border-[#38bdf8] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="rounded-lg border border-[#2a3040] bg-[#1a202c] px-4 py-2 text-xs text-[#94a3b8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !newMemberEmail.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {addingMember ? "Adding..." : "Add Teammate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


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
  icon: Icon,
  type = "default",
}: {
  title: string;
  items: string[];
  empty: string;
  icon?: React.ElementType;
  type?:
    | "goal"
    | "next_actions"
    | "progress"
    | "decisions"
    | "blockers"
    | "assumptions"
    | "risk_flags"
    | "open_questions"
    | "default";
}) {
  const themeMap = {
    goal: {
      border: "border-sky-500/30",
      bg: "bg-gradient-to-br from-[#121e36]/90 via-[#151c2d]/90 to-[#101420]/90",
      badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      iconColor: "text-sky-400",
      itemBg: "bg-[#182642]/80 border-sky-500/20 text-sky-100",
    },
    next_actions: {
      border: "border-sky-500/20",
      bg: "bg-[#141a27]/90",
      badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      iconColor: "text-sky-400",
      itemBg: "bg-[#192338] border-sky-500/20 text-slate-200 hover:border-sky-500/40",
    },
    progress: {
      border: "border-emerald-500/20",
      bg: "bg-[#131d1a]/90",
      badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      iconColor: "text-emerald-400",
      itemBg: "bg-[#182923] border-emerald-500/20 text-emerald-100 hover:border-emerald-500/40",
    },
    decisions: {
      border: "border-purple-500/20",
      bg: "bg-[#171524]/90",
      badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      iconColor: "text-purple-400",
      itemBg: "bg-[#211d33] border-purple-500/20 text-purple-100 hover:border-purple-500/40",
    },
    blockers: {
      border: items.length > 0 ? "border-rose-500/40" : "border-slate-800",
      bg: items.length > 0 ? "bg-[#241318]/90" : "bg-[#161a24]/80",
      badgeBg: items.length > 0 ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : "bg-slate-800 text-slate-400 border-slate-700",
      iconColor: items.length > 0 ? "text-rose-400 animate-pulse" : "text-slate-500",
      itemBg: "bg-[#2d171e] border-rose-500/30 text-rose-100",
    },
    assumptions: {
      border: "border-amber-500/20",
      bg: "bg-[#1b1915]/90",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      iconColor: "text-amber-400",
      itemBg: "bg-[#262118] border-amber-500/20 text-amber-100",
    },
    risk_flags: {
      border: items.length > 0 ? "border-rose-500/30" : "border-slate-800",
      bg: items.length > 0 ? "bg-[#201217]/90" : "bg-[#161a24]/80",
      badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      iconColor: "text-rose-400",
      itemBg: "bg-[#29161c] border-rose-500/30 text-rose-100",
    },
    open_questions: {
      border: "border-sky-500/20",
      bg: "bg-[#131a26]/90",
      badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      iconColor: "text-sky-400",
      itemBg: "bg-[#192436] border-sky-500/20 text-sky-100",
    },
    default: {
      border: "border-[#222734]",
      bg: "bg-[#161a24]",
      badgeBg: "bg-slate-800 text-slate-400 border-slate-700",
      iconColor: "text-slate-400",
      itemBg: "bg-[#11141c] border-[#262c3a] text-[#cbd5e1]",
    },
  };

  const theme = themeMap[type] || themeMap.default;

  return (
    <section className={`rounded-xl border p-5 shadow-lg transition-all duration-200 ${theme.border} ${theme.bg}`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className={`h-4 w-4 ${theme.iconColor}`} />}
          <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
        </div>

        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium ${theme.badgeBg}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-white/10 p-5 text-center">
          <p className="text-xs text-[#64748b]">{empty}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {items.map((item, index) => {
            return (
              <div
                key={index}
                className={`group flex items-start rounded-xl border p-3.5 text-sm transition-all duration-150 ${theme.itemBg}`}
              >
                {type === "next_actions" && (
                  <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/20 text-[11px] font-bold font-mono text-sky-400 border border-sky-500/30">
                    {index + 1}
                  </span>
                )}

                {type === "progress" && (
                  <CheckCircle2 className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                )}

                {type === "decisions" && (
                  <Lightbulb className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                )}

                {type === "blockers" && (
                  <AlertOctagon className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                )}

                {type === "assumptions" && (
                  <HelpCircle className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                )}

                {type === "risk_flags" && (
                  <ShieldAlert className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                )}

                {type === "open_questions" && (
                  <HelpCircle className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                )}

                {type === "goal" && (
                  <Target className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                )}

                <div className="flex-1 leading-relaxed">{item}</div>
              </div>
            );
          })}
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
