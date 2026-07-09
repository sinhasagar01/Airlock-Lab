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
  isGitRepository: boolean;
  branch: string;
  status: "indexed" | "indexing" | "not_indexed";
  openChanges: number;
  lastIndexedAt: string | null;
};

export type IndexingJobStatus = "queued" | "running" | "completed" | "failed";

export type IndexingJob = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  status: IndexingJobStatus;
  progress: number;
  step: string;
  createdAt: string;
  updatedAt: string;
};

export type IndexedFileFact = {
  repositoryId: string;
  path: string;
  sizeBytes: number;
  extension: string | null;
  modifiedAt: string | null;
};

export type FileTreeScanResult = {
  repositoryPath: string;
  scannedFiles: number;
  skippedEntries: number;
  files: IndexedFileFact[];
};

export type FilePreviewStatus =
  "ready" | "binary" | "too_large" | "outside_repository" | "unavailable";

export type FileContentPreview = {
  path: string;
  status: FilePreviewStatus;
  content: string | null;
  sizeBytes: number;
  maxSizeBytes: number;
};

export type FileExtensionSummary = {
  extension: string;
  count: number;
};

export type ProjectFolderSummary = {
  name: string;
  fileCount: number;
};

export type KeyFileSummary = {
  name: string;
  path: string;
};

export type FrameworkHintSummary = {
  name: string;
  evidence: string;
};

export type RepositoryIntelligenceSummary = {
  totalIndexedFiles: number;
  totalIndexedDirectories: number | null;
  topExtensions: FileExtensionSummary[];
  projectFolders: ProjectFolderSummary[];
  keyFiles: KeyFileSummary[];
  frameworkHints: FrameworkHintSummary[];
  packageMetadataAvailable: boolean;
};

const importantProjectFolders = [
  "apps",
  "packages",
  "src",
  "components",
  "docs",
  "tests",
  "scripts",
  "config",
];

const importantKeyFiles = [
  "package.json",
  "README.md",
  "tsconfig.json",
  "vite.config.ts",
  "tauri.conf.json",
  "Cargo.toml",
  "CHANGELOG.md",
  "PROJECT-STATE.md",
];

function repositoryNameFromPath(path: string): string {
  const normalizedPath = path.replace(/\/$/, "");
  const pathSegments = normalizedPath.split("/");
  return pathSegments.at(-1) || normalizedPath;
}

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function deriveRepositoryIntelligence(
  files: IndexedFileFact[],
): RepositoryIntelligenceSummary {
  const extensionCounts = new Map<string, number>();
  const directoryPaths = new Set<string>();
  const folderCounts = new Map<string, number>();
  const keyFiles = new Map<string, KeyFileSummary>();

  for (const file of files) {
    const extension = file.extension ?? "none";
    extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);

    const segments = pathSegments(file.path);
    const fileName = segments.at(-1) ?? file.path;
    const directories = segments.slice(0, -1);

    for (let index = 0; index < directories.length; index += 1) {
      directoryPaths.add(directories.slice(0, index + 1).join("/"));
    }

    for (const folderName of importantProjectFolders) {
      if (directories.includes(folderName)) {
        folderCounts.set(folderName, (folderCounts.get(folderName) ?? 0) + 1);
      }
    }

    if (importantKeyFiles.includes(fileName) && !keyFiles.has(fileName)) {
      keyFiles.set(fileName, {
        name: fileName,
        path: file.path,
      });
    }
  }

  const topExtensions = [...extensionCounts.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count || left.extension.localeCompare(right.extension))
    .slice(0, 8);

  const projectFolders = importantProjectFolders
    .filter((folderName) => folderCounts.has(folderName))
    .map((folderName) => ({
      name: folderName,
      fileCount: folderCounts.get(folderName) ?? 0,
    }));

  const orderedKeyFiles = importantKeyFiles
    .map((fileName) => keyFiles.get(fileName))
    .filter((file): file is KeyFileSummary => Boolean(file));

  const keyFileNames = new Set(orderedKeyFiles.map((file) => file.name));
  const extensionNames = new Set(topExtensions.map((item) => item.extension));
  const frameworkHints: FrameworkHintSummary[] = [];

  if (
    keyFileNames.has("tsconfig.json") ||
    extensionNames.has("ts") ||
    extensionNames.has("tsx")
  ) {
    frameworkHints.push({
      name: "TypeScript",
      evidence: keyFileNames.has("tsconfig.json")
        ? "tsconfig.json indexed"
        : "TypeScript file extensions indexed",
    });
  }

  if (extensionNames.has("tsx")) {
    frameworkHints.push({
      name: "React",
      evidence: "TSX files indexed",
    });
  }

  if (keyFileNames.has("vite.config.ts")) {
    frameworkHints.push({
      name: "Vite",
      evidence: "vite.config.ts indexed",
    });
  }

  if (keyFileNames.has("tauri.conf.json") || keyFileNames.has("Cargo.toml")) {
    frameworkHints.push({
      name: "Tauri",
      evidence: keyFileNames.has("tauri.conf.json")
        ? "tauri.conf.json indexed"
        : "Cargo.toml indexed",
    });
  }

  if (keyFileNames.has("README.md") || folderCounts.has("docs")) {
    frameworkHints.push({
      name: "Documentation",
      evidence: keyFileNames.has("README.md") ? "README.md indexed" : "docs folder indexed",
    });
  }

  return {
    totalIndexedFiles: files.length,
    totalIndexedDirectories: files.length > 0 ? directoryPaths.size : null,
    topExtensions,
    projectFolders,
    keyFiles: orderedKeyFiles,
    frameworkHints,
    packageMetadataAvailable: false,
  };
}

export function createRepositorySummaryFromPath(
  path: string,
): RepositorySummary {
  return {
    id: `repo-${path}`,
    name: repositoryNameFromPath(path),
    path,
    isGitRepository: false,
    branch: "unknown",
    status: "not_indexed",
    openChanges: 0,
    lastIndexedAt: null,
  };
}

export function createIndexingJob(repository: RepositorySummary): IndexingJob {
  const timestamp = new Date().toISOString();

  return {
    id: `index-${repository.id}-${timestamp}`,
    repositoryId: repository.id,
    repositoryName: repository.name,
    status: "queued",
    progress: 0,
    step: "Waiting to scan repository files",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

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
      isGitRepository: true,
      branch: "main",
      status: "indexed",
      openChanges: 0,
      lastIndexedAt: "Today, 10:24",
    },
  ];
}
