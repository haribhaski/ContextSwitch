"use client";

import {
  Mail,
  UserPlus,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

type AddMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;

  teamId: string;
  projectId?: string;

  user: {
    name?: string | null;
    email?: string | null;
  };

  onSuccess?: () => void;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function AddMemberModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  user,
  onSuccess,
}: AddMemberModalProps) {
  const [
    memberName,
    setMemberName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState("member");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMemberName("");
    setEmail("");
    setRole("member");
    setError(null);
    setLoading(false);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleClose() {
    if (loading) {
      return;
    }

    onClose();
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const name =
      memberName.trim();

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const currentUserEmail =
      user.email
        ?.trim()
        .toLowerCase();

    if (!teamId) {
      setError(
        "No team selected."
      );

      return;
    }

    if (!name) {
      setError(
        "Teammate name is required."
      );

      return;
    }

    if (!normalizedEmail) {
      setError(
        "Teammate email is required."
      );

      return;
    }

    if (!currentUserEmail) {
      setError(
        "Your login session is missing an email address."
      );

      return;
    }

    setLoading(true);
    setError(null);

    try {
      /*
       * If a projectId exists, this adds the user to:
       *
       * team membership
       * +
       * project membership
       *
       * If you're adding from the Teams page without a
       * project, we'll use the team-level endpoint below.
       */

      const endpoint =
        projectId
          ? `${API_URL}/teams/${teamId}/projects/${projectId}/members`
          : `${API_URL}/teams/${teamId}/members`;

      const response =
        await fetch(
          endpoint,
          {
            method: "POST",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              "X-User-Email":
                currentUserEmail,

              "X-User-Name":
                user.name?.trim() ||
                "",
            },

            body:
              JSON.stringify({
                worker_id:
                  normalizedEmail,

                name,

                email:
                  normalizedEmail,

                role,
              }),
          }
        );

      if (!response.ok) {
        let message =
          "Failed to add teammate";

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
          // keep default message
        }

        throw new Error(
          message
        );
      }

      setMemberName("");
      setEmail("");
      setRole("member");

      onSuccess?.();

      onClose();

    } catch (err) {
      console.error(
        "Add teammate failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to add teammate"
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
      onMouseDown={(
        event
      ) => {
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
          text-[#e1e7ef]
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
            <UserPlus
              className="
                h-5 w-5
                text-[#38bdf8]
              "
            />

            Add Team Member
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
          className="
            mt-4
            space-y-4
          "
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
              Teammate Name
            </label>

            <input
              type="text"
              value={
                memberName
              }
              disabled={loading}
              onChange={(
                event
              ) =>
                setMemberName(
                  event.target
                    .value
                )
              }
              placeholder="e.g. Jeevan Kumar"
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
              Google Email Address
            </label>

            <div
              className="
                relative mt-1
              "
            >
              <Mail
                className="
                  absolute
                  left-3 top-2.5
                  h-4 w-4
                  text-[#64748b]
                "
              />

              <input
                type="email"
                value={
                  email
                }
                disabled={loading}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                placeholder="teammate@gmail.com"
                className="
                  w-full
                  rounded-lg
                  border
                  border-[#2a3040]
                  bg-[#11141c]
                  py-2
                  pl-9 pr-3.5
                  text-sm
                  text-white
                  focus:border-[#38bdf8]
                  focus:outline-none
                  disabled:opacity-50
                "
                required
              />
            </div>
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
              Team Role
            </label>

            <select
              value={
                role
              }
              disabled={loading}
              onChange={(
                event
              ) =>
                setRole(
                  event.target
                    .value
                )
              }
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
            >
              <option value="member">
                Member
              </option>

              <option value="admin">
                Admin
              </option>
            </select>
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
                disabled:opacity-50
              "
            >
              <UserPlus
                size={16}
              />

              {loading
                ? "Adding..."
                : "Add teammate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}