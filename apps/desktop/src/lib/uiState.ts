import type {
  ApprovalRequestStatus,
  ApprovalRisk,
  AgentRun,
  PersistedProposedChange,
  ProposedChangeStepStatus,
  ProposedPatchArtifact,
  ProposedRisk,
} from "@ai-dev/ai";
import type { RepositorySummary } from "@ai-dev/indexing";

export function repositoryTone(
  status: RepositorySummary["status"],
): "neutral" | "success" | "warning" {
  if (status === "indexed") {
    return "success";
  }

  if (status === "indexing") {
    return "neutral";
  }

  return "warning";
}

export function approvalRiskTone(
  risk: ApprovalRisk,
): "neutral" | "success" | "warning" | "danger" {
  if (risk === "high") {
    return "danger";
  }

  if (risk === "medium") {
    return "warning";
  }

  return "success";
}

export function approvalStatusTone(
  status: ApprovalRequestStatus,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "warning";
}

export function fileNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function agentRunTone(status: AgentRun["status"]) {
  if (status === "waiting_for_approval") {
    return "warning";
  }

  if (status === "running" || status === "queued") {
    return "agent";
  }

  return "success";
}

export function stepStatusTone(status: ProposedChangeStepStatus) {
  if (status === "completed") {
    return "success";
  }

  if (status === "in_progress") {
    return "agent";
  }

  if (status === "blocked") {
    return "danger";
  }

  return "neutral";
}

export function riskTone(level: ProposedRisk["level"]) {
  if (level === "high") {
    return "danger";
  }

  if (level === "medium") {
    return "warning";
  }

  return "success";
}

export function changeKindTone(kind: string) {
  if (kind === "added" || kind === "untracked") {
    return "success";
  }

  if (kind === "deleted" || kind === "conflicted") {
    return "danger";
  }

  if (kind === "renamed" || kind === "copied") {
    return "agent";
  }

  return "warning";
}

export function proposedChangeStatusTone(
  status: PersistedProposedChange["status"],
) {
  if (status === "approved" || status === "applied") {
    return "success";
  }

  // Quarantine means the working tree changed in a way the app could not
  // account for. It is the loudest fail-closed state in the product and must
  // never render as calm as a draft.
  if (
    status === "rejected" ||
    status === "superseded" ||
    status === "quarantine_required"
  ) {
    return "danger";
  }

  if (status === "ready_for_review") {
    return "warning";
  }

  // `rolled_back` lands here deliberately, not by omission: nothing went wrong
  // and nothing is pending, so it is neither a success nor a failure. Promoting
  // it to `success` would repeat the "applied" claim the rollback disproved.
  return "neutral";
}

export function patchArtifactTone(status: ProposedPatchArtifact["status"]) {
  if (status === "generated") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  if (status === "unavailable") {
    return "warning";
  }

  return "neutral";
}

export function formatGitRefreshedAt(refreshedAt: string | null | undefined) {
  if (!refreshedAt) {
    return "Not refreshed yet";
  }

  const timestamp = Number(refreshedAt);

  if (!Number.isNaN(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return refreshedAt;
}
