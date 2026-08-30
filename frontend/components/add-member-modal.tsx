"use client";

import { useState } from "react";
import { Mail, UserPlus, X } from "lucide-react";

type AddMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (name: string, tool: string, email?: string, role?: string) => void;
};

export default function AddMemberModal({
  isOpen,
  onClose,
  onAddMember,
}: AddMemberModalProps) {
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [aiTool, setAiTool] = useState("Cursor");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim()) return;

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${apiUrl}/teams/team-alpha/projects/contextswitch/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: memberName.trim(),
          name: memberName.trim(),
          email: email.trim() || undefined,
          role: role,
        }),
      });
    } catch (e) {
      console.warn("Added member in local dashboard state.");
    }

    onAddMember(memberName.trim(), aiTool, email.trim(), role);
    setMemberName("");
    setEmail("");
    setRole("member");
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2a3040] bg-[#161a24] p-6 shadow-2xl text-[#e1e7ef]">
        <div className="flex items-center justify-between border-b border-[#222734] pb-4">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <UserPlus className="h-5 w-5 text-[#38bdf8]" />
            Add / Invite Team Member
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#94a3b8] hover:bg-[#222734] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Teammate Name / ID
            </label>
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Anand, Priyan, Harsha"
              className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94a3b8]">
              Google Email Address (Invitation)
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#64748b]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@gmail.com"
                className="w-full rounded-lg border border-[#2a3040] bg-[#11141c] pl-9 pr-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8]">
                Team Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94a3b8]">
                Primary AI Agent
              </label>
              <select
                value={aiTool}
                onChange={(e) => setAiTool(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2a3040] bg-[#11141c] px-3.5 py-2 text-sm text-white focus:border-[#38bdf8] focus:outline-none"
              >
                <option value="Cursor">Cursor AI</option>
                <option value="Claude">Claude 3.5 Sonnet</option>
                <option value="Gemini">Gemini 3 Flash</option>
                <option value="Antigravity">Google Antigravity</option>
                <option value="Copilot">GitHub Copilot</option>
              </select>
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
              {loading ? "Inviting..." : "Add / Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
