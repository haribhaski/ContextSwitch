"use client";

import { useState } from "react";

type ProjectState = {
  goal: string;
  progress: string[];
  decisions: string[];
  failures: string[];
  blockers: string[];
  open_questions: string[];
  dependencies: string[];
  next_actions: string[];
};

type WorkspaceResponse = {
  workspace: {
    id: string;
    name: string;
    github: string;
  };

  state: ProjectState;
};

type ResumeResult = {
  workspace_id: string;
  new_evidence_count: number;

  message?: string;

  state?: ProjectState;

  resume?: {
    where_you_left_off: {
      goal: string;
      previous_next_actions: string[];
    };

    changes: {
      type: string;
      description: string;
      source: string;
      evidence_id: string;
    }[];

    task_updates: {
      task: string;
      previous_status: string;
      current_status: string;
      reason: string;
      evidence_ids: string[];
    }[];

    current_state: ProjectState;

    next_action: {
      action: string;
      reason: string;
    };
  };
};

function statusStyle(status: string) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "new":
    case "new_result":
    case "new_decision":
    case "new_requirement":
    case "new_dependency":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case "completed":
    case "task_completed":
      return "border-green-500/30 bg-green-500/10 text-green-300";

    case "outdated":
    case "task_outdated":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case "blocked":
    case "blocker_added":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "resolved":
    case "blocker_resolved":
    case "dependency_resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "changed":
    case "task_changed":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";

    case "still_pending":
    case "pending":
      return "border-zinc-600 bg-zinc-800 text-zinc-300";

    default:
      return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }
}

