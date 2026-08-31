"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";

type CreateTeamModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (teamId: string, teamName: string) => void;
};

export default function CreateTeamModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;

    setLoading(true);
    setError(null);

    const teamId = teamName.toLowerCase().replace(/\s+/g, "-");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          name: teamName.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create team on backend server.");
      }

      onSuccess?.(teamId, teamName.trim());
      setTeamName("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2a3040] bg-[#161a24] p-6 shadow-2xl text-[#e1e7ef]">
        <div className="flex items-center justify-between border-b border-[#222734] pb-4">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <Users className="h-5 w-5 text-[#38bdf8]" />
            Create New Team Workspace
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#94a3b8] hover:bg-[#222734] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-[#ef4444]/10 p-3 text-xs text-[#ef4444]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Team Workspace Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Engineering Core, Mobile AI, Research"
              className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              required
            />
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
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
