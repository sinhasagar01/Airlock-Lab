import { describe, expect, it } from "vitest";
import { proposedChangeStatusTone } from "./uiState";

describe("proposedChangeStatusTone", () => {
  it("renders a quarantined proposal as the loudest fail-closed state", () => {
    // Quarantine means the working tree changed in a way the app could not
    // account for. It must never read as calm as a draft.
    expect(proposedChangeStatusTone("quarantine_required")).toBe("danger");
  });

  it("keeps existing tones intact", () => {
    expect(proposedChangeStatusTone("applied")).toBe("success");
    expect(proposedChangeStatusTone("approved")).toBe("success");
    expect(proposedChangeStatusTone("rejected")).toBe("danger");
    expect(proposedChangeStatusTone("ready_for_review")).toBe("warning");
    expect(proposedChangeStatusTone("draft")).toBe("neutral");
  });
});
