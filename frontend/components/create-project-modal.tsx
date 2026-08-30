"use client";

import { useState } from "react";
import { FolderPlus, GitBranch, Plus, X } from "lucide-react";

type CreateProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const [teamId, setTeamId] = useState("team-alpha");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId.trim() || !projectName.trim()) {
      setError("Project ID and Project Name are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId.toLowerCase().replace(/\s+/g, "-"),
          project_id: projectId.toLowerCase().replace(/\s+/g, "-"),
          name: projectName,
          github_owner: githubOwner.trim() || undefined,
          github_repo: githubRepo.trim() || undefined,
          creator_worker_id: "Harsha",
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create project");
      }

      onClose();
      if (onSuccess) onSuccess();
      window.location.href = `/projects/${teamId}/${projectId}`;
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2a3040] bg-[#161a24] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222734] pb-4">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <FolderPlus className="h-5 w-5 text-[#38bdf8]" />
            Create Shared Project
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#94a3b8] hover:bg-[#222734] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-xs text-[#fca5a5]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Team ID
            </label>
            <input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="e.g. team-alpha"
              className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setProjectId(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              placeholder="e.g. Memory LLM Engine"
              className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Project Slug / ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. memory-llm-engine"
              className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              required
            />
          </div>

          <div className="border-t border-[#222734] pt-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#38bdf8]">
              <GitBranch className="h-3.5 w-3.5" />
              GitHub Repository (Optional Initial Context)
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="Owner (e.g. haribhaski)"
                className="w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3 py-1.5 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
              />
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="Repo (e.g. RAG-System)"
                className="w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3 py-1.5 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs text-[#94a3b8] hover:bg-[#222734]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {loading ? "Creating & Analyzing..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
