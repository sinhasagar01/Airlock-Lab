import { invoke } from "@tauri-apps/api/core";
import type {
  PatchValidationResult,
  ProposedChangeFile,
  ProposedPatchArtifact,
} from "@ai-dev/ai";

type NativePatchValidationResult = {
  repositoryId: string;
  filePath: string;
  status: PatchValidationResult["status"];
  message: string;
  validatedAt: string;
};

export async function dryRunGeneratedPatch(
  repositoryId: string,
  repositoryPath: string,
  artifact: ProposedPatchArtifact,
  file: ProposedChangeFile,
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
      },
    },
  );

  return {
    status: result.status,
    message: result.message,
    validatedAt: result.validatedAt,
  };
}
