export type ScanTarget = {
  path: string;
  includeGitState: boolean;
  includeDocumentation: boolean;
};

export type ScanTargetSummary = {
  path: string;
  mode: "facts-first";
  includes: string[];
};

export type RepositorySummary = {
  id: string;
  name: string;
  path: string;
  branch: string;
  status: "indexed" | "indexing" | "not_indexed";
  openChanges: number;
  lastIndexedAt: string | null;
};

export function summarizeScanTarget(target: ScanTarget): ScanTargetSummary {
  const includes = ["file-tree"];

  if (target.includeGitState) {
    includes.push("git-state");
  }

  if (target.includeDocumentation) {
    includes.push("documentation");
  }

  return {
    path: target.path,
    mode: "facts-first",
    includes,
  };
}

export function createMockRepositories(): RepositorySummary[] {
  return [
    {
      id: "repo-workspace",
      name: "AI-Developer-Workspace",
      path: "/Users/sagarakspuchu/Documents/AI Developer Workspace",
      branch: "main",
      status: "indexed",
      openChanges: 0,
      lastIndexedAt: "Today, 10:24",
    },
    {
      id: "repo-empty-state",
      name: "Select another repository",
      path: "/select/a/repository",
      branch: "none",
      status: "not_indexed",
      openChanges: 0,
      lastIndexedAt: null,
    },
  ];
}
