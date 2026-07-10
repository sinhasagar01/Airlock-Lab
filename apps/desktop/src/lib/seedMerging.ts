import {
  ensureProposedPatchArtifacts,
  type ApprovalRequest,
  type PersistedProposedChange,
} from "@ai-dev/ai";
import { mockApprovalRequests, mockProposedChanges } from "./appData";

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

export function mergeSeedProposedChanges(
  savedChanges: PersistedProposedChange[],
): PersistedProposedChange[] {
  const savedById = new Map(savedChanges.map((change) => [change.id, change]));
  const seededIds = new Set(mockProposedChanges.map((change) => change.id));
  const seededOrSaved = mockProposedChanges.map((change) =>
    ensureProposedPatchArtifacts(savedById.get(change.id) ?? change),
  );
  const savedExtras = savedChanges
    .filter((change) => !seededIds.has(change.id))
    .map(ensureProposedPatchArtifacts);

  return [...seededOrSaved, ...savedExtras];
}
