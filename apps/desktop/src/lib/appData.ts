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
import type { RepositorySummary } from "@ai-dev/indexing";
import type { IconName } from "@ai-dev/ui";

export const workspace = createMockWorkspaceSnapshot();
export const provider = createMockProvider();
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
  review: "approval",
  repositories: "repository",
  "working-tree": "changes",
  settings: "settings",
};

export const sectionEyebrows: Record<NavigationSection, string> = {
  review: "Human approval",
  repositories: "Workspace repositories",
  "working-tree": "Workspace changes",
  settings: "Workspace settings",
};

export const sectionHeaders: Record<
  NavigationSection,
  { title: string; description: string }
> = {
  repositories: {
    // "Repository Intelligence" is demoted out of the headline -- it names a
    // file-tree summary with extension counts, not the section. It survives as
    // a sub-panel label within this section.
    title: "Repositories",
    description:
      "Choose a repository and understand it through indexed facts, project structure, and safe local context.",
  },
  review: {
    title: "Review",
    // Approve vs apply, stated where the section names itself. Approval is a
    // recorded decision; only an explicit apply touches the working tree.
    description:
      "Approving records your decision. It does not touch your files.",
  },
  "working-tree": {
    title: "Working tree",
    description:
      "Inspect read-only Git status and file diffs without mutating repository state.",
  },
  settings: {
    title: "Workspace Settings",
    description:
      "Manage local workspace controls and confirmation-gated maintenance boundaries.",
  },
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
