import { invoke } from "@tauri-apps/api/core";
import type { RepositoryValidationSnapshot } from "@ai-dev/ai";

export async function loadRepositoryValidationSnapshot(
  repositoryId: string,
  repositoryPath: string,
  artifactDigest: string,
  relevantFilePaths: string[],
): Promise<RepositoryValidationSnapshot> {
  return invoke<RepositoryValidationSnapshot>(
    "load_repository_validation_snapshot",
    {
      input: {
        repositoryId,
        repositoryPath,
        artifactDigest,
        relevantFilePaths,
      },
    },
  );
}
