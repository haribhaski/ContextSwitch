"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  GitBranch,
  HelpCircle,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProjectState = {
  goal?: string;
  progress?: string[];
  decisions?: string[];
  failures?: string[];
  blockers?: string[];
  open_questions?: string[];
  dependencies?: string[];
  next_actions?: string[];
};

type Member = {
  id: string;
  worker_id: string;
  name: string;
  joined_at?: string;
};

type Conflict = {
  id: string;
  conflict_id: string;
  topic: string;
  side_a: { worker_id: string; position: string };
  side_b: { worker_id: string; position: string };
  status: string;
  resolution?: string;
};

type Entry = {
  id: string;
  worker_id: string;
  type: string;
  content: string;
  source: string;
  timestamp?: string;
};

type ProjectDetailsShellProps = {
  teamId: string;
  projectId: string;
};


export default function ProjectDetailsShell({
  teamId,
  projectId,
}: ProjectDetailsShellProps) {

  const [activeTab, setActiveTab] = useState<
    "overview" | "people" | "activity" | "conflicts"
  >("overview");

  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter state for People tab
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Conflict Resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  // Dynamic state loaded only from FastAPI / Firestore
  const [projectName, setProjectName] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [currentState, setCurrentState] = useState<ProjectState>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProjectData() {
    setLoading(true);
    setError(null);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const [projectRes, entriesRes] = await Promise.all([
        fetch(`${apiUrl}/teams/${teamId}/projects/${projectId}`, {
          cache: "no-store",
        }),
        fetch(`${apiUrl}/teams/${teamId}/projects/${projectId}/entries`, {
          cache: "no-store",
        }),
      ]);

      if (!projectRes.ok) {
        const body = await projectRes.text();
        throw new Error(
          `Failed to load project (${projectRes.status}): ${body || projectRes.statusText}`
        );
      }

      if (!entriesRes.ok) {
        const body = await entriesRes.text();
        throw new Error(
          `Failed to load entries (${entriesRes.status}): ${body || entriesRes.statusText}`
        );
      }

      const data = await projectRes.json();
      const entriesData = await entriesRes.json();

      if (!data.project) {
        throw new Error("Project not found");
      }

      const state = data.project.current_state || {};

      setProjectName(data.project.name || projectId);
      setGithubRepo(
        data.project.github_owner && data.project.github_repo
          ? `${data.project.github_owner}/${data.project.github_repo}`
          : ""
      );

      setCurrentState({
        goal: state.goal || "",
        progress: state.progress || state.completed || [],
        decisions: state.decisions || [],
        failures: state.failures || state.failed || [],
        blockers: state.blockers || [],
        open_questions: state.open_questions || [],
        dependencies: state.dependencies || [],
        next_actions: state.next_actions || [],
      });

      // IMPORTANT: empty arrays are real Firestore data.
      // Never preserve old/fake values when backend returns [].
      setMembers(Array.isArray(data.members) ? data.members : []);
      setConflicts(
        Array.isArray(data.active_conflicts) ? data.active_conflicts : []
      );
      setEntries(
        Array.isArray(entriesData.entries) ? entriesData.entries : []
      );
    } catch (err) {
      console.error("Failed to load project data:", err);

      setProjectName("");
      setGithubRepo("");
      setCurrentState({});
      setMembers([]);
      setEntries([]);
      setConflicts([]);

      setError(
        err instanceof Error ? err.message : "Failed to load project data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjectData();
  }, [teamId, projectId]);


  // Member filtering for People-wise context
  const memberFilteredEntries = selectedMember
    ? entries.filter(
        (e) => e.worker_id.toLowerCase() === selectedMember.toLowerCase()
      )
    : entries;

  // On-demand GitHub sync.
  // The backend writes/reconciles Firestore; the frontend then reloads Firestore data.
  async function handleSyncGitHub() {
    setSyncing(true);
    setSyncToast(null);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const res = await fetch(
        `${apiUrl}/teams/${teamId}/projects/${projectId}/sync-github`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `GitHub sync failed (${res.status}): ${body || res.statusText}`
        );
      }

      const data = await res.json();

      // Reload everything from Firestore after the backend has reconciled it.
      await loadProjectData();

      setSyncToast(
        `GitHub sync complete. ${data.evidence_count ?? 0} evidence item(s) processed.`
      );
    } catch (err) {
      console.error("GitHub sync failed:", err);
      setSyncToast(
        err instanceof Error ? err.message : "GitHub sync failed"
      );
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  }

  // Conflict resolution is persisted by FastAPI into Firestore.
  // Do not mutate the UI optimistically with fake/local data; reload after success.
  async function handleResolveConflict(conflictId: string) {
    if (!resolutionText.trim()) return;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const res = await fetch(
        `${apiUrl}/teams/${teamId}/projects/${projectId}/conflicts/${conflictId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: resolutionText.trim(),
            resolved_by: "web-dashboard",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Conflict resolution failed (${res.status}): ${body || res.statusText}`
        );
      }

      setResolvingId(null);
      setResolutionText("");

      // Pull the authoritative state back from Firestore.
      await loadProjectData();
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
      setSyncToast(
        err instanceof Error ? err.message : "Failed to resolve conflict"
      );
      setTimeout(() => setSyncToast(null), 5000);
    }
  }

  const unresolvedConflictsCount = conflicts.filter(
    (c) => c.status === "unresolved"
  ).length;

  const exportPacket = `=== CONTEXTSWITCH PORTABLE WORKSPACE PACKET ===
Project: ${projectName} (${teamId}/${projectId})
Repository: ${githubRepo ? `https://github.com/${githubRepo}` : "Not connected"}
Goal: ${currentState.goal || "Not specified"}

