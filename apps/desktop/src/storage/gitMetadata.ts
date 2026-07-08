import { invoke } from "@tauri-apps/api/core";
import type { RepositorySummary } from "@ai-dev/indexing";

type RepositoryGitMetadata = {
  is_git_repository: boolean;
  branch: string;
  open_changes: number;
};

export async function loadRepositoryGitMetadata(
  repository: RepositorySummary,
): Promise<RepositorySummary> {
  const metadata = await invoke<RepositoryGitMetadata>(
    "load_repository_git_metadata",
    {
      repositoryPath: repository.path,
    },
  );

  return {
    ...repository,
    isGitRepository: metadata.is_git_repository,
    branch: metadata.branch,
    openChanges: metadata.open_changes,
  };
}

export async function loadRepositoriesGitMetadata(
  repositories: RepositorySummary[],
): Promise<RepositorySummary[]> {
  return Promise.all(
    repositories.map(async (repository) => {
      try {
        return await loadRepositoryGitMetadata(repository);
      } catch {
        return repository;
      }
    }),
  );
}
