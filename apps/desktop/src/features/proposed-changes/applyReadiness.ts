import {
  initialPatchValidationStatus,
  type ApprovalRequestStatus,
  type ProposedPatchArtifact,
  type RepositoryValidationSnapshot,
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
    | "artifact_digest"
    | "validation_snapshot"
    | "target_fingerprints"
    | "repository_staleness";
  label: string;
  detail: string;
  status: ApplyReadinessGateStatus;
};

export type ApplyReadinessContext = {
  approvalStatus: ApprovalRequestStatus | null;
  hasSelectedRepository: boolean;
  repositoryMatches: boolean;
  currentRepositorySnapshot: RepositoryValidationSnapshot | null;
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

function shortDigest(digest: string) {
  return `SHA-256 ${digest.slice(0, 12)}...`;
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
  const validationHasRun =
    Boolean(artifact.validatedAt) && validationStatus !== "not_validated";
  const hasCurrentDigest = Boolean(artifact.artifactDigest);
  const hasValidatedDigest = Boolean(artifact.validatedArtifactDigest);
  const artifactDigestMatches =
    hasCurrentDigest &&
    hasValidatedDigest &&
    artifact.artifactDigest === artifact.validatedArtifactDigest;
  const validationSnapshot = artifact.validationRepositorySnapshot;
  const currentSnapshot = context.currentRepositorySnapshot;
  const targetFileFingerprints =
    validationSnapshot?.targetFileFingerprints ?? [];
  const unavailableTargetFingerprints = targetFileFingerprints.filter(
    (fingerprint) =>
      fingerprint.status !== "captured" && fingerprint.status !== "missing",
  );
  const hasComparableNativeSnapshot = Boolean(
    validationSnapshot?.repositorySnapshotDigest &&
      currentSnapshot?.repositorySnapshotDigest,
  );
  const repositoryIsUnchanged = Boolean(
    validationSnapshot &&
      currentSnapshot &&
      validationSnapshot.repositorySnapshotDigest ===
        currentSnapshot.repositorySnapshotDigest,
  );

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
      "artifact_digest",
      "Artifact digest matches validation",
      !validationHasRun
        ? "not_checked"
        : !hasCurrentDigest || !hasValidatedDigest
          ? "future"
          : artifactDigestMatches
            ? "passed"
            : "blocked",
      !validationHasRun
        ? "Run validation to bind a digest to the reviewed patch content."
        : !hasCurrentDigest || !hasValidatedDigest
          ? "A comparable SHA-256 validation digest is unavailable."
          : artifactDigestMatches
            ? `${shortDigest(artifact.artifactDigest!)} matches the validated patch content.`
            : "Patch artifact changed after validation. Re-run validation before future apply.",
    ),
    gate(
      "validation_snapshot",
      "Validation snapshot captured",
      !validationHasRun
        ? "not_checked"
        : validationSnapshot
          ? "passed"
          : "future",
      !validationHasRun
        ? "Run validation to capture repository state."
        : validationSnapshot
          ? `Captured ${validationSnapshot.branch ?? "detached or unknown branch"} at ${validationSnapshot.headSha ?? "an unavailable HEAD"} with ${validationSnapshot.changedFileCount} changed file${validationSnapshot.changedFileCount === 1 ? "" : "s"} and ${validationSnapshot.targetFileFingerprints?.length ?? 0} target fingerprint${validationSnapshot.targetFileFingerprints?.length === 1 ? "" : "s"}.`
          : "The native repository snapshot was unavailable during validation.",
    ),
    gate(
      "target_fingerprints",
      "Target files fingerprinted",
      !validationHasRun
        ? "not_checked"
        : !validationSnapshot?.targetFileFingerprints ||
            targetFileFingerprints.length === 0 ||
            !validationSnapshot.repositorySnapshotDigest
          ? "future"
          : unavailableTargetFingerprints.length > 0
            ? "blocked"
            : "passed",
      !validationHasRun
        ? "Run validation to fingerprint the proposed target paths."
        : !validationSnapshot?.targetFileFingerprints ||
            targetFileFingerprints.length === 0 ||
            !validationSnapshot.repositorySnapshotDigest
          ? "Authoritative native fingerprint evidence is unavailable."
          : unavailableTargetFingerprints.length > 0
            ? `${unavailableTargetFingerprints.length} target fingerprint${unavailableTargetFingerprints.length === 1 ? " is" : "s are"} unavailable, forbidden, binary, or too large.`
            : `${targetFileFingerprints.length} target path${targetFileFingerprints.length === 1 ? " is" : "s are"} bound to snapshot ${shortDigest(validationSnapshot.repositorySnapshotDigest)}.`,
    ),
    gate(
      "repository_staleness",
      "Repository state unchanged",
      !validationHasRun
        ? "not_checked"
        : !validationSnapshot || !currentSnapshot || !hasComparableNativeSnapshot
          ? "future"
          : repositoryIsUnchanged
            ? "passed"
            : "blocked",
      !validationHasRun
        ? "Repository staleness cannot be checked before validation."
        : !validationSnapshot || !currentSnapshot
          ? "A validation or current repository snapshot is unavailable."
        : !hasComparableNativeSnapshot
            ? "An authoritative current or validation snapshot digest is unavailable."
            : repositoryIsUnchanged
              ? "Branch, HEAD, Git state, artifact digest, relevant paths, and target fingerprints match validation."
              : "Repository state changed after validation. Re-run validation before future apply.",
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
