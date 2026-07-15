import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";
import { describe, expect, it } from "vitest";
import {
  isSeededRecordId,
  isSeededRunId,
  isUntouchedSeededApproval,
  isUntouchedSeededProposal,
} from "./seedRecords";

function seededApproval(
  overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest {
  return {
    id: "approval-provider-rfc",
    title: "Approve provider abstraction patch plan",
    repository: "AI-Developer-Workspace",
    agentRunId: "run-mvp-shell",
    status: "pending",
    risk: "medium",
    summary: "Review the proposed provider adapter sequence.",
    files: ["packages/ai/src/index.ts"],
    createdAt: "Today, 10:42",
    ...overrides,
  };
}

function seededProposal(
  overrides: Partial<PersistedProposedChange> = {},
): PersistedProposedChange {
  return {
    id: "proposal-mvp-shell",
    runId: "run-mvp-shell",
    approvalRequestId: "approval-provider-rfc",
    repositoryId: "repo-workspace",
    title: "Draft app shell implementation plan",
    summary: "Durable proposal record.",
    status: "ready_for_review",
    files: [],
    patchArtifacts: [],
    createdAt: "Today, 10:42",
    updatedAt: "Today, 10:42",
    ...overrides,
  };
}

describe("seed record identification", () => {
  it("recognises the shipped demo ids", () => {
    expect(isSeededRecordId("proposal-mvp-shell")).toBe(true);
    expect(isSeededRecordId("approval-indexing-job")).toBe(true);
    expect(isSeededRunId("run-mvp-shell")).toBe(true);
  });

  it("never claims a user record is a demo record", () => {
    // User records are keyed on a timestamp, so they cannot collide.
    expect(isSeededRecordId("proposal-run-1783532400000")).toBe(false);
    expect(isSeededRecordId("approval-run-1783532400000")).toBe(false);
    expect(isSeededRunId("run-1783532400000")).toBe(false);
    expect(isSeededRecordId(undefined)).toBe(false);
  });
});

describe("untouched seed detection", () => {
  it("treats a pending seeded approval as untouched", () => {
    expect(isUntouchedSeededApproval(seededApproval())).toBe(true);
  });

  it("treats a decided seeded approval as touched", () => {
    // Approving a demo record is a real human decision about a fake subject.
    // The subject is fabricated; the act is not, so it must not be deleted.
    expect(
      isUntouchedSeededApproval(seededApproval({ status: "approved" })),
    ).toBe(false);
    expect(
      isUntouchedSeededApproval(seededApproval({ status: "rejected" })),
    ).toBe(false);
  });

  it("never treats a non-seeded approval as an untouched seed", () => {
    expect(
      isUntouchedSeededApproval(seededApproval({ id: "approval-run-123" })),
    ).toBe(false);
  });

  it("treats a proposal carrying apply or validation evidence as touched", () => {
    expect(isUntouchedSeededProposal(seededProposal())).toBe(true);
    expect(
      isUntouchedSeededProposal(seededProposal({ status: "approved" })),
    ).toBe(false);
    expect(
      isUntouchedSeededProposal(
        seededProposal({
          patchArtifacts: [
            {
              id: "artifact-1",
              proposedChangeId: "proposal-mvp-shell",
              filePath: "packages/ai/src/index.ts",
              status: "generated",
              isBinary: false,
              isTooLarge: false,
              applyStatus: "applied_verified",
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
