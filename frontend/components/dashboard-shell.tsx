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
  UserPlus,
  Users,
  X,
} from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import CreateProjectModal from "@/components/create-project-modal";
import AddMemberModal from "@/components/add-member-modal";

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

type Member = {
  initials: string;
  name: string;
  tool: string;
};

const initialProjects: Project[] = [
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
      "Retinal vessel segmentation experiments and clinical evaluation.",
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
      "Long-context memory architecture and retrieval compression experiments.",
    team: "Final Year Project",
    members: ["HB", "JK", "JG", "DS"],
    updated: "Yesterday",
    conflicts: 0,
    blockers: 2,
  },
];

const initialActivities = [
  {
    id: 1,
    user: "Jeevan",
    initials: "JK",
    action: "recorded a decision",
    content: "Use Pinecone because retrieval quality is better for long docs",
    source: "Claude",
    time: "8 min ago",
    type: "decision",
  },
  {
    id: 2,
    user: "Hariharan",
    initials: "HB",
    action: "recorded a decision",
    content: "Use ChromaDB to lower operational cost and keep setup local",
    source: "Cursor",
    time: "12 min ago",
    type: "decision",
  },
  {
    id: 3,
    user: "Dhanya",
    initials: "DS",
    action: "completed",
    content: "Authentication flow & token verification implementation",
    source: "Gemini",
    time: "1 hr ago",
    type: "completed",
  },
  {
    id: 4,
    user: "Jagan",
    initials: "JG",
    action: "reported a blocker",
    content: "Reranking latency is currently above 450ms SLA target",
    source: "Antigravity",
    time: "3 hr ago",
    type: "blocker",
  },
];

const initialMembers: Member[] = [
  { initials: "HB", name: "Hariharan", tool: "Cursor" },
  { initials: "JK", name: "Jeevan", tool: "Claude" },
  { initials: "DS", name: "Dhanya", tool: "Gemini" },
  { initials: "JG", name: "Jagan", tool: "Antigravity" },
];

export default function DashboardShell({ user }: DashboardShellProps) {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    "home" | "projects" | "teams" | "activity" | "conflicts"
  >("home");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // Dynamic Data
  const [projectList, setProjectList] = useState<Project[]>(initialProjects);
  const [activityList, setActivityList] = useState(initialActivities);
  const [memberList, setMemberList] = useState<Member[]>(initialMembers);

  useEffect(() => {
    const stored = localStorage.getItem("contextswitch-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = stored === "dark" || (!stored && prefersDark);
    setDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("contextswitch-theme", next ? "dark" : "light");
  }

  function handleAddMember(name: string, tool: string) {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    setMemberList((prev) => [...prev, { initials, name, tool }]);
    setActivityList((prev) => [
      {
        id: Date.now(),
        user: name,
        initials,
        action: "joined the team",
        content: `Joined Team Alpha using ${tool}`,
        source: tool,
        time: "Just now",
        type: "decision",
      },
      ...prev,
    ]);
  }

  // Filtered lists based on Search bar
  const filteredProjects = projectList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.description.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.team.toLowerCase().includes(searchValue.toLowerCase())
  );

  const filteredActivities = activityList.filter(
    (a) =>
      a.user.toLowerCase().includes(searchValue.toLowerCase()) ||
      a.content.toLowerCase().includes(searchValue.toLowerCase()) ||
      a.source.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="cs-app">
      {/* SIDEBAR */}
      <aside className={`cs-sidebar ${sidebarOpen ? "cs-sidebar-open" : ""}`}>
        <div className="cs-sidebar-header">
          <Link href="/dashboard" className="cs-brand">
            <div className="cs-logo">C</div>
            <span>ContextSwitch</span>
          </Link>

          <button
            className="cs-mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="cs-nav">
          <SidebarItem
            icon={<Home size={19} />}
            label="Home"
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
          />

          <SidebarItem
            icon={<FolderKanban size={19} />}
            label="Projects"
            active={activeTab === "projects"}
            onClick={() => setActiveTab("projects")}
          />

          <SidebarItem
            icon={<Users size={19} />}
            label="Teams"
            active={activeTab === "teams"}
            onClick={() => setActiveTab("teams")}
          />

          <SidebarItem
            icon={<Activity size={19} />}
            label="Activity"
            active={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
          />

          <SidebarItem
            icon={<AlertTriangle size={19} />}
            label="Conflicts"
            badge="1"
            active={activeTab === "conflicts"}
            onClick={() => setActiveTab("conflicts")}
          />
        </nav>

        <div className="cs-sidebar-section">
          <div className="cs-sidebar-label">Your teams</div>

          <TeamItem
            name="Team Alpha"
            color="blue"
            onClick={() => setActiveTab("teams")}
          />
          <TeamItem
            name="Final Year Project"
            color="green"
            onClick={() => setActiveTab("teams")}
          />
          <TeamItem
            name="Research Team"
            color="orange"
            onClick={() => setActiveTab("teams")}
          />

          <button
            className="cs-new-team"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={17} />
            Create team
          </button>
        </div>

        <div className="cs-sidebar-bottom">
          <SidebarItem
            icon={<CircleHelp size={18} />}
            label="Help"
            onClick={() =>
              alert("ContextSwitch AI Team Shared Memory. Need help? Contact team.")
            }
          />
          <SidebarItem
            icon={<Settings size={18} />}
            label="Settings"
            onClick={() => setProfileOpen(true)}
          />
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="cs-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="cs-main">
        {/* TOP BAR */}
        <header className="cs-topbar">
          <div className="cs-topbar-left">
            <button
              className="cs-menu-button"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="cs-search">
              <Search size={19} />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search project memory..."
              />
              <kbd>⌘ K</kbd>
            </div>
          </div>

          <div className="cs-top-actions">
            <button onClick={toggleTheme} className="cs-theme-toggle">
              <span className={dark ? "cs-[#eab308]" : ""}>
                {dark ? "☀" : "☾"}
              </span>
            </button>

            <button className="cs-icon-button">
              <Bell size={20} />
              <span className="cs-notification-dot" />
            </button>

            <div className="cs-profile-wrapper">
              <button
                className="cs-profile"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? "User"}
                    width={34}
                    height={34}
                    className="cs-profile-image"
                  />
                ) : (
                  <div className="cs-profile-fallback">
                    {user.name?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                )}
                <ChevronDown size={15} />
              </button>

              {profileOpen && (
                <div className="cs-profile-menu">
                  <div className="cs-profile-info">
                    <div>
                      <div className="cs-profile-name">{user.name}</div>
                      <div className="cs-profile-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="cs-menu-divider" />
                  <button
                    className="cs-profile-menu-item"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut size={17} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DYNAMIC SUBVIEWS */}
        <main className="cs-content">
          {/* VIEW: HOME */}
          {activeTab === "home" && (
            <>
              <section className="cs-welcome">
                <div>
                  <p className="cs-eyebrow">Workspace</p>
                  <h1>
                    Good evening
                    {user.name ? `, ${user.name.split(" ")[0]}` : ""}
                  </h1>
                  <p>
                    Here&apos;s what your teams and AI agents have been working
                    on.
                  </p>
                </div>

                <button
                  className="cs-primary-button"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus size={18} />
                  New project
                </button>
              </section>

              <section className="cs-summary-strip">
                <SummaryItem
                  icon={<FolderKanban size={20} />}
                  number={filteredProjects.length.toString()}
                  label="Active projects"
                  onClick={() => setActiveTab("projects")}
                />
                <SummaryItem
                  icon={<Users size={20} />}
                  number={memberList.length.toString()}
                  label="Collaborators"
                  onClick={() => setActiveTab("teams")}
                />
                <SummaryItem
                  icon={<AlertTriangle size={20} />}
                  number="1"
                  label="Needs attention"
                  warning
                  onClick={() => setActiveTab("conflicts")}
                />
                <SummaryItem
                  icon={<CheckCircle2 size={20} />}
                  number="12"
                  label="Updates this week"
                  onClick={() => setActiveTab("activity")}
                />
              </section>

              <section className="cs-section">
                <div className="cs-section-heading">
                  <div>
                    <h2>Your projects</h2>
                    <p>Shared context across your teams.</p>
                  </div>
                  <button
                    className="cs-text-button"
                    onClick={() => setActiveTab("projects")}
                  >
                    View all <ArrowRight size={16} />
                  </button>
                </div>

                <div className="cs-project-grid">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </section>

              <section className="cs-dashboard-grid">
                {/* Recent Activity */}
                <div className="cs-panel cs-activity-panel">
                  <div className="cs-panel-header">
                    <div>
                      <h2>Recent activity</h2>
                      <p>Latest updates across your projects</p>
                    </div>
                  </div>

                  <div className="cs-activity-list">
                    {filteredActivities.slice(0, 4).map((activity) => (
                      <ActivityItem key={activity.id} {...activity} />
                    ))}
                  </div>

                  <button
                    className="cs-panel-footer-button"
                    onClick={() => setActiveTab("activity")}
                  >
                    View all activity
                  </button>
                </div>

                {/* Right Column: Conflict & Team */}
                <div className="cs-right-column">
                  <div className="cs-panel">
                    <div className="cs-conflict-heading">
                      <div className="cs-warning-icon">
                        <AlertTriangle size={19} />
                      </div>
                      <div>
                        <span>Needs attention</span>
                        <h3>Decision conflict</h3>
                      </div>
                    </div>

                    <div className="cs-conflict-body">
                      <div className="cs-conflict-project">ContextSwitch</div>
                      <h4>Vector Database Selection</h4>
                      <p>
                        Hariharan and Jeevan recorded incompatible decisions.
                      </p>

                      <div className="cs-conflict-sides">
                        <div>
                          <Avatar initials="HB" />
                          <span>ChromaDB</span>
                        </div>
                        <span className="cs-vs">vs</span>
                        <div>
                          <Avatar initials="JK" />
                          <span>Pinecone</span>
                        </div>
                      </div>

                      <Link
                        href="/projects/team-alpha/contextswitch"
                        className="cs-resolve-button block text-center"
                      >
                        Review conflict →
                      </Link>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="cs-panel">
                    <div className="cs-panel-header compact">
                      <div>
                        <h2>Team Alpha</h2>
                        <p>{memberList.length} members</p>
                      </div>

                      <button
                        className="cs-icon-button subtle"
                        onClick={() => setAddMemberModalOpen(true)}
                        title="Add Team Member"
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    <div className="cs-team-list">
                      {memberList.map((m, idx) => (
                        <MemberRow
                          key={idx}
                          initials={m.initials}
                          name={m.name}
                          tool={m.tool}
                          onClick={() => setActiveTab("teams")}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* VIEW: PROJECTS */}
          {activeTab === "projects" && (
            <section className="cs-section">
              <div className="cs-section-heading">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    All Active Projects ({filteredProjects.length})
                  </h1>
                  <p className="text-sm text-[#94a3b8]">
                    Shared project memory & AI decision tracking across teams.
                  </p>
                </div>
                <button
                  className="cs-primary-button"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus size={18} />
                  New project
                </button>
              </div>

              <div className="cs-project-grid mt-6">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}

          {/* VIEW: TEAMS */}
          {activeTab === "teams" && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Team Workspaces & Teammates
                  </h1>
                  <p className="text-sm text-[#94a3b8]">
                    Manage team members, roles, and connected AI coding tools.
                  </p>
                </div>
                <button
                  className="cs-primary-button"
                  onClick={() => setAddMemberModalOpen(true)}
                >
                  <UserPlus size={18} />
                  Add Team Member
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      Team Alpha (Active Workspace)
                    </h2>
                    <span className="rounded bg-[#2563eb]/20 px-2.5 py-1 text-xs font-semibold text-[#38bdf8]">
                      {memberList.length} Members
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {memberList.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-[#262c3a] bg-[#11141c] p-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar initials={m.initials} />
                          <div>
                            <div className="font-medium text-white">
                              {m.name}
                            </div>
                            <div className="text-xs text-[#64748b]">
                              Primary Agent: {m.tool}
                            </div>
                          </div>
                        </div>
                        <span className="rounded bg-[#1e293b] px-2 py-0.5 text-xs text-[#94a3b8]">
                          Member
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                    <h2 className="text-lg font-semibold text-white">
                      Research Team
                    </h2>
                    <p className="mt-1 text-xs text-[#64748b]">
                      Connected to Retinal vessel segmentation project
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Avatar initials="HB" />
                      <Avatar initials="DS" />
                      <Avatar initials="JK" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#222734] bg-[#161a24] p-6">
                    <h2 className="text-lg font-semibold text-white">
                      Final Year Project
                    </h2>
                    <p className="mt-1 text-xs text-[#64748b]">
                      Connected to Long-context Memory LLM experiments
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Avatar initials="HB" />
                      <Avatar initials="JK" />
                      <Avatar initials="JG" />
                      <Avatar initials="DS" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: ACTIVITY */}
          {activeTab === "activity" && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Live Activity Stream ({filteredActivities.length})
                </h1>
                <p className="text-sm text-[#94a3b8]">
                  Real-time entries logged across Cursor, Claude, Antigravity, and Gemini.
                </p>
              </div>

              <div className="space-y-3">
                {filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 rounded-xl border border-[#222734] bg-[#161a24] p-5"
                  >
                    <Avatar initials={activity.initials} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-white">
                          <strong className="text-[#38bdf8]">
                            {activity.user}
                          </strong>{" "}
                          {activity.action}
                        </div>
                        <span className="text-xs text-[#64748b]">
                          {activity.time}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#cbd5e1]">
                        {activity.content}
                      </p>
                      <div className="mt-2 text-xs font-mono text-[#94a3b8]">
                        Source: {activity.source}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* VIEW: CONFLICTS */}
          {activeTab === "conflicts" && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Team Decision Conflicts
                </h1>
                <p className="text-sm text-[#94a3b8]">
                  Gemini reconciliation highlights incompatible decisions recorded across team members.
                </p>
              </div>

              <div className="rounded-xl border border-[#ef4444]/30 bg-[#161a24] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-base font-bold text-[#f87171]">
                    <AlertTriangle className="h-5 w-5" />
                    Vector Database Selection Conflict
                  </div>
                  <span className="rounded bg-[#ef4444]/10 px-2.5 py-1 text-xs font-semibold text-[#ef4444]">
                    UNRESOLVED
                  </span>
                </div>

                <p className="mt-2 text-xs text-[#94a3b8]">
                  Project: ContextSwitch (Team Alpha)
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                    <div className="text-xs font-semibold text-[#38bdf8]">
                      Side A: Hariharan (Cursor)
                    </div>
                    <p className="mt-2 text-sm text-[#cbd5e1]">
                      Use ChromaDB to lower operational cost and keep setup simple locally.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#262c3a] bg-[#11141c] p-4">
                    <div className="text-xs font-semibold text-[#eab308]">
                      Side B: Jeevan (Claude)
                    </div>
                    <p className="mt-2 text-sm text-[#cbd5e1]">
                      Use Pinecone because vector indexing quality is higher for long docs.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Link
                    href="/projects/team-alpha/contextswitch"
                    className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                  >
                    Open Project & Resolve Conflict →
                  </Link>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODALS */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setProjectList((prev) => [
            {
              id: "new-project",
              name: "New Shared Project",
              description: "Newly created agentic project workspace.",
              team: "Team Alpha",
              members: ["HB", "JK", "DS", "JG"],
              updated: "Just now",
              conflicts: 0,
              blockers: 0,
            },
            ...prev,
          ]);
        }}
      />

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        onAddMember={handleAddMember}
      />
    </div>
  );
}

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
      onClick={onClick}
      className={`cs-nav-item ${active ? "active" : ""}`}
    >
      {icon}
      <span>{label}</span>
      {badge && <span className="cs-nav-badge">{badge}</span>}
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
    <button className="cs-team-item" onClick={onClick}>
      <span className={`cs-team-dot ${color}`} />
      <span>{name}</span>
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
    <div className="cs-summary-item cursor-pointer" onClick={onClick}>
      <div className={`cs-summary-icon ${warning ? "warning" : ""}`}>
        {icon}
      </div>
      <div>
        <strong>{number}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const teamSlug = project.team.toLowerCase().replace(/\s+/g, "-");
  return (
    <Link
      href={`/projects/${teamSlug}/${project.id}`}
      className="cs-project-card"
    >
      <div className="cs-project-card-top">
        <div className="cs-project-icon">
          <FolderKanban size={21} />
        </div>
        <button
          className="cs-icon-button subtle"
          onClick={(event) => event.preventDefault()}
        >
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="cs-project-title">{project.name}</div>
      <p className="cs-project-description">{project.description}</p>
      <div className="cs-project-team">{project.team}</div>

      <div className="cs-project-footer">
        <div className="cs-avatar-stack">
          {project.members.slice(0, 4).map((member) => (
            <Avatar key={member} initials={member} small />
          ))}
        </div>

        <div className="cs-project-status">
          {project.conflicts > 0 && (
            <span className="warning">
              <AlertTriangle size={14} />
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
      <Avatar initials={initials} />
      <div className="cs-activity-content">
        <div className="cs-activity-top">
          <div>
            <strong>{user}</strong>
            <span> {action}</span>
          </div>
          <time>{time}</time>
        </div>

        <div className="cs-activity-message">{content}</div>

        <div className="cs-activity-meta">
          {type === "completed" ? (
            <CheckCircle2 size={14} />
          ) : type === "blocker" ? (
            <AlertTriangle size={14} />
          ) : (
            <MessageSquareText size={14} />
          )}
          <span>{source}</span>
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
    <div className={`cs-avatar ${small ? "small" : ""}`}>{initials}</div>
  );
}

function MemberRow({
  initials,
  name,
  tool,
  onClick,
}: {
  initials: string;
  name: string;
  tool: string;
  onClick?: () => void;
}) {
  return (
    <button className="cs-member-row" onClick={onClick}>
      <Avatar initials={initials} />
      <div>
        <strong>{name}</strong>
        <span>{tool}</span>
      </div>
      <ArrowRight size={16} />
    </button>
  );
}