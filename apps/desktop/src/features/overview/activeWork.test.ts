import type { PersistedProposedChange, ProposedChangeStatus } from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import { selectActiveWork } from "./activeWork";

function change(
  overrides: Partial<PersistedProposedChange> & { id: string },
): PersistedProposedChange {
  return {
    runId: `run-${overrides.id}`,
    repositoryId: "repo-here",
    title: `Title ${overrides.id}`,
    summary: "Summary",
    status: "ready_for_review",
    files: [],
    patchArtifacts: [],
    createdAt: "Today, 10:00",
    updatedAt: "Today, 10:00",
    ...overrides,
  };
}

describe("selectActiveWork", () => {
  it("finds a real proposal by repository, not by a known id", () => {
    const work = selectActiveWork([change({ id: "anything-at-all" })], "repo-here");

    expect(work?.proposal.id).toBe("anything-at-all");
    expect(work?.activeCount).toBe(1);
  });

  it("returns null when the repository has no proposal", () => {
    expect(selectActiveWork([], "repo-here")).toBeNull();
  });

  it("never returns another repository's proposal", () => {
    const work = selectActiveWork(
      [change({ id: "foreign", repositoryId: "repo-elsewhere" })],
      "repo-here",
    );

    expect(work).toBeNull();
  });

  // Each of these is either terminal or waiting on nobody. A card headed
  // "Active work" that showed an applied or rejected proposal would be naming
  // finished work as outstanding.
  it.each<ProposedChangeStatus>([
    "draft",
    "rejected",
    "superseded",
    "applied",
    "rolled_back",
  ])("does not treat %s as active work", (status) => {
    expect(selectActiveWork([change({ id: "done", status })], "repo-here")).toBeNull();
  });

  it.each<ProposedChangeStatus>(["quarantine_required", "ready_for_review", "approved"])(
    "treats %s as active work",
    (status) => {
      expect(
        selectActiveWork([change({ id: "live", status })], "repo-here")?.proposal.id,
      ).toBe("live");
    },
  );

  // A quarantined repository cannot accept another patch until a human records
  // an inspection (#1). It outranks a proposal merely waiting to be read, and
  // it must outrank it regardless of list order -- so assert both orders, or
  // the test passes on the tie-break rather than on the rank.
  it("shows a quarantine ahead of a proposal waiting for review", () => {
    const quarantined = change({ id: "blocked", status: "quarantine_required" });
    const waiting = change({ id: "waiting", status: "ready_for_review" });

    expect(selectActiveWork([waiting, quarantined], "repo-here")?.proposal.id).toBe(
      "blocked",
    );
    expect(selectActiveWork([quarantined, waiting], "repo-here")?.proposal.id).toBe(
      "blocked",
    );
  });

  it("shows a proposal waiting for review ahead of one already approved", () => {
    const approved = change({ id: "approved", status: "approved" });
    const waiting = change({ id: "waiting", status: "ready_for_review" });

    expect(selectActiveWork([approved, waiting], "repo-here")?.proposal.id).toBe(
      "waiting",
    );
    expect(selectActiveWork([waiting, approved], "repo-here")?.proposal.id).toBe(
      "waiting",
    );
  });

  it("counts every active proposal for the repository, not the ones it skipped", () => {
    const work = selectActiveWork(
      [
        change({ id: "one" }),
        change({ id: "two" }),
        change({ id: "done", status: "applied" }),
        change({ id: "foreign", repositoryId: "repo-elsewhere" }),
      ],
      "repo-here",
    );

    expect(work?.activeCount).toBe(2);
  });

  // Two proposals at the same rank: neither needs a human first, and
  // `updatedAt` cannot say which is newer (it holds "Today, 10:44" from the
  // creation path and an ISO string from the approval path). List order is the
  // tie-break, and it is stable rather than meaningful -- pinned so a future
  // sort-by-timestamp has to confront that this field cannot order anything.
  it("breaks a rank tie by list order", () => {
    const first = change({ id: "first", updatedAt: "Today, 9:05" });
    const second = change({ id: "second", updatedAt: "Today, 10:44" });

    expect(selectActiveWork([first, second], "repo-here")?.proposal.id).toBe("first");
    expect(selectActiveWork([second, first], "repo-here")?.proposal.id).toBe("second");
  });
});
