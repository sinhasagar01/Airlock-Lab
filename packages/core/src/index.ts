export type WorkspaceSummary = {
  name: string;
  repositories: number;
  activeRuns: number;
  pendingApprovals: number;
};

export type DomainStatus =
  | "draft"
  | "ready"
  | "pending_approval"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export function createWorkspaceSummary(
  summary: WorkspaceSummary,
): WorkspaceSummary {
  return summary;
}