[BEST NEXT ACTIONS]
${(currentState.next_actions || []).map((a, i) => `${i + 1}. ${a}`).join("\n")}

[ACTIVE BLOCKERS & OBSTACLES]
${(currentState.blockers || []).map((b) => `- ${b}`).join("\n")}

[KEY ARCHITECTURE DECISIONS]
${(currentState.decisions || []).map((d) => `- ${d}`).join("\n")}

[FAILED ATTEMPTS & GOTCHAS]
${(currentState.failures || []).map((f) => `- ${f}`).join("\n")}

[ACTIVE UNRESOLVED CONFLICTS]
${
  unresolvedConflictsCount === 0
    ? "- None (All decisions aligned)"
    : conflicts
        .filter((c) => c.status === "unresolved")
        .map(
          (c) =>
            `- [${c.topic}] ${c.side_a.worker_id}: "${c.side_a.position}" VS ${c.side_b.worker_id}: "${c.side_b.position}"`
        )
        .join("\n")
}
=================================================`;

  function copyToClipboard() {
    navigator.clipboard.writeText(exportPacket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#38bdf8]" />
            <p className="mt-3 text-sm text-[#94a3b8]">
              Loading project context from Firestore...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-xl border border-[#ef4444]/30 bg-[#161a24] p-7 text-center">
            <XCircle className="mx-auto h-8 w-8 text-[#ef4444]" />
            <h2 className="mt-4 text-lg font-semibold text-white">
              Unable to load project
            </h2>
            <p className="mt-2 break-words text-sm text-[#94a3b8]">
              {error}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => void loadProjectData()}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
              >
                Retry
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs text-[#94a3b8] hover:bg-[#222734]"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e1e7ef]">
      {/* Toast Notification Banner */}
      {syncToast && (
        <div className="bg-[#0284c7] px-6 py-2.5 text-center text-xs font-semibold text-white shadow-md animate-fade-in flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" />
          {syncToast}
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#222734] bg-[#0f1117]/90 px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-[#2a3040] bg-[#161a24] px-3 py-1.5 text-xs text-[#94a3b8] transition hover:bg-[#222734] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Workspace
          </Link>

          <div className="h-4 w-px bg-[#222734]" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white">{projectName}</h1>
              <span className="rounded bg-[#1e293b] px-2 py-0.5 text-[10px] font-mono text-[#38bdf8]">
                {teamId}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#64748b]">
              <GitBranch className="h-3 w-3" />
              {githubRepo}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncGitHub}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[#2a3040] bg-[#161a24] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#222734] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#38bdf8] ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing GitHub..." : "Sync GitHub"}
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#1d4ed8]"
          >
            <Copy className="h-3.5 w-3.5" />
            Export Context
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="border-b border-[#222734] bg-[#141721] px-6">
        <nav className="flex gap-8">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "people", label: "People-Wise Context", icon: Users },
            { id: "activity", label: "Activity Feed", icon: Activity },
            {
              id: "conflicts",
              label: `Conflicts (${unresolvedConflictsCount})`,
              icon: AlertTriangle,
              badge: unresolvedConflictsCount > 0,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 border-b-2 py-3.5 text-sm font-medium transition ${
                  isActive
                    ? "border-[#38bdf8] text-[#38bdf8]"
                    : "border-transparent text-[#94a3b8] hover:text-[#e1e7ef]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.badge && (
                  <span className="rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unresolvedConflictsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Goal Card */}
            <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#38bdf8]">
                  <Sparkles className="h-4 w-4" />
                  Active Project Goal
                </div>
                <span className="text-xs font-mono text-[#64748b]">
                  Reconciled via Gemini 3 + ADK
                </span>
              </div>
              <p className="mt-3 text-lg font-medium text-white">
                {currentState.goal || "No project goal set yet."}
              </p>
            </div>

            {/* Grid layout */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Best Next Actions */}
              <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Zap className="h-4 w-4 text-[#eab308]" />
                  Best Next Actions
                </h3>
                <ul className="mt-4 space-y-3">
                  {(currentState.next_actions || []).map((action, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-[#262c3a] bg-[#11141c] p-3 text-sm"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eab308]/10 text-xs font-bold text-[#eab308]">
                        {idx + 1}
                      </span>
                      <span className="text-[#cbd5e1]">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Active Blockers */}
              <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/5 p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#f87171]">
                  <AlertTriangle className="h-4 w-4" />
                  Active Blockers & Obstacles
                </h3>
                <ul className="mt-4 space-y-3">
                  {(currentState.blockers || []).length === 0 ? (
                    <li className="text-xs text-[#94a3b8]">No active blockers reported.</li>
                  ) : (
                    (currentState.blockers || []).map((blocker, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border border-[#ef4444]/20 bg-[#161a24] p-3 text-sm text-[#fca5a5]"
                      >
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ef4444]" />
                        <span>{blocker}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {/* Decisions & Progress */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Decisions */}
              <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                  Key Architecture Decisions
                </h3>
                <ul className="mt-4 space-y-3">
                  {(currentState.decisions || []).map((dec, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-[#262c3a] bg-[#11141c] p-3 text-sm text-[#cbd5e1]"
                    >
                      <span className="h-2 w-2 mt-1.5 rounded-full bg-[#22c55e]" />
                      <span>{dec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Progress */}
              <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Activity className="h-4 w-4 text-[#38bdf8]" />
                  Completed Milestone Progress
                </h3>
                <ul className="mt-4 space-y-3">
                  {(currentState.progress || []).map((prog, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-[#262c3a] bg-[#11141c] p-3 text-sm text-[#cbd5e1]"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38bdf8]" />
                      <span>{prog}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* PEOPLE TAB */}
        {activeTab === "people" && (
          <div className="grid gap-8 md:grid-cols-[260px_1fr]">
            {/* Teammates Sidebar */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                Team Members
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className={`w-full text-left rounded-lg p-3 text-sm font-medium transition ${
                    selectedMember === null
                      ? "bg-[#2563eb] text-white"
                      : "bg-[#161a24] text-[#94a3b8] hover:bg-[#222734]"
                  }`}
                >
                  All Teammates ({members.length})
                </button>
                {members.map((m) => {
                  const isSelected = selectedMember?.toLowerCase() === m.worker_id.toLowerCase();
                  return (
                    <button
                      key={m.id || m.worker_id}
                      onClick={() => setSelectedMember(m.worker_id)}
                      className={`flex w-full items-center justify-between rounded-lg p-3 text-sm font-medium transition ${
                        isSelected
                          ? "bg-[#2563eb] text-white"
                          : "bg-[#161a24] text-[#94a3b8] hover:bg-[#222734]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e293b] text-xs font-bold text-[#38bdf8]">
                          {m.worker_id.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{m.name || m.worker_id}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Member Entries & Context */}
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-[#222734] bg-[#161a24] p-5">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {selectedMember ? `Context Logged by ${selectedMember}` : "All Teammate Contributions"}
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Filtered decisions, blockers, failures, and AI tools used by this contributor.
                  </p>
                </div>
                <span className="rounded bg-[#1e293b] px-2.5 py-1 text-xs text-[#38bdf8]">
                  {memberFilteredEntries.length} Entries
                </span>
              </div>

              <div className="space-y-3">
                {memberFilteredEntries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="rounded-xl border border-[#222734] bg-[#161a24] p-5 transition hover:border-[#2a3040]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#1e293b] px-2 py-0.5 text-xs font-semibold text-white">
                          {entry.worker_id}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            entry.type === "decision"
                              ? "bg-[#22c55e]/10 text-[#22c55e]"
                              : entry.type === "blocker"
                              ? "bg-[#ef4444]/10 text-[#ef4444]"
                              : "bg-[#38bdf8]/10 text-[#38bdf8]"
                          }`}
                        >
                          {entry.type}
                        </span>
                      </div>

                      <span className="rounded border border-[#2a3040] bg-[#11141c] px-2.5 py-0.5 text-xs font-mono text-[#94a3b8]">
                        AI Source: {entry.source}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-[#cbd5e1]">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b]">
              Live Project Activity Feed
            </h2>
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className="flex items-start gap-4 rounded-xl border border-[#222734] bg-[#161a24] p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs font-bold text-[#38bdf8]">
                    {entry.worker_id.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-white">
                        <span className="text-[#38bdf8]">{entry.worker_id}</span>{" "}
                        logged a <span className="font-semibold uppercase">{entry.type}</span>
                      </div>
                      <span className="text-xs font-mono text-[#64748b]">{entry.source}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#94a3b8]">{entry.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFLICTS TAB */}
        {activeTab === "conflicts" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Detected Team Conflicts</h2>
                <p className="text-xs text-[#64748b]">
                  Gemini reconciliation identifies opposing team decisions and allows direct resolution.
                </p>
              </div>
            </div>

            {conflicts.length === 0 ? (
              <div className="rounded-xl border border-[#222734] bg-[#161a24] p-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[#22c55e]" />
                <h3 className="mt-3 text-sm font-semibold text-white">No Open Conflicts</h3>
                <p className="mt-1 text-xs text-[#64748b]">All team decisions are aligned and consistent!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {conflicts.map((c) => (
                  <div
                    key={c.id || c.conflict_id}
                    className="rounded-xl border border-[#ef4444]/30 bg-[#161a24] p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#f87171]">
                        <AlertTriangle className="h-4 w-4" />
                        {c.topic}
                      </div>

                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          c.status === "resolved"
                            ? "bg-[#22c55e]/10 text-[#22c55e]"
                            : "bg-[#ef4444]/10 text-[#ef4444]"
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Side A vs Side B Grid */}
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                        <div className="text-xs font-semibold text-[#38bdf8]">
                          Side A: {c.side_a.worker_id}
                        </div>
                        <p className="mt-2 text-sm text-[#cbd5e1]">{c.side_a.position}</p>
                      </div>

                      <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                        <div className="text-xs font-semibold text-[#eab308]">
                          Side B: {c.side_b.worker_id}
                        </div>
                        <p className="mt-2 text-sm text-[#cbd5e1]">{c.side_b.position}</p>
                      </div>
                    </div>

                    {/* Resolution Section */}
                    {c.status === "resolved" ? (
                      <div className="mt-4 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/5 p-3 text-xs text-[#86efac]">
                        <strong>Final Resolution:</strong> {c.resolution}
                      </div>
                    ) : resolvingId === c.conflict_id || resolvingId === c.id ? (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="Type team resolution decision here..."
                          className="w-full rounded-lg border border-[#2a3040] bg-[#11141c] p-3 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolveConflict(c.conflict_id || c.id)}
                            className="rounded-lg bg-[#22c55e] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#16a34a]"
                          >
                            Save Resolution
                          </button>
                          <button
                            onClick={() => setResolvingId(null)}
                            className="rounded-lg border border-[#2a3040] px-4 py-1.5 text-xs text-[#94a3b8] hover:bg-[#222734]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setResolvingId(c.conflict_id || c.id);
                          setResolutionText(`Resolved: Agreed on ${c.side_a.position}`);
                        }}
                        className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#38bdf8] hover:underline"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolve Conflict
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Export Context Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#2a3040] bg-[#161a24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222734] pb-4">
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <Copy className="h-4 w-4 text-[#38bdf8]" />
                Portable Context Packet (`cs export`)
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="rounded p-1 text-[#94a3b8] hover:bg-[#222734] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-[#94a3b8]">
              Copy and paste this bundle directly into Cursor, Claude, Gemini, or Antigravity to transfer active team context.
            </p>

            <pre className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-[#262c3a] bg-[#0d1017] p-4 text-xs font-mono text-[#38bdf8]">
              {exportPacket}
            </pre>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setExportModalOpen(false)}
                className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs text-[#94a3b8] hover:bg-[#222734]"
              >
                Close
              </button>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy Context Packet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}