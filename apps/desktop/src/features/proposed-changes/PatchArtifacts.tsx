import { useEffect, useState } from "react";
import {
  initialPatchValidationStatus,
  type PatchApplyAttempt,
  type ProposedPatchArtifact,
} from "@ai-dev/ai";
import {
  IconBadge,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@ai-dev/ui";
import { patchArtifactTone } from "../../lib/uiState";
import {
  ACKNOWLEDGE_INSPECTION_CONFIRMATION,
  APPLY_PATCH_CONFIRMATION,
  ROLLBACK_PATCH_CONFIRMATION,
} from "../../storage/patchApplication";
import {
  applyReadinessGateStatusLabel,
  evaluateApplyReadiness,
  summarizeChecks,
  type ApplyReadinessContext,
  type ApplyReadinessGateStatus,
  type ChecksSummaryStatus,
} from "./applyReadiness";
import {
  evaluateRollbackEligibility,
  type RollbackEligibilityContext,
} from "./rollbackEligibility";

type PatchArtifactListProps = {
  artifacts: ProposedPatchArtifact[];
  onSelectArtifact?: (artifactId: string) => void;
  selectedArtifactId?: string | null;
};

function patchArtifactStateTitle(artifact: ProposedPatchArtifact | null) {
  if (!artifact) {
    return "Select a patch artifact";
  }

  if (artifact.status === "generated") {
    return "Generated patch artifact";
  }

  if (artifact.status === "failed") {
    return "Patch generation failed";
  }

  if (artifact.status === "unavailable") {
    return "Patch unavailable";
  }

  return "Patch not generated";
}

function patchArtifactSummary(artifact: ProposedPatchArtifact) {
  if (artifact.status === "generated") {
    if (artifact.isBinary) {
      return "Binary proposal · inline preview unavailable";
    }

    if (artifact.isTooLarge) {
      return "Generated proposal · inline preview size limit exceeded";
    }

    return `${artifact.additions ?? 0} additions · ${artifact.deletions ?? 0} deletions`;
  }

  if (artifact.status === "failed") {
    return "Provider could not produce reviewable patch content";
  }

  if (artifact.status === "unavailable") {
    return "Bounded context was insufficient for safe generation";
  }

  return "No generated patch content is stored";
}

function checksTone(status: ChecksSummaryStatus) {
  if (status === "passed") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  return "warning" as const;
}

function checksStatusLabel(status: ChecksSummaryStatus) {
  if (status === "passed") {
    return "checks passed";
  }

  if (status === "failed") {
    return "checks failed";
  }

  return "checks incomplete";
}

export function PatchArtifactList({
  artifacts,
  onSelectArtifact,
  selectedArtifactId,
}: PatchArtifactListProps) {
  if (artifacts.length === 0) {
    return (
      <div className="patch-artifact-empty">
        <IconBadge icon="changes" tone="neutral" size="md" />
        <div>
          <h4>No patch artifact records yet</h4>
          <p>
            Placeholder artifacts will appear here before any generated patch
            content is available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="patch-artifact-list" aria-label="Generated patch artifacts">
      {artifacts.map((artifact) => {
        const isSelected = selectedArtifactId === artifact.id;
        const itemContent = (
          <>
            <StatusPill
              tone={patchArtifactTone(artifact.status)}
              size="sm"
              showDot={false}
            >
              {artifact.status.replaceAll("_", " ")}
            </StatusPill>
            <div>
              <strong>{artifact.filePath}</strong>
              <span>
                {patchArtifactSummary(artifact)} · Validation:{" "}
                {initialPatchValidationStatus(artifact).replaceAll("_", " ")} ·
                Apply:{" "}
                {artifact.applyStatus?.replaceAll("_", " ") ?? "not applied"}
              </span>
            </div>
          </>
        );

        if (!onSelectArtifact) {
          return (
            <div className="patch-artifact-item" key={artifact.id}>
              {itemContent}
            </div>
          );
        }

        return (
          <button
            aria-pressed={isSelected}
            className={`patch-artifact-item patch-artifact-item--button ${
              isSelected ? "is-selected" : ""
            }`}
            key={artifact.id}
            onClick={() => onSelectArtifact(artifact.id)}
            type="button"
          >
            {itemContent}
          </button>
        );
      })}
    </div>
  );
}

type PatchArtifactDetailProps = {
  applyAttempt?: PatchApplyAttempt | null;
  applyReadinessContext: ApplyReadinessContext;
  applyFeedback?: {
    status: "success" | "error";
    message: string;
  } | null;
  acknowledgeFeedback?: {
    status: "success" | "error";
    message: string;
  } | null;
  artifact: ProposedPatchArtifact | null;
  isAcknowledging?: boolean;
  isApplying?: boolean;
  isRollingBack?: boolean;
  isRunningChecks?: boolean;
  onAcknowledge?: (confirmationPhrase: string) => void;
  onApply?: (confirmationPhrase: string) => void;
  onRollback?: (confirmationPhrase: string) => void;
  onRunChecks?: () => void;
  rollbackEligibilityContext?: RollbackEligibilityContext | null;
  rollbackFeedback?: {
    status: "success" | "error";
    message: string;
  } | null;
};

function readinessTone(
  status: "ready_to_apply" | "applied" | "blocked" | "checks_pending",
) {
  if (status === "ready_to_apply" || status === "applied") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function readinessGateTone(status: ApplyReadinessGateStatus) {
  if (status === "passed") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "danger" as const;
  }

  if (status === "future") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function PatchArtifactDetail({
  applyAttempt = null,
  applyReadinessContext,
  applyFeedback = null,
  acknowledgeFeedback = null,
  artifact,
  isAcknowledging = false,
  isApplying = false,
  isRollingBack = false,
  isRunningChecks = false,
  onAcknowledge,
  onApply,
  onRollback,
  onRunChecks,
  rollbackEligibilityContext = null,
  rollbackFeedback = null,
}: PatchArtifactDetailProps) {
  const [isConfirmingApply, setIsConfirmingApply] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [isConfirmingAcknowledge, setIsConfirmingAcknowledge] = useState(false);
  const [acknowledgePhrase, setAcknowledgePhrase] = useState("");
  const [isConfirmingRollback, setIsConfirmingRollback] = useState(false);
  const [rollbackPhrase, setRollbackPhrase] = useState("");
  const [showAdvancedGates, setShowAdvancedGates] = useState(false);
  const canRunChecks = Boolean(
    artifact?.status === "generated" &&
    !artifact.isBinary &&
    !artifact.isTooLarge &&
    artifact.rawDiff,
  );
  const applyReadiness = artifact
    ? evaluateApplyReadiness(artifact, applyReadinessContext)
    : null;
  const checksSummary = applyReadiness ? summarizeChecks(applyReadiness) : null;
  // The recorded moment the checks were last observed. It is a static point in
  // time carried on the line, not a live subscription -- there is no watcher.
  const checksObservedAt = artifact?.dryRunAt ?? artifact?.validatedAt ?? null;
  // The checks run a native git subprocess. Fire it once, on open, and only in
  // the native runtime: the browser preview cannot run git, and a stale but
  // already-observed artifact is reported, never silently re-validated.
  const shouldAutoRunChecks = Boolean(
    artifact &&
    applyReadinessContext.isNativeRuntime &&
    onRunChecks &&
    canRunChecks &&
    artifact.applyStatus === undefined &&
    !artifact.validatedAt,
  );
  const canApply = Boolean(applyReadiness?.canApply && onApply);
  const applicationVerified =
    artifact?.applyStatus === "applied" ||
    artifact?.applyStatus === "applied_verified";
  const requiresManualInspection =
    applyAttempt?.status === "interrupted" ||
    applyAttempt?.status === "needs_inspection" ||
    applyAttempt?.status === "quarantine_required";
  const inspectionRecorded = applyAttempt?.status === "inspected";
  // An acknowledged attempt keeps its evidence on screen. Only an unresolved
  // one can still be acknowledged.
  const showsRecoveryPanel = requiresManualInspection || inspectionRecorded;
  const isQuarantined = applyAttempt?.status === "quarantine_required";
  const postApplyVerification =
    applyAttempt?.postApplyVerification ?? artifact?.postApplyVerification;
  const acknowledgePhraseMatches =
    acknowledgePhrase === ACKNOWLEDGE_INSPECTION_CONFIRMATION;
  const rollbackEligibility =
    artifact && rollbackEligibilityContext
      ? evaluateRollbackEligibility(artifact, rollbackEligibilityContext)
      : null;
  const wasRolledBack = artifact?.applyStatus === "rolled_back";
  const postRollbackVerification =
    applyAttempt?.postRollbackVerification ?? artifact?.postRollbackVerification;
  // Shown whenever the artifact reached a verified apply, so ineligibility and
  // its reason are visible before any action rather than discovered by clicking.
  const showsRollbackPanel = Boolean(
    rollbackEligibility &&
    (artifact?.applyStatus === "applied_verified" ||
      artifact?.applyStatus === "rolling_back" ||
      wasRolledBack),
  );

  useEffect(() => {
    setIsConfirmingApply(false);
    setConfirmationPhrase("");
    setIsConfirmingAcknowledge(false);
    setAcknowledgePhrase("");
    setIsConfirmingRollback(false);
    setRollbackPhrase("");
    setShowAdvancedGates(false);
  }, [artifact?.id]);

  // Keyed on the artifact id: the checks are a one-time observation taken when
  // this artifact is opened, not a watcher. Re-opening an already-observed
  // artifact does not re-run them (guarded by `shouldAutoRunChecks`), so a stale
  // observation is reported by the projection rather than silently refreshed.
  useEffect(() => {
    if (shouldAutoRunChecks) {
      onRunChecks?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  // Display-only: the readiness logic is authoritative and untouched. The full
  // eighteen-gate list is evidence to inspect, not a workflow to walk, so it
  // lives behind an explicit Advanced control. When application is not ready,
  // the first blocking gate's reason stands in for the wall of gates.
  const firstBlockingGate =
    applyReadiness?.gates.find((item) => item.status === "blocked") ?? null;

  return (
    <section
      className="patch-artifact-detail"
      aria-label="Patch artifact detail"
    >
      <div className="patch-artifact-detail__header">
        <div>
          <p className="card-eyebrow">Generated Patch Artifact</p>
          <h3>{patchArtifactStateTitle(artifact)}</h3>
          <p>
            {artifact?.filePath ??
              "Choose a generated patch artifact record to inspect its review state."}
          </p>
        </div>
        <StatusPill
          tone={artifact ? patchArtifactTone(artifact.status) : "neutral"}
          size="sm"
          showDot={false}
        >
          {artifact?.status.replaceAll("_", " ") ?? "none"}
        </StatusPill>
      </div>

      <dl className="diff-metadata-grid">
        <div>
          <dt>Additions</dt>
          <dd>+{artifact?.additions ?? 0}</dd>
        </div>
        <div>
          <dt>Deletions</dt>
          <dd>-{artifact?.deletions ?? 0}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{artifact?.createdAt ?? "Not generated"}</dd>
        </div>
        <div>
          <dt>Apply state</dt>
          <dd>
            {artifact?.applyStatus?.replaceAll("_", " ") ?? "Not applied"}
          </dd>
        </div>
      </dl>

      {artifact && checksSummary ? (
        <div className="patch-checks" aria-label="Checks">
          <div className="patch-checks__title">
            <span>Checks</span>
            <StatusPill
              tone={isRunningChecks ? "neutral" : checksTone(checksSummary.status)}
              size="sm"
              showDot={false}
            >
              {isRunningChecks
                ? "running checks"
                : checksStatusLabel(checksSummary.status)}
            </StatusPill>
          </div>
          <p className="patch-checks__reason" role="status">
            {isRunningChecks
              ? "Running structure validation and the read-only Git dry-run."
              : checksSummary.reason}
          </p>
          <p className="patch-checks__observed">
            {checksObservedAt
              ? `Checks observed at ${checksObservedAt}. They are not re-run while this approval stays open.`
              : applyReadinessContext.isNativeRuntime
                ? "Checks run once when this approval is opened."
                : "Checks run in the native desktop app, not the browser preview."}
          </p>
        </div>
      ) : null}

      {showsRecoveryPanel && applyAttempt ? (
        <section
          aria-live="polite"
          className="patch-apply-recovery"
          role="status"
        >
          <div className="patch-apply-recovery__header">
            <IconBadge
              icon="changes"
              tone={
                inspectionRecorded
                  ? "neutral"
                  : isQuarantined
                    ? "danger"
                    : "warning"
              }
              size="md"
            />
            <div>
              <p className="card-eyebrow">
                {inspectionRecorded
                  ? "Inspection Recorded"
                  : isQuarantined
                    ? "Post-Apply Quarantine"
                    : "Interrupted Apply"}
              </p>
              <h4>
                {inspectionRecorded
                  ? "Inspection recorded"
                  : "Manual inspection required"}
              </h4>
            </div>
            <StatusPill
              tone={
                inspectionRecorded
                  ? "neutral"
                  : isQuarantined
                    ? "danger"
                    : "warning"
              }
              size="sm"
              showDot={false}
            >
              {applyAttempt.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <p>{applyAttempt.message}</p>
          <dl className="patch-apply-recovery__facts">
            <div>
              <dt>Attempt</dt>
              <dd>{applyAttempt.applyAttemptId}</dd>
            </div>
            <div>
              <dt>Backup</dt>
              <dd>{applyAttempt.backupId ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Current Git status</dt>
              <dd>
                {applyAttempt.currentGitStatusChanged === true
                  ? "Changed after apply started"
                  : applyAttempt.currentGitStatusChanged === false
                    ? "No change detected"
                    : "Not enough evidence"}
              </dd>
            </div>
            {postApplyVerification ? (
              <>
                <div>
                  <dt>Expected paths</dt>
                  <dd>{postApplyVerification.expectedPaths.join(", ")}</dd>
                </div>
                <div>
                  <dt>Observed paths</dt>
                  <dd>
                    {postApplyVerification.observedChangedPaths.join(", ") ||
                      "None detected"}
                  </dd>
                </div>
                <div>
                  <dt>Unexpected paths</dt>
                  <dd>
                    {postApplyVerification.unexpectedPaths.join(", ") ||
                      "None detected"}
                  </dd>
                </div>
                <div>
                  <dt>Missing expected paths</dt>
                  <dd>
                    {postApplyVerification.missingExpectedPaths.join(", ") ||
                      "None detected"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          <p className="patch-apply-recovery__boundary">
            No patch was retried or rolled back. Inspect the working tree and
            backup evidence before taking any manual action.
          </p>

          {requiresManualInspection && onAcknowledge ? (
            isConfirmingAcknowledge ? (
              <div className="patch-apply-confirm">
                <p>
                  Recording an inspection lets other patches be applied to this
                  repository again. It does not apply, retry, or roll back
                  anything, and this artifact stays permanently ineligible.
                </p>
                <label htmlFor="acknowledge-confirmation">
                  Type INSPECTED to confirm you reviewed this outcome
                </label>
                <input
                  id="acknowledge-confirmation"
                  autoComplete="off"
                  onChange={(event) => setAcknowledgePhrase(event.target.value)}
                  value={acknowledgePhrase}
                />
                <div className="patch-apply-confirm__actions">
                  <SecondaryButton
                    onClick={() => {
                      setIsConfirmingAcknowledge(false);
                      setAcknowledgePhrase("");
                    }}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={!acknowledgePhraseMatches || isAcknowledging}
                    onClick={() => onAcknowledge(acknowledgePhrase)}
                  >
                    {isAcknowledging ? "Recording..." : "Confirm inspection"}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <SecondaryButton onClick={() => setIsConfirmingAcknowledge(true)}>
                Record inspection
              </SecondaryButton>
            )
          ) : null}

          {acknowledgeFeedback ? (
            <p
              className={`patch-apply-feedback patch-apply-feedback--${acknowledgeFeedback.status}`}
            >
              {acknowledgeFeedback.message}
            </p>
          ) : null}
        </section>
      ) : null}

      {applyReadiness ? (
        <section className="apply-readiness" aria-label="Apply readiness">
          <div className="apply-readiness__header">
            <div className="apply-readiness__heading">
              <IconBadge icon="approval" tone="agent" size="md" />
              <div>
                <p className="card-eyebrow">Native Safety Gate</p>
                <h4>Apply Readiness</h4>
              </div>
            </div>
            <StatusPill
              tone={readinessTone(applyReadiness.status)}
              size="sm"
              showDot={false}
            >
              {applyReadiness.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <p className="apply-readiness__notice">
            Applying modifies files in your working tree. It does not commit or
            stage changes, and approval alone never applies a patch.
          </p>
          <p className="apply-readiness__summary">{applyReadiness.summary}</p>
          {firstBlockingGate ? (
            <p className="apply-readiness__blocking" role="status">
              First unmet gate:{" "}
              <span className="apply-readiness__blocking-reason">
                {firstBlockingGate.detail}
              </span>
            </p>
          ) : null}
          <div className="apply-readiness__advanced">
            <SecondaryButton
              aria-expanded={showAdvancedGates}
              icon="approval"
              onClick={() => setShowAdvancedGates((shown) => !shown)}
            >
              {showAdvancedGates
                ? "Hide all readiness gates"
                : "Advanced: show all 18 readiness gates"}
            </SecondaryButton>
            {showAdvancedGates ? (
              <ul
                className="apply-readiness__gates"
                aria-label="Apply readiness gates"
              >
                {applyReadiness.gates.map((readinessGate) => (
                  <li key={readinessGate.id}>
                    <div>
                      <strong>{readinessGate.label}</strong>
                      <span>{readinessGate.detail}</span>
                    </div>
                    <StatusPill
                      tone={readinessGateTone(readinessGate.status)}
                      size="sm"
                      showDot={false}
                    >
                      {applyReadinessGateStatusLabel(readinessGate.status)}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="apply-readiness__action">
            {applicationVerified ? (
              <SecondaryButton disabled icon="approval">
                Patch applied and verified
              </SecondaryButton>
            ) : canApply ? (
              <PrimaryButton
                disabled={isApplying}
                icon="changes"
                onClick={() => setIsConfirmingApply(true)}
              >
                {isApplying ? "Applying patch" : "Apply Patch"}
              </PrimaryButton>
            ) : (
              <SecondaryButton disabled icon="changes">
                Apply unavailable
              </SecondaryButton>
            )}
            <span>
              A bounded backup is required before the native command can modify
              the selected target file.
            </span>
          </div>
          {isConfirmingApply && canApply && artifact ? (
            <div
              className="apply-confirmation"
              role="group"
              aria-labelledby={`apply-confirmation-${artifact.id}`}
            >
              <div>
                <h5 id={`apply-confirmation-${artifact.id}`}>
                  Confirm working-tree modification
                </h5>
                <p>
                  This will modify files in your working tree. It will not
                  commit or stage changes. Type <strong>APPLY PATCH</strong> to
                  continue.
                </p>
              </div>
              <label>
                Confirmation phrase
                <input
                  autoComplete="off"
                  disabled={isApplying}
                  onChange={(event) =>
                    setConfirmationPhrase(event.currentTarget.value)
                  }
                  spellCheck={false}
                  value={confirmationPhrase}
                />
              </label>
              <div className="apply-confirmation__actions">
                <SecondaryButton
                  disabled={isApplying}
                  onClick={() => {
                    setIsConfirmingApply(false);
                    setConfirmationPhrase("");
                  }}
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  disabled={
                    isApplying ||
                    confirmationPhrase !== APPLY_PATCH_CONFIRMATION
                  }
                  icon="changes"
                  onClick={() => onApply?.(confirmationPhrase)}
                >
                  {isApplying ? "Applying patch" : "Confirm Apply Patch"}
                </PrimaryButton>
              </div>
            </div>
          ) : null}
          {applicationVerified ? (
            <p className="apply-feedback apply-feedback--success" role="status">
              The approved patch was applied and authoritative verification
              confirmed only the expected path changed. No files were staged or
              committed. Applied at {artifact.appliedAt ?? "an unknown time"}.
              {artifact.backupId
                ? ` Pre-apply backup: ${artifact.backupId}.`
                : " Backup reference unavailable."}
            </p>
          ) : null}
          {applyFeedback &&
          (applyFeedback.status === "error" || !applicationVerified) ? (
            <p
              className={`apply-feedback apply-feedback--${applyFeedback.status}`}
              role={applyFeedback.status === "error" ? "alert" : "status"}
            >
              {applyFeedback.message}
            </p>
          ) : null}
        </section>
      ) : null}

      {showsRollbackPanel && artifact && rollbackEligibility ? (
        <section className="patch-rollback" aria-label="Rollback">
          <div className="patch-rollback__header">
            <IconBadge
              icon="changes"
              tone={wasRolledBack ? "neutral" : "warning"}
              size="md"
            />
            <div>
              <p className="card-eyebrow">App-Local Backup Restore</p>
              <h4>{wasRolledBack ? "Rolled back" : "Roll back this patch"}</h4>
            </div>
            <StatusPill
              tone={wasRolledBack ? "neutral" : "warning"}
              size="sm"
              showDot={false}
            >
              {wasRolledBack ? "rolled back" : "available"}
            </StatusPill>
          </div>

          {wasRolledBack ? (
            <>
              <p>
                This patch was restored to its pre-apply state from the
                app-local backup taken before it was applied. Git history was
                not touched, and nothing was staged or committed.
                {artifact.rolledBackAt
                  ? ` Rolled back at ${artifact.rolledBackAt}.`
                  : ""}
              </p>
              <p className="patch-rollback__boundary">
                It cannot be applied again. Re-applying would replay an approval
                that has been undone; generate and validate a fresh proposal
                instead.
              </p>
            </>
          ) : (
            <p>{rollbackEligibility.detail}</p>
          )}

          {postRollbackVerification ? (
            <dl className="patch-rollback__facts">
              <div>
                <dt>Restored path</dt>
                <dd>{postRollbackVerification.targetPath}</dd>
              </div>
              <div>
                <dt>Other paths still changed</dt>
                <dd>
                  {postRollbackVerification.observedChangedPaths.join(", ") ||
                    "None"}
                </dd>
              </div>
              <div>
                <dt>Unexpected paths</dt>
                <dd>
                  {postRollbackVerification.unexpectedPaths.join(", ") ||
                    "None detected"}
                </dd>
              </div>
              <div>
                <dt>Backup of overwritten contents</dt>
                <dd>{artifact.rollbackBackupId ?? "Not available"}</dd>
              </div>
            </dl>
          ) : null}

          {/* An artifact that can never be rolled back gets no button. A
              control that exists only to refuse is dishonesty in a smaller box. */}
          {!wasRolledBack && !rollbackEligibility.canRollback ? (
            <p
              className="patch-rollback__blocked"
              role="status"
              data-reason={rollbackEligibility.reason ?? undefined}
            >
              {rollbackEligibility.isPermanentlyIneligible
                ? "Rollback unavailable: "
                : "Rollback not available right now: "}
              {rollbackEligibility.detail}
            </p>
          ) : null}

          {!wasRolledBack && rollbackEligibility.canRollback && onRollback ? (
            isConfirmingRollback ? (
              <div
                className="patch-rollback-confirm"
                role="group"
                aria-labelledby={`rollback-confirmation-${artifact.id}`}
              >
                <h5 id={`rollback-confirmation-${artifact.id}`}>
                  Roll back this patch?
                </h5>
                {/* The two acts are different and must not share one sentence. */}
                {rollbackEligibility.operation === "create" ? (
                  <p>
                    This deletes <strong>{artifact.filePath}</strong>. The file
                    did not exist before the apply, so there are no previous
                    contents to restore.
                  </p>
                ) : (
                  <p>
                    This restores <strong>{artifact.filePath}</strong> to its
                    pre-apply contents, overwriting what is on disk now.
                  </p>
                )}
                <p>
                  It changes working-tree files only. It does not stage, commit,
                  or touch Git history, and it cannot be undone from here.
                </p>
                <label htmlFor={`rollback-phrase-${artifact.id}`}>
                  Type ROLL BACK to confirm
                </label>
                <input
                  id={`rollback-phrase-${artifact.id}`}
                  autoComplete="off"
                  disabled={isRollingBack}
                  onChange={(event) => setRollbackPhrase(event.target.value)}
                  spellCheck={false}
                  value={rollbackPhrase}
                />
                <div className="patch-rollback-confirm__actions">
                  <SecondaryButton
                    disabled={isRollingBack}
                    onClick={() => {
                      setIsConfirmingRollback(false);
                      setRollbackPhrase("");
                    }}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={
                      isRollingBack ||
                      rollbackPhrase !== ROLLBACK_PATCH_CONFIRMATION
                    }
                    icon="changes"
                    onClick={() => onRollback(rollbackPhrase)}
                  >
                    {isRollingBack ? "Rolling back..." : "Confirm Roll Back"}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <SecondaryButton
                icon="changes"
                onClick={() => setIsConfirmingRollback(true)}
              >
                Roll Back Patch
              </SecondaryButton>
            )
          ) : null}

          {rollbackFeedback ? (
            <p
              className={`patch-rollback-feedback patch-rollback-feedback--${rollbackFeedback.status}`}
              role={rollbackFeedback.status === "error" ? "alert" : "status"}
            >
              {rollbackFeedback.message}
            </p>
          ) : null}
        </section>
      ) : null}

      {!artifact ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>No artifact selected</h4>
            <p>
              Select an artifact record to inspect its generated patch state.
            </p>
          </div>
        </div>
      ) : artifact.status === "not_generated" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>Patch not generated</h4>
            <p>
              Future agent execution will attach a reviewable generated patch
              here.
            </p>
          </div>
        </div>
      ) : artifact.status === "failed" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="danger" size="md" />
          <div>
            <h4>Patch generation failed</h4>
            <p>
              Generation failed before reviewable patch content was available.
              No fake diff is shown.
            </p>
          </div>
        </div>
      ) : artifact.status === "unavailable" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="warning" size="md" />
          <div>
            <h4>Patch unavailable</h4>
            <p>
              This patch artifact is unavailable for review. No generated diff
              content is attached.
            </p>
          </div>
        </div>
      ) : artifact.isBinary ? (
        <div className="patch-artifact-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Binary generated patch</h4>
            <p>Binary generated patches are not rendered as text previews.</p>
          </div>
        </div>
      ) : artifact.isTooLarge ? (
        <div className="patch-artifact-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Generated patch too large</h4>
            <p>This generated patch is too large for inline preview.</p>
          </div>
        </div>
      ) : artifact.rawDiff ? (
        <div className="generated-patch-preview">
          <div className="generated-patch-preview__label">
            Provider-generated proposal · not applied
          </div>
          <pre className="git-diff-code" tabIndex={0}>
            {artifact.rawDiff.split("\n").map((line, index) => (
              <code
                className={`git-diff-line ${
                  line.startsWith("diff ") ||
                  line.startsWith("index ") ||
                  line.startsWith("---") ||
                  line.startsWith("+++")
                    ? "git-diff-line--metadata"
                    : line.startsWith("@@")
                      ? "git-diff-line--hunk"
                      : line.startsWith("+")
                        ? "git-diff-line--added"
                        : line.startsWith("-")
                          ? "git-diff-line--removed"
                          : ""
                }`}
                key={`${artifact.id}-${index}-${line}`}
              >
                {line}
              </code>
            ))}
          </pre>
        </div>
      ) : (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="warning" size="md" />
          <div>
            <h4>Generated patch has no preview</h4>
            <p>
              This artifact is marked generated, but no raw diff content is
              attached.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
