import {
  ensureProposedPatchArtifacts,
  type AgentRun,
  type ApprovalRequest,
  type PersistedProposedChange,
} from "@ai-dev/ai";
import { mockApprovalRequests, mockProposedChanges } from "./appData";

const LEGACY_SEEDED_AI_PATCH =
  "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts\n@@ -1,2 +1,3 @@\n-export type OldPlan = string;\n+export type NewPlan = string;\n+export type PatchArtifact = string;";

function migrateSeededProposedChange(
  savedChange: PersistedProposedChange,
  seededChange: PersistedProposedChange,
): PersistedProposedChange {
  if (savedChange.id !== "proposal-mvp-shell") {
    return savedChange;
  }

  const seededArtifacts = new Map(
    seededChange.patchArtifacts.map((artifact) => [artifact.id, artifact]),
  );

  return {
    ...savedChange,
    patchArtifacts: savedChange.patchArtifacts.map((artifact) => {
      const seededArtifact = seededArtifacts.get(artifact.id);

      if (
        artifact.id !== "proposal-mvp-shell-ai-patch-artifact" ||
        artifact.rawDiff !== LEGACY_SEEDED_AI_PATCH ||
        !seededArtifact?.rawDiff
      ) {
        return artifact;
      }

      return {
        ...artifact,
        rawDiff: seededArtifact.rawDiff,
        validationStatus: "not_validated",
        validationMessage: undefined,
        validatedAt: undefined,
      };
    }),
  };
}

export function mergeSeedApprovalRequests(
  savedRequests: ApprovalRequest[],
): ApprovalRequest[] {
  const savedById = new Map(savedRequests.map((request) => [request.id, request]));
  const seededIds = new Set(mockApprovalRequests.map((request) => request.id));
  const seededOrSaved = mockApprovalRequests.map(
    (request) => savedById.get(request.id) ?? request,
  );
  const savedExtras = savedRequests.filter((request) => !seededIds.has(request.id));

  return [...seededOrSaved, ...savedExtras];
}

export function reconcileAgentRunApprovalStatuses(
  runs: AgentRun[],
  approvals: ApprovalRequest[],
): AgentRun[] {
  const approvalsByRunId = new Map(
    approvals.map((approval) => [approval.agentRunId, approval]),
  );

  return runs.map((run) => {
    const approval = approvalsByRunId.get(run.id);

    if (!approval || approval.status === "pending") {
      return run;
    }

    return {
      ...run,
      status: "completed",
      nextStep:
        approval.status === "approved"
          ? "Approval completed. No patch has been applied."
          : "Approval rejected. No patch has been applied.",
    };
  });
}

export function mergeSeedProposedChanges(
  savedChanges: PersistedProposedChange[],
): PersistedProposedChange[] {
  const savedById = new Map(savedChanges.map((change) => [change.id, change]));
  const seededIds = new Set(mockProposedChanges.map((change) => change.id));
  const seededOrSaved = mockProposedChanges.map((change) => {
    const savedChange = savedById.get(change.id);

    return ensureProposedPatchArtifacts(
      savedChange ? migrateSeededProposedChange(savedChange, change) : change,
    );
  });
  const savedExtras = savedChanges
    .filter((change) => !seededIds.has(change.id))
    .map(ensureProposedPatchArtifacts);

  return [...seededOrSaved, ...savedExtras];
}
