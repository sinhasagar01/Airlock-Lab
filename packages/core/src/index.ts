export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string;
  repositories: number;
  activeRuns: number;
  pendingApprovals: number;
  lastIndexedAt: string | null;
};

export type DomainStatus =
  | "draft"
  | "ready"
  | "pending_approval"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type GitChangeKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted"
  | "unknown";

export type GitChangeStage =
  | "staged"
  | "unstaged"
  | "both"
  | "untracked"
  | "unknown";

export type GitChangedFile = {
  path: string;
  oldPath?: string;
  kind: GitChangeKind;
  stage: GitChangeStage;
  statusCode: string;
};

export type GitStatusSummary = {
  repositoryId: string;
  repositoryPath: string;
  branch?: string;
  headSha?: string;
  isGitRepository: boolean;
  isClean: boolean;
  changedFileCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  files: GitChangedFile[];
  refreshedAt: string;
};

export type GitDiffKind =
  | "unstaged"
  | "staged"
  | "combined"
  | "untracked"
  | "binary"
  | "unavailable";

export type GitDiffLineType =
  | "context"
  | "added"
  | "removed"
  | "hunk"
  | "metadata";

export type GitDiffLine = {
  type: GitDiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type GitFileDiff = {
  repositoryId: string;
  repositoryPath: string;
  filePath: string;
  oldPath?: string;
  kind: GitDiffKind;
  isBinary: boolean;
  isTooLarge: boolean;
  lineCount: number;
  additions: number;
  deletions: number;
  rawDiff?: string;
  lines: GitDiffLine[];
  refreshedAt: string;
};

export function createWorkspaceSummary(
  summary: WorkspaceSummary,
): WorkspaceSummary {
  return summary;
}

/*
 * UI-local section identifiers. Renaming these is a display change, not a
 * migration: no table, column, or serde name is derived from them.
 *
 * `agents` is a section that is deliberately NOT in `primaryNavigation`. Agent
 * Runs left the nav with part 4 -- the noun implies a loop that does not exist
 * -- while the destination is still reachable from Repositories and Working
 * tree. Part 5 folds it into Review and removes it from this union.
 */
export type NavigationSection =
  "review" | "repositories" | "agents" | "working-tree" | "settings";

export type NavigationItem = {
  id: NavigationSection;
  label: string;
};

/*
 * Four items, and the order is structural rather than decorative: item one is
 * the surface the product claims is its front door. Review is first because
 * approving is the decision the whole product exists to hold.
 */
export const primaryNavigation: NavigationItem[] = [
  { id: "review", label: "Review" },
  { id: "working-tree", label: "Working tree" },
  { id: "repositories", label: "Repositories" },
  { id: "settings", label: "Settings" },
];

export type WorkspaceActivity = {
  id: string;
  title: string;
  detail: string;
  status: DomainStatus;
};

export type WorkspaceSnapshot = {
  summary: WorkspaceSummary;
  activity: WorkspaceActivity[];
};

export function createMockWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    summary: createWorkspaceSummary({
      id: "local-workspace",
      name: "Airlock",
      description:
        "A local-first engineering workspace for repository understanding, AI-assisted implementation, and human-approved changes.",
      repositories: 2,
      activeRuns: 1,
      pendingApprovals: 2,
      lastIndexedAt: "Today, 10:24",
    }),
    activity: [
      {
        id: "activity-index",
        title: "Repository intelligence warmed",
        detail:
          "Source tree, docs map, and Git status are available for the active repository.",
        status: "ready",
      },
      {
        id: "activity-agent",
        title: "Agent run awaiting approval",
        detail:
          "The provider abstraction spike produced a patch plan that needs review.",
        status: "pending_approval",
      },
      {
        id: "activity-provider",
        title: "Mock provider connected",
        detail:
          "The shell is wired through package contracts instead of hardcoded app-only shapes.",
        status: "completed",
      },
    ],
  };
}
