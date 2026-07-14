import { invoke } from "@tauri-apps/api/core";
import type {
  PatchValidationResult,
  ProposedChangeFile,
  ProposedPatchArtifact,
  RepositoryValidationSnapshot,
} from "@ai-dev/ai";

type NativePatchValidationResult = {
  repositoryId: string;
  filePath: string;
  status: PatchValidationResult["status"];
  message: string;
  artifactDigest?: string | null;
  repositorySnapshot?: RepositoryValidationSnapshot | null;
  validatedAt: string;
  dryRunAt?: string | null;
};

export async function dryRunGeneratedPatch(
  repositoryId: string,
  repositoryPath: string,
  artifact: ProposedPatchArtifact,
  file: ProposedChangeFile,
  artifactDigest: string,
  relevantFilePaths: string[],
): Promise<PatchValidationResult> {
  const result = await invoke<NativePatchValidationResult>(
    "validate_generated_patch",
    {
      input: {
        repositoryId,
        repositoryPath,
        filePath: artifact.filePath,
        operation: file.operation,
        isBinary: artifact.isBinary,
        rawDiff: artifact.rawDiff,
        artifactDigest,
        relevantFilePaths,
      },
    },
  );

  return {
    status: result.status,
    message: result.message,
    artifactDigest: result.artifactDigest ?? undefined,
    repositorySnapshot: result.repositorySnapshot ?? undefined,
    validatedAt: result.validatedAt,
    dryRunAt: result.dryRunAt ?? undefined,
  };
}
