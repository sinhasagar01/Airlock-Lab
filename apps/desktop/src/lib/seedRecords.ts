import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";

/**
 * Identifiers of the demo records shipped with the app.
 *
 * These are fixtures, not user data. User-created records are keyed on a
 * timestamp (`run-${Date.now()}` and the `proposal-`/`approval-` ids derived
 * from it), so a real record can never collide with one of these.
 *
 * Hydration must never persist a record with one of these ids: that write ran
 * on every launch with no user action and put fixtures into the same tables as
 * real records, where nothing distinguished them afterwards. A record with one
 * of these ids may still reach storage through an explicit human decision --
 * approving or rejecting it -- which is exactly what makes it "touched".
 */
export const KNOWN_SEED_RECORD_IDS = [
  "approval-provider-rfc",
  "approval-indexing-job",
  "proposal-mvp-shell",
  "proposal-index-refresh",
] as const;

export type KnownSeedRecordId = (typeof KNOWN_SEED_RECORD_IDS)[number];

export function isSeededRecordId(id: string | undefined | null) {
  return (
    typeof id === "string" &&
    (KNOWN_SEED_RECORD_IDS as readonly string[]).includes(id)
  );
}

/**
 * Demo agent runs. These are never persisted -- `saveAgentRunRecord` is only
 * called for runs a user starts -- so they are tracked separately from the ids
 * that can reach durable storage.
 */
export const KNOWN_SEED_RUN_IDS = [
  "run-mvp-shell",
  "run-index-refresh",
] as const;

export function isSeededRunId(id: string | undefined | null) {
  return (
    typeof id === "string" &&
    (KNOWN_SEED_RUN_IDS as readonly string[]).includes(id)
  );
}

/**
 * A demo approval nobody has decided on. Its presence in storage is pure
 * fabrication: hydration put it there with no user action.
 */
export function isUntouchedSeededApproval(request: ApprovalRequest) {
  return isSeededRecordId(request.id) && request.status === "pending";
}

/**
 * A demo proposal carrying no human decision and no evidence of validation or
 * application. Anything else is retained: the subject is fabricated, but a
 * decision or an apply attempt about it is a real act with real audit rows
 * behind it.
 */
export function isUntouchedSeededProposal(change: PersistedProposedChange) {
  if (!isSeededRecordId(change.id)) {
    return false;
  }

  if (change.status !== "ready_for_review" && change.status !== "draft") {
    return false;
  }

  return change.patchArtifacts.every(
    (artifact) =>
      !artifact.applyStatus &&
      !artifact.validatedAt &&
      !artifact.backupId &&
      !artifact.appliedAt,
  );
}