function friendlyStatus(status: string) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "task_completed":
      return "COMPLETED";

    case "task_outdated":
      return "OUTDATED";

    case "task_changed":
      return "CHANGED";

    case "blocker_added":
      return "BLOCKED";

    case "blocker_resolved":
      return "RESOLVED";

    case "dependency_resolved":
      return "RESOLVED";

    case "new_result":
      return "NEW RESULT";

    case "new_decision":
      return "NEW DECISION";

    case "new_requirement":
      return "NEW REQUIREMENT";

    case "new_dependency":
      return "NEW DEPENDENCY";

    case "still_pending":
      return "PENDING";

    default:
      return status.replaceAll("_", " ").toUpperCase();
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-3
        py-1
        text-xs
        font-semibold
        uppercase
        tracking-wider
        ${statusStyle(status)}
      `}
    >
      {friendlyStatus(status)}
    </span>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      {items.length === 0 ? (
        <p className="text-zinc-500">Nothing detected.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={index}
              className="text-zinc-300 flex gap-3"
            >
              <span className="text-zinc-600">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");

  const [loading, setLoading] = useState(false);

  const [data, setData] =
    useState<WorkspaceResponse | null>(null);

  const [error, setError] = useState("");

  const [resumeData, setResumeData] =
    useState<ResumeResult | null>(null);

  const [resumeLoading, setResumeLoading] =
    useState(false);

  async function handleCreateWorkspace() {
    setError("");

    if (!name.trim() || !repo.trim()) {
      setError(
        "Please enter a project name and GitHub repository."
      );
      return;
    }

    const parts = repo
      .replace("https://github.com/", "")
      .replace(/\/$/, "")
      .split("/");

    if (parts.length < 2) {
      setError(
        "Use owner/repository or a GitHub repository URL."
      );
      return;
    }

    const github_owner = parts[0];
    const github_repo = parts[1];

    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/workspaces",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name,
            github_owner,
            github_repo,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          text || "Could not analyze repository."
        );
      }

      const result: WorkspaceResponse =
        await response.json();

      setData(result);
      setResumeData(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!data) return;

    setResumeLoading(true);
    setError("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/workspaces/${data.workspace.id}/resume`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          text || "Could not resume project."
        );
      }

      const result: ResumeResult =
        await response.json();

      setResumeData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setResumeLoading(false);
    }
  }

  function handleBackToWorkspace() {
    setResumeData(null);
  }

  function handleReset() {
    setData(null);
    setResumeData(null);
    setName("");
    setRepo("");
    setError("");
  }

  // ==========================================================
  // RESUME VIEW
  // ==========================================================

  if (data && resumeData) {
    const resume = resumeData.resume;

    const outdatedTasks =
      resume?.task_updates.filter(
        (task) =>
          task.current_status.toLowerCase() ===
          "outdated"
      ) ?? [];

    const otherTaskUpdates =
      resume?.task_updates.filter(
        (task) =>
          task.current_status.toLowerCase() !==
          "outdated"
      ) ?? [];

    return (
      <main className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-zinc-500 uppercase tracking-[0.3em]">
                ContextSwitch
              </p>

              <h1 className="text-4xl md:text-5xl font-semibold mt-3">
                Welcome back.
              </h1>

              <p className="text-zinc-400 mt-3">
                {data.workspace.name}
              </p>

              <p className="text-sm text-zinc-600 mt-1">
                {data.workspace.github}
              </p>
            </div>

            <button
              onClick={handleBackToWorkspace}
              className="border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 transition"
            >
              BACK
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-300">
              {error}
            </div>
          )}

          {resumeData.message && !resume && (
            <>
              <section className="mt-10 border border-zinc-800 bg-zinc-900 rounded-2xl p-7">
                <StatusBadge status="resolved" />

                <h2 className="text-2xl font-semibold mt-4">
                  You're already up to date.
                </h2>

                <p className="text-zinc-400 mt-3">
                  {resumeData.message}
                </p>
              </section>

              <section className="mt-6 border border-zinc-800 bg-zinc-900 rounded-2xl p-7">
                <p className="text-xs text-zinc-500 uppercase tracking-widest">
                  Current Goal
                </p>

                <h2 className="text-xl font-semibold mt-3">
                  {resumeData.state?.goal ??
                    data.state.goal}
                </h2>
              </section>
            </>
          )}

          {resume && (
            <>
              {/* WHERE YOU LEFT OFF */}

              <section className="mt-10 border border-zinc-800 bg-zinc-900 rounded-2xl p-7">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
                  Where You Left Off
                </p>

                <h2 className="text-2xl font-semibold mt-4">
                  {
                    resume.where_you_left_off
                      .goal
                  }
                </h2>

                {resume.where_you_left_off
                  .previous_next_actions.length >
                  0 && (
                  <div className="mt-6">
                    <p className="text-sm text-zinc-500 mb-3">
                      Previous next actions
                    </p>

                    <ul className="space-y-2">
                      {resume.where_you_left_off.previous_next_actions.map(
                        (action, index) => (
                          <li
                            key={index}
                            className="text-zinc-300 flex gap-3"
                          >
                            <span className="text-zinc-600">
                              →
                            </span>

                            <span>
                              {action}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </section>

              {/* WHILE YOU WERE AWAY */}

              <section className="mt-6 border border-zinc-800 bg-zinc-900 rounded-2xl p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
                      While You Were Away
                    </p>

                    <p className="text-sm text-zinc-500 mt-2">
                      Meaningful project changes
                      detected from new evidence.
                    </p>
                  </div>

                  <span className="text-sm text-zinc-600">
                    {
                      resumeData.new_evidence_count
                    }{" "}
                    evidence
                  </span>
                </div>

                {resume.changes.length === 0 ? (
                  <p className="mt-6 text-zinc-500">
                    No meaningful state changes were
                    detected.
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {resume.changes.map(
                      (change, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <StatusBadge
                              status={
                                change.type
                              }
                            />

                            <span className="text-xs text-zinc-600 uppercase tracking-wider">
                              {change.source}
                            </span>
                          </div>

                          <p className="mt-4 text-zinc-200 leading-7">
                            {
                              change.description
                            }
                          </p>

                          {change.evidence_id && (
                            <div className="mt-4 border-t border-zinc-800 pt-3">
                              <p className="font-mono text-xs text-zinc-600 break-all">
                                Evidence:{" "}
                                {
                                  change.evidence_id
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              {/* OUTDATED TASKS */}

              {outdatedTasks.length > 0 && (
                <section className="mt-6 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                        Outdated Tasks
                      </p>

                      <h2 className="text-2xl font-semibold mt-3">
                        Don't waste time on these.
                      </h2>

                      <p className="text-zinc-400 mt-2">
                        ContextSwitch detected
                        previous tasks that are no
                        longer valid.
                      </p>
                    </div>

                    <div className="text-3xl">
                      ⚠
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {outdatedTasks.map(
                      (task, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-orange-500/20 bg-zinc-950 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <StatusBadge status="outdated" />

                            <span className="text-xs text-zinc-500">
                              {
                                task.previous_status
                              }{" "}
                              →{" "}
                              {
                                task.current_status
                              }
                            </span>
                          </div>

                          <h3 className="mt-4 text-lg font-semibold">
                            {task.task}
                          </h3>

                          <p className="mt-3 text-sm leading-6 text-zinc-400">
                            {task.reason}
                          </p>

                          {task.evidence_ids &&
                            task.evidence_ids
                              .length > 0 && (
                              <div className="mt-4 border-t border-zinc-800 pt-3">
                                <p className="text-xs text-zinc-600 mb-2">
                                  Supporting
                                  evidence
                                </p>

                                {task.evidence_ids.map(
                                  (
                                    evidenceId,
                                    evidenceIndex
                                  ) => (
                                    <p
                                      key={
                                        evidenceIndex
                                      }
                                      className="font-mono text-xs text-zinc-600 break-all"
                                    >
                                      {
                                        evidenceId
                                      }
                                    </p>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* OTHER TASK UPDATES */}

              {otherTaskUpdates.length > 0 && (
                <section className="mt-6 border border-zinc-800 bg-zinc-900 rounded-2xl p-7">
                  <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
                    Task Updates
                  </p>

                  <div className="mt-6 space-y-4">
                    {otherTaskUpdates.map(
                      (task, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <StatusBadge
                              status={
                                task.current_status
                              }
                            />

                            <span className="text-xs text-zinc-500">
                              {
                                task.previous_status
                              }{" "}
                              →{" "}
                              {
                                task.current_status
                              }
                            </span>
                          </div>

                          <h3 className="mt-4 font-semibold text-white">
                            {task.task}
                          </h3>

                          <p className="mt-3 text-sm leading-6 text-zinc-400">
                            {task.reason}
                          </p>

                          {task.evidence_ids &&
                            task.evidence_ids
                              .length > 0 && (
                              <div className="mt-4 border-t border-zinc-800 pt-3">
                                {task.evidence_ids.map(
                                  (
                                    evidenceId,
                                    evidenceIndex
                                  ) => (
                                    <p
                                      key={
                                        evidenceIndex
                                      }
                                      className="font-mono text-xs text-zinc-600 break-all"
                                    >
                                      Evidence:{" "}
                                      {
                                        evidenceId
                                      }
                                    </p>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* CURRENT STATE SUMMARY */}

              <section className="mt-6">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-4">
                  Updated Project State
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <Section
                    title="Progress"
                    items={
                      resume.current_state
                        .progress
                    }
                  />

                  <Section
                    title="Decisions"
                    items={
                      resume.current_state
                        .decisions
                    }
                  />

                  <Section
                    title="Blockers"
                    items={
                      resume.current_state
                        .blockers
                    }
                  />

                  <Section
                    title="Dependencies"
                    items={
                      resume.current_state
                        .dependencies
                    }
                  />

                  <Section
                    title="Open Questions"
                    items={
                      resume.current_state
                        .open_questions
                    }
                  />

                  <Section
                    title="Failures"
                    items={
                      resume.current_state
                        .failures
                    }
                  />
                </div>
              </section>

              {/* BEST NEXT ACTION */}

              <section className="mt-8 rounded-2xl border border-white bg-white p-8 text-black">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Best Next Action
                </p>

                <h2 className="mt-4 text-2xl md:text-3xl font-semibold">
                  {resume.next_action.action}
                </h2>

                <p className="mt-4 text-sm md:text-base leading-7 text-zinc-600">
                  {resume.next_action.reason}
                </p>

                <div className="mt-6 pt-5 border-t border-zinc-200">
                  <p className="text-xs text-zinc-500">
                    Based on{" "}
                    {
                      resumeData.new_evidence_count
                    }{" "}
                    new pieces of evidence.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  // ==========================================================
  // WORKSPACE DASHBOARD
  // ==========================================================

  if (data) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-zinc-500 uppercase tracking-[0.3em]">
                ContextSwitch
              </p>

              <h1 className="text-4xl font-semibold mt-3">
                {data.workspace.name}
              </h1>

              <p className="text-zinc-500 mt-2">
                {data.workspace.github}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 transition"
            >
              NEW WORKSPACE
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-300">
              {error}
            </div>
          )}

          <section className="mt-10 border border-zinc-800 rounded-2xl p-7 bg-zinc-900">
            <p className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
              Current Goal
            </p>

            <h2 className="text-2xl font-semibold mt-4 leading-9">
              {data.state.goal}
            </h2>
          </section>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <Section
              title="Progress"
              items={data.state.progress}
            />

            <Section
              title="Next Actions"
              items={data.state.next_actions}
            />

            <Section
              title="Decisions"
              items={data.state.decisions}
            />

            <Section
              title="Blockers"
              items={data.state.blockers}
            />

            <Section
              title="Open Questions"
              items={data.state.open_questions}
            />

            <Section
              title="Dependencies"
              items={data.state.dependencies}
            />

            <Section
              title="Failures"
              items={data.state.failures}
            />
          </div>

          <button
            onClick={handleResume}
            disabled={resumeLoading}
            className="
              mt-8
              w-full
              bg-white
              text-black
              rounded-2xl
              py-5
              font-semibold
              text-lg
              hover:bg-zinc-200
              transition
              disabled:opacity-50
            "
          >
            {resumeLoading
              ? "RECONSTRUCTING CONTEXT..."
              : "RESUME PROJECT"}
          </button>

          <p className="text-center text-xs text-zinc-600 mt-4">
            ContextSwitch will compare this
            snapshot against new project evidence.
          </p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // CREATE WORKSPACE VIEW
  // ==========================================================

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-10">
          <p className="text-sm text-zinc-500 uppercase tracking-[0.3em]">
            ContextSwitch
          </p>

          <h1 className="text-5xl font-semibold mt-4 leading-tight">
            Your projects remember
            <br />
            where you left off.
          </h1>

          <p className="text-zinc-400 mt-5 text-lg leading-8">
            Connect a GitHub repository and
            ContextSwitch will reconstruct the
            current state of your project.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900">
          <label className="block text-sm text-zinc-400 mb-2">
            Project Name
          </label>

          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Finance Chatbot"
            className="
              w-full
              bg-zinc-950
              border
              border-zinc-700
              rounded-xl
              px-4
              py-3
              mb-5
              outline-none
              focus:border-zinc-400
            "
          />

          <label className="block text-sm text-zinc-400 mb-2">
            GitHub Repository
          </label>

          <input
            value={repo}
            onChange={(e) =>
              setRepo(e.target.value)
            }
            placeholder="username/repository"
            className="
              w-full
              bg-zinc-950
              border
              border-zinc-700
              rounded-xl
              px-4
              py-3
              outline-none
              focus:border-zinc-400
            "
          />

          {error && (
            <p className="text-red-400 text-sm mt-4">
              {error}
            </p>
          )}

          <button
            onClick={handleCreateWorkspace}
            disabled={loading}
            className="
              w-full
              mt-6
              bg-white
              text-black
              rounded-xl
              py-3
              font-semibold
              hover:bg-zinc-200
              transition
              disabled:opacity-50
            "
          >
            {loading
              ? "ANALYZING PROJECT..."
              : "CREATE WORKSPACE"}
          </button>
        </div>
      </div>
    </main>
  );
}