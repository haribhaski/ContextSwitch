"use client";

import {
  FolderPlus,
  GitBranch,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type User = {
  name?: string | null;
  email?: string | null;
};

type CreateProjectModalProps = {
  isOpen: boolean;

  onClose: () => void;

  /*
   * The dashboard should pass the CURRENT team ID.
   * There must be no default team-alpha here.
   */
  teamId: string;

  /*
   * Current logged-in user from NextAuth.
   */
  user: User;

  /*
   * Optional callback after successful creation.
   *
   * We pass the project info back so the parent does not
   * need to invent or reconstruct anything.
   */
  onSuccess?: (project: {
    team_id: string;
    project_id: string;
    name: string;
  }) => void;
};

type CreateProjectResponse = {
  project: {
    team_id: string;
    project_id: string;
    name: string;

    github_owner?: string | null;
    github_repo?: string | null;

    github_connected?: boolean;
    needs_github_sync?: boolean;

    status?: string;
  };

  creator?: {
    worker_id?: string;
    name?: string;
    email?: string;
  };

  state?: Record<string, unknown>;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";


/* =========================================================
   HELPERS
========================================================= */

function makeSlug(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

function parseGithubInput(
  input: string
): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\s#?]+)/i
  );
  if (urlMatch) {
    const owner = urlMatch[1];
    let repo = urlMatch[2];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    return { owner, repo };
  }

  const slashMatch = trimmed.match(
    /^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$/
  );
  if (slashMatch) {
    let repo = slashMatch[2];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    return { owner: slashMatch[1], repo };
  }

  return null;
}



/* =========================================================
   COMPONENT
========================================================= */

export default function CreateProjectModal({
  isOpen,
  onClose,
  teamId,
  user,
  onSuccess,
}: CreateProjectModalProps) {
  const router =
    useRouter();

  const [
    projectId,
    setProjectId,
  ] = useState("");

  const [
    projectName,
    setProjectName,
  ] = useState("");

  const [
    githubOwner,
    setGithubOwner,
  ] = useState("");

  const [
    githubRepo,
    setGithubRepo,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    projectIdTouched,
    setProjectIdTouched,
  ] = useState(false);


  /* =======================================================
     RESET FORM WHEN MODAL OPENS
  ======================================================= */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setProjectId("");
    setProjectName("");
    setGithubOwner("");
    setGithubRepo("");
    setError(null);
    setLoading(false);
    setProjectIdTouched(false);
  }, [isOpen]);


  /* =======================================================
     CLOSE
  ======================================================= */

  function handleClose() {
    /*
     * Do not let the user visually close the modal while
     * the request is still committing.
     *
     * This avoids:
     *
     * click Create
     * → click X
     * → request keeps running
     * → project suddenly appears later
     */
    if (loading) {
      return;
    }

    onClose();
  }


  /* =======================================================
     SUBMIT
  ======================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedTeamId =
      teamId.trim();

    const normalizedName =
      projectName.trim();

    const normalizedProjectId =
      makeSlug(
        projectId
      );

    const normalizedEmail =
      user.email
        ?.trim()
        .toLowerCase();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!normalizedEmail) {
      setError(
        "Your login session has no email address. Please sign in again."
      );

      return;
    }

    if (!normalizedTeamId) {
      setError(
        "No team is selected. Create or join a team before creating a project."
      );

      return;
    }

    if (!normalizedName) {
      setError(
        "Project Name is required."
      );

      return;
    }

    if (!normalizedProjectId) {
      setError(
        "Project ID is required."
      );

      return;
    }

    /*
     * GitHub fields parsing (supports full URL, owner/repo string, or separate fields)
     */
    let owner = githubOwner.trim();
    let repo = githubRepo.trim();

    const parsedOwner = parseGithubInput(owner);
    if (parsedOwner) {
      owner = parsedOwner.owner;
      repo = parsedOwner.repo;
      setGithubOwner(owner);
      setGithubRepo(repo);
    } else if (repo) {
      const parsedRepo = parseGithubInput(repo);
      if (parsedRepo) {
        owner = parsedRepo.owner;
        repo = parsedRepo.repo;
        setGithubOwner(owner);
        setGithubRepo(repo);
      }
    }

    if (
      (owner && !repo) ||
      (!owner && repo)
    ) {
      setError(
        "Enter a valid GitHub URL, owner/repository format, or enter both owner and repository."
      );

      return;
    }

    setLoading(true);
    setError(null);

    try {
      /* ===================================================
         CREATE PROJECT

         IMPORTANT:
         We send project data ONLY in the request body.

         Identity comes through headers.

         NO:
             creator_worker_id
             creator_email
             Harsha
             team-alpha
      =================================================== */

      const response =
        await fetch(
          `${API_URL}/projects`,
          {
            method:
              "POST",

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
                normalizedEmail,

              "X-User-Name":
                user.name?.trim() ||
                "",
            },

            body:
              JSON.stringify({
                team_id:
                  normalizedTeamId,

                project_id:
                  normalizedProjectId,

                name:
                  normalizedName,

                github_owner:
                  owner ||
                  null,

                github_repo:
                  repo ||
                  null,
              }),
          }
        );


      /* ===================================================
         HANDLE API ERROR
      =================================================== */

      if (!response.ok) {
        let message =
          "Failed to create project";

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
          /*
           * Ignore JSON parse failure and use default.
           */
        }

        throw new Error(
          message
        );
      }


      /* ===================================================
         SUCCESS RESPONSE
      =================================================== */

      const data:
        CreateProjectResponse =
        await response.json();

      const createdProject =
        data.project;

      if (
        !createdProject ||
        !createdProject.team_id ||
        !createdProject.project_id
      ) {
        throw new Error(
          "Backend created the project but returned an invalid project response."
        );
      }


      /* ===================================================
         PARENT CALLBACK

         Parent may update dashboard data if needed.

         Do this BEFORE navigation.
      =================================================== */

      onSuccess?.({
        team_id:
          createdProject.team_id,

        project_id:
          createdProject.project_id,

        name:
          createdProject.name,
      });


      /* ===================================================
         CLOSE MODAL
      =================================================== */

      onClose();


      /* ===================================================
         ONE NAVIGATION ONLY

         NO window.location.href.
         NO second redirect.
         NO parent-generated route.
      =================================================== */

      router.push(
        `/projects/${createdProject.team_id}/${createdProject.project_id}`
      );

      router.refresh();

    } catch (err) {
      console.error(
        "Create project failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create project"
      );

      setLoading(false);
    }
  }


  /* =======================================================
     HIDDEN
  ======================================================= */

  if (!isOpen) {
    return null;
  }


  /* =======================================================
     UI
  ======================================================= */

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
        /*
         * Clicking the dark overlay closes only when idle.
         */
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
        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex items-center justify-between
            border-b border-[#222734]
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
            <FolderPlus
              className="
                h-5 w-5
                text-[#38bdf8]
              "
            />

            Create Shared Project
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
            title={
              loading
                ? "Project creation is in progress"
                : "Close"
            }
          >
            <X
              className="h-4 w-4"
            />
          </button>
        </div>


        {/* =================================================
            TEAM
        ================================================= */}

        <div
          className="
            mt-4 rounded-lg
            border border-[#2a3040]
            bg-[#11141c]
            px-3.5 py-3
          "
        >
          <div
            className="
              text-[11px]
              font-semibold
              uppercase tracking-wide
              text-[#64748b]
            "
          >
            Creating inside
          </div>

          <div
            className="
              mt-1 text-sm
              font-medium
              text-white
            "
          >
            {teamId ||
              "No team selected"}
          </div>
        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            className="
              mt-4 rounded-lg
              border border-[#ef4444]/30
              bg-[#ef4444]/10
              p-3
              text-xs
              text-[#fca5a5]
            "
          >
            {error}
          </div>
        )}


        {/* =================================================
            FORM
        ================================================= */}

        <form
          onSubmit={
            handleSubmit
          }
          className="
            mt-4
            space-y-4
          "
        >
          {/* PROJECT NAME */}

          <div>
            <label
              className="
                block
                text-xs font-semibold
                text-[#94a3b8]
              "
            >
              Project Name
            </label>

            <input
              type="text"
              value={
                projectName
              }
              disabled={loading}
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value;

                setProjectName(
                  value
                );

                /*
                 * Automatically generate project ID
                 * until user manually edits the slug.
                 */
                if (
                  !projectIdTouched
                ) {
                  setProjectId(
                    makeSlug(
                      value
                    )
                  );
                }
              }}
              placeholder="e.g. Memory LLM Engine"
              className="
                mt-1 w-full
                rounded-lg
                border border-[#2a3040]
                bg-[#11141c]
                px-3.5 py-2
                text-sm text-white
                focus:border-[#38bdf8]
                focus:outline-none
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
              required
            />
          </div>


          {/* PROJECT ID */}

          <div>
            <label
              className="
                block
                text-xs font-semibold
                text-[#94a3b8]
              "
            >
              Project Slug / ID
            </label>

            <input
              type="text"
              value={
                projectId
              }
              disabled={loading}
              onChange={(
                event
              ) => {
                setProjectIdTouched(
                  true
                );

                setProjectId(
                  makeSlug(
                    event.target
                      .value
                  )
                );
              }}
              placeholder="e.g. memory-llm-engine"
              className="
                mt-1 w-full
                rounded-lg
                border border-[#2a3040]
                bg-[#11141c]
                px-3.5 py-2
                text-sm text-white
                focus:border-[#38bdf8]
                focus:outline-none
                disabled:cursor-not-allowed
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
              Used in the project URL.
            </p>
          </div>


          {/* =================================================
              GITHUB
          ================================================= */}

          <div
            className="
              border-t
              border-[#222734]
              pt-4
            "
          >
            <label
              className="
                flex items-center gap-1.5
                text-xs font-semibold
                text-[#38bdf8]
              "
            >
              <GitBranch
                className="h-3.5 w-3.5"
              />

              GitHub Repository
              <span
                className="
                  font-normal
                  text-[#64748b]
                "
              >
                (optional)
              </span>
            </label>

            <p
              className="
                mt-1
                text-[11px]
                leading-4
                text-[#64748b]
              "
            >
              The project will be created
              immediately. Repository analysis
              can run afterward.
            </p>

            <div
              className="
                mt-3
                grid grid-cols-2
                gap-2
              "
            >
              <input
                type="text"
                value={
                  githubOwner
                }
                disabled={loading}
                onChange={(
                  event
                ) => {
                  const val = event.target.value;
                  const parsed = parseGithubInput(val);
                  if (parsed) {
                    setGithubOwner(parsed.owner);
                    setGithubRepo(parsed.repo);
                  } else {
                    setGithubOwner(val);
                  }
                }}
                placeholder="Owner or Repo URL (e.g. owner/repo)"
                className="
                  w-full rounded-lg
                  border border-[#2a3040]
                  bg-[#11141c]
                  px-3 py-2
                  text-xs text-white
                  focus:border-[#38bdf8]
                  focus:outline-none
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />

              <input
                type="text"
                value={
                  githubRepo
                }
                disabled={loading}
                onChange={(
                  event
                ) => {
                  const val = event.target.value;
                  const parsed = parseGithubInput(val);
                  if (parsed) {
                    setGithubOwner(parsed.owner);
                    setGithubRepo(parsed.repo);
                  } else {
                    setGithubRepo(val);
                  }
                }}
                placeholder="Repository"
                className="
                  w-full rounded-lg
                  border border-[#2a3040]
                  bg-[#11141c]
                  px-3 py-2
                  text-xs text-white
                  focus:border-[#38bdf8]
                  focus:outline-none
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />
            </div>
          </div>


          {/* =================================================
              BUTTONS
          ================================================= */}

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
                border border-[#2a3040]
                px-4 py-2
                text-xs
                text-[#94a3b8]
                hover:bg-[#222734]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                !teamId ||
                !user.email
              }
              className="
                flex items-center
                gap-1.5
                rounded-lg
                bg-[#2563eb]
                px-4 py-2
                text-xs font-semibold
                text-white
                hover:bg-[#1d4ed8]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <FolderPlus
                className="h-4 w-4"
              />

              {loading
                ? "Creating project..."
                : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}