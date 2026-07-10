import {
  createMockAgentRuns,
  createMockApprovalRequests,
  createMockPersistedProposedChanges,
  createMockProposedChangePlans,
  createMockProvider,
} from "@ai-dev/ai";
import {
  createMockWorkspaceSnapshot,
  type DomainStatus,
  type NavigationSection,
} from "@ai-dev/core";
import {
  createMockRepositories,
  type RepositorySummary,
} from "@ai-dev/indexing";
import type { IconName } from "@ai-dev/ui";

export const workspace = createMockWorkspaceSnapshot();
export const provider = createMockProvider();
export const mockRepositories = createMockRepositories();
export const emptyRepository: RepositorySummary = {
  id: "no-repository",
  name: "No repository selected",
  path: "Choose a local repository to begin",
  isGitRepository: false,
  branch: "Not available yet",
  status: "not_indexed",
  openChanges: 0,
  lastIndexedAt: null,
};
export const agentRuns = createMockAgentRuns();
export const proposedChangePlans = createMockProposedChangePlans();
export const mockApprovalRequests = createMockApprovalRequests();
export const mockProposedChanges = createMockPersistedProposedChanges();

export const dashboardActivity = [
  {
    badge: "ready",
    detail: "Source tree, docs map, and Git status available.",
    status: "ready" as DomainStatus,
    time: "2m ago",
    title: "Intelligence Warmed",
  },
  {
    badge: "pending",
    detail: "Provider abstraction spike produced a patch plan.",
    status: "pending_approval" as DomainStatus,
    time: "5m ago",
    title: "Agent run awaiting approval",
  },
  {
    badge: "completed",
    detail: "Shell wired through package contracts successfully.",
    status: "completed" as DomainStatus,
    time: "12m ago",
    title: "Mock provider connected",
  },
];

export const quickStartItems = [
  {
    description: "Add a repository to begin",
    icon: "repository" as IconName,
    tone: "agent",
    title: "Import repository",
  },
  {
    description: "Execute a task with AI assistance",
    icon: "play" as IconName,
    tone: "context",
    title: "Run agent",
  },
  {
    description: "Review and approve pending changes",
    icon: "approval" as IconName,
    tone: "agent",
    title: "Review approvals",
  },
];

export const changeFeatureBlocks = [
  {
    description:
      "Current branch, Git cleanliness, and repository readiness are checked before review.",
    icon: "repository" as IconName,
    title: "Repository status",
  },
  {
    description:
      "Generated patches will be grouped into readable diffs with file-level context.",
    icon: "changes" as IconName,
    title: "Generated diffs",
  },
  {
    description:
      "Release checks summarize risk, approvals, and follow-up work before merge.",
    icon: "approval" as IconName,
    title: "Release readiness",
  },
];

export const settingsRows = [
  {
    action: "Manage",
    description:
      "Provider adapters route model calls through approved local contracts.",
    icon: "agent" as IconName,
    title: "Provider adapters",
  },
  {
    action: "Inspect",
    description: "Workspace data stays local in SQLite-backed desktop storage.",
    icon: "database" as IconName,
    title: "Local storage",
  },
  {
    action: "Reindex",
    description:
      "Repository facts include file trees, Git state, and documentation hints.",
    icon: "index" as IconName,
    title: "Indexing policy",
  },
  {
    action: "Review",
    description:
      "Human approval remains required before agent-generated changes proceed.",
    icon: "approval" as IconName,
    title: "Approval defaults",
  },
];

export const maintenanceActions = [
  {
    description: "Refresh file facts and Git metadata for the active repository.",
    icon: "index" as IconName,
    title: "Reindex repositories",
  },
  {
    description: "Remove temporary derived state without deleting workspace data.",
    icon: "database" as IconName,
    title: "Clear caches",
  },
  {
    description: "Return local workspace preferences to their initial state.",
    icon: "settings" as IconName,
    title: "Reset workspace",
  },
];

export const navigationIcons: Record<NavigationSection, IconName> = {
  overview: "grid",
  repositories: "repository",
  agents: "play",
  approvals: "approval",
  changes: "changes",
  settings: "settings",
};

export const sectionEyebrows: Record<NavigationSection, string> = {
  overview: "Workspace overview",
  repositories: "Repository intelligence",
  agents: "Agent runs",
  approvals: "Human approval",
  changes: "Workspace changes",
  settings: "Workspace settings",
};

export const statusTone: Record<
  DomainStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  ready: "success",
  pending_approval: "warning",
  running: "neutral",
  paused: "warning",
  completed: "success",
  failed: "danger",
};
