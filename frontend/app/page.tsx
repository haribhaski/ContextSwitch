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

export default function Home() {
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState("");
  const [resumeData, setResumeData] = useState<ResumeResult | null>(null);
  const [resumeLoading, setResumeLoading] =useState(false);

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
        throw new Error("Could not resume project.");
      }

      const result = await response.json();

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

  async function handleCreateWorkspace() {
    setError("");

    if (!name.trim() || !repo.trim()) {
      setError("Please enter a project name and GitHub repository.");
      return;
    }

    const parts = repo
      .replace("https://github.com/", "")
      .replace(/\/$/, "")
      .split("/");

    if (parts.length < 2) {
      setError("Use owner/repository or a GitHub repository URL.");
      return;
    }

    const github_owner = parts[0];
    const github_repo = parts[1];

    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          github_owner,
          github_repo,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not analyze repository.");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  if (data && resumeData) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-5xl mx-auto">

        <p className="text-sm text-zinc-500 uppercase tracking-[0.3em]">
          ContextSwitch
        </p>

        <h1 className="text-4xl font-semibold mt-3">
          Welcome back.
        </h1>

        <p className="text-zinc-400 mt-2">
          {data.workspace.name}
        </p>

        {resumeData.message && (
          <section className="mt-10 border border-zinc-800 bg-zinc-900 rounded-2xl p-6">

            <h2 className="text-xl font-semibold">
              You're already up to date.
            </h2>

            <p className="text-zinc-400 mt-2">
              {resumeData.message}
            </p>

          </section>
        )}

        {resumeData.resume && (
          <>

            <section className="mt-10 border border-zinc-800 bg-zinc-900 rounded-2xl p-6">

              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
                Where You Left Off
              </p>

              <h2 className="text-xl">
                {resumeData.resume.where_you_left_off.goal}
              </h2>

            </section>


            <section className="mt-6 border border-zinc-800 bg-zinc-900 rounded-2xl p-6">

              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-5">
                While You Were Away
              </p>

              <div className="space-y-4">

                {resumeData.resume.changes.map(
                  (change, index) => (
                    <div
                      key={index}
                      className="border-b border-zinc-800 pb-4 last:border-0"
                    >
                      <p className="text-white">
                        {change.description}
                      </p>

                      <p className="text-xs text-zinc-500 mt-1">
                        {change.source}
                      </p>
                    </div>
                  )
                )}

              </div>

            </section>


            {resumeData.resume.task_updates.length > 0 && (
              <section className="mt-6 border border-zinc-800 bg-zinc-900 rounded-2xl p-6">

                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-5">
                  Task Updates
                </p>

                {resumeData.resume.task_updates.map(
                  (task, index) => (
                    <div
                      key={index}
                      className="mb-5 last:mb-0"
                    >
                      <p className="font-medium">
                        {task.task}
                      </p>

                      <p className="text-zinc-400 text-sm mt-1">
                        {task.previous_status}
                        {" → "}
                        {task.current_status}
                      </p>

                      <p className="text-zinc-500 text-sm mt-2">
                        {task.reason}
                      </p>
                    </div>
                  )
                )}

              </section>
            )}


            <section className="mt-6 border border-white/20 bg-zinc-900 rounded-2xl p-7">

              <p className="text-xs text-zinc-500 uppercase tracking-widest">
                What You Should Do Next
              </p>

              <h2 className="text-2xl font-semibold mt-3">
                {resumeData.resume.next_action.action}
              </h2>

              <p className="text-zinc-400 mt-3">
                {resumeData.resume.next_action.reason}
              </p>

            </section>


            <p className="text-zinc-600 text-sm mt-6">
              {resumeData.new_evidence_count} new pieces of evidence analyzed.
            </p>

          </>
        )}

      </div>
    </main>
  );
}

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

          <p className="text-zinc-400 mt-5 text-lg">
            Connect a GitHub repository and ContextSwitch will reconstruct
            the current state of your project.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900">
          <label className="block text-sm text-zinc-400 mb-2">
            Project Name
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Finance Chatbot"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 mb-5 outline-none focus:border-zinc-400"
          />

          <label className="block text-sm text-zinc-400 mb-2">
            GitHub Repository
          </label>

          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="username/repository"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-zinc-400"
          />

          {error && (
            <p className="text-red-400 text-sm mt-4">
              {error}
            </p>
          )}

          <button
            onClick={handleCreateWorkspace}
            disabled={loading}
            className="w-full mt-6 bg-white text-black rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {loading ? "ANALYZING PROJECT..." : "CREATE WORKSPACE"}
          </button>
        </div>
      </div>
    </main>
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
      <h3 className="text-lg font-semibold mb-4">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-zinc-500">
          Nothing detected.
        </p>
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

type ResumeResult = {
  workspace_id: string;
  new_evidence_count: number;

  message?: string;

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
    }[];

    current_state: ProjectState;

    next_action: {
      action: string;
      reason: string;
    };
  };
};
