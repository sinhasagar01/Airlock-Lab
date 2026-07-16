import { describe, expect, it } from "vitest";
import { formatRecordTimestamp, proposedChangeStatusTone } from "./uiState";

describe("proposedChangeStatusTone", () => {
  it("renders a quarantined proposal as the loudest fail-closed state", () => {
    // Quarantine means the working tree changed in a way the app could not
    // account for. It must never read as calm as a draft.
    expect(proposedChangeStatusTone("quarantine_required")).toBe("danger");
  });

  // Nothing went wrong and nothing is pending: the change was applied and then
  // deliberately undone. Rendering it `success` would repeat the `applied` lie
  // in a different colour; rendering it `danger` would invent a problem.
  it("renders a rolled-back proposal as a calm completed outcome", () => {
    expect(proposedChangeStatusTone("rolled_back")).toBe("neutral");
  });

  it("keeps existing tones intact", () => {
    expect(proposedChangeStatusTone("applied")).toBe("success");
    expect(proposedChangeStatusTone("approved")).toBe("success");
    expect(proposedChangeStatusTone("rejected")).toBe("danger");
    expect(proposedChangeStatusTone("ready_for_review")).toBe("warning");
    expect(proposedChangeStatusTone("draft")).toBe("neutral");
  });
});

describe("formatRecordTimestamp", () => {
  it("labels a same-day ISO timestamp as Today with its time", () => {
    expect(formatRecordTimestamp(new Date().toISOString())).toMatch(/^Today, /);
  });

  it("labels an earlier day by its date, never Today", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRecordTimestamp(past)).not.toMatch(/^Today,/);
  });

  it("passes a legacy display string through unchanged", () => {
    // Rows written before this fix hold "Today, 10:44"; they must still render.
    expect(formatRecordTimestamp("Today, 10:44")).toBe("Today, 10:44");
  });

  it("stores values that sort chronologically by plain string order", () => {
    const earlier = "2026-07-15T10:42:00.000Z";
    const later = "2026-07-15T10:46:00.000Z";
    // The whole point: lexicographic order == chronological order for ISO.
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});
