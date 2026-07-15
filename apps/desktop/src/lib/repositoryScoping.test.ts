import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import {
  resolveAgentRunRepositoryId,
  resolveApprovalRepositoryId,
  scopeRecordsToRepository,
} from "./repositoryScoping";

function proposal(
  overrides: Pick<PersistedProposedChange, "id" | "runId" | "repositoryId"> &
    Partial<PersistedProposedChange>,
): PersistedProposedChange {
  return {
    title: "Proposal",
    summary: "Proposal summary",
    status: "ready_for_review",
    files: [],
    patchArtifacts: [],
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
    ...overrides,
  };
}

function approval(overrides: Pick<ApprovalRequest, "id" | "agentRunId">) {
  return {
    title: "Approval",
    repository: "Display name only",
    status: "pending",
    risk: "low",
    summary: "Approval summary",
    files: [],
    createdAt: "Today, 10:46",
    ...overrides,
  } satisfies ApprovalRequest;
}

describe("resolveAgentRunRepositoryId", () => {
  it("resolves a run through the proposal that links it, not the first proposal", () => {
    // The decoy is first on purpose: a resolver that reaches for `changes[0]`
    // returns `repo-beta` here and the assertion catches it.
    const changes = [
      proposal({ id: "p-beta", runId: "run-beta", repositoryId: "repo-beta" }),
      proposal({
        id: "p-alpha",
        runId: "run-alpha",
        repositoryId: "repo-alpha",
      }),
    ];

    expect(resolveAgentRunRepositoryId("run-alpha", changes)).toBe(
      "repo-alpha",
    );
  });

  it("returns null for a run no proposal links", () => {
    const changes = [
      proposal({ id: "p-beta", runId: "run-beta", repositoryId: "repo-beta" }),
    ];

    expect(resolveAgentRunRepositoryId("run-orphan", changes)).toBeNull();
  });
});

describe("resolveApprovalRepositoryId", () => {
  it("resolves an approval through a proposal carrying its approval id", () => {
    // No proposal carries `run-alpha`, so only the approval-id link can
    // resolve this. A resolver that consults the run link alone returns null.
    const changes = [
      proposal({
        id: "p-alpha",
        runId: "run-superseded",
        approvalRequestId: "approval-alpha",
        repositoryId: "repo-alpha",
      }),
    ];

    expect(
      resolveApprovalRepositoryId(
        approval({ id: "approval-alpha", agentRunId: "run-alpha" }),
        changes,
      ),
    ).toBe("repo-alpha");
  });

  it("resolves an approval through its run when no proposal carries the approval id", () => {
    // The mirror of the case above: a resolver that consults the approval-id
    // link alone returns null here.
    const changes = [
      proposal({ id: "p-beta", runId: "run-beta", repositoryId: "repo-beta" }),
    ];

    expect(
      resolveApprovalRepositoryId(
        approval({ id: "approval-beta", agentRunId: "run-beta" }),
        changes,
      ),
    ).toBe("repo-beta");
  });

  it("returns null when neither link resolves", () => {
    const changes = [
      proposal({
        id: "p-beta",
        runId: "run-beta",
        approvalRequestId: "approval-beta",
        repositoryId: "repo-beta",
      }),
    ];

    expect(
      resolveApprovalRepositoryId(
        approval({ id: "approval-orphan", agentRunId: "run-orphan" }),
        changes,
      ),
    ).toBeNull();
  });
});

describe("scopeRecordsToRepository", () => {
  const activeRecord = { id: "record-active", repositoryId: "repo-active" };
  const otherRecord = { id: "record-other", repositoryId: "repo-other" };
  const demoRecord = { id: "record-demo", repositoryId: "repo-workspace" };
  const orphanRecord = { id: "record-orphan", repositoryId: null };

  function scope(
    records: readonly { id: string; repositoryId: string | null }[],
    savedRepositoryIds: readonly string[] = ["repo-active", "repo-other"],
    activeRepositoryId = "repo-active",
  ) {
    return scopeRecordsToRepository({
      records,
      resolveRepositoryId: (record) => record.repositoryId,
      activeRepositoryId,
      savedRepositoryIds,
    });
  }

  it("scopes a record whose repository is the active one", () => {
    const { scoped, unlinked } = scope([activeRecord]);

    expect(scoped).toEqual([activeRecord]);
    expect(unlinked).toEqual([]);
  });

  it("hides a record belonging to a different saved repository", () => {
    // Neither list: this record is another repository's work. Showing it under
    // the active repository is the aggregate lie; putting it in the unlinked
    // group would mislabel a record whose link resolves perfectly well.
    const { scoped, unlinked } = scope([activeRecord, otherRecord]);

    expect(scoped).toEqual([activeRecord]);
    expect(unlinked).toEqual([]);
  });

  it("groups a record with no repository link as unlinked", () => {
    const { scoped, unlinked } = scope([orphanRecord]);

    expect(scoped).toEqual([]);
    expect(unlinked).toEqual([orphanRecord]);
  });

  it("groups a record naming a repository nothing has saved as unlinked", () => {
    // The shipped demo records: `repo-workspace` matches no real `repo-${path}`
    // once hydration has installed one.
    const { scoped, unlinked } = scope(
      [activeRecord, demoRecord],
      ["repo-active", "repo-other"],
      "repo-active",
    );

    expect(scoped).toEqual([activeRecord]);
    expect(unlinked).toEqual([demoRecord]);
  });

  it("resolves a record to the mock fixture repository while that fixture is the active one", () => {
    // Uniform resolution, no demo special-casing. Before hydration -- and
    // permanently when storage fails -- `repo-workspace` is a repository in the
    // list, and the demo record genuinely belongs to it.
    const { scoped, unlinked } = scope(
      [demoRecord],
      ["repo-workspace"],
      "repo-workspace",
    );

    expect(scoped).toEqual([demoRecord]);
    expect(unlinked).toEqual([]);
  });

  it("groups every record as unlinked when no repository is saved", () => {
    const { scoped, unlinked } = scope(
      [activeRecord, demoRecord],
      [],
      "no-repository",
    );

    expect(scoped).toEqual([]);
    expect(unlinked).toEqual([activeRecord, demoRecord]);
  });
});
