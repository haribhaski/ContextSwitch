"use client";

import { Plus, Users, X } from "lucide-react";
import { useState } from "react";

type CreateTeamModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;

  user?: {
    name?: string | null;
    email?: string | null;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateTeamModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: CreateTeamModalProps) {
  const [teamName, setTeamName] =
    useState("");

  const [teamId, setTeamId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  function handleClose() {
    if (loading) {
      return;
    }

    setError(null);
    onClose();
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedName =
      teamName.trim();

    const normalizedTeamId =
      makeSlug(teamId);

    const email =
      user?.email
        ?.trim()
        .toLowerCase();

    if (!normalizedName) {
      setError(
        "Team name is required."
      );
      return;
    }

    if (!normalizedTeamId) {
      setError(
        "Team ID is required."
      );
      return;
    }

    if (!email) {
      setError(
        "Your login session does not contain an email address."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_URL}/teams`,
          {
            method: "POST",

            cache: "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              "X-User-Email":
                email,

              "X-User-Name":
                user?.name?.trim() ||
                "",
            },

            body:
              JSON.stringify({
                team_id:
                  normalizedTeamId,

                name:
                  normalizedName,
              }),
          }
        );

      if (!response.ok) {
        let message =
          "Failed to create team";

        try {
          const body =
            await response.json();

          if (
            typeof body?.detail ===
            "string"
          ) {
            message =
              body.detail;
          }
        } catch {
          // use default message
        }

        throw new Error(
          message
        );
      }

      setTeamName("");
      setTeamId("");
      setError(null);

      onSuccess?.();
      onClose();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create team"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/70
        p-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >
      <div
        className="
          w-full max-w-md
          rounded-2xl
          border border-[#2a3040]
          bg-[#161a24]
          p-6
          shadow-2xl
        "
      >
        <div
          className="
            flex items-center
            justify-between
            border-b
            border-[#222734]
            pb-4
          "
        >
          <div
            className="
              flex items-center gap-2
              text-base font-semibold
              text-white
            "
          >
            <Users
              className="
                h-5 w-5
                text-[#38bdf8]
              "
            />

            Create Team
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={
              handleClose
            }
            className="
              rounded p-1
              text-[#94a3b8]
              hover:bg-[#222734]
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <X
              className="h-4 w-4"
            />
          </button>
        </div>

        {error && (
          <div
            className="
              mt-4
              rounded-lg
              border
              border-[#ef4444]/30
              bg-[#ef4444]/10
              p-3
              text-xs
              text-[#fca5a5]
            "
          >
            {error}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-5 space-y-4"
        >
          <div>
            <label
              className="
                block
                text-xs
                font-semibold
                text-[#94a3b8]
              "
            >
              Team Name
            </label>

            <input
              type="text"
              value={
                teamName
              }
              disabled={loading}
              onChange={(event) => {
                const value =
                  event.target.value;

                setTeamName(
                  value
                );

                setTeamId(
                  makeSlug(value)
                );
              }}
              placeholder="e.g. Memory Research Team"
              className="
                mt-1 w-full
                rounded-lg
                border
                border-[#2a3040]
                bg-[#11141c]
                px-3.5 py-2
                text-sm
                text-white
                focus:border-[#38bdf8]
                focus:outline-none
                disabled:opacity-50
              "
              required
            />
          </div>

          <div>
            <label
              className="
                block
                text-xs
                font-semibold
                text-[#94a3b8]
              "
            >
              Team Slug / ID
            </label>

            <input
              type="text"
              value={
                teamId
              }
              disabled={loading}
              onChange={(event) =>
                setTeamId(
                  makeSlug(
                    event.target.value
                  )
                )
              }
              placeholder="e.g. memory-research-team"
              className="
                mt-1 w-full
                rounded-lg
                border
                border-[#2a3040]
                bg-[#11141c]
                px-3.5 py-2
                text-sm
                text-white
                focus:border-[#38bdf8]
                focus:outline-none
                disabled:opacity-50
              "
              required
            />

            <p
              className="
                mt-1
                text-[11px]
                text-[#64748b]
              "
            >
              Used internally to identify the workspace.
            </p>
          </div>

          <div
            className="
              mt-6 flex
              justify-end
              gap-2 pt-2
            "
          >
            <button
              type="button"
              disabled={loading}
              onClick={
                handleClose
              }
              className="
                rounded-lg
                border
                border-[#2a3040]
                px-4 py-2
                text-xs
                text-[#94a3b8]
                hover:bg-[#222734]
                disabled:opacity-40
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="
                flex items-center
                gap-1.5
                rounded-lg
                bg-[#2563eb]
                px-4 py-2
                text-xs
                font-semibold
                text-white
                hover:bg-[#1d4ed8]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <Plus
                size={16}
              />

              {loading
                ? "Creating team..."
                : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}