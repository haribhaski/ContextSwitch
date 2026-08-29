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
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";


type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};


type DashboardShellProps = {
  user: User;
};


type Project = {
  id: string;
  name: string;
  description: string;
  team: string;
  members: string[];
  updated: string;
  conflicts: number;
  blockers: number;
};


const projects: Project[] = [
  {
    id: "contextswitch",
    name: "ContextSwitch",
    description:
      "Shared memory layer for teams working across AI coding agents.",
    team: "Team Alpha",
    members: ["HB", "JK", "DS", "JG"],
    updated: "8 min ago",
    conflicts: 1,
    blockers: 1,
  },
  {
    id: "medical-ai",
    name: "Medical AI",
    description:
      "Retinal vessel segmentation experiments and evaluation.",
    team: "Research Team",
    members: ["HB", "DS", "JK"],
    updated: "2 hr ago",
    conflicts: 0,
    blockers: 0,
  },
  {
    id: "memory-llm",
    name: "Memory LLM",
    description:
      "Long-context memory architecture and retrieval experiments.",
    team: "Final Year Project",
    members: ["HB", "JK", "JG", "DS"],
    updated: "Yesterday",
    conflicts: 0,
    blockers: 2,
  },
];


const activities = [
  {
    id: 1,
    user: "Jeevan",
    initials: "JK",
    action: "recorded a decision",
    content:
      "Use Pinecone because retrieval quality is better",
    source: "Claude",
    time: "8 min ago",
    type: "decision",
  },
  {
    id: 2,
    user: "Hariharan",
    initials: "HB",
    action: "recorded a decision",
    content:
      "Use ChromaDB because Pinecone is too expensive",
    source: "Cursor",
    time: "12 min ago",
    type: "decision",
  },
  {
    id: 3,
    user: "Dhanya",
    initials: "DS",
    action: "completed",
    content:
      "Authentication flow implementation",
    source: "Gemini",
    time: "1 hr ago",
    type: "completed",
  },
  {
    id: 4,
    user: "Jagan",
    initials: "JG",
    action: "reported a blocker",
    content:
      "Reranking latency is still above target",
    source: "Antigravity",
    time: "3 hr ago",
    type: "blocker",
  },
];


export default function DashboardShell({
  user,
}: DashboardShellProps) {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [searchValue, setSearchValue] =
    useState("");


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
      (!stored && prefersDark);

    setDark(shouldUseDark);

    document.documentElement.classList.toggle(
      "dark",
      shouldUseDark
    );
  }, []);


  function toggleTheme() {
    const next = !dark;

    setDark(next);

    document.documentElement.classList.toggle(
      "dark",
      next
    );

    localStorage.setItem(
      "contextswitch-theme",
      next ? "dark" : "light"
    );
  }


  return (
    <div className="cs-app">

      {/* ========================================= */}
      {/* SIDEBAR */}
      {/* ========================================= */}

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
              setSidebarOpen(false)
            }
          >
            <X size={20} />
          </button>

        </div>


        <nav className="cs-nav">

          <SidebarItem
            icon={<Home size={19} />}
            label="Home"
            active
          />

          <SidebarItem
            icon={
              <FolderKanban size={19} />
            }
            label="Projects"
          />

          <SidebarItem
            icon={<Users size={19} />}
            label="Teams"
          />

          <SidebarItem
            icon={<Activity size={19} />}
            label="Activity"
          />

          <SidebarItem
            icon={
              <AlertTriangle size={19} />
            }
            label="Conflicts"
            badge="1"
          />

        </nav>


        <div className="cs-sidebar-section">

          <div className="cs-sidebar-label">
            Your teams
          </div>

          <TeamItem
            name="Team Alpha"
            color="blue"
          />

          <TeamItem
            name="Final Year Project"
            color="green"
          />

          <TeamItem
            name="Research Team"
            color="orange"
          />

          <button className="cs-new-team">
            <Plus size={17} />
            Create team
          </button>

        </div>


        <div className="cs-sidebar-bottom">

          <SidebarItem
            icon={<CircleHelp size={18} />}
            label="Help"
          />

          <SidebarItem
            icon={<Settings size={18} />}
            label="Settings"
          />

        </div>

      </aside>


      {sidebarOpen && (
        <button
          className="cs-mobile-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}


      {/* ========================================= */}
      {/* MAIN */}
      {/* ========================================= */}

      <div className="cs-main">

        {/* TOP BAR */}

        <header className="cs-topbar">

          <div className="cs-topbar-left">

            <button
              className="cs-menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
            >
              <Menu size={21} />
            </button>


            <div className="cs-search">

              <Search size={19} />

              <input
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                placeholder="Search project memory"
              />

              <kbd>
                ⌘ K
              </kbd>

            </div>

          </div>


          <div className="cs-top-actions">

            {/* DARK MODE */}

            <button
              onClick={toggleTheme}
              className="cs-theme-toggle"
              aria-label="Toggle dark mode"
            >

              <span
                className={
                  dark
                    ? ""
                    : "active"
                }
              >
                ☀
              </span>

              <span
                className={
                  dark
                    ? "active"
                    : ""
                }
              >
                ☾
              </span>

            </button>


            <button className="cs-icon-button">
              <Bell size={20} />

              <span className="cs-notification-dot" />
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
                    src={user.image}
                    alt={
                      user.name ??
                      "User"
                    }
                    width={34}
                    height={34}
                    className="cs-profile-image"
                  />
                ) : (
                  <div className="cs-profile-fallback">
                    {user.name
                      ?.charAt(0)
                      .toUpperCase() ?? "U"}
                  </div>
                )}

                <ChevronDown size={15} />

              </button>


              {profileOpen && (

                <div className="cs-profile-menu">

                  <div className="cs-profile-info">

                    {user.image && (
                      <Image
                        src={user.image}
                        alt={
                          user.name ??
                          "User"
                        }
                        width={42}
                        height={42}
                        className="cs-profile-image"
                      />
                    )}

                    <div>
                      <div className="cs-profile-name">
                        {user.name}
                      </div>

                      <div className="cs-profile-email">
                        {user.email}
                      </div>
                    </div>

                  </div>


                  <div className="cs-menu-divider" />


                  <button className="cs-profile-menu-item">
                    <Settings size={17} />
                    Settings
                  </button>


                  <button
                    className="cs-profile-menu-item"
                    onClick={() =>
                      signOut({
                        callbackUrl:
                          "/login",
                      })
                    }
                  >
                    <LogOut size={17} />
                    Sign out
                  </button>

                </div>

              )}

            </div>

          </div>

        </header>


        {/* ========================================= */}
        {/* CONTENT */}
        {/* ========================================= */}

        <main className="cs-content">

          {/* HERO */}

          <section className="cs-welcome">

            <div>

              <p className="cs-eyebrow">
                Workspace
              </p>

              <h1>
                Good evening
                {user.name
                  ? `, ${
                      user.name.split(
                        " "
                      )[0]
                    }`
                  : ""}
              </h1>

              <p>
                Here&apos;s what your
                teams and AI agents have
                been working on.
              </p>

            </div>


            <button className="cs-primary-button">
              <Plus size={18} />
              New project
            </button>

          </section>


          {/* SUMMARY STRIP */}

          <section className="cs-summary-strip">

            <SummaryItem
              icon={
                <FolderKanban
                  size={20}
                />
              }
              number="3"
              label="Active projects"
            />

            <SummaryItem
              icon={
                <Users size={20} />
              }
              number="8"
              label="Collaborators"
            />

            <SummaryItem
              icon={
                <AlertTriangle
                  size={20}
                />
              }
              number="1"
              label="Needs attention"
              warning
            />

            <SummaryItem
              icon={
                <CheckCircle2
                  size={20}
                />
              }
              number="12"
              label="Updates this week"
            />

          </section>


          {/* PROJECT HEADER */}

          <section className="cs-section">

            <div className="cs-section-heading">

              <div>
                <h2>
                  Your projects
                </h2>

                <p>
                  Shared context across
                  your teams.
                </p>
              </div>

              <button className="cs-text-button">
                View all
                <ArrowRight size={16} />
              </button>

            </div>


            <div className="cs-project-grid">

              {projects.map(
                (project) => (

                  <ProjectCard
                    key={project.id}
                    project={project}
                  />

                )
              )}

            </div>

          </section>


          {/* LOWER GRID */}

          <section className="cs-dashboard-grid">

            {/* ACTIVITY */}

            <div className="cs-panel cs-activity-panel">

              <div className="cs-panel-header">

                <div>
                  <h2>
                    Recent activity
                  </h2>

                  <p>
                    Latest updates across
                    your projects
                  </p>
                </div>

                <button className="cs-icon-button subtle">
                  <MoreVertical
                    size={19}
                  />
                </button>

              </div>


              <div className="cs-activity-list">

                {activities.map(
                  (activity) => (

                    <ActivityItem
                      key={activity.id}
                      {...activity}
                    />

                  )
                )}

              </div>


              <button className="cs-panel-footer-button">
                View all activity
              </button>

            </div>


            {/* RIGHT COLUMN */}

            <div className="cs-right-column">

              {/* CONFLICT */}

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
                      Decision conflict
                    </h3>

                  </div>

                </div>


                <div className="cs-conflict-body">

                  <div className="cs-conflict-project">
                    ContextSwitch
                  </div>

                  <h4>
                    Vector Database
                    Selection
                  </h4>

                  <p>
                    Hariharan and Jeevan
                    recorded incompatible
                    decisions.
                  </p>


                  <div className="cs-conflict-sides">

                    <div>
                      <Avatar
                        initials="HB"
                      />

                      <span>
                        ChromaDB
                      </span>
                    </div>

                    <span className="cs-vs">
                      vs
                    </span>

                    <div>
                      <Avatar
                        initials="JK"
                      />

                      <span>
                        Pinecone
                      </span>
                    </div>

                  </div>


                  <button className="cs-resolve-button">
                    Review conflict
                  </button>

                </div>

              </div>


              {/* TEAM */}

              <div className="cs-panel">

                <div className="cs-panel-header compact">

                  <div>
                    <h2>
                      Team Alpha
                    </h2>

                    <p>
                      4 members
                    </p>
                  </div>

                  <button className="cs-icon-button subtle">
                    <Plus size={18} />
                  </button>

                </div>


                <div className="cs-team-list">

                  <MemberRow
                    initials="HB"
                    name="Hariharan"
                    tool="Cursor"
                  />

                  <MemberRow
                    initials="JK"
                    name="Jeevan"
                    tool="Claude"
                  />

                  <MemberRow
                    initials="DS"
                    name="Dhanya"
                    tool="Gemini"
                  />

                  <MemberRow
                    initials="JG"
                    name="Jagan"
                    tool="Antigravity"
                  />

                </div>

              </div>

            </div>

          </section>

        </main>

      </div>

    </div>
  );
}


