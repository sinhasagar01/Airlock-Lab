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
    includes
  };
}
