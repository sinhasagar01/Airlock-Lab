import {
  initialPatchValidationStatus,
  type ApprovalRequestStatus,
  type ProposedPatchArtifact,
} from "@ai-dev/ai";

export type ApplyReadinessGateStatus =
  | "passed"
  | "blocked"
  | "not_checked"
  | "future";

export type ApplyReadinessGate = {
  id:
    | "approval"
    | "generated"
    | "structure"
    | "dry_run"
    | "repository"
    | "working_tree"
    | "path"
    | "forbidden_path"
    | "binary"
    | "size"
    | "staleness";
  label: string;
  detail: string;
  status: ApplyReadinessGateStatus;
};

export type ApplyReadinessContext = {
  approvalStatus: ApprovalRequestStatus | null;
  hasSelectedRepository: boolean;
  repositoryMatches: boolean;
  workingTreeState: "clean" | "dirty" | "unknown";
};

export type ApplyReadinessResult = {
  gates: ApplyReadinessGate[];
  status: "closer_to_ready" | "blocked" | "checks_pending";
  summary: string;
};

function gate(
  id: ApplyReadinessGate["id"],
  label: string,
  status: ApplyReadinessGateStatus,
  detail: string,
): ApplyReadinessGate {
  return { id, label, status, detail };
}

function hasAllowedRelativePath(path: string) {
  if (
    !path ||
    path.length > 320 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("\0") ||
    /^[A-Za-z]:/.test(path)
  ) {
    return false;
  }

  return path
    .split("/")
    .every((segment) => Boolean(segment) && segment !== "." && segment !== "..");
}

function isForbiddenPath(path: string) {
  return path.split("/").some((segment) => {
    const normalized = segment.toLowerCase();

    return (
      normalized === ".git" ||
      normalized === ".env" ||
      normalized.startsWith(".env.") ||
      normalized === "id_rsa" ||
      normalized === "id_ed25519" ||
      normalized === "credentials.json" ||
      normalized.startsWith("secrets.") ||
      normalized.endsWith(".pem") ||
      normalized.endsWith(".key") ||
      normalized.endsWith(".p12") ||
      normalized.endsWith(".pfx")
    );
  });
}

export function evaluateApplyReadiness(
  artifact: ProposedPatchArtifact,
  context: ApplyReadinessContext,
): ApplyReadinessResult {
  const validationStatus = initialPatchValidationStatus(artifact);
  const pathAllowed = hasAllowedRelativePath(artifact.filePath);
  const forbiddenPath = isForbiddenPath(artifact.filePath);
  const structurePassed =
    validationStatus === "valid_structure" ||
    validationStatus === "dry_run_passed" ||
    validationStatus === "dry_run_failed";

  const gates: ApplyReadinessGate[] = [
    gate(
      "approval",
      "Approval request approved",
      context.approvalStatus === "approved" ? "passed" : "blocked",
      context.approvalStatus === "approved"
        ? "The linked review request is approved."
        : context.approvalStatus === "rejected"
          ? "The linked review request was rejected."
          : context.approvalStatus === "pending"
            ? "Human approval is still pending."
            : "No linked approval request is available.",
    ),
    gate(
      "generated",
      "Artifact generated",
      artifact.status === "generated" ? "passed" : "blocked",
      artifact.status === "generated"
        ? "Stored generated artifact content is available for review."
        : `Artifact state is ${artifact.status.replaceAll("_", " ")}.`,
    ),
    gate(
      "structure",
      "Artifact structure valid",
      structurePassed
        ? "passed"
        : validationStatus === "invalid_structure"
          ? "blocked"
          : validationStatus === "unavailable" &&
              artifact.status === "generated"
            ? "blocked"
            : "not_checked",
      structurePassed
        ? "The stored structure validation passed."
        : validationStatus === "invalid_structure"
          ? "The artifact failed structure validation."
          : validationStatus === "unavailable" &&
              artifact.status === "generated"
            ? "Reviewable text is unavailable for structure validation."
            : "Run structure validation before evaluating this gate.",
    ),
    gate(
      "dry_run",
      "Read-only dry-run passed",
      validationStatus === "dry_run_passed"
        ? "passed"
        : validationStatus === "dry_run_failed"
          ? "blocked"
          : "not_checked",
      validationStatus === "dry_run_passed"
        ? "Git reported the patch potentially applicable without writing it."
        : validationStatus === "dry_run_failed"
          ? "The read-only Git applicability check failed."
          : "A successful native dry-run has not been recorded.",
    ),
    gate(
      "repository",
      "Linked repository selected",
      context.hasSelectedRepository && context.repositoryMatches
        ? "passed"
        : "blocked",
      !context.hasSelectedRepository
        ? "Select a saved repository before evaluating future application."
        : context.repositoryMatches
          ? "The selected repository matches the proposal."
          : "The selected repository does not match the proposal.",
    ),
    gate(
      "working_tree",
      "Working tree clean",
      context.workingTreeState === "clean"
        ? "passed"
        : context.workingTreeState === "dirty"
          ? "blocked"
          : "not_checked",
      context.workingTreeState === "clean"
        ? "The latest known Git status is clean."
        : context.workingTreeState === "dirty"
          ? "Local changes currently block future safe application."
          : "Refresh Git status to check the working tree.",
    ),
    gate(
      "path",
      "Artifact path allowed",
      pathAllowed ? "passed" : "blocked",
      pathAllowed
        ? "The stored path passes the informational relative-path check."
        : "The stored path is not an allowed repository-relative path.",
    ),
    gate(
      "forbidden_path",
      "No forbidden file touched",
      forbiddenPath ? "blocked" : "passed",
      forbiddenPath
        ? "The path matches a protected repository or secret-file pattern."
        : "No currently recognized protected path pattern was found.",
    ),
    gate(
      "binary",
      "Artifact is text",
      artifact.isBinary ? "blocked" : "passed",
      artifact.isBinary
        ? "Binary artifacts are outside the future version 1 apply boundary."
        : "The artifact is represented as text.",
    ),
    gate(
      "size",
      "Artifact within size limit",
      artifact.isTooLarge ? "blocked" : "passed",
      artifact.isTooLarge
        ? "The artifact exceeds the retained review and validation limit."
        : "The artifact is within the current per-artifact size boundary.",
    ),
    gate(
      "staleness",
      "Artifact not stale",
      "future",
      "Repository snapshots and artifact digests are not implemented yet.",
    ),
  ];

  const blockedCount = gates.filter((item) => item.status === "blocked").length;
  const pendingCount = gates.filter(
    (item) => item.status === "not_checked",
  ).length;

  if (blockedCount > 0) {
    return {
      gates,
      status: "blocked",
      summary: `${blockedCount} current gate${blockedCount === 1 ? "" : "s"} block future application readiness.`,
    };
  }

  if (pendingCount > 0) {
    return {
      gates,
      status: "checks_pending",
      summary: `${pendingCount} check${pendingCount === 1 ? " has" : "s have"} not completed yet.`,
    };
  }

  return {
    gates,
    status: "closer_to_ready",
    summary:
      "All currently checkable gates pass. Future authorization and staleness checks still remain.",
  };
}

export function applyReadinessGateStatusLabel(
  status: ApplyReadinessGateStatus,
) {
  if (status === "passed") {
    return "Passed";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  if (status === "future") {
    return "Requires future apply implementation";
  }

  return "Not checked yet";
}
