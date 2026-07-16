import type { PersistedProposedChange, ProposedChangeStatus } from "@ai-dev/ai";

/**
 * Which proposal statuses are active work -- work a human still has to act on --
 * and, when more than one is, which needs a human most.
 *
 * A `Record` over the whole union rather than a list of the active ones, so that
 * adding a status to `ProposedChangeStatus` is a **compile error here** until
 * someone decides whether it is active work. This project has twice shipped a
 * guard whose default was the defect (the apply artifact guard and the
 * attempt-level gates, both inverted to allow-lists), and the failure a display
 * has is the same shape: an unrecognised status silently drops out of the filter
 * and Overview reports "No active work" over work that exists. The compiler can
 * enforce completeness here, so it does.
 */
const ACTIVE_WORK_RANK: Record<ProposedChangeStatus, number | null> = {
  // Blocks every further apply to this repository until an inspection is
  // recorded (#1). Nothing needs a human more than a repository that cannot
  // accept another patch until someone types INSPECTED.
  quarantine_required: 0,
  // Waiting on the approval decision the product is built around.
  ready_for_review: 1,
  // The decision is made and the act is not: approved, nothing applied yet.
  approved: 2,
  // Not active work. Each of these is either terminal or waiting on nobody.
  draft: null,
  rejected: null,
  superseded: null,
  applied: null,
  rolled_back: null,
};

export type ActiveWork = {
  /** The proposal the card shows. */
  proposal: PersistedProposedChange;
  /** How many proposals are active for this repository, including the one shown. */
  activeCount: number;
};

/**
 * The active work for one repository, or `null` when there is none.
 *
 * Scoped to a repository rather than the workspace, and that is not a coin
 * flip: the card's own body -- Repository, Branch, Local path, Open Changes,
 * Clean Working Directory -- is entirely active-repository facts. A proposal
 * from another repository rendered above them would print one repository's work
 * over another's branch, which is exactly the lie #6 fixed at two other sites.
 *
 * Ranked by what the status *means*, ties broken by list order. Deliberately
 * **not** ordered by `updatedAt`: that field holds `"Today, 10:44"` from the
 * creation path (`AgentRun.startedAt` is a locale-formatted display string, for
 * real runs as well as fixtures) and an ISO string from the approval path. Two
 * incompatible formats in one field cannot order anything -- lexicographically
 * every `"Today, ..."` sorts after every ISO string, and `"Today, 9:05"` sorts
 * after `"Today, 10:44"`. Sorting on it would look right and be wrong.
 */
export function selectActiveWork(
  changes: PersistedProposedChange[],
  repositoryId: string,
): ActiveWork | null {
  const active = changes
    .filter((change) => change.repositoryId === repositoryId)
    .map((change) => ({
      change,
      // `?? null` for a status outside the union at runtime -- a legacy row that
      // serde let through. Ranked `null`, so it is not counted as active work.
      // That direction underclaims, which is this card's known failure mode; the
      // Record above is what keeps it unreachable for any status we know about.
      rank: ACTIVE_WORK_RANK[change.status] ?? null,
    }))
    .filter(
      (entry): entry is { change: PersistedProposedChange; rank: number } =>
        entry.rank !== null,
    );

  const best = active.at(0);

  if (!best) {
    return null;
  }

  return {
    proposal: active.reduce(
      (left, right) => (right.rank < left.rank ? right : left),
      best,
    ).change,
    activeCount: active.length,
  };
}
