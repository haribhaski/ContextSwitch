"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import CreateProjectModal from "@/components/create-project-modal";
import CreateTeamModal from "@/components/create-team-modal";
import AddMemberModal from "@/components/add-member-modal";

/* =========================================================
   TYPES
========================================================= */

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type DashboardShellProps = {
  user: User;
};

type ProjectState = {
  goal?: string;
  completed?: string[];
  progress?: string[];
  failed?: string[];
  failures?: string[];
  decisions?: string[];
  blockers?: string[];
  next_actions?: string[];
};

type DashboardMember = {
  id?: string;
  team_id?: string;
  project_id?: string;

  worker_id: string;
  name: string;

  email?: string;
  role?: string;
  tool?: string;
  primary_agent?: string;

  joined_at?: string;
};

type DashboardProject = {
  id?: string;

  project_id: string;
  team_id: string;

  name: string;

  github_owner?: string | null;
  github_repo?: string | null;

  current_state?: ProjectState;

  members?: DashboardMember[];

  blocker_count?: number;
  conflict_count?: number;

  created_at?: string;
  updated_at?: string;
};

type ActivityEntry = {
  id?: string;
  entry_id?: string;

  worker_id: string;

  type?: string;
  entry_type?: string;

  content: string;

  source?: string;
  timestamp?: string;

  project_id?: string;
  project_name?: string;
  team_id?: string;
};

type Conflict = {
  id?: string;
  conflict_id?: string;

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

  resolution?: string | null;

  project_id?: string;
  project_name?: string;
  team_id?: string;
};

type DashboardStats = {
  projects: number;
  members: number;
  unresolved_conflicts: number;
  blockers: number;
};

type DashboardTeam = {
  id?: string;
  team_id: string;
  name: string;
  project_count?: number;
  member_count?: number;
};

type DashboardResponse = {
  teams?: DashboardTeam[];
  team_id?: string;
  team_name?: string;

  projects?: DashboardProject[];
  members?: DashboardMember[];
  recent_entries?: ActivityEntry[];
  conflicts?: Conflict[];

  stats?: DashboardStats;
};

/* =========================================================
   CONFIG
========================================================= */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

/* =========================================================
   HELPERS
========================================================= */

function getInitials(name?: string) {
  if (!name) return "?";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }

  return name
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value?: string) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const diff =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      diff / 60000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days === 1) {
    return "Yesterday";
  }

  return `${days} days ago`;
}