function SidebarItem({
  icon,
  label,
  active = false,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <button
      className={`cs-nav-item ${
        active ? "active" : ""
      }`}
    >
      {icon}

      <span>{label}</span>

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
}: {
  name: string;
  color: string;
}) {
  return (
    <button className="cs-team-item">

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
}: {
  icon: React.ReactNode;
  number: string;
  label: string;
  warning?: boolean;
}) {
  return (
    <div className="cs-summary-item">

      <div
        className={`cs-summary-icon ${
          warning ? "warning" : ""
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
  project: Project;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="cs-project-card"
    >

      <div className="cs-project-card-top">

        <div className="cs-project-icon">
          <FolderKanban
            size={21}
          />
        </div>

        <button
          className="cs-icon-button subtle"
          onClick={(event) =>
            event.preventDefault()
          }
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
        {project.description}
      </p>


      <div className="cs-project-team">
        {project.team}
      </div>


      <div className="cs-project-footer">

        <div className="cs-avatar-stack">

          {project.members
            .slice(0, 4)
            .map(
              (member) => (
                <Avatar
                  key={member}
                  initials={member}
                  small
                />
              )
            )}

        </div>


        <div className="cs-project-status">

          {project.conflicts > 0 && (
            <span className="warning">
              <AlertTriangle
                size={14}
              />
              {project.conflicts}
            </span>
          )}

          <span>
            <Clock3 size={14} />
            {project.updated}
          </span>

        </div>

      </div>

    </Link>
  );
}


function ActivityItem({
  user,
  initials,
  action,
  content,
  source,
  time,
  type,
}: {
  user: string;
  initials: string;
  action: string;
  content: string;
  source: string;
  time: string;
  type: string;
}) {
  return (
    <div className="cs-activity-item">

      <Avatar
        initials={initials}
      />

      <div className="cs-activity-content">

        <div className="cs-activity-top">

          <div>
            <strong>
              {user}
            </strong>

            <span>
              {" "}
              {action}
            </span>
          </div>

          <time>
            {time}
          </time>

        </div>


        <div className="cs-activity-message">
          {content}
        </div>


        <div className="cs-activity-meta">

          {type === "completed" ? (
            <CheckCircle2
              size={14}
            />
          ) : type === "blocker" ? (
            <AlertTriangle
              size={14}
            />
          ) : (
            <MessageSquareText
              size={14}
            />
          )}

          <span>
            {source}
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
        small ? "small" : ""
      }`}
    >
      {initials}
    </div>
  );
}


function MemberRow({
  initials,
  name,
  tool,
}: {
  initials: string;
  name: string;
  tool: string;
}) {
  return (
    <button className="cs-member-row">

      <Avatar
        initials={initials}
      />

      <div>

        <strong>
          {name}
        </strong>

        <span>
          {tool}
        </span>

      </div>

      <ArrowRight
        size={16}
      />

    </button>
  );
}