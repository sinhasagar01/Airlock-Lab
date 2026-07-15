import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";

/**
 * Which repository a record belongs to.
 *
 * `AgentRun.repository` and `ApprovalRequest.repository` are display *names*,
 * not ids, so neither can answer this. The durable link runs through the
 * proposal: `proposal.runId` / `proposal.approvalRequestId` -> `repositoryId`.
 * That is the same link the apply readiness gate already compares against the
 * active repository (`repositoryMatches`), so the lists and the gate agree
 * about what "this repository's work" means.
 */
export function resolveAgentRunRepositoryId(
  runId: string,
  changes: readonly PersistedProposedChange[],
): string | null {
  return changes.find((change) => change.runId === runId)?.repositoryId ?? null;
}

export function resolveApprovalRepositoryId(
  approval: ApprovalRequest,
  changes: readonly PersistedProposedChange[],
): string | null {
  return (
    changes.find(
      (change) =>
        change.approvalRequestId === approval.id ||
        change.runId === approval.agentRunId,
    )?.repositoryId ?? null
  );
}

/**
 * Split records into the active repository's work and work that names no
 * repository this app has saved.
 *
 * Three outcomes, not two. A record belonging to a *different* saved repository
 * is in neither list: it is that repository's work, and rendering it under this
 * repository's selector is the aggregate lie -- every row accurate, the screen
 * as a whole misleading. A record whose link does not resolve is never dropped;
 * hiding a record is its own dishonesty, and the roadmap records that these
 * links can dangle. It goes to `unlinked` and is labelled on screen.
 *
 * Resolution is uniform: no record is special-cased by id. The shipped demo
 * records name `repo-workspace`, which no real `repo-${path}` can match -- but
 * `createMockRepositories()` returns exactly that id, and it is the repository
 * list's initial value, so before hydration (and permanently if storage fails)
 * a demo record resolves to the fixture repository it genuinely belongs to.
 */
export function scopeRecordsToRepository<T>({
  records,
  resolveRepositoryId,
  activeRepositoryId,
  savedRepositoryIds,
}: {
  records: readonly T[];
  resolveRepositoryId: (record: T) => string | null;
  activeRepositoryId: string;
  savedRepositoryIds: readonly string[];
}): { scoped: T[]; unlinked: T[] } {
  const savedIds = new Set(savedRepositoryIds);
  const scoped: T[] = [];
  const unlinked: T[] = [];

  for (const record of records) {
    const repositoryId = resolveRepositoryId(record);

    if (repositoryId === null || !savedIds.has(repositoryId)) {
      unlinked.push(record);
      continue;
    }

    if (repositoryId === activeRepositoryId) {
      scoped.push(record);
    }
  }

  return { scoped, unlinked };
}