function getActivityAction(
  entry: ActivityEntry
) {
  const type =
    entry.entry_type ||
    entry.type ||
    "update";

  switch (type) {
    case "decision":
      return "recorded a decision";

    case "completed":
      return "completed";

    case "blocker":
      return "reported a blocker";

    case "failure":
    case "failed":
      return "recorded a failed attempt";

    case "github_commit":
    case "github_sync":
      return "synced GitHub evidence";

    case "conflict_resolution":
      return "resolved a conflict";

    default:
      return "added an update";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function DashboardShell({
  user,
}: DashboardShellProps) {
  const [dark, setDark] =
    useState(false);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    | "home"
    | "projects"
    | "teams"
    | "activity"
    | "conflicts"
  >("home");

  const [
    createProjectOpen,
    setCreateProjectOpen,
  ] = useState(false);

  const [
    createTeamOpen,
    setCreateTeamOpen,
  ] = useState(false);

  const [
    addMemberOpen,
    setAddMemberOpen,
  ] = useState(false);

  const [
    projects,
    setProjects,
  ] = useState<
    DashboardProject[]
  >([]);

  const [teams, setTeams] =
    useState<DashboardTeam[]>([]);

  const [
    members,
    setMembers,
  ] = useState<
    DashboardMember[]
  >([]);

  const [
    activities,
    setActivities,
  ] = useState<
    ActivityEntry[]
  >([]);

  const [
    conflicts,
    setConflicts,
  ] = useState<
    Conflict[]
  >([]);

  const [
    teamId,
    setTeamId,
  ] = useState("");

  const [
    teamName,
    setTeamName,
  ] = useState(
    "Your workspace"
  );

  const [
    hasTeam,
    setHasTeam,
  ] = useState(false);

  const [
    stats,
    setStats,
  ] = useState<DashboardStats>({
    projects: 0,
    members: 0,
    unresolved_conflicts: 0,
    blockers: 0,
  });

  const [
    dashboardLoading,
    setDashboardLoading,
  ] = useState(true);

  const [
    dashboardError,
    setDashboardError,
  ] = useState<
    string | null
  >(null);

  const userEmail =
    user.email
      ?.trim()
      .toLowerCase() || "";

  /* =======================================================
     CLEAR DATA
  ======================================================= */

  const clearDashboardData =
    useCallback(() => {
      setProjects([]);
      setTeams([]);
      setMembers([]);
      setActivities([]);
      setConflicts([]);

      setStats({
        projects: 0,
        members: 0,
        unresolved_conflicts: 0,
        blockers: 0,
      });
    }, []);

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  const loadDashboard =
    useCallback(
      async () => {
        if (!userEmail) {
          setDashboardLoading(
            false
          );

          await signOut({
            callbackUrl:
              "/login",
          });

          return;
        }

        setDashboardLoading(
          true
        );

        setDashboardError(
          null
        );

        try {
          const response =
            await fetch(
              `${API_URL}/me/dashboard`,
              {
                method:
                  "GET",

                cache:
                  "no-store",

                credentials:
                  "include",

                headers: {
                  Accept:
                    "application/json",

                  "X-User-Email":
                    userEmail,
                },
              }
            );

          if (
            response.status ===
            401
          ) {
            await signOut({
              callbackUrl:
                "/login",
            });

            return;
          }

          /*
           * Logged in, but user has no team.
           */
          if (
            response.status ===
            404
          ) {
            setTeamId("");

            setTeamName(
              "Your workspace"
            );

            clearDashboardData();

            setHasTeam(false);

            return;
          }

          if (!response.ok) {
            const body =
              await response.text();

            throw new Error(
              `Dashboard API failed (${response.status}): ${
                body ||
                response.statusText
              }`
            );
          }

          const data:
            DashboardResponse =
            await response.json();

          const loadedTeams =
            Array.isArray(data.teams)
              ? data.teams
              : [];

          const returnedTeamId =
            typeof data.team_id ===
            "string"
              ? data.team_id
              : "";

          if (
            !returnedTeamId
          ) {
            throw new Error(
              "Dashboard returned no team_id."
            );
          }

          setHasTeam(loadedTeams.length > 0 || Boolean(returnedTeamId));
          setTeams(loadedTeams);

          setTeamId(
            returnedTeamId
          );

          setTeamName(
            data.team_name ||
              returnedTeamId
          );

          const loadedProjects =
            Array.isArray(
              data.projects
            )
              ? data.projects
              : [];

          const loadedMembers =
            Array.isArray(
              data.members
            )
              ? data.members
              : [];

          const loadedActivities =
            Array.isArray(
              data.recent_entries
            )
              ? data.recent_entries
              : [];

          const loadedConflicts =
            Array.isArray(
              data.conflicts
            )
              ? data.conflicts
              : [];

          setProjects(
            loadedProjects
          );

          setMembers(
            loadedMembers
          );

          setActivities(
            loadedActivities
          );

          setConflicts(
            loadedConflicts
          );

          setStats({
            projects:
              data.stats
                ?.projects ??
              loadedProjects
                .length,

            members:
              data.stats
                ?.members ??
              loadedMembers
                .length,

            unresolved_conflicts:
              data.stats
                ?.unresolved_conflicts ??
              loadedConflicts.filter(
                (conflict) =>
                  conflict.status ===
                  "unresolved"
              ).length,

            blockers:
              data.stats
                ?.blockers ??
              loadedProjects.reduce(
                (
                  total,
                  project
                ) =>
                  total +
                  (
                    project
                      .blocker_count ??
                    project
                      .current_state
                      ?.blockers
                      ?.length ??
                    0
                  ),
                0
              ),
          });
        } catch (error) {
          console.error(
            "Dashboard load failed:",
            error
          );

          setHasTeam(false);

          setTeamId("");

          setTeamName(
            "Your workspace"
          );

          clearDashboardData();

          setDashboardError(
            error instanceof Error
              ? error.message
              : "Failed to load dashboard"
          );
        } finally {
          setDashboardLoading(
            false
          );
        }
      },
      [
        userEmail,
        clearDashboardData,
      ]
    );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  /* =======================================================
     THEME
  ======================================================= */

  useEffect(() => {
    const stored =
      localStorage.getItem(
        "contextswitch-theme"
      );

    const prefersDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    const shouldUseDark =
      stored === "dark" ||
      (!stored &&
        prefersDark);

    const timer = window.setTimeout(() => {
      setDark(shouldUseDark);
      document.documentElement.classList.toggle(
        "dark",
        shouldUseDark
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const next =
      !dark;

    setDark(next);

    document.documentElement.classList.toggle(
      "dark",
      next
    );

    localStorage.setItem(
      "contextswitch-theme",
      next
        ? "dark"
        : "light"
    );
  }

  /* =======================================================
     CREATE ACTION

     ONE centralized function so no screen can accidentally
     open project creation before a team exists.
  ======================================================= */

  function handleCreateAction() {
    if (!hasTeam) {
      setCreateTeamOpen(
        true
      );

      return;
    }

    setCreateProjectOpen(
      true
    );
  }

  function selectTeam(team: DashboardTeam) {
    setTeamId(team.team_id);
    setTeamName(team.name || team.team_id);
    setHasTeam(true);
  }

  /* =======================================================
     SEARCH
  ======================================================= */

  const query =
    searchValue
      .trim()
      .toLowerCase();

  const filteredProjects =
    projects.filter(
      (project) => {
        if (!query) {
          return true;
        }

        const goal =
          project
            .current_state
            ?.goal || "";

        return (
          project.name
            ?.toLowerCase()
            .includes(
              query
            ) ||
          project.project_id
            ?.toLowerCase()
            .includes(
              query
            ) ||
          goal
            .toLowerCase()
            .includes(
              query
            )
        );
      }
    );

  const filteredActivities =
    activities.filter(
      (activity) => {
        if (!query) {
          return true;
        }

        return (
          activity.worker_id
            ?.toLowerCase()
            .includes(
              query
            ) ||
          activity.content
            ?.toLowerCase()
            .includes(
              query
            ) ||
          activity.source
            ?.toLowerCase()
            .includes(
              query
            ) ||
          activity.project_name
            ?.toLowerCase()
            .includes(
              query
            )
        );
      }
    );

  const selectedTeamMembers = members.filter(
    (member) => !member.team_id || member.team_id === teamId
  );

  const unresolvedConflicts =
    conflicts.filter(
      (conflict) =>
        conflict.status ===
        "unresolved"
    );

  const firstConflict =
    unresolvedConflicts[0];

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    dashboardLoading
  ) {
    return (
      <div className="cs-app">
        <div className="flex min-h-screen w-full items-center justify-center">
          <div className="text-center">
            <RefreshCw
              size={30}
              className="mx-auto animate-spin"
            />

            <p className="mt-3 text-sm">
              Loading workspace...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (dashboardError) {
    return (
      <div className="cs-app">
        <div className="flex min-h-screen w-full items-center justify-center px-6">
          <div className="max-w-lg text-center">
            <XCircle
              size={34}
              className="mx-auto"
            />

            <h2 className="mt-4 text-xl font-semibold">
              Unable to load
              workspace
            </h2>

            <p className="mt-2 text-sm opacity-70">
              {dashboardError}
            </p>

            <button
              onClick={() =>
                void loadDashboard()
              }
              className="cs-primary-button mt-5"
            >
              <RefreshCw
                size={16}
              />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-app">
      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={`cs-sidebar ${
          sidebarOpen
            ? "cs-sidebar-open"
            : ""
        }`}
      >
        <div className="cs-sidebar-header">
          <Link
            href="/dashboard"
            className="cs-brand"
          >
            <div className="cs-logo">
              C
            </div>

            <span>
              ContextSwitch
            </span>
          </Link>

          <button
            className="cs-mobile-close"
            onClick={() =>
              setSidebarOpen(
                false
              )
            }
          >
            <X size={20} />
          </button>
        </div>

        <nav className="cs-nav">
          <SidebarItem
            icon={
              <Home
                size={19}
              />
            }
            label="Home"
            active={
              activeTab ===
              "home"
            }
            onClick={() =>
              setActiveTab(
                "home"
              )
            }
          />

          <SidebarItem
            icon={
              <FolderKanban
                size={19}
              />
            }
            label="Projects"
            active={
              activeTab ===
              "projects"
            }
            onClick={() =>
              setActiveTab(
                "projects"
              )
            }
          />

          <SidebarItem
            icon={
              <Users
                size={19}
              />
            }
            label="Teams"
            active={
              activeTab ===
              "teams"
            }
            onClick={() =>
              setActiveTab(
                "teams"
              )
            }
          />

          <SidebarItem
            icon={
              <Activity
                size={19}
              />
            }
            label="Activity"
            active={
              activeTab ===
              "activity"
            }
            onClick={() =>
              setActiveTab(
                "activity"
              )
            }
          />

          <SidebarItem
            icon={
              <AlertTriangle
                size={19}
              />
            }
            label="Conflicts"
            badge={
              unresolvedConflicts.length
                ? unresolvedConflicts.length.toString()
                : undefined
            }
            active={
              activeTab ===
              "conflicts"
            }
            onClick={() =>
              setActiveTab(
                "conflicts"
              )
            }
          />
        </nav>

        <div className="cs-sidebar-section">
          <div className="cs-sidebar-label">
            Your teams
          </div>

          {teams.map((team, index) => (
            <TeamItem
              key={team.team_id}
              name={team.name || team.team_id}
              color={index % 3 === 0 ? "blue" : index % 3 === 1 ? "green" : "orange"}
              onClick={() => {
                selectTeam(team);
                setActiveTab("teams");
              }}
            />
          ))}

            <button
              onClick={() =>
                setCreateTeamOpen(
                  true
                )
              }
              className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-dashed border-[#334155] px-3 py-2 text-left text-sm text-[#94a3b8] hover:bg-[#1e2430] hover:text-white"
            >
              <Plus
                size={16}
              />

              {hasTeam ? "New team" : "Create team"}
            </button>
        </div>

        <div className="cs-sidebar-bottom">
          <SidebarItem
            icon={
              <CircleHelp
                size={18}
              />
            }
            label="Help"
          />

          <SidebarItem
            icon={
              <Settings
                size={18}
              />
            }
            label="Settings"
            onClick={() =>
              setProfileOpen(
                true
              )
            }
          />
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="cs-mobile-overlay"
          onClick={() =>
            setSidebarOpen(
              false
            )
          }
        />
      )}

      {/* ===================================================
          MAIN
      =================================================== */}

      <div className="cs-main">
        <header className="cs-topbar">
          <div className="cs-topbar-left">
            <button
              className="cs-menu-button"
              onClick={() =>
                setSidebarOpen(
                  true
                )
              }
            >
              <Menu
                size={21}
              />
            </button>

            <div className="cs-search">
              <Search
                size={19}
              />

              <input
                value={
                  searchValue
                }
                onChange={(
                  event
                ) =>
                  setSearchValue(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Search project memory..."
              />

              <kbd>⌘ K</kbd>
            </div>
          </div>

          <div className="cs-top-actions">
            <button
              onClick={
                toggleTheme
              }
              className="cs-theme-toggle"
            >
              {dark
                ? "☀"
                : "☾"}
            </button>

            <button
              className="cs-icon-button"
              onClick={() =>
                void loadDashboard()
              }
              title="Refresh"
            >
              <RefreshCw
                size={19}
              />
            </button>

            <button className="cs-icon-button">
              <Bell
                size={20}
              />

              {unresolvedConflicts.length >
                0 && (
                <span className="cs-notification-dot" />
              )}
            </button>

            <div className="cs-profile-wrapper">
              <button
                className="cs-profile"
                onClick={() =>
                  setProfileOpen(
                    !profileOpen
                  )
                }
              >
                {user.image ? (
                  <Image
                    src={
                      user.image
                    }
                    alt={
                      user.name ||
                      "User"
                    }
                    width={34}
                    height={34}
                    className="cs-profile-image"
                  />
                ) : (
                  <div className="cs-profile-fallback">
                    {getInitials(
                      user.name ||
                        user.email ||
                        "User"
                    )}
                  </div>
                )}

                <ChevronDown
                  size={15}
                />
              </button>

              {profileOpen && (
                <div className="cs-profile-menu">
                  <div className="cs-profile-info">
                    <div>
                      <div className="cs-profile-name">
                        {user.name ||
                          "User"}
                      </div>

                      <div className="cs-profile-email">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="cs-menu-divider" />

                  <button
                    className="cs-profile-menu-item"
                    onClick={() =>
                      signOut({
                        callbackUrl:
                          "/login",
                      })
                    }
                  >
                    <LogOut
                      size={17}
                    />

                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="cs-content">
          {/* =================================================
              HOME
          ================================================= */}

          {activeTab ===
            "home" && (
            <>
              <section className="cs-welcome">
                <div>
                  <p className="cs-eyebrow">
                    Workspace
                  </p>

                  <h1>
                    Welcome
                    {user.name
                      ? `, ${
                          user.name.split(
                            " "
                          )[0]
                        }`
                      : ""}
                  </h1>

                  <p>
                    {hasTeam
                      ? `Shared context across ${teams.length} team${teams.length === 1 ? "" : "s"}.`
                      : "Create your team workspace to start using ContextSwitch."}
                  </p>
                </div>

                <button
                  className="cs-primary-button"
                  onClick={
                    handleCreateAction
                  }
                >
                  <Plus
                    size={18}
                  />

                  {hasTeam
                    ? "New project"
                    : "Create team"}
                </button>
              </section>

              {/* NO TEAM */}

              {!hasTeam && (
                <section className="mb-6 rounded-2xl border border-dashed border-[#334155] bg-[#161a24] px-8 py-12">
                  <div className="mx-auto max-w-lg text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb]/10 text-[#38bdf8]">
                      <Users
                        size={28}
                      />
                    </div>

                    <h2 className="mt-5 text-xl font-semibold text-white">
                      Create your first
                      team
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-[#94a3b8]">
                      Projects belong
                      inside teams.
                      Create your team
                      workspace first,
                      then you can add
                      projects and invite
                      collaborators.
                    </p>

                    <button
                      className="cs-primary-button mx-auto mt-6"
                      onClick={() =>
                        setCreateTeamOpen(
                          true
                        )
                      }
                    >
                      <Plus
                        size={18}
                      />

                      Create team
                    </button>
                  </div>
                </section>
              )}

              <section className="cs-summary-strip">
                <SummaryItem
                  icon={
                    <FolderKanban
                      size={20}
                    />
                  }
                  number={
                    stats.projects.toString()
                  }
                  label="Active projects"
                  onClick={() =>
                    setActiveTab(
                      "projects"
                    )
                  }
                />

                <SummaryItem
                  icon={
                    <Users
                      size={20}
                    />
                  }
                  number={
                    stats.members.toString()
                  }
                  label="Collaborators"
                  onClick={() =>
                    setActiveTab(
                      "teams"
                    )
                  }
                />

                <SummaryItem
                  icon={
                    <AlertTriangle
                      size={20}
                    />
                  }
                  number={
                    stats.unresolved_conflicts.toString()
                  }
                  label="Needs attention"
                  warning={
                    stats.unresolved_conflicts >
                    0
                  }
                  onClick={() =>
                    setActiveTab(
                      "conflicts"
                    )
                  }
                />

                <SummaryItem
                  icon={
                    <CheckCircle2
                      size={20}
                    />
                  }
                  number={
                    activities.length.toString()
                  }
                  label="Recent updates"
                  onClick={() =>
                    setActiveTab(
                      "activity"
                    )
                  }
                />
              </section>

              <section className="cs-section">
                <div className="cs-section-heading">
                  <div>
                    <h2>
                      Your projects
                    </h2>

                    <p>
                      Shared project
                      context.
                    </p>
                  </div>

                  <button
                    className="cs-text-button"
                    onClick={() =>
                      setActiveTab(
                        "projects"
                      )
                    }
                  >
                    View all
                    <ArrowRight
                      size={16}
                    />
                  </button>
                </div>

                {filteredProjects.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed border-[#2a3040] bg-[#161a24] p-8 text-center">
                    <FolderKanban
                      size={28}
                      className="mx-auto opacity-50"
                    />

                    <h3 className="mt-3 font-semibold">
                      {hasTeam
                        ? "No projects yet"
                        : "Create a team first"}
                    </h3>

                    <p className="mt-2 text-sm opacity-60">
                      {hasTeam
                        ? "Create your first project inside this team."
                        : "Every ContextSwitch project belongs to a team workspace."}
                    </p>

                    <button
                      className="cs-primary-button mx-auto mt-5"
                      onClick={
                        handleCreateAction
                      }
                    >
                      <Plus
                        size={17}
                      />

                      {hasTeam
                        ? "Create project"
                        : "Create team"}
                    </button>
                  </div>
                ) : (
                  <div className="cs-project-grid">
                    {filteredProjects.map(
                      (
                        project
                      ) => (
                        <ProjectCard
                          key={`${project.team_id}-${project.project_id}`}
                          project={
                            project
                          }
                        />
                      )
                    )}
                  </div>
                )}
              </section>

              <section className="cs-dashboard-grid">
                <div className="cs-panel cs-activity-panel">
                  <div className="cs-panel-header">
                    <div>
                      <h2>
                        Recent activity
                      </h2>

                      <p>
                        Latest workspace
                        updates
                      </p>
                    </div>
                  </div>

                  <div className="cs-activity-list">
                    {filteredActivities.length ===
                    0 ? (
                      <EmptyState text="No activity logged yet." />
                    ) : (
                      filteredActivities
                        .slice(
                          0,
                          4
                        )
                        .map(
                          (
                            activity
                          ) => (
                            <ActivityItem
                              key={
                                activity.id ||
                                activity.entry_id
                              }
                              activity={
                                activity
                              }
                            />
                          )
                        )
                    )}
                  </div>
                </div>

                <div className="cs-right-column">
                  <div className="cs-panel">
                    <div className="cs-conflict-heading">
                      <div className="cs-warning-icon">
                        <AlertTriangle
                          size={19}
                        />
                      </div>

                      <div>
                        <span>
                          Needs attention
                        </span>

                        <h3>
                          Decision
                          conflicts
                        </h3>
                      </div>
                    </div>

                    {firstConflict ? (
                      <div className="cs-conflict-body">
                        <h4>
                          {
                            firstConflict.topic
                          }
                        </h4>

                        <p>
                          {
                            firstConflict
                              .side_a
                              .worker_id
                          }{" "}
                          and{" "}
                          {
                            firstConflict
                              .side_b
                              .worker_id
                          }{" "}
                          recorded
                          conflicting
                          decisions.
                        </p>

                        {firstConflict.project_id && (
                          <Link
                            href={`/projects/${
                              firstConflict.team_id ||
                              teamId
                            }/${
                              firstConflict.project_id
                            }`}
                            className="cs-resolve-button block text-center"
                          >
                            Review
                            conflict →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="p-5 text-sm">
                        <CheckCircle2
                          size={20}
                        />

                        <p className="mt-2">
                          No unresolved
                          conflicts.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="cs-panel">
                    <div className="cs-panel-header compact">
                      <div>
                        <h2>
                          {hasTeam
                            ? teamName
                            : "Your team"}
                        </h2>

                        <p>
                          {hasTeam
                            ? `${selectedTeamMembers.length} member${
                                selectedTeamMembers.length ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : "No team yet"}
                        </p>
                      </div>

                      {hasTeam && (
                        <button
                          className="cs-icon-button subtle"
                          onClick={() =>
                            setAddMemberOpen(
                              true
                            )
                          }
                        >
                          <Plus
                            size={18}
                          />
                        </button>
                      )}
                    </div>

                    <div className="cs-team-list">
                      {selectedTeamMembers.length ===
                      0 ? (
                        <EmptyState
                          text={
                            hasTeam
                              ? "No members found."
                              : "Create a team first."
                          }
                        />
                      ) : (
                        selectedTeamMembers
                          .slice(
                            0,
                            5
                          )
                          .map(
                            (
                              member
                            ) => (
                              <MemberRow
                                key={
                                  member.id ||
                                  member.worker_id
                                }
                                member={
                                  member
                                }
                                onClick={() =>
                                  setActiveTab(
                                    "teams"
                                  )
                                }
                              />
                            )
                          )
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* =================================================
              PROJECTS
          ================================================= */}

          {activeTab ===
            "projects" && (
            <section className="cs-section">
              <div className="cs-section-heading">
                <div>
                  <h1 className="text-2xl font-bold">
                    Projects (
                    {
                      filteredProjects.length
                    }
                    )
                  </h1>

                  <p>
                    Projects from your
                    workspace.
                  </p>
                </div>

                <button
                  className="cs-primary-button"
                  onClick={
                    handleCreateAction
                  }
                >
                  <Plus
                    size={18}
                  />

                  {hasTeam
                    ? "New project"
                    : "Create team"}
                </button>
              </div>

              {filteredProjects.length ===
              0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-[#2a3040] bg-[#161a24] p-10 text-center">
                  <FolderKanban
                    size={30}
                    className="mx-auto opacity-50"
                  />

                  <h3 className="mt-3 font-semibold">
                    {hasTeam
                      ? "No projects yet"
                      : "You need a team first"}
                  </h3>

                  <button
                    className="cs-primary-button mx-auto mt-5"
                    onClick={
                      handleCreateAction
                    }
                  >
                    <Plus
                      size={17}
                    />

                    {hasTeam
                      ? "Create first project"
                      : "Create team"}
                  </button>
                </div>
              ) : (
                <div className="cs-project-grid mt-6">
                  {filteredProjects.map(
                    (
                      project
                    ) => (
                      <ProjectCard
                        key={`${project.team_id}-${project.project_id}`}
                        project={
                          project
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              TEAMS
          ================================================= */}

          {activeTab ===
            "teams" && (
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">
                    Teams
                  </h1>

                  <p className="mt-1 text-sm opacity-70">
                    Manage your shared
                    workspace and
                    collaborators.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    className="cs-primary-button"
                    onClick={() =>
                      setCreateTeamOpen(
                        true
                      )
                    }
                  >
                    <Plus
                      size={18}
                    />

                    Create team
                  </button>

                  {hasTeam && (
                  <button
                    className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#273449]"
                    onClick={() =>
                      setAddMemberOpen(
                        true
                      )
                    }
                  >
                    <UserPlus
                      size={18}
                    />

                    Add member
                  </button>
                  )}
                </div>
              </div>

              {!hasTeam ? (
                <div className="rounded-2xl border border-dashed border-[#334155] bg-[#161a24] px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb]/10 text-[#38bdf8]">
                    <Users
                      size={28}
                    />
                  </div>

                  <h2 className="mt-5 text-xl font-semibold text-white">
                    You don&apos;t
                    have a team yet
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#94a3b8]">
                    Create your first
                    ContextSwitch team
                    before creating
                    projects or inviting
                    collaborators.
                  </p>

                  <button
                    className="cs-primary-button mx-auto mt-6"
                    onClick={() =>
                      setCreateTeamOpen(
                        true
                      )
                    }
                  >
                    <Plus
                      size={18}
                    />

                    Create your first
                    team
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {teams.map((team) => {
                      const selected = team.team_id === teamId;
                      return (
                        <button
                          key={team.team_id}
                          type="button"
                          onClick={() => selectTeam(team)}
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-[#38bdf8] bg-[#0c4a6e]/30"
                              : "border-[#222734] bg-[#161a24] hover:border-[#334155]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="truncate font-semibold text-white">
                                {team.name || team.team_id}
                              </h2>
                              <p className="mt-1 truncate font-mono text-[11px] text-[#64748b]">
                                {team.team_id}
                              </p>
                            </div>
                            {selected && (
                              <span className="rounded bg-[#38bdf8]/10 px-2 py-1 text-[10px] font-semibold text-[#38bdf8]">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-xs text-[#94a3b8]">
                            {team.project_count ?? 0} projects · {team.member_count ?? 0} members
                          </p>
                        </button>
                      );
                    })}
                  </div>

                <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {teamName}
                      </h2>

                      <p className="mt-1 font-mono text-xs text-[#64748b]">
                        {teamId}
                      </p>
                    </div>

                    <span className="rounded-md bg-[#2563eb]/10 px-2.5 py-1 text-xs font-semibold text-[#38bdf8]">
                      Active workspace
                    </span>
                  </div>

                  <div className="mt-6 border-t border-[#222734] pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Members
                        </div>

                        <div className="mt-1 text-xs text-[#64748b]">
                          {
                            selectedTeamMembers.length
                          }{" "}
                          member
                          {selectedTeamMembers.length ===
                          1
                            ? ""
                            : "s"}
                        </div>
                      </div>

                      <button
                        className="cs-icon-button subtle"
                        onClick={() =>
                          setAddMemberOpen(
                            true
                          )
                        }
                        title="Add member"
                      >
                        <UserPlus
                          size={17}
                        />
                      </button>
                    </div>

                    {selectedTeamMembers.length >
                    0 ? (
                      <div className="mt-4 space-y-2">
                        {selectedTeamMembers.map(
                          (
                            member
                          ) => (
                            <div
                              key={
                                member.id ||
                                member.worker_id
                              }
                              className="flex items-center justify-between rounded-lg border border-[#262c3a] bg-[#11141c] p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar
                                  initials={getInitials(
                                    member.name ||
                                      member.worker_id
                                  )}
                                />

                                <div>
                                  <div className="text-sm font-medium text-white">
                                    {member.name ||
                                      member.worker_id}
                                  </div>

                                  <div className="text-xs text-[#64748b]">
                                    {member.email ||
                                      member.role ||
                                      "Member"}
                                  </div>
                                </div>
                              </div>

                              {member.role && (
                                <span className="rounded bg-[#222734] px-2 py-1 text-xs text-[#94a3b8]">
                                  {
                                    member.role
                                  }
                                </span>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <EmptyState text="No members found." />
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      className="cs-primary-button"
                      onClick={() =>
                        setCreateProjectOpen(
                          true
                        )
                      }
                    >
                      <Plus
                        size={17}
                      />

                      Create project
                    </button>

                    <button
                      className="rounded-lg border border-[#2a3040] px-4 py-2 text-xs font-semibold text-[#cbd5e1] hover:bg-[#222734]"
                      onClick={() =>
                        setAddMemberOpen(
                          true
                        )
                      }
                    >
                      <UserPlus
                        size={16}
                      />

                      Add member
                    </button>
                  </div>
                </div>
                </div>
              )}
            </section>
          )}

          {/* =================================================
              ACTIVITY
          ================================================= */}

          {activeTab ===
            "activity" && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">
                  Live Activity
                  Stream
                </h1>

                <p>
                  Project updates
                  stored in shared
                  memory.
                </p>
              </div>

              {filteredActivities.length ===
              0 ? (
                <EmptyState text="No activity found." />
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map(
                    (
                      activity
                    ) => (
                      <ActivityItem
                        key={
                          activity.id ||
                          activity.entry_id
                        }
                        activity={
                          activity
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              CONFLICTS
          ================================================= */}

          {activeTab ===
            "conflicts" && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">
                  Team Decision
                  Conflicts
                </h1>

                <p>
                  Unresolved
                  conflicting project
                  decisions.
                </p>
              </div>

              {unresolvedConflicts.length ===
              0 ? (
                <div className="rounded-xl border border-[#222734] bg-[#161a24] p-10 text-center">
                  <CheckCircle2
                    size={32}
                    className="mx-auto"
                  />

                  <h3 className="mt-3 font-semibold">
                    No Open
                    Conflicts
                  </h3>
                </div>
              ) : (
                <div className="space-y-5">
                  {unresolvedConflicts.map(
                    (
                      conflict
                    ) => (
                      <div
                        key={
                          conflict.id ||
                          conflict.conflict_id
                        }
                        className="rounded-xl border border-[#ef4444]/30 bg-[#161a24] p-6"
                      >
                        <div className="flex items-center gap-2 font-bold">
                          <AlertTriangle
                            size={18}
                          />

                          {
                            conflict.topic
                          }
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                            <strong>
                              {
                                conflict
                                  .side_a
                                  .worker_id
                              }
                            </strong>

                            <p className="mt-2 text-sm">
                              {
                                conflict
                                  .side_a
                                  .position
                              }
                            </p>
                          </div>

                          <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                            <strong>
                              {
                                conflict
                                  .side_b
                                  .worker_id
                              }
                            </strong>

                            <p className="mt-2 text-sm">
                              {
                                conflict
                                  .side_b
                                  .position
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* ===================================================
          MODALS
      =================================================== */}

      <CreateTeamModal
        isOpen={createTeamOpen}

        user={{
          name: user.name,
          email: user.email,
        }}

        onClose={() =>
          setCreateTeamOpen(false)
        }

        onSuccess={() => {
          setCreateTeamOpen(false);
          void loadDashboard();
        }}
      />

      {hasTeam &&
        teamId && (
          <CreateProjectModal
            isOpen={
              createProjectOpen
            }
            teamId={
              teamId
            }
            user={{
              name:
                user.name,

              email:
                user.email,
            }}
            onClose={() =>
              setCreateProjectOpen(
                false
              )
            }
            onSuccess={() => {
              setCreateProjectOpen(
                false
              );

              /*
               * CreateProjectModal handles navigation.
               * Do not navigate again here.
               */
            }}
          />
        )}

      {hasTeam && (
        <AddMemberModal
          isOpen={addMemberOpen}

          teamId={teamId}

          user={{
            name: user.name,
            email: user.email,
          }}

          onClose={() =>
            setAddMemberOpen(false)
          }

          onSuccess={() => {
            setAddMemberOpen(false);

            void loadDashboard();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function SidebarItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`cs-nav-item ${
        active
          ? "active"
          : ""
      }`}
    >
      {icon}

      <span>
        {label}
      </span>

      {badge && (
        <span className="cs-nav-badge">
          {badge}
        </span>
      )}
    </button>
  );
}

function TeamItem({
  name,
  color,
  onClick,
}: {
  name: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="cs-team-item"
      onClick={
        onClick
      }
    >
      <span
        className={`cs-team-dot ${color}`}
      />

      <span>
        {name}
      </span>
    </button>
  );
}

function SummaryItem({
  icon,
  number,
  label,
  warning = false,
  onClick,
}: {
  icon: React.ReactNode;
  number: string;
  label: string;
  warning?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="cs-summary-item cursor-pointer"
      onClick={
        onClick
      }
    >
      <div
        className={`cs-summary-icon ${
          warning
            ? "warning"
            : ""
        }`}
      >
        {icon}
      </div>

      <div>
        <strong>
          {number}
        </strong>

        <span>
          {label}
        </span>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: DashboardProject;
}) {
  const projectMembers =
    project.members || [];

  const description =
    project.current_state
      ?.goal ||
    "No project goal has been recorded yet.";

  return (
    <Link
      href={`/projects/${project.team_id}/${project.project_id}`}
      className="cs-project-card"
    >
      <div className="cs-project-card-top">
        <div className="cs-project-icon">
          <FolderKanban
            size={21}
          />
        </div>

        <button
          type="button"
          className="cs-icon-button subtle"
          onClick={(
            event
          ) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreVertical
            size={18}
          />
        </button>
      </div>

      <div className="cs-project-title">
        {project.name}
      </div>

      <p className="cs-project-description">
        {description}
      </p>

      <div className="cs-project-team">
        {project.team_id}
      </div>

      <div className="cs-project-footer">
        <div className="cs-avatar-stack">
          {projectMembers
            .slice(
              0,
              4
            )
            .map(
              (
                member
              ) => (
                <Avatar
                  key={
                    member.id ||
                    member.worker_id
                  }
                  initials={getInitials(
                    member.name ||
                      member.worker_id
                  )}
                  small
                />
              )
            )}
        </div>

        <div className="cs-project-status">
          {(project.conflict_count ||
            0) > 0 && (
            <span className="warning">
              <AlertTriangle
                size={14}
              />

              {
                project.conflict_count
              }
            </span>
          )}

          {(project.blocker_count ??
            project
              .current_state
              ?.blockers
              ?.length ??
            0) > 0 && (
            <span>
              {project.blocker_count ??
                project
                  .current_state
                  ?.blockers
                  ?.length ??
                0}{" "}
              blockers
            </span>
          )}

          {project.updated_at && (
            <span>
              <Clock3
                size={14}
              />

              {formatTime(
                project.updated_at
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({
  activity,
}: {
  activity: ActivityEntry;
}) {
  const type =
    activity.entry_type ||
    activity.type ||
    "update";

  return (
    <div className="cs-activity-item">
      <Avatar
        initials={getInitials(
          activity.worker_id
        )}
      />

      <div className="cs-activity-content">
        <div className="cs-activity-top">
          <div>
            <strong>
              {
                activity.worker_id
              }
            </strong>

            <span>
              {" "}
              {getActivityAction(
                activity
              )}
            </span>
          </div>

          <time>
            {formatTime(
              activity.timestamp
            )}
          </time>
        </div>

        <div className="cs-activity-message">
          {
            activity.content
          }
        </div>

        <div className="cs-activity-meta">
          {type ===
          "completed" ? (
            <CheckCircle2
              size={14}
            />
          ) : type ===
            "blocker" ? (
            <AlertTriangle
              size={14}
            />
          ) : (
            <MessageSquareText
              size={14}
            />
          )}

          <span>
            {activity.source ||
              "unknown"}

            {activity.project_name
              ? ` · ${activity.project_name}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function Avatar({
  initials,
  small = false,
}: {
  initials: string;
  small?: boolean;
}) {
  return (
    <div
      className={`cs-avatar ${
        small
          ? "small"
          : ""
      }`}
    >
      {initials}
    </div>
  );
}

function MemberRow({
  member,
  onClick,
}: {
  member: DashboardMember;
  onClick?: () => void;
}) {
  return (
    <button
      className="cs-member-row"
      onClick={
        onClick
      }
    >
      <Avatar
        initials={getInitials(
          member.name ||
            member.worker_id
        )}
      />

      <div>
        <strong>
          {member.name ||
            member.worker_id}
        </strong>

        <span>
          {member.primary_agent ||
            member.tool ||
            member.role ||
            "Member"}
        </span>
      </div>

      <ArrowRight
        size={16}
      />
    </button>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#2a3040] p-6 text-center text-sm opacity-60">
      {text}
    </div>
  );
}
