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
