import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";
import { primaryNavigation } from "@ai-dev/core";
import type { GitFileDiff, GitStatusSummary } from "@ai-dev/core";
import type {
  FileContentPreview,
  IndexedFileFact,
  IndexingJob,
  RepositorySummary,
} from "@ai-dev/indexing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { previewRepositoryFile } from "./storage/filePreview";
import { scanRepositoryFileTree } from "./storage/fileTreeScanner";
import { loadGitFileDiff, loadGitStatusSummary } from "./storage/gitChanges";
import { loadIndexingJobs } from "./storage/indexingJobStore";
import { loadIndexedFileFacts } from "./storage/indexedFileStore";
import { KNOWN_SEED_RECORD_IDS } from "./lib/seedRecords";
import { dryRunGeneratedPatch } from "./storage/patchValidation";
import {
  acknowledgePatchApplyAttempt,
  applyApprovedPatchArtifact,
  reconcileInterruptedPatchApplyAttempts,
  rollbackAppliedPatchArtifact,
} from "./storage/patchApplication";
import { loadRepositoryValidationSnapshot } from "./storage/repositoryValidationSnapshot";
import {
  deleteApprovalRequestById,
  saveApprovalRequest,
  saveApprovalRequests,
  updateApprovalRequestStatus,
} from "./storage/approvalRequestStore";
import { saveAgentRunRecord } from "./storage/agentRunStore";
import {
  loadProposedChanges,
  saveProposedChange,
  saveProposedChanges,
} from "./storage/proposedChangeStore";
import {
  loadSavedRepositories,
  saveRepositories,
} from "./storage/repositoryStore";
import {
  isTauriRuntime,
  pickRepositoryDirectories,
  RepositoryPickerError,
} from "./storage/repositoryPicker";
import {
  loadOpenAiProviderConfiguration,
  requestOpenAiPlan,
  testOpenAiConnection,
} from "./storage/providerRuntime";

const mockState = vi.hoisted(() => {
  const repository: RepositorySummary = {
    id: "repo-workspace",
    name: "AI-Developer-Workspace",
    path: "/workspace",
    isGitRepository: true,
    branch: "main",
    status: "indexed",
    openChanges: 0,
    lastIndexedAt: "Today, 10:24",
  };

  const files: IndexedFileFact[] = [
    {
      repositoryId: repository.id,
      path: "src/App.tsx",
      sizeBytes: 1280,
      extension: "tsx",
      modifiedAt: "Today, 11:00",
    },
    {
      repositoryId: repository.id,
      path: "apps/desktop/src/main.tsx",
      sizeBytes: 620,
      extension: "tsx",
      modifiedAt: "Today, 11:03",
    },
    {
      repositoryId: repository.id,
      path: "packages/indexing/src/index.ts",
      sizeBytes: 2048,
      extension: "ts",
      modifiedAt: "Today, 11:04",
    },
    {
      repositoryId: repository.id,
      path: "docs/features/file-preview.md",
      sizeBytes: 980,
      extension: "md",
      modifiedAt: "Today, 11:05",
    },
    {
      repositoryId: repository.id,
      path: "README.md",
      sizeBytes: 512,
      extension: "md",
      modifiedAt: "Today, 11:06",
    },
    {
      repositoryId: repository.id,
      path: "package.json",
      sizeBytes: 640,
      extension: "json",
      modifiedAt: "Today, 11:07",
    },
    {
      repositoryId: repository.id,
      path: "tsconfig.json",
      sizeBytes: 520,
      extension: "json",
      modifiedAt: "Today, 11:08",
    },
    {
      repositoryId: repository.id,
      path: "vite.config.ts",
      sizeBytes: 440,
      extension: "ts",
      modifiedAt: "Today, 11:09",
    },
    {
      repositoryId: repository.id,
      path: "apps/desktop/src-tauri/tauri.conf.json",
      sizeBytes: 760,
      extension: "json",
      modifiedAt: "Today, 11:10",
    },
    {
      repositoryId: repository.id,
      path: "Cargo.toml",
      sizeBytes: 410,
      extension: "toml",
      modifiedAt: "Today, 11:11",
    },
    {
      repositoryId: repository.id,
      path: "CHANGELOG.md",
      sizeBytes: 820,
      extension: "md",
      modifiedAt: "Today, 11:12",
    },
    {
      repositoryId: repository.id,
      path: "PROJECT-STATE.md",
      sizeBytes: 780,
      extension: "md",
      modifiedAt: "Today, 11:13",
    },
    {
      repositoryId: repository.id,
      path: "scripts/run-index.sh",
      sizeBytes: 300,
      extension: "sh",
      modifiedAt: "Today, 11:14",
    },
    {
      repositoryId: repository.id,
      path: "config/workspace.json",
      sizeBytes: 360,
      extension: "json",
      modifiedAt: "Today, 11:15",
    },
  ];

  const approvals: ApprovalRequest[] = [
    {
      id: "approval-provider-rfc",
      title: "Approve provider abstraction patch plan",
      repository: repository.name,
      agentRunId: "run-mvp-shell",
      status: "pending",
      risk: "medium",
      summary:
        "Review the provider adapter sequence before implementation touches shared AI package contracts.",
      files: ["packages/ai/src/index.ts", "docs/specs/provider-api.md"],
      createdAt: "Today, 10:42",
    },
    {
      id: "approval-indexing-job",
      title: "Approve indexing job persistence follow-up",
      repository: repository.name,
      agentRunId: "run-index-refresh",
      status: "pending",
      risk: "low",
      summary:
        "Confirm the indexing job flow before it records file-tree facts.",
      files: ["packages/indexing/src/index.ts"],
      createdAt: "Today, 10:46",
    },
  ];

  return {
    approvals,
    files,
    gitStatus: {
      repositoryId: repository.id,
      repositoryPath: repository.path,
      branch: "main",
      headSha: "abc1234",
      isGitRepository: true,
      isClean: false,
      changedFileCount: 3,
      stagedCount: 1,
      unstagedCount: 1,
      untrackedCount: 1,
      conflictedCount: 0,
      refreshedAt: "1783532100",
      files: [
        {
          path: "apps/desktop/src/App.tsx",
          kind: "modified",
          stage: "unstaged",
          statusCode: " M",
        },
        {
          path: "packages/git/src/index.ts",
          kind: "added",
          stage: "staged",
          statusCode: "A ",
        },
        {
          path: "docs/features/git-status.md",
          kind: "untracked",
          stage: "untracked",
          statusCode: "??",
        },
      ],
    } as GitStatusSummary,
    gitDiff: {
      repositoryId: repository.id,
      repositoryPath: repository.path,
      filePath: "apps/desktop/src/App.tsx",
      kind: "unstaged",
      isBinary: false,
      isTooLarge: false,
      lineCount: 7,
      additions: 1,
      deletions: 1,
      rawDiff:
        "diff --git a/apps/desktop/src/App.tsx b/apps/desktop/src/App.tsx\n@@ -1,3 +1,3 @@\n-export const label = 'old';\n+export const label = 'new';",
      lines: [
        {
          type: "metadata",
          content:
            "diff --git a/apps/desktop/src/App.tsx b/apps/desktop/src/App.tsx",
        },
        {
          type: "hunk",
          content: "@@ -1,3 +1,3 @@",
        },
        {
          type: "removed",
          content: "-export const label = 'old';",
        },
        {
          type: "added",
          content: "+export const label = 'new';",
        },
      ],
      refreshedAt: "1783532100",
    } as GitFileDiff,
    indexingJobs: [] as IndexingJob[],
    proposedChanges: [
      {
        id: "proposal-mvp-shell",
        runId: "run-mvp-shell",
        approvalRequestId: "approval-provider-rfc",
        repositoryId: repository.id,
        title: "Draft app shell implementation plan",
        summary:
          "Persisted proposal record for reviewing the app shell plan before file writes.",
        status: "ready_for_review",
        files: [
          {
            id: "proposal-file-app",
            path: "apps/desktop/src/App.tsx",
            operation: "modify",
            reason:
              "Primary shell and run-detail composition lives here today.",
            riskLevel: "medium",
            patchArtifactStatus: "not_generated",
          },
          {
            id: "proposal-file-ai",
            path: "packages/ai/src/index.ts",
            operation: "modify",
            reason: "Agent contracts need durable proposal shapes.",
            riskLevel: "medium",
            patchArtifactStatus: "generated",
          },
          {
            id: "proposal-file-docs",
            path: "docs/specs/provider-api.md",
            operation: "modify",
            reason: "Provider API docs need generated patch review.",
            riskLevel: "low",
            patchArtifactStatus: "failed",
          },
          {
            id: "proposal-file-rfc",
            path: "docs/rfcs/provider-abstraction.md",
            operation: "modify",
            reason: "Provider abstraction RFC needs generated patch review.",
            riskLevel: "low",
            patchArtifactStatus: "unavailable",
          },
        ],
        patchArtifacts: [
          {
            id: "proposal-file-app-patch-artifact",
            proposedChangeId: "proposal-mvp-shell",
            filePath: "apps/desktop/src/App.tsx",
            status: "not_generated",
            isBinary: false,
            isTooLarge: false,
          },
          {
            id: "proposal-file-ai-patch-artifact",
            proposedChangeId: "proposal-mvp-shell",
            filePath: "packages/ai/src/index.ts",
            status: "generated",
            isBinary: false,
            isTooLarge: false,
            additions: 2,
            deletions: 1,
            rawDiff:
              "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts\n--- a/packages/ai/src/index.ts\n+++ b/packages/ai/src/index.ts\n@@ -1,2 +1,3 @@\n-export type OldPlan = string;\n+export type NewPlan = string;\n+export type PatchArtifact = string;",
            createdAt: "Today, 10:44",
          },
          {
            id: "proposal-file-docs-patch-artifact",
            proposedChangeId: "proposal-mvp-shell",
            filePath: "docs/specs/provider-api.md",
            status: "failed",
            isBinary: false,
            isTooLarge: false,
            createdAt: "Today, 10:45",
          },
          {
            id: "proposal-file-rfc-patch-artifact",
            proposedChangeId: "proposal-mvp-shell",
            filePath: "docs/rfcs/provider-abstraction.md",
            status: "unavailable",
            isBinary: false,
            isTooLarge: false,
          },
        ],
        createdAt: "Today, 10:42",
        updatedAt: "Today, 10:42",
      },
      {
        id: "proposal-index-refresh",
        runId: "run-index-refresh",
        approvalRequestId: "approval-indexing-job",
        repositoryId: repository.id,
        title: "Refresh repository context index",
        summary:
          "Persisted proposal record for indexing persistence follow-up work.",
        status: "ready_for_review",
        files: [
          {
            id: "proposal-file-indexing",
            path: "packages/indexing/src/index.ts",
            operation: "modify",
            reason:
              "Repository intelligence helpers derive context from facts.",
            riskLevel: "low",
            patchArtifactStatus: "not_generated",
          },
        ],
        patchArtifacts: [],
        createdAt: "Today, 10:46",
        updatedAt: "Today, 10:46",
      },
    ] as PersistedProposedChange[],
    preview: {
      path: files[0].path,
      status: "ready",
      content: "export function App() {}",
      sizeBytes: files[0].sizeBytes,
      maxSizeBytes: 65536,
    } as FileContentPreview | Promise<FileContentPreview>,
    repositories: [repository],
  };
});

vi.mock("./storage/repositoryPicker", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./storage/repositoryPicker")>();

  return {
    ...actual,
    isTauriRuntime: vi.fn(() => true),
    pickRepositoryDirectories: vi.fn(async () => null),
  };
});

vi.mock("./storage/repositoryStore", () => ({
  loadSavedRepositories: vi.fn(async () => mockState.repositories),
  saveRepositories: vi.fn(async () => undefined),
}));

vi.mock("./storage/gitMetadata", () => ({
  loadRepositoriesGitMetadata: vi.fn(
    async (repositories: RepositorySummary[]) => repositories,
  ),
}));

vi.mock("./storage/indexingJobStore", () => ({
  loadIndexingJobs: vi.fn(async () => mockState.indexingJobs),
  saveIndexingJob: vi.fn(async () => undefined),
}));

vi.mock("./storage/indexedFileStore", () => ({
  loadIndexedFileFacts: vi.fn(async () => mockState.files),
  replaceIndexedFileFacts: vi.fn(async () => undefined),
}));

vi.mock("./storage/fileTreeScanner", () => ({
  scanRepositoryFileTree: vi.fn(async () => ({
    repositoryPath: mockState.repositories[0].path,
    scannedFiles: mockState.files.length,
    skippedEntries: 0,
    files: mockState.files,
  })),
}));

vi.mock("./storage/gitChanges", () => ({
  loadGitFileDiff: vi.fn(async () => mockState.gitDiff),
  loadGitStatusSummary: vi.fn(async () => mockState.gitStatus),
}));

vi.mock("./storage/patchValidation", () => ({
  dryRunGeneratedPatch: vi.fn(async (...args: unknown[]) => ({
    status: "dry_run_passed",
    message:
      "Git reports that the patch can apply to the current working tree without writing it.",
    artifactDigest: args[4] as string,
    repositorySnapshot: {
      repositoryId: "repo-workspace",
      branch: "main",
      headSha: "abc1234",
      isClean: false,
      changedFileCount: 3,
      relevantFilePaths: args[5] as string[],
      artifactDigest: args[4] as string,
      targetFileFingerprints: (args[5] as string[]).map((path) => ({
        path,
        exists: true,
        sizeBytes: 120,
        modifiedAt: "1783532000",
        contentSha256: "f".repeat(64),
        status: "captured" as const,
      })),
      repositorySnapshotDigest: "a".repeat(64),
      capturedAt: "1783532400",
      fingerprintedAt: "1783532400",
    },
    validatedAt: "1783532400",
    dryRunAt: "1783532400",
  })),
}));

vi.mock("./storage/patchApplication", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./storage/patchApplication")>();

  return {
    ...actual,
    applyApprovedPatchArtifact: vi.fn(),
    acknowledgePatchApplyAttempt: vi.fn(),
    reconcileInterruptedPatchApplyAttempts: vi.fn(async () => []),
    rollbackAppliedPatchArtifact: vi.fn(),
  };
});

vi.mock("./storage/repositoryValidationSnapshot", () => ({
  loadRepositoryValidationSnapshot: vi.fn(
    async (
      repositoryId: string,
      _repositoryPath: string,
      artifactDigest: string,
      relevantFilePaths: string[],
    ) => ({
      repositoryId,
      branch: "main",
      headSha: "abc1234",
      isClean: false,
      changedFileCount: 3,
      relevantFilePaths,
      artifactDigest,
      targetFileFingerprints: relevantFilePaths.map((path) => ({
        path,
        exists: true,
        sizeBytes: 120,
        modifiedAt: "1783532000",
        contentSha256: "f".repeat(64),
        status: "captured" as const,
      })),
      repositorySnapshotDigest: "a".repeat(64),
      capturedAt: "1783532400",
      fingerprintedAt: "1783532400",
    }),
  ),
}));

vi.mock("./storage/approvalRequestStore", () => ({
  loadApprovalRequests: vi.fn(async () => mockState.approvals),
  saveApprovalRequest: vi.fn(async () => undefined),
  saveApprovalRequests: vi.fn(async () => undefined),
  deleteApprovalRequestById: vi.fn(async () => undefined),
  updateApprovalRequestStatus: vi.fn(async () => undefined),
}));

vi.mock("./storage/agentRunStore", () => ({
  loadAgentRunRecords: vi.fn(async () => []),
  saveAgentRunRecord: vi.fn(async () => undefined),
}));

vi.mock("./storage/proposedChangeStore", () => ({
  loadProposedChanges: vi.fn(async () => mockState.proposedChanges),
  deleteProposedChangeById: vi.fn(async () => undefined),
  saveProposedChange: vi.fn(async (change: PersistedProposedChange) => {
    const existingIndex = mockState.proposedChanges.findIndex(
      (candidate) => candidate.id === change.id,
    );
    mockState.proposedChanges =
      existingIndex >= 0
        ? mockState.proposedChanges.map((candidate) =>
            candidate.id === change.id ? change : candidate,
          )
        : [change, ...mockState.proposedChanges];
  }),
  saveProposedChanges: vi.fn(async (changes: PersistedProposedChange[]) => {
    mockState.proposedChanges = [...changes];
  }),
}));

vi.mock("./storage/filePreview", () => ({
  previewRepositoryFile: vi.fn(() => Promise.resolve(mockState.preview)),
}));

vi.mock("./storage/providerRuntime", () => ({
  loadOpenAiProviderConfiguration: vi.fn(async () => ({
    configured: false,
    model: "gpt-5.6-luna",
    reason: "Set OPENAI_API_KEY in the native app environment.",
  })),
  requestOpenAiPlan: vi.fn(),
  testOpenAiConnection: vi.fn(),
}));

function renderApp(options?: {
  approvals?: ApprovalRequest[];
  files?: IndexedFileFact[];
  gitDiff?: GitFileDiff;
  gitStatus?: GitStatusSummary;
  preview?: FileContentPreview | Promise<FileContentPreview>;
  proposedChanges?: PersistedProposedChange[];
  repositories?: RepositorySummary[];
}) {
  mockState.approvals = options?.approvals ?? [...defaultApprovals];
  mockState.files = options?.files ?? [...defaultFiles];
  mockState.gitDiff = options?.gitDiff ?? defaultGitDiff;
  mockState.gitStatus = options?.gitStatus ?? defaultGitStatus;
  mockState.preview = options?.preview ?? defaultPreview;
  mockState.proposedChanges = options?.proposedChanges ?? [
    ...defaultProposedChanges,
  ];
  mockState.repositories = options?.repositories ?? [...defaultRepositories];

  return {
    user: userEvent.setup(),
    ...render(<App />),
  };
}

async function goToTab(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name }));
}

const defaultApprovals = [...mockState.approvals];
const defaultFiles = [...mockState.files];
const defaultGitDiff = mockState.gitDiff;
const defaultGitStatus = mockState.gitStatus;
const defaultPreview = mockState.preview;
const defaultProposedChanges = [...mockState.proposedChanges];
const defaultRepositories = [...mockState.repositories];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(isTauriRuntime).mockReturnValue(true);
  vi.mocked(pickRepositoryDirectories).mockResolvedValue(null);
  vi.mocked(applyApprovedPatchArtifact).mockReset();
  vi.mocked(acknowledgePatchApplyAttempt).mockReset();
  vi.mocked(reconcileInterruptedPatchApplyAttempts).mockReset();
  vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([]);
  vi.mocked(saveRepositories).mockResolvedValue(undefined);
  vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
    configured: false,
    model: "gpt-5.6-luna",
    reason: "Set OPENAI_API_KEY in the native app environment.",
  });
  vi.mocked(requestOpenAiPlan).mockReset();
  vi.mocked(testOpenAiConnection).mockReset();
  vi.mocked(previewRepositoryFile).mockImplementation(() =>
    Promise.resolve(mockState.preview),
  );
  vi.mocked(loadGitStatusSummary).mockImplementation(
    async () => mockState.gitStatus,
  );
  vi.mocked(loadGitFileDiff).mockImplementation(async (_id, _path, file) => {
    if (file.stage === "untracked") {
      return {
        ...mockState.gitDiff,
        filePath: file.path,
        kind: "untracked",
        additions: 0,
        deletions: 0,
        lineCount: 0,
        rawDiff: undefined,
        lines: [],
      };
    }

    return {
      ...mockState.gitDiff,
      filePath: file.path,
      kind: file.stage === "staged" ? "staged" : mockState.gitDiff.kind,
    };
  });
  vi.mocked(dryRunGeneratedPatch).mockImplementation(async (...args) => ({
    status: "dry_run_passed",
    message:
      "Git reports that the patch can apply to the current working tree without writing it.",
    artifactDigest: args[4],
    repositorySnapshot: {
      repositoryId: "repo-workspace",
      branch: "main",
      headSha: "abc1234",
      isClean: false,
      changedFileCount: 3,
      relevantFilePaths: args[5],
      artifactDigest: args[4],
      targetFileFingerprints: args[5].map((path) => ({
        path,
        exists: true,
        sizeBytes: 120,
        modifiedAt: "1783532000",
        contentSha256: "f".repeat(64),
        status: "captured" as const,
      })),
      repositorySnapshotDigest: "a".repeat(64),
      capturedAt: "1783532400",
      fingerprintedAt: "1783532400",
    },
    validatedAt: "1783532400",
    dryRunAt: "1783532400",
  }));
  vi.mocked(scanRepositoryFileTree).mockImplementation(async () => ({
    repositoryPath: mockState.repositories[0]?.path ?? "/workspace",
    scannedFiles: mockState.files.length,
    skippedEntries: 0,
    files: mockState.files,
  }));
  mockState.files = [...defaultFiles];
  mockState.gitDiff = defaultGitDiff;
  mockState.gitStatus = defaultGitStatus;
  mockState.preview = defaultPreview;
  mockState.proposedChanges = [...defaultProposedChanges];
  mockState.repositories = defaultRepositories.map((repository) => ({
    ...repository,
    openChanges: 0,
    status: "indexed",
  }));
});

describe("Slice F: Review front door and Repository Intelligence demotion", () => {
  it("lands an empty workspace on the section that names the next action", async () => {
    renderApp({ repositories: [] });

    // An empty workspace has nothing to review, so the front door cannot be
    // Review. The next action is choosing a repository, which lives in
    // Repositories -- so that is where an empty workspace lands.
    const repositoriesNav = await screen.findByRole("button", {
      name: "Repositories",
    });
    await waitFor(() =>
      expect(repositoriesNav).toHaveAttribute("aria-current", "page"),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Repositories" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "No repository selected" }),
    ).toBeInTheDocument();
    // Not the Review front door: there is nothing to review yet.
    expect(
      screen.getByRole("button", { name: "Approvals" }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  it("lands a populated workspace on Review, the front door", async () => {
    renderApp();

    const approvalsNav = await screen.findByRole("button", {
      name: "Approvals",
    });
    await waitFor(() =>
      expect(approvalsNav).toHaveAttribute("aria-current", "page"),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Approval Review" }),
    ).toBeInTheDocument();
    // Overview is no longer the surface the app enters through.
    expect(
      screen.getByRole("button", { name: "Overview" }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  it("demotes Repository Intelligence to a panel within Repositories, not a nav item or headline", async () => {
    const { user } = renderApp();
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });

    // Not a nav item.
    expect(
      within(nav).queryByRole("button", { name: "Repository Intelligence" }),
    ).toBeNull();
    // Not a section headline on the front door either.
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: "Repository Intelligence",
      }),
    ).toBeNull();

    // Reachable within Repositories, demoted to a sub-panel label under a
    // "Repositories" headline.
    await user.click(within(nav).getByRole("button", { name: "Repositories" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Repositories" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: "Repository Intelligence",
      }),
    ).toBeNull();
    expect(
      screen.getAllByText("Repository Intelligence").length,
    ).toBeGreaterThan(0);
  });

  it("keeps the agreed primary navigation set with Repository Intelligence demoted out of it", () => {
    expect(primaryNavigation).toHaveLength(6);
    expect(primaryNavigation.map((item) => item.id)).toEqual([
      "overview",
      "repositories",
      "agents",
      "approvals",
      "changes",
      "settings",
    ]);
    expect(primaryNavigation.map((item) => item.label)).not.toContain(
      "Repository Intelligence",
    );
  });
});

describe("App smoke tests", () => {
  it("renders all six tabs and updates the active surface from sidebar navigation", async () => {
    const { user } = renderApp();

    // The front door is Review: a populated workspace enters here.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Approval Review" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(
      await screen.findByRole("heading", {
        name: "Draft app shell implementation plan",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Repositories",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Workspace context derived from saved repository metadata, Git state, and indexed file facts.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Agent Runs" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Provider Context")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approvals" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Approval Review" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Changes" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Workspace Changes",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "3 local changes waiting for review",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Workspace Settings",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Local-first workspace controls",
      }),
    ).toBeInTheDocument();
  });

  it("opens the clearly labeled mock-provider composer from Overview", async () => {
    const { user } = renderApp();

    // The app now enters through Review; the Overview quick-start shortcut is
    // reached by navigating to Overview first.
    await user.click(screen.getByRole("button", { name: "Overview" }));

    await user.click(
      await screen.findByRole("button", {
        name: /Start mock agent run/,
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Start with Mock Provider" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Describe a task to create a review-only plan with the mock provider.",
      ),
    ).toBeInTheDocument();
  });

  it("persists repositories returned by the native directory picker", async () => {
    const { user } = renderApp();

    await waitFor(() => expect(saveRepositories).toHaveBeenCalled());
    vi.mocked(saveRepositories).mockClear();
    vi.mocked(pickRepositoryDirectories).mockResolvedValue([
      "/workspace/second-repository",
    ]);

    await user.click(screen.getByRole("button", { name: "Choose repository" }));

    await waitFor(() => {
      expect(saveRepositories).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: "/workspace/second-repository" }),
        ]),
      );
    });
    expect(
      screen.queryByText(/web preview cannot open local folders/i),
    ).not.toBeInTheDocument();
  });

  it("indexes the first repository the moment it is chosen, with no control in between", async () => {
    const { user } = renderApp({ files: [], repositories: [] });

    vi.mocked(pickRepositoryDirectories).mockResolvedValue(["/fresh-clone"]);

    // Choosing the first repository is the only interaction. Selection starts
    // indexing directly -- no "Reindex repository" control stands between the
    // choice and the indexed facts.
    await user.click(screen.getByRole("button", { name: "Choose repository" }));

    await waitFor(() =>
      expect(scanRepositoryFileTree).toHaveBeenCalledWith(
        "repo-/fresh-clone",
        "/fresh-clone",
      ),
    );
    // Exactly once: selection must not double-index, and nothing else indexes.
    expect(scanRepositoryFileTree).toHaveBeenCalledTimes(1);
    // The chosen repository reaches the indexed state from selection alone.
    await waitFor(() =>
      expect(saveRepositories).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ path: "/fresh-clone", status: "indexed" }),
        ]),
      ),
    );
  });

  it("shows the web fallback only when the picker reports browser runtime", async () => {
    vi.mocked(pickRepositoryDirectories).mockRejectedValue(
      new RepositoryPickerError(
        "browser_runtime",
        "Repository selection requires the native Tauri app.",
      ),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Choose repository" }));

    expect(
      await screen.findByText(
        "Repository selection is available in the native Tauri app. The web preview cannot open local folders.",
      ),
    ).toBeInTheDocument();
  });

  it("does not mislabel a native dialog failure as web preview", async () => {
    vi.mocked(pickRepositoryDirectories).mockRejectedValue(
      new RepositoryPickerError(
        "native_dialog_failed",
        "The native repository picker could not be opened.",
      ),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Choose repository" }));

    expect(
      await screen.findByText(
        "The native repository picker could not open. Restart the desktop app and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/web preview cannot open local folders/i),
    ).not.toBeInTheDocument();
  });

  it("reports post-selection persistence failures separately", async () => {
    const { user } = renderApp();

    await waitFor(() => expect(saveRepositories).toHaveBeenCalled());
    vi.mocked(saveRepositories).mockClear();
    vi.mocked(saveRepositories).mockRejectedValueOnce(
      new Error("execute not allowed"),
    );
    vi.mocked(pickRepositoryDirectories).mockResolvedValue([
      "/workspace/second-repository",
    ]);

    await user.click(screen.getByRole("button", { name: "Choose repository" }));

    expect(
      await screen.findByText(
        "The repository was selected, but the workspace could not save it. Check native storage access and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/web preview cannot open local folders/i),
    ).not.toBeInTheDocument();
  });

  it("renders repository intelligence from indexed file facts", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Repositories" }));

    expect(
      await screen.findByRole("heading", { name: "AI-Developer-Workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Indexed facts")).toBeInTheDocument();
    expect(screen.getByText(String(defaultFiles.length))).toBeInTheDocument();
    expect(screen.getByText("tsx 2")).toBeInTheDocument();
    expect(screen.getByText("apps")).toBeInTheDocument();
    expect(screen.getByText("packages")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getAllByText("package.json").length).toBeGreaterThan(0);
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Tauri")).toBeInTheDocument();
    expect(screen.getByText("Package scripts unavailable")).toBeInTheDocument();
  });

  it("renders confirmation-gated Settings maintenance actions", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(
      await screen.findByRole("heading", {
        name: "Keep local intelligence current",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reindex repository" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Clear workspace caches" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Cache clearing is unavailable until cache boundaries are formalized.",
      ),
    ).toBeInTheDocument();

    const resetButton = screen.getByRole("button", {
      name: "Reset workspace",
    });
    expect(resetButton).toBeDisabled();
    await user.type(
      screen.getByLabelText("Type RESET WORKSPACE to confirm reset"),
      "RESET WORKSPACE",
    );
    expect(resetButton).toBeDisabled();
    expect(
      screen.getByText(
        /Reset is unavailable until app-local delete boundaries are formalized/,
      ),
    ).toBeInTheDocument();
  });

  it("keeps OpenAI connection testing disabled when credentials are unavailable", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(
      await screen.findByText(
        "Set OPENAI_API_KEY in the native app environment.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Test connection" }),
    ).toBeDisabled();
    expect(testOpenAiConnection).not.toHaveBeenCalled();
  });

  it("tests configured OpenAI credentials through the native boundary", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(testOpenAiConnection).mockResolvedValue({
      status: "connected",
      configured: true,
      model: "test-model",
      checkedAt: "1720951200",
      latencyMs: 42,
      message: "OpenAI credentials and configured model access were verified.",
    });
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const testButton = screen.getByRole("button", {
      name: "Test connection",
    });
    await waitFor(() => expect(testButton).toBeEnabled());
    expect(
      screen.getByText(
        "Credential source: native environment. Connection not tested in this session.",
      ),
    ).toBeInTheDocument();

    await user.click(testButton);

    expect(testOpenAiConnection).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        /credentials and configured model access were verified/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Model test-model\. 42 ms\./)).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("renders sanitized provider diagnostics without upstream error details", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(testOpenAiConnection).mockResolvedValue({
      status: "authentication_failed",
      configured: true,
      model: "test-model",
      checkedAt: "1720951200",
      message: "OpenAI authentication or model access was denied.",
    });
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const testButton = screen.getByRole("button", {
      name: "Test connection",
    });
    await waitFor(() => expect(testButton).toBeEnabled());
    await user.click(testButton);

    expect(
      await screen.findByText(
        /OpenAI authentication or model access was denied/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("authentication failed")).toBeInTheDocument();
    expect(
      screen.queryByText(/response body|api key|sk-/i),
    ).not.toBeInTheDocument();
    expect(testButton).toBeEnabled();
  });

  it("handles unavailable native connection testing without exposing exceptions", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(testOpenAiConnection).mockRejectedValue(
      new Error("private native exception"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const testButton = screen.getByRole("button", {
      name: "Test connection",
    });
    await waitFor(() => expect(testButton).toBeEnabled());
    await user.click(testButton);

    expect(
      await screen.findByText(
        /native OpenAI connection test is unavailable. No credentials were exposed/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/private native exception/),
    ).not.toBeInTheDocument();
  });

  it("disables reindex maintenance when no repository is selected", async () => {
    const { user } = renderApp({ files: [], repositories: [] });

    await user.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reindex repository" }),
      ).toBeDisabled();
    });
  });

  it("runs the Settings reindex action through the indexing boundary", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(
      await screen.findByRole("button", { name: "Reindex repository" }),
    );

    expect(
      await screen.findByText(
        /Repository intelligence refreshed from indexed file facts/,
      ),
    ).toBeInTheDocument();
    expect(scanRepositoryFileTree).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
    );
  });

  it("shows a safe Settings reindex error without mutating project files", async () => {
    vi.mocked(scanRepositoryFileTree).mockRejectedValueOnce(
      new Error("scan unavailable"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(
      await screen.findByRole("button", { name: "Reindex repository" }),
    );

    expect(
      await screen.findByText(
        "Reindex failed. No repository files were changed.",
      ),
    ).toBeInTheDocument();
  });

  it("connects the seeded demo workflow across repository intelligence, agent run, approval, and changes", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Repositories" }));

    expect(
      await screen.findByRole("heading", { name: "Continue review workflow" }),
    ).toBeInTheDocument();
    expect(screen.getByText("safe demo")).toBeInTheDocument();
    expect(screen.getByText(/proposal-mvp-shell/)).toBeInTheDocument();
    expect(screen.getByText("1 generated · 4 total")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Continue review workflow" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Draft app shell implementation plan",
      }),
    ).toBeInTheDocument();
    // Renamed from "demo workflow": the marker now covers every shipped demo
    // record, not only the one the demo-workflow card links to.
    expect(screen.getAllByText("Demo record").length).toBeGreaterThan(0);
    expect(screen.getByText("seeded path")).toBeInTheDocument();
    expect(screen.getAllByText(/approval-provider-rfc/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: "Inspect local diffs" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Review approval" }));

    expect(
      await screen.findByRole("heading", {
        name: "Approve provider abstraction patch plan",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Connected MVP review path")).toBeInTheDocument();
    expect(
      screen.getByText(/generated patch artifact states/),
    ).toBeInTheDocument();
    expect(screen.getByText("Generated Patch Artifacts")).toBeInTheDocument();
    expect(screen.getByText("Local repository diffs")).toBeInTheDocument();
    expect(
      screen.getByText(
        /This shows matching local Git diffs. Generated patch artifacts remain separate/,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Inspect local diffs" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "3 local changes waiting for review",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Approval-linked local change review"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Local Git diffs remain repository state/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("matches approval").length).toBeGreaterThan(0);
  });

  it("shows an empty repository intelligence state when no repository is saved", async () => {
    const { user } = renderApp({ files: [], repositories: [] });

    await user.click(screen.getByRole("button", { name: "Repositories" }));

    expect(
      await screen.findByRole("heading", { name: "No repository selected" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a local repository to build indexed facts, Git state, project structure, and safe file preview context.",
      ),
    ).toBeInTheDocument();
  });

  it("renders real Git status changes in the Changes tab", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Changes" }));

    expect(
      await screen.findByRole("heading", {
        name: "3 local changes waiting for review",
      }),
    ).toBeInTheDocument();
    expect(loadGitStatusSummary).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
    );
    expect(screen.getByText("Changed files")).toBeInTheDocument();
    expect(
      screen.getAllByText("apps/desktop/src/App.tsx").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("packages/git/src/index.ts")).toBeInTheDocument();
    expect(screen.getByText("docs/features/git-status.md")).toBeInTheDocument();
    expect(screen.getByText("Staged / Unstaged")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByText("read only")).toBeInTheDocument();
    expect(loadGitFileDiff).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
      expect.objectContaining({ path: "apps/desktop/src/App.tsx" }),
    );
    expect(await screen.findByText("Local Git diff")).toBeInTheDocument();
    expect(
      screen.getByText("+export const label = 'new';"),
    ).toBeInTheDocument();

    const callCountBeforeRefresh =
      vi.mocked(loadGitStatusSummary).mock.calls.length;

    await user.click(
      screen.getByRole("button", { name: "Refresh Git status" }),
    );

    expect(loadGitStatusSummary).toHaveBeenCalledTimes(
      callCountBeforeRefresh + 1,
    );
  });

  it("shows Git status unavailable state when the native Git status wrapper rejects", async () => {
    vi.mocked(loadGitStatusSummary).mockRejectedValue(
      new Error("git unavailable"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Changes" }));

    expect(
      await screen.findByText("Git status unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The workspace could not read Git status for the selected repository. No write operations were attempted.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Approval-linked local change review"),
    ).toBeInTheDocument();
  });

  it("keeps the demo workflow navigable when native status and preview wrappers are unavailable", async () => {
    vi.mocked(loadGitStatusSummary).mockRejectedValue(
      new Error("git unavailable"),
    );
    vi.mocked(previewRepositoryFile).mockRejectedValue(
      new Error("preview unavailable"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    await user.click(
      await screen.findByRole("button", { name: "Continue review workflow" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Draft app shell implementation plan",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review approval" }));

    expect(
      await screen.findByRole("heading", {
        name: "Approve provider abstraction patch plan",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Generated Patch Artifacts")).toBeInTheDocument();
    expect(screen.getByText("Local repository diffs")).toBeInTheDocument();
    expect(screen.getAllByText("No local diff yet").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("shows an honest untracked diff state when a changed file has no tracked baseline", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Changes" }));
    await screen.findByText("Local Git diff");

    await user.click(
      screen.getByRole("button", {
        name: /docs\/features\/git-status\.md/,
      }),
    );

    expect(await screen.findByText("Untracked file")).toBeInTheDocument();
    expect(screen.getByText("No tracked baseline yet")).toBeInTheDocument();
    expect(loadGitFileDiff).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
      expect.objectContaining({
        path: "docs/features/git-status.md",
        stage: "untracked",
      }),
    );
  });

  it("renders selected agent run detail with structured proposed plan and approval handoff", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    expect(
      await screen.findByRole("heading", {
        name: "Draft app shell implementation plan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Structured implementation plan"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ordered plan")).toBeInTheDocument();
    expect(screen.getByText("Affected files")).toBeInTheDocument();
    expect(screen.getByText("Known risks")).toBeInTheDocument();
    expect(screen.getByText("Check strategy")).toBeInTheDocument();
    expect(
      screen.getAllByText("apps/desktop/src/App.tsx").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Proposal Record")).toBeInTheDocument();
    expect(screen.getAllByText("proposal-mvp-shell").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ready for review").length).toBeGreaterThan(0);
    expect(screen.getByText("Generated Patch Artifacts")).toBeInTheDocument();
    expect(screen.getByText("Reviewable patch proposals")).toBeInTheDocument();
    expect(
      screen.getByText(/any applied artifact is labeled explicitly/),
    ).toBeInTheDocument();
    // The read-only list still surfaces each artifact's status; the "Patch not
    // generated" detail state and its copy moved to Approval Review with the
    // rest of the patch artifact detail.
    expect(screen.getAllByText("not generated").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Generated patch artifact preview"),
    ).not.toBeInTheDocument();
    // Provider context prose stays with the run on this surface. It used to
    // read "Mock runs do not generate patch content", which the demo unlock
    // made false.
    expect(
      screen.getByText(/does not author changes to your own code/),
    ).toBeInTheDocument();
    // The generated-artifact list is a read-only summary in Agent Runs; the
    // reviewable detail and every apply affordance now live in Approval Review.
    expect(screen.getByText(String(defaultFiles.length))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review approval" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Diffs not generated yet" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review approval" }));

    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    expect(screen.getByText("Generated patch artifact")).toBeInTheDocument();
    expect(
      screen.getByText("Provider-generated proposal · not applied"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("+export type PatchArtifact = string;"),
    ).toBeInTheDocument();
  });

  it("keeps a valid structure result when the native dry-run is unavailable", async () => {
    const proposal = defaultProposedChanges[0];
    const validProposal: PersistedProposedChange = {
      ...proposal,
      patchArtifacts: proposal.patchArtifacts.map((artifact) =>
        artifact.filePath === "packages/ai/src/index.ts"
          ? {
              ...artifact,
              rawDiff: [
                "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts",
                "--- a/packages/ai/src/index.ts",
                "+++ b/packages/ai/src/index.ts",
                "@@ -1 +1 @@",
                "-export type OldPlan = string;",
                "+export type NewPlan = string;",
              ].join("\n"),
              validationStatus: "not_validated",
            }
          : artifact,
      ),
    };
    vi.mocked(dryRunGeneratedPatch).mockRejectedValue(
      new Error("native runtime unavailable"),
    );
    const { user } = renderApp({
      proposedChanges: [validProposal, ...defaultProposedChanges.slice(1)],
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    // Checks run on review-open, behind Approval Review.
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    // Structure passed but the native dry-run could not run, so the checks line
    // reports incomplete -- never a false "passed" -- and names the dry-run gap.
    expect(await screen.findByText("checks incomplete")).toBeInTheDocument();
    expect(
      screen.getByText("A successful native dry-run has not been recorded."),
    ).toBeInTheDocument();
    expect(saveProposedChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patchArtifacts: expect.arrayContaining([
          expect.objectContaining({ validationStatus: "valid_structure" }),
        ]),
      }),
    );
  });

  it("keeps patch application disabled while safety gates are blocked", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    // Apply Readiness renders on the sole apply surface: Approval Review.
    await user.click(screen.getByRole("button", { name: "Review approval" }));

    expect(
      await screen.findByRole("heading", { name: "Apply Readiness" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Applying modifies files in your working tree. It does not commit or stage changes, and approval alone never applies a patch.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
  });

  // The eighteen readiness gates are evidence, not workflow. The default view
  // must not present them as steps; they belong behind an explicit Advanced
  // control. This lists every label so a renamed or dropped gate is caught here.
  const APPLY_READINESS_GATE_LABELS = [
    "Native desktop runtime",
    "Durable records available",
    "Artifact is in an appliable state",
    "Approval request approved",
    "Artifact generated",
    "Artifact structure valid",
    "Read-only dry-run passed",
    "Linked repository selected",
    "Named branch and HEAD available",
    "Working tree clean",
    "Artifact path allowed",
    "No forbidden file touched",
    "Artifact is text",
    "Artifact within size limit",
    "Artifact digest matches validation",
    "Validation snapshot captured",
    "Target files fingerprinted",
    "Repository state unchanged",
  ];

  it("keeps the eighteen readiness gates out of the document until Advanced is activated", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));

    // The readiness section is on screen...
    expect(
      await screen.findByRole("heading", { name: "Apply Readiness" }),
    ).toBeInTheDocument();

    // ...but not one gate label is rendered on first arrival.
    for (const label of APPLY_READINESS_GATE_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    await user.click(
      screen.getByRole("button", { name: /Advanced.*readiness gates/i }),
    );

    // Every gate is present once revealed, each exactly once.
    for (const label of APPLY_READINESS_GATE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("names the first blocking gate's reason without listing every gate", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));

    await screen.findByRole("heading", { name: "Apply Readiness" });

    // Reveal the gates to read the authoritative first blocking reason, without
    // hardcoding which gate blocks first in the fixture's default state.
    await user.click(
      screen.getByRole("button", { name: /readiness gates/i }),
    );
    const gateList = screen.getByRole("list", {
      name: "Apply readiness gates",
    });
    const firstBlockedItem = within(gateList)
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("Blocked"));
    expect(firstBlockedItem).toBeDefined();
    // The detail span sits inside the label div, before the status pill.
    const firstBlockingDetail =
      firstBlockedItem!.querySelector("div span")?.textContent ?? "";
    expect(firstBlockingDetail.length).toBeGreaterThan(0);

    // Collapse the gate list again: the reason survives as a single summary
    // line while the eighteen gate labels leave the document.
    await user.click(
      screen.getByRole("button", { name: /readiness gates/i }),
    );
    for (const label of APPLY_READINESS_GATE_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByText(firstBlockingDetail)).toBeInTheDocument();
  });

  const quarantinedProposedChanges = defaultProposedChanges.map((change) =>
    change.id === "proposal-mvp-shell"
      ? {
          ...change,
          status: "quarantine_required" as const,
          patchArtifacts: change.patchArtifacts.map((artifact) =>
            artifact.id === "proposal-file-ai-patch-artifact"
              ? { ...artifact, applyStatus: "quarantine_required" as const }
              : artifact,
          ),
        }
      : change,
  );

  const quarantinedApplyAttempt = {
    applyAttemptId: "apply-quarantine-1",
    repositoryId: "repo-workspace",
    proposedChangeId: "proposal-mvp-shell",
    approvalRequestId: "approval-provider-rfc",
    patchArtifactId: "proposal-file-ai-patch-artifact",
    backupId: "backup-quarantine-1",
    status: "quarantine_required" as const,
    startedAt: "1783532400",
    completedAt: "1783532500",
    sanitizedError: "Post-apply verification found an unexpected changed path.",
    currentGitStatusChanged: true,
    postApplyVerification: {
      status: "quarantine_required" as const,
      expectedPaths: ["packages/ai/src/index.ts"],
      observedChangedPaths: [
        "packages/ai/src/index.ts",
        "packages/core/src/unexpected.ts",
      ],
      unexpectedPaths: ["packages/core/src/unexpected.ts"],
      missingExpectedPaths: [],
      verifiedAt: "1783532500",
      message: "Quarantined for manual inspection.",
    },
    message: "Quarantined for manual inspection.",
  };

  it("purges untouched demo rows from storage but retains decided ones", async () => {
    renderApp({
      approvals: [
        {
          ...defaultApprovals[0],
          id: "approval-provider-rfc",
          status: "pending",
        },
        {
          ...defaultApprovals[0],
          id: "approval-indexing-job",
          status: "approved",
        },
      ],
    });

    await waitFor(() => expect(deleteApprovalRequestById).toHaveBeenCalled());

    const deleted = vi
      .mocked(deleteApprovalRequestById)
      .mock.calls.map(([id]: [string]) => id);

    // The untouched row is pure fabrication that hydration wrote with no user
    // action. The approved one carries a real decision and must survive.
    expect(deleted).toContain("approval-provider-rfc");
    expect(deleted).not.toContain("approval-indexing-job");
  });

  it("marks a retained demo record where it is displayed", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    // Retention is only honest if the row declares itself at the point of
    // display. A marker in Settings would leave this row reading as real.
    expect((await screen.findAllByText("Demo record")).length).toBeGreaterThan(
      0,
    );
  });

  it("renders an approval whose agent run does not exist without blanking", async () => {
    // Persisted approvals reference runs by id with no foreign key, and seeded
    // agent runs were never persisted. Demo fixtures keep their runs in memory
    // so the link resolves today; this pins the guard that keeps a dangling
    // reference from blanking the screen if it ever stops resolving.
    const { user } = renderApp({
      approvals: [
        {
          ...defaultApprovals[0],
          id: "approval-dangling",
          title: "Approval with a missing run",
          agentRunId: "run-that-was-never-persisted",
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    // The row renders at all -- the screen did not blank -- and it reports the
    // missing link instead of an empty title.
    const row = await screen.findByRole("button", {
      name: /Approval with a missing run/,
    });
    expect(row).toBeInTheDocument();
    expect(row.textContent).toContain("No linked run");
  });

  it("agrees with Changes about whether the working tree is clean", async () => {
    const dirtyGitStatus: GitStatusSummary = {
      ...defaultGitStatus,
      isClean: false,
      changedFileCount: 3,
      unstagedCount: 3,
    };
    const { user } = renderApp({ gitStatus: dirtyGitStatus });

    // Overview read the persisted openChanges snapshot while Changes read live
    // Git, so Overview could report a clean tree while Changes reported three
    // changed files. Clean-tree state is an apply gate; the two must not
    // disagree. The app now enters through Review, so open Overview explicitly.
    await user.click(screen.getByRole("button", { name: "Overview" }));
    const overview = await screen.findByLabelText("Active work");
    // The `await` above synchronises with nothing: "Active work" renders on the
    // first frame regardless of Git. This assertion used to be read straight
    // off it, and passed only because a fixture repository existed before
    // hydration, so live Git happened to arrive first. Wait for the Git-derived
    // number itself, not for a container that was always there.
    await waitFor(() => expect(overview.textContent).toContain("3"));
    expect(overview.textContent).not.toContain("✓");
    expect(overview.textContent).toContain("No");
  });

  // The Active Work card rendered its heading from the proposal and its pill
  // from a fallback, so with no proposal the two halves disagreed inside one
  // card: "No active work" beside "waiting for approval". A status pill for a
  // proposal that does not exist is a status for nothing.
  it("does not claim work is waiting for approval while reporting no active work", async () => {
    const { user } = renderApp({ proposedChanges: [] });

    // The app enters through Review; this guards Overview, so open it.
    await user.click(screen.getByRole("button", { name: "Overview" }));
    const heading = await screen.findByRole("heading", {
      name: "No active work",
      level: 2,
    });
    const card = heading.closest("article");
    expect(card).not.toBeNull();

    // "waiting for approval" is reachable only through the no-proposal
    // fallback: a real status renders as its own id with underscores replaced
    // ("ready for review"), never this phrase. So its presence here is the
    // contradiction itself, not a coincidence of wording.
    expect(card?.textContent).not.toContain("waiting for approval");
    // The prose asserted a plan to review, with no plan to review.
    expect(card?.textContent).not.toContain("Review the proposed plan");
  });

  // The other direction. Without this, deleting the pill outright -- or the
  // whole card -- would satisfy the assertion above. A real proposal must
  // still report its real status.
  it("still reports the proposal's status when there is active work", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Overview" }));
    const heading = await screen.findByRole("heading", {
      name: "Draft app shell implementation plan",
      level: 2,
    });
    const card = heading.closest("article");

    expect(card?.textContent).toContain("ready for review");
    expect(card?.textContent).not.toContain("No active work");
  });

  // A real proposal, shaped like one a provider run persists: its id is NOT the
  // demo workflow's `proposal-mvp-shell`. That is the whole discriminator. The
  // card used to resolve its content through a hardcoded lookup for that one
  // fixture id, so every real proposal was invisible to it and Overview
  // reported "No active work" while Approvals showed the proposal waiting.
  function realProposal(
    overrides: Partial<PersistedProposedChange> = {},
  ): PersistedProposedChange {
    return {
      id: "proposal-openai-timeout",
      runId: "run-openai-timeout",
      approvalRequestId: "approval-openai-timeout",
      repositoryId: "repo-workspace",
      title: "Bound the provider request timeout",
      summary: "A real provider run's proposal, not the demo fixture.",
      status: "ready_for_review",
      files: [],
      patchArtifacts: [],
      createdAt: "Today, 11:20",
      updatedAt: "Today, 11:20",
      ...overrides,
    };
  }

  it("reports a real proposal as active work, not only the demo fixture", async () => {
    const { user } = renderApp({ proposedChanges: [realProposal()] });

    await user.click(screen.getByRole("button", { name: "Overview" }));
    const card = (
      await screen.findByText("Active Work")
    ).closest("article");

    expect(card?.textContent).toContain("Bound the provider request timeout");
    expect(card?.textContent).not.toContain("No active work");
  });

  it("never reports another repository's proposal as this repository's active work", async () => {
    // The card's own meta rows -- Repository, Branch, Local path, Open Changes
    // -- are all active-repository facts. A foreign proposal's title above them
    // would print one repository's work over another's branch: the exact lie #6
    // fixed at two other sites.
    const { user } = renderApp({
      proposedChanges: [realProposal({ repositoryId: "repo-somewhere-else" })],
    });

    await user.click(screen.getByRole("button", { name: "Overview" }));
    const card = (
      await screen.findByText("Active Work")
    ).closest("article");

    expect(card?.textContent).not.toContain("Bound the provider request timeout");
    expect(card?.textContent).toContain("No active work");
  });

  it("says how many proposals are active rather than implying the one shown is all", async () => {
    const { user } = renderApp({
      proposedChanges: [
        realProposal(),
        realProposal({
          id: "proposal-openai-retry",
          runId: "run-openai-retry",
          approvalRequestId: "approval-openai-retry",
          title: "Retry the failed apply",
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Overview" }));
    const card = (await screen.findByText("Active Work")).closest("article");

    // The count counts the scoped list it describes, per #6 -- two here, both
    // this repository's. It must not silently show one of two.
    expect(card?.textContent).toContain("2 proposals are active in this repository");
  });

  it("does not count another repository's proposal in this repository's active work", async () => {
    const { user } = renderApp({
      proposedChanges: [
        realProposal(),
        realProposal({
          id: "proposal-foreign",
          repositoryId: "repo-somewhere-else",
          title: "Someone else's work",
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Overview" }));
    const card = (await screen.findByText("Active Work")).closest("article");

    // One active proposal here, so no count line at all -- and certainly not
    // "2", which is the number a workspace-wide count would print above this
    // repository's own branch.
    expect(card?.textContent).toContain("Bound the provider request timeout");
    expect(card?.textContent).not.toContain("2 proposals are active");
    expect(card?.textContent).not.toContain("Someone else's work");
  });

  it("does not offer an upgrade for a tier that does not exist", async () => {
    renderApp();

    await screen.findByRole("button", { name: "Approvals" });

    expect(screen.queryByText("Pro Intelligence")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upgrade Plan" }),
    ).not.toBeInTheDocument();
  });

  it("does not present fabricated activity as workspace history", async () => {
    renderApp();

    await screen.findByRole("button", { name: "Approvals" });

    // These three entries were static copy with invented timestamps rendered as
    // though they were a real event feed.
    expect(screen.queryByText("Intelligence Warmed")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Mock provider connected"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("2m ago")).not.toBeInTheDocument();
  });

  it("tells an empty workspace what to do instead of showing invented numbers", async () => {
    const { user } = renderApp({ repositories: [], files: [] });

    // An empty workspace lands on Repositories (the next action); this guards
    // Overview's honest empty state, so open it explicitly.
    await user.click(screen.getByRole("button", { name: "Overview" }));

    expect(
      await screen.findByText("No workspace state yet"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Choose a repository to begin/i).length,
    ).toBeGreaterThan(0);
    // The fabricated index time was shipped as a constant regardless of state.
    expect(
      screen.queryByText(/Last indexed Today, 10:24/),
    ).not.toBeInTheDocument();
  });

  it("never writes a seeded record into durable storage during hydration", async () => {
    renderApp();

    // Anchor on the read: hydration no longer writes, so a write can never be
    // the barrier for hydration having finished.
    await waitFor(() => expect(loadProposedChanges).toHaveBeenCalled());
    await screen.findByRole("button", { name: "Approvals" });

    // Hydration is the covert path: it ran on every launch with no user action
    // and upserted seeds into the same tables as real records, where nothing
    // distinguishes them afterwards. A user's own approve/reject decision may
    // still persist -- that is what makes a seeded row "touched".
    const writtenChangeIds = vi
      .mocked(saveProposedChanges)
      .mock.calls.flatMap(([changes]) => changes.map((change) => change.id));
    const writtenApprovalIds = vi
      .mocked(saveApprovalRequests)
      .mock.calls.flatMap(([requests]) =>
        requests.map((request) => request.id),
      );

    for (const seedId of KNOWN_SEED_RECORD_IDS) {
      expect(writtenChangeIds).not.toContain(seedId);
      expect(writtenApprovalIds).not.toContain(seedId);
    }
  });

  it("shows reconciled interrupted attempts and keeps apply unavailable", async () => {
    const interruptedChanges = defaultProposedChanges.map((change) =>
      change.id === "proposal-mvp-shell"
        ? {
            ...change,
            patchArtifacts: change.patchArtifacts.map((artifact) =>
              artifact.id === "proposal-file-ai-patch-artifact"
                ? { ...artifact, applyStatus: "needs_inspection" as const }
                : artifact,
            ),
          }
        : change,
    );
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([
      {
        applyAttemptId: "apply-interrupted-1",
        repositoryId: "repo-workspace",
        proposedChangeId: "proposal-mvp-shell",
        approvalRequestId: "approval-provider-rfc",
        patchArtifactId: "proposal-file-ai-patch-artifact",
        backupId: "backup-interrupted-1",
        status: "needs_inspection",
        startedAt: "1783532400",
        completedAt: "1783532500",
        sanitizedError: "Manual inspection is required.",
        currentGitStatusChanged: true,
        message:
          "Repository evidence is ambiguous after an interrupted apply. Manual inspection is required.",
      },
    ]);
    const { user } = renderApp({ proposedChanges: interruptedChanges });

    await waitFor(() =>
      expect(reconcileInterruptedPatchApplyAttempts).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    // Apply, and its recovery evidence, live only behind Approval Review now.
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Manual inspection required",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("backup-interrupted-1")).toBeInTheDocument();
    expect(screen.getByText("Changed after apply started")).toBeInTheDocument();
    expect(
      screen.getByText(/No patch was retried or rolled back/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
    // Reconciliation re-runs after the initial hydrate. The exact count is not
    // the guarantee -- navigating to the linked approval to reach the recovery
    // evidence drives an extra pass -- so assert it ran again, not that it ran
    // exactly twice.
    await waitFor(() =>
      expect(
        vi.mocked(reconcileInterruptedPatchApplyAttempts).mock.calls.length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  it("quarantines an apply outcome when authoritative verification finds an unexpected path", async () => {
    const quarantinedChanges = defaultProposedChanges.map((change) =>
      change.id === "proposal-mvp-shell"
        ? {
            ...change,
            status: "quarantine_required" as const,
            patchArtifacts: change.patchArtifacts.map((artifact) =>
              artifact.id === "proposal-file-ai-patch-artifact"
                ? {
                    ...artifact,
                    applyStatus: "quarantine_required" as const,
                  }
                : artifact,
            ),
          }
        : change,
    );
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([
      {
        applyAttemptId: "apply-quarantine-1",
        repositoryId: "repo-workspace",
        proposedChangeId: "proposal-mvp-shell",
        approvalRequestId: "approval-provider-rfc",
        patchArtifactId: "proposal-file-ai-patch-artifact",
        backupId: "backup-quarantine-1",
        status: "quarantine_required",
        startedAt: "1783532400",
        completedAt: "1783532500",
        sanitizedError:
          "Post-apply verification found an unexpected changed path.",
        currentGitStatusChanged: true,
        postApplyVerification: {
          status: "quarantine_required",
          expectedPaths: ["packages/ai/src/index.ts"],
          observedChangedPaths: [
            "packages/ai/src/index.ts",
            "packages/core/src/unexpected.ts",
          ],
          unexpectedPaths: ["packages/core/src/unexpected.ts"],
          missingExpectedPaths: [],
          verifiedAt: "1783532500",
          message:
            "Post-apply verification could not prove that only the approved artifact path changed. The outcome is quarantined for manual inspection.",
        },
        message:
          "Post-apply verification could not prove that only the approved artifact path changed. The outcome is quarantined for manual inspection.",
      },
    ]);
    const { user } = renderApp({ proposedChanges: quarantinedChanges });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    expect(
      await screen.findByText("Post-Apply Quarantine"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Manual inspection required" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("packages/core/src/unexpected.ts"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
  });

  it("records an inspection only after exact typed confirmation and keeps apply disabled", async () => {
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([
      quarantinedApplyAttempt,
    ]);
    vi.mocked(acknowledgePatchApplyAttempt).mockResolvedValue({
      applyAttemptId: "apply-quarantine-1",
      status: "inspected",
      acknowledgedFromStatus: "quarantine_required",
      acknowledgedAt: "1783532600",
      message: "The attempt was recorded as manually inspected.",
    });
    const { user } = renderApp({ proposedChanges: quarantinedProposedChanges });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Record inspection" }),
    );

    const confirmButton = screen.getByRole("button", {
      name: "Confirm inspection",
    });
    const phraseInput = screen.getByLabelText(/Type INSPECTED to confirm/i);

    expect(confirmButton).toBeDisabled();
    await user.type(phraseInput, "inspected");
    expect(confirmButton).toBeDisabled();
    expect(acknowledgePatchApplyAttempt).not.toHaveBeenCalled();

    await user.clear(phraseInput);
    await user.type(phraseInput, "INSPECTED");
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() =>
      expect(acknowledgePatchApplyAttempt).toHaveBeenCalledWith(
        "apply-quarantine-1",
        "INSPECTED",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
  });

  it("shows an acknowledged attempt as recorded and never offers apply again", async () => {
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([
      {
        ...quarantinedApplyAttempt,
        status: "inspected",
        message:
          "The attempt was recorded as manually inspected. Its artifact remains permanently ineligible for application, and no patch was retried or rolled back.",
      },
    ]);
    const { user } = renderApp({ proposedChanges: quarantinedProposedChanges });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    expect(await screen.findByText("Inspection Recorded")).toBeInTheDocument();
    // The evidence must survive acknowledgement rather than disappear.
    expect(
      screen.getByText("packages/core/src/unexpected.ts"),
    ).toBeInTheDocument();
    expect(screen.getByText("backup-quarantine-1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record inspection" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
  });

  it("requires typed confirmation and applies only through the ID-only native boundary", async () => {
    const cleanGitStatus: GitStatusSummary = {
      ...defaultGitStatus,
      isClean: true,
      changedFileCount: 0,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      files: [],
    };
    const postApplyGitStatus: GitStatusSummary = {
      ...cleanGitStatus,
      isClean: false,
      changedFileCount: 1,
      unstagedCount: 1,
      files: [
        {
          path: "packages/ai/src/index.ts",
          kind: "modified",
          stage: "unstaged",
          statusCode: " M",
        },
      ],
      refreshedAt: "1783532500",
    };
    vi.mocked(applyApprovedPatchArtifact)
      .mockRejectedValueOnce(new Error("private native path and stderr"))
      .mockImplementation(
        async (
          repositoryId,
          proposedChangeId,
          _approvalRequestId,
          patchArtifactId,
        ) => {
          mockState.gitStatus = postApplyGitStatus;
          mockState.proposedChanges = mockState.proposedChanges.map((change) =>
            change.id === proposedChangeId
              ? {
                  ...change,
                  status: "applied",
                  patchArtifacts: change.patchArtifacts.map((artifact) =>
                    artifact.id === patchArtifactId
                      ? {
                          ...artifact,
                          applyStatus: "applied_verified",
                          appliedAt: "1783532500",
                          appliedBy: "local_user",
                          backupId: "backup-1",
                          postApplyGitStatus,
                        }
                      : artifact,
                  ),
                  updatedAt: "1783532500",
                }
              : change,
          );

          return {
            status: "applied_verified",
            applyAttemptId: "apply-artifact-1",
            proposedChangeId,
            patchArtifactId,
            backupId: "backup-1",
            appliedAt: "1783532500",
            postApplyGitStatus: {
              ...postApplyGitStatus,
              repositoryId,
            },
            postApplyVerification: {
              status: "applied_verified",
              expectedPaths: ["packages/ai/src/index.ts"],
              observedChangedPaths: ["packages/ai/src/index.ts"],
              unexpectedPaths: [],
              missingExpectedPaths: [],
              verifiedAt: "1783532500",
              message:
                "Post-apply verification confirmed that only the approved artifact path changed. No files were staged or committed.",
            },
            message:
              "Post-apply verification confirmed that only the approved artifact path changed. No files were staged or committed.",
          };
        },
      );
    const { user } = renderApp({ gitStatus: cleanGitStatus });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    // Checks run automatically on open; no validate control to click.
    await screen.findByText("checks passed");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(
      await screen.findByRole("button", { name: "Apply Patch" }),
    );

    const confirmation = screen.getByRole("textbox", {
      name: "Confirmation phrase",
    });
    const confirmButton = screen.getByRole("button", {
      name: "Confirm Apply Patch",
    });
    await user.type(confirmation, "WRONG");
    expect(confirmButton).toBeDisabled();
    expect(applyApprovedPatchArtifact).not.toHaveBeenCalled();
    await user.clear(confirmation);
    await user.type(confirmation, "APPLY PATCH");
    expect(confirmButton).toBeEnabled();
    const reconciliationCallsBeforeFailure = vi.mocked(
      reconcileInterruptedPatchApplyAttempts,
    ).mock.calls.length;
    await user.click(confirmButton);
    expect(
      await screen.findByText(
        "The native patch application failed safely. Review validation and repository state before retrying.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private native path/)).not.toBeInTheDocument();
    expect(applyApprovedPatchArtifact).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        vi.mocked(reconcileInterruptedPatchApplyAttempts).mock.calls.length,
      ).toBeGreaterThan(reconciliationCallsBeforeFailure),
    );
    await user.click(confirmButton);

    await waitFor(() =>
      expect(applyApprovedPatchArtifact).toHaveBeenCalledWith(
        "repo-workspace",
        "proposal-mvp-shell",
        "approval-provider-rfc",
        "proposal-file-ai-patch-artifact",
        "APPLY PATCH",
      ),
    );
    // A verified apply lands the operator in Changes with the proof as the
    // primary content -- no manual navigation to reach it.
    const verificationHeading = await screen.findByRole("heading", {
      name: /Applied packages\/ai\/src\/index\.ts .* nothing was staged or committed/,
    });
    expect(verificationHeading).toBeInTheDocument();
    // The proof is a heading, not the disabled "Patch applied and verified"
    // pill it replaced -- and that pill lives on the approval surface we left.
    expect(
      screen.queryByRole("button", { name: "Patch applied and verified" }),
    ).not.toBeInTheDocument();
    // It precedes the changed-files list in DOM order.
    const changedFiles = screen.getByLabelText("Changed files");
    expect(
      verificationHeading.compareDocumentPosition(changedFiles) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("creates a persisted mock agent run with a proposal, approval, and the demo patch", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Add a repository context summary",
    );
    await user.click(screen.getByRole("button", { name: "Run mock agent" }));

    expect(
      await screen.findByRole("heading", {
        name: "Add a repository context summary",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mock run created and saved. Review the structured plan before approving it.",
      ),
    ).toBeInTheDocument();
    expect(saveAgentRunRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({
          providerId: "mock",
          status: "waiting_for_approval",
        }),
      }),
    );
    expect(saveProposedChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready_for_review",
        files: expect.any(Array),
        patchArtifacts: expect.any(Array),
      }),
    );
    expect(saveApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        agentRunId: expect.stringMatching(/^run-/),
      }),
    );

    // The demo patch reaches durable storage, which is what makes apply
    // reachable at all: the artifact the apply gate reads is this row. Before
    // this, every mock artifact persisted `not_generated`, the generation gate
    // blocked, and Apply Patch could not be reached without a paid OpenAI key.
    const savedChange = vi.mocked(saveProposedChange).mock.calls[0][0];
    const demoArtifact = savedChange.patchArtifacts.find(
      (artifact) => artifact.filePath === "airlock-demo.md",
    );

    expect(demoArtifact?.status).toBe("generated");
    expect(demoArtifact?.rawDiff).toContain(
      "diff --git a/airlock-demo.md b/airlock-demo.md",
    );
    // The context candidates stay review-only: the demo provider generates one
    // patch and does not claim to have authored this repository's real files.
    expect(
      savedChange.patchArtifacts
        .filter((artifact) => artifact.filePath !== "airlock-demo.md")
        .every((artifact) => artifact.status === "not_generated"),
    ).toBe(true);
  });

  it("shows OpenAI as unavailable when native credentials are not configured", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    const openAiOption = await screen.findByRole("option", {
      name: /OpenAI · gpt-5\.6-luna/,
    });
    expect(openAiOption).toBeDisabled();
    expect(
      screen.getByText("Set OPENAI_API_KEY in the native app environment."),
    ).toBeInTheDocument();
  });

  it("creates persisted review records from a validated OpenAI plan", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(requestOpenAiPlan).mockResolvedValue({
      summary: "Add provider-backed repository planning.",
      steps: [
        {
          title: "Wire provider planning",
          description: "Connect the native plan transport to the composer.",
        },
      ],
      affectedFiles: [
        {
          path: "src/App.tsx",
          reason: "Expose provider selection and plan status.",
          operation: "modify",
          riskLevel: "medium",
        },
      ],
      risks: [
        {
          level: "medium",
          title: "Validate provider output",
          description: "Reject malformed plans before persistence.",
        },
      ],
      validation: [{ label: "Run provider contract tests" }],
      patchArtifacts: [
        {
          filePath: "src/App.tsx",
          status: "generated",
          isBinary: false,
          rawDiff: [
            "diff --git a/src/App.tsx b/src/App.tsx",
            "--- a/src/App.tsx",
            "+++ b/src/App.tsx",
            "@@ -1 +1 @@",
            "-const provider = 'mock';",
            "+const provider = 'openai';",
          ].join("\n"),
        },
      ],
      approvalRequired: true,
    });
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    const providerSelect = screen.getByRole("combobox", {
      name: "Agent provider",
    });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "OpenAI · test-model" }),
      ).toBeEnabled();
    });
    await user.selectOptions(providerSelect, "openai");
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Add provider-backed repository planning",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate plan with OpenAI" }),
    );

    expect(
      await screen.findByText(
        "OpenAI run created and saved with 1 generated patch artifact. Review every proposal before approval.",
      ),
    ).toBeInTheDocument();
    expect(requestOpenAiPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        taskPrompt: "Add provider-backed repository planning",
        context: expect.objectContaining({
          branch: "main",
          indexedFileCount: defaultFiles.length,
          keyFiles: expect.arrayContaining(["package.json", "README.md"]),
          projectFolders: expect.arrayContaining(["src", "docs"]),
        }),
      }),
    );
    expect(saveAgentRunRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        run: expect.objectContaining({
          providerId: "openai",
          model: "test-model",
        }),
      }),
    );
    expect(saveProposedChange).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ path: "src/App.tsx" })],
        patchArtifacts: [
          expect.objectContaining({
            status: "generated",
            additions: 1,
            deletions: 1,
          }),
        ],
      }),
    );
    expect(saveApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    // The checks run on review-open behind Approval Review; the reviewable
    // detail lives here too.
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", { name: /generated src\/App\.tsx/ }),
    );
    expect(
      await screen.findByText("Provider-generated proposal · not applied"),
    ).toBeInTheDocument();

    // Opening the artifact runs the native dry-run once; no human clicks it.
    await waitFor(() =>
      expect(dryRunGeneratedPatch).toHaveBeenCalledWith(
        "repo-workspace",
        "/workspace",
        expect.objectContaining({ filePath: "src/App.tsx" }),
        expect.objectContaining({ operation: "modify" }),
        expect.stringMatching(/^[a-f0-9]{64}$/),
        ["src/App.tsx"],
      ),
    );
    expect(await screen.findByText("checks passed")).toBeInTheDocument();
    // Individual gate labels live behind the Advanced control now.
    await user.click(
      screen.getByRole("button", { name: /readiness gates/i }),
    );
    expect(
      screen.getByText("Artifact digest matches validation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Validation snapshot captured"),
    ).toBeInTheDocument();
    expect(screen.getByText("Target files fingerprinted")).toBeInTheDocument();
    expect(screen.getByText("Repository state unchanged")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply unavailable" }),
    ).toBeDisabled();
    expect(loadRepositoryValidationSnapshot).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      ["src/App.tsx"],
    );
    await waitFor(() => {
      expect(saveProposedChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          patchArtifacts: [
            expect.objectContaining({
              validationStatus: "dry_run_passed",
              artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
              validatedArtifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
              validationRepositorySnapshot: expect.objectContaining({
                headSha: "abc1234",
              }),
            }),
          ],
        }),
      );
    });
  });

  it("rejects malformed OpenAI output without creating review records", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(requestOpenAiPlan).mockResolvedValue({ summary: "Incomplete" });
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "OpenAI · test-model" }),
      ).toBeEnabled();
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Agent provider" }),
      "openai",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Create an invalid plan",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate plan with OpenAI" }),
    );

    expect(
      await screen.findByText(
        "OpenAI returned malformed plan output. No review records were created.",
      ),
    ).toBeInTheDocument();
    expect(saveAgentRunRecord).not.toHaveBeenCalled();
    expect(saveProposedChange).not.toHaveBeenCalled();
    expect(saveApprovalRequest).not.toHaveBeenCalled();
  });

  it("shows normalized OpenAI errors without creating broken records", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "test-model",
    });
    vi.mocked(requestOpenAiPlan).mockRejectedValue(
      new Error("provider_unavailable: private upstream details"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "OpenAI · test-model" }),
      ).toBeEnabled();
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Agent provider" }),
      "openai",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Create a provider plan",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate plan with OpenAI" }),
    );

    expect(
      await screen.findByText(
        "OpenAI is currently unavailable. No review records were created.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/private upstream details/),
    ).not.toBeInTheDocument();
    expect(saveAgentRunRecord).not.toHaveBeenCalled();
    expect(saveProposedChange).not.toHaveBeenCalled();
    expect(saveApprovalRequest).not.toHaveBeenCalled();
  });

  it("refuses to start a run when storage failed and no repository was ever chosen", async () => {
    // This asserted that a mock run *was created* here, and it could only do
    // that because a fabricated repository outlived the failed hydrate: the run
    // was attributed to it, and the proposal it wrote carried
    // `repositoryId: "repo-workspace"` -- provenance naming a repository nobody
    // had chosen and that did not exist. The premise died with the fixture, so
    // the assertion changed rather than being re-pointed at something that
    // still passed. With nothing to attribute a run to, and no way to reach the
    // native picker from the web preview, refusing is the honest answer.
    //
    // The persistence assertions are unchanged and are the reason this test
    // still exists: a storage failure must never be met with a write.
    vi.mocked(loadSavedRepositories).mockRejectedValueOnce(
      new Error("native storage unavailable"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Document the repository entry points",
    );

    // The composer already degraded honestly on its own -- the fixture was the
    // only reason this state was never seen. It names the obstacle rather than
    // a repository, and the control that would act is not offered.
    expect(await screen.findByText("repository required")).toBeInTheDocument();
    const runButton = screen.getByRole("button", { name: "Run mock agent" });
    expect(runButton).toBeDisabled();

    await user.click(runButton);

    expect(
      screen.queryByText(/Mock run created for this session/),
    ).not.toBeInTheDocument();
    expect(saveAgentRunRecord).not.toHaveBeenCalled();
    expect(saveProposedChange).not.toHaveBeenCalled();
    expect(saveApprovalRequest).not.toHaveBeenCalled();
  });

  it("switches the selected agent run from the run list", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Open agent run Refresh repository context index",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Refresh repository context index",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/mock-context-v1/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("packages/indexing/src/index.ts").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Approve indexing job persistence follow-up"),
    ).toBeInTheDocument();
  });

  it("keeps approval actions visible, wired, and reflected in pending count", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Review approval Approve provider abstraction patch plan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Approve provider abstraction patch plan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Draft app shell implementation plan"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mock Provider.*mock-planner-v1/),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan attached to approval")).toBeInTheDocument();
    expect(screen.getByText("Proposal Status")).toBeInTheDocument();
    expect(screen.getByText("Patch Artifacts")).toBeInTheDocument();
    expect(screen.getByText("Patch artifact review")).toBeInTheDocument();
    expect(
      screen.getByText(/separate from local Git diffs/),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", {
        name: /failed docs\/specs\/provider-api\.md/,
      })[0],
    );
    expect(
      screen.getAllByText("Patch generation failed").length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getAllByRole("button", {
        name: /unavailable docs\/rfcs\/provider-abstraction\.md/,
      })[0],
    );
    expect(screen.getAllByText("Patch unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ready for review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("not generated").length).toBeGreaterThan(0);
    expect(screen.getByText("Ordered plan")).toBeInTheDocument();
    expect(screen.getByText("Review risks")).toBeInTheDocument();
    expect(screen.getByText("Check strategy")).toBeInTheDocument();
    expect(screen.getByText("Local repository diffs")).toBeInTheDocument();
    expect(
      screen.getByText(
        /This shows matching local Git diffs. Generated patch artifacts remain separate/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Local Diffs")).toBeInTheDocument();
    expect(screen.getAllByText("Local diff available").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("No local diff yet").length).toBeGreaterThan(0);
    expect(await screen.findByText("Local Git diff")).toBeInTheDocument();
    expect(
      screen.getByText("+export const label = 'new';"),
    ).toBeInTheDocument();
    expect(loadGitFileDiff).toHaveBeenCalledWith(
      "repo-workspace",
      "/workspace",
      expect.objectContaining({ path: "apps/desktop/src/App.tsx" }),
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(updateApprovalRequestStatus).toHaveBeenCalledWith(
      "approval-provider-rfc",
      "approved",
    );
    expect(saveProposedChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        approvalRequestId: "approval-provider-rfc",
        id: "proposal-mvp-shell",
        status: "approved",
      }),
    ]);
    expect(
      await screen.findByRole("heading", { name: "1 pending approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "0 runs are waiting for human approval across all repositories",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Request approved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(applyApprovedPatchArtifact).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "Review approval Approve indexing job persistence follow-up",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(updateApprovalRequestStatus).toHaveBeenCalledWith(
      "approval-indexing-job",
      "rejected",
    );
    expect(saveProposedChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        approvalRequestId: "approval-indexing-job",
        id: "proposal-index-refresh",
        status: "rejected",
      }),
    ]);
    expect(
      await screen.findByRole("heading", { name: "0 pending approvals" }),
    ).toBeInTheDocument();
  });

  it("shows approval diff loading state from the safe local diff wrapper", async () => {
    vi.mocked(loadGitFileDiff).mockImplementation(
      () => new Promise<GitFileDiff>(() => undefined),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(await screen.findByText("Loading diff safely")).toBeInTheDocument();
    expect(screen.getByText("Local repository diffs")).toBeInTheDocument();
  });

  it("shows approval diff error state without hiding approval actions", async () => {
    vi.mocked(loadGitFileDiff).mockImplementation(async () => {
      throw new Error("diff failed");
    });
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(
      await screen.findByText("Diff could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("shows the no-file-selected preview state when no indexed files exist", async () => {
    renderApp({ files: [] });

    await goToTab("Changes");

    expect(
      await screen.findByText("Select a file after running indexing."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading preview...")).not.toBeInTheDocument();
    expect(previewRepositoryFile).not.toHaveBeenCalled();
  });

  it("shows the loading preview state while safe preview data is pending", async () => {
    const pendingPreview = new Promise<FileContentPreview>(() => undefined);
    renderApp({ preview: pendingPreview });

    await goToTab("Changes");

    expect(await screen.findByText("Loading preview...")).toBeInTheDocument();
  });

  it("shows text preview content returned by the safe preview wrapper", async () => {
    renderApp({
      preview: {
        path: "src/App.tsx",
        status: "ready",
        content: "const visiblePreview = true;",
        sizeBytes: 24,
        maxSizeBytes: 65536,
      },
    });

    await goToTab("Changes");

    expect(
      await screen.findByText("const visiblePreview = true;"),
    ).toBeInTheDocument();
    expect(previewRepositoryFile).toHaveBeenCalledWith(
      "/workspace",
      "src/App.tsx",
    );
  });

  it("shows binary file preview state", async () => {
    renderApp({
      preview: {
        path: "src/App.tsx",
        status: "binary",
        content: null,
        sizeBytes: 24,
        maxSizeBytes: 65536,
      },
    });

    await goToTab("Changes");

    expect(
      await screen.findByText("Preview skipped for binary content."),
    ).toBeInTheDocument();
  });

  it("shows too-large file preview state", async () => {
    renderApp({
      preview: {
        path: "src/App.tsx",
        status: "too_large",
        content: null,
        sizeBytes: 1024 * 1024,
        maxSizeBytes: 65536,
      },
    });

    await goToTab("Changes");

    expect(
      await screen.findByText(
        "Preview skipped because this file is 1.0 MB. The preview limit is 64.0 KB.",
      ),
    ).toBeInTheDocument();
  });

  it("shows outside-repository preview state", async () => {
    renderApp({
      preview: {
        path: "src/App.tsx",
        status: "outside_repository",
        content: null,
        sizeBytes: 24,
        maxSizeBytes: 65536,
      },
    });

    await goToTab("Changes");

    expect(
      await screen.findByText(
        "Preview blocked because the resolved path is outside the repository.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the preview error fallback when the safe preview wrapper rejects", async () => {
    vi.mocked(previewRepositoryFile).mockRejectedValueOnce(
      new Error("preview failed"),
    );
    renderApp();

    await goToTab("Changes");

    expect(
      await screen.findByText("Preview unavailable for this file."),
    ).toBeInTheDocument();
  });

  it("updates the preview panel when selecting a different indexed file", async () => {
    const files: IndexedFileFact[] = [
      ...defaultFiles,
      {
        repositoryId: "repo-workspace",
        path: "docs/guide.md",
        sizeBytes: 512,
        extension: "md",
        modifiedAt: "Today, 11:15",
      },
    ];

    vi.mocked(previewRepositoryFile).mockImplementation(
      async (_repositoryPath, filePath) => ({
        path: filePath,
        status: "ready",
        content: `Preview for ${filePath}`,
        sizeBytes: filePath === "docs/guide.md" ? 512 : 1280,
        maxSizeBytes: 65536,
      }),
    );

    const { user } = renderApp({ files });

    await user.click(screen.getByRole("button", { name: "Changes" }));
    expect(
      await screen.findByText("Preview for src/App.tsx"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "docs/guide.md, md, 512 B" }),
    );

    expect(
      await screen.findByText("Preview for docs/guide.md"),
    ).toBeInTheDocument();
    expect(previewRepositoryFile).toHaveBeenLastCalledWith(
      "/workspace",
      "docs/guide.md",
    );
  });
});

describe("rollback surface", () => {
  const AI_ARTIFACT_ID = "proposal-file-ai-patch-artifact";
  const AI_PATH = "packages/ai/src/index.ts";

  const dirtyGitStatus: GitStatusSummary = {
    repositoryId: "repo-workspace",
    repositoryPath: "/workspace",
    branch: "main",
    headSha: "abc1234",
    isGitRepository: true,
    isClean: false,
    changedFileCount: 1,
    stagedCount: 0,
    unstagedCount: 1,
    untrackedCount: 0,
    conflictedCount: 0,
    files: [
      { path: AI_PATH, kind: "modified", stage: "unstaged", statusCode: " M" },
    ],
    refreshedAt: "1783532500",
  };

  /** A proposal whose artifact reached a verified apply. */
  function appliedProposedChange(): PersistedProposedChange[] {
    return defaultProposedChanges.map((change) =>
      change.id === "proposal-mvp-shell"
        ? {
            ...change,
            status: "applied",
            patchArtifacts: change.patchArtifacts.map((artifact) =>
              artifact.id === AI_ARTIFACT_ID
                ? {
                    ...artifact,
                    applyStatus: "applied_verified" as const,
                    appliedAt: "1783532500",
                    appliedBy: "local_user" as const,
                    backupId: "backup-1",
                  }
                : artifact,
            ),
          }
        : change,
    );
  }

  /** The attempt carrying the rollback baseline assertion. */
  function verifiedAttempt(withBaseline: boolean) {
    return [
      {
        applyAttemptId: "apply-1",
        repositoryId: "repo-workspace",
        proposedChangeId: "proposal-mvp-shell",
        approvalRequestId: "approval-provider-rfc",
        patchArtifactId: AI_ARTIFACT_ID,
        backupId: "backup-1",
        status: "applied_verified" as const,
        startedAt: "1783532400",
        // The baseline is a positive assertion from native; without one, the
        // surface must refuse permanently rather than reconstruct eligibility.
        rollbackBaseline: withBaseline
          ? {
              status: "recorded" as const,
              source: "apply",
              targetPath: AI_PATH,
              contentSha256: "f".repeat(64),
              branch: "main",
              headSha: "abc1234",
              capturedAt: "1783532400",
            }
          : undefined,
        message: "applied",
      },
    ];
  }

  async function openAppliedArtifact(withBaseline: boolean) {
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue(
      verifiedAttempt(withBaseline),
    );
    const { user } = renderApp({
      gitStatus: dirtyGitStatus,
      proposedChanges: appliedProposedChange(),
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    // Rollback lives with apply, behind Approval Review.
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(`generated ${AI_PATH.replace(/[/.]/g, "\\$&")}`),
      }),
    );

    return user;
  }

  // The UX contract: ineligibility and its reason are shown where the artifact
  // is displayed, before any action. An artifact whose apply recorded no
  // baseline can never be rolled back, and a button that exists only to refuse
  // is dishonesty in a smaller box.
  it("explains permanent ineligibility instead of offering a button that can only refuse", async () => {
    await openAppliedArtifact(false);

    expect(
      await screen.findByText(/Rollback unavailable:.*can never be rolled back/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Roll Back Patch" }),
    ).not.toBeInTheDocument();
  });

  it("requires the exact phrase and sends durable IDs only", async () => {
    vi.mocked(rollbackAppliedPatchArtifact).mockResolvedValue({
      status: "rolled_back",
      rollbackAttemptId: "rollback-1",
      proposedChangeId: "proposal-mvp-shell",
      patchArtifactId: AI_ARTIFACT_ID,
      rollbackBackupId: "rollback-backup-1",
      rolledBackAt: "1783532600",
      postRollbackGitStatus: {
        ...dirtyGitStatus,
        isClean: true,
        changedFileCount: 0,
        unstagedCount: 0,
        files: [],
      },
      postRollbackVerification: {
        status: "rolled_back",
        targetPath: AI_PATH,
        expectedChangedPaths: [],
        observedChangedPaths: [],
        unexpectedPaths: [],
        missingExpectedPaths: [],
        expectedStagedPaths: [],
        observedStagedPaths: [],
        verifiedAt: "1783532600",
        message: "Restored and verified.",
      },
      message: "Restored and verified.",
    });
    const user = await openAppliedArtifact(true);

    await user.click(
      await screen.findByRole("button", { name: "Roll Back Patch" }),
    );

    // The artifact's operation is `modify`, so the copy must say it restores
    // previous contents rather than that it deletes the file.
    expect(
      screen.getByText(/restores.*to its pre-apply contents/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /does not stage, commit, or touch Git history, and it cannot be undone from here/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^This deletes/)).not.toBeInTheDocument();

    const phrase = screen.getByLabelText("Type ROLL BACK to confirm");
    const confirm = screen.getByRole("button", { name: "Confirm Roll Back" });

    await user.type(phrase, "roll back");
    expect(confirm).toBeDisabled();
    expect(rollbackAppliedPatchArtifact).not.toHaveBeenCalled();

    await user.clear(phrase);
    await user.type(phrase, "ROLL BACK");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() =>
      expect(rollbackAppliedPatchArtifact).toHaveBeenCalledWith(
        "repo-workspace",
        "proposal-mvp-shell",
        AI_ARTIFACT_ID,
        "ROLL BACK",
      ),
    );
    expect(await screen.findByText("Restored and verified.")).toBeInTheDocument();
  });

  // A quarantined rollback is not an error to swallow: the write happened and
  // could not be proven.
  it("surfaces a quarantined rollback with its unexpected-path evidence", async () => {
    vi.mocked(rollbackAppliedPatchArtifact).mockResolvedValue({
      status: "quarantine_required",
      rollbackAttemptId: "rollback-1",
      proposedChangeId: "proposal-mvp-shell",
      patchArtifactId: AI_ARTIFACT_ID,
      rollbackBackupId: "rollback-backup-1",
      rolledBackAt: "1783532600",
      postRollbackGitStatus: dirtyGitStatus,
      postRollbackVerification: {
        status: "quarantine_required",
        targetPath: AI_PATH,
        expectedChangedPaths: [],
        observedChangedPaths: ["surprise.txt"],
        unexpectedPaths: ["surprise.txt"],
        missingExpectedPaths: [],
        expectedStagedPaths: [],
        observedStagedPaths: [],
        verifiedAt: "1783532600",
        message:
          "Post-restore verification could not prove that the rollback restored only the target path.",
      },
      message:
        "Post-restore verification could not prove that the rollback restored only the target path.",
    });
    const user = await openAppliedArtifact(true);

    await user.click(
      await screen.findByRole("button", { name: "Roll Back Patch" }),
    );
    await user.type(
      screen.getByLabelText("Type ROLL BACK to confirm"),
      "ROLL BACK",
    );
    await user.click(screen.getByRole("button", { name: "Confirm Roll Back" }));

    expect(
      await screen.findByText(/could not prove that the rollback restored/i),
    ).toBeInTheDocument();
  });

  it("refuses a drifted target without claiming anything was restored", async () => {
    const { PatchApplicationError: RealError } = await vi.importActual<
      typeof import("./storage/patchApplication")
    >("./storage/patchApplication");
    vi.mocked(rollbackAppliedPatchArtifact).mockRejectedValue(
      new RealError(
        "target_drifted",
        "The target file changed after this patch was applied. Rollback will not overwrite work done since the apply.",
      ),
    );
    const user = await openAppliedArtifact(true);

    await user.click(
      await screen.findByRole("button", { name: "Roll Back Patch" }),
    );
    await user.type(
      screen.getByLabelText("Type ROLL BACK to confirm"),
      "ROLL BACK",
    );
    await user.click(screen.getByRole("button", { name: "Confirm Roll Back" }));

    expect(
      await screen.findByText(/will not overwrite work done since the apply/i),
    ).toBeInTheDocument();
  });
});

describe("repository-scoped facts", () => {
  // Every one of these is correct today only because activeRepository is pinned
  // to repositories[0], so the live Git status can only ever be the active
  // repository's. The moment a switch is possible there is an async window --
  // and a stale-result window -- where the summary in hand describes a
  // different repository than the one being named. Fail closed to unknown, not
  // to the other repository's numbers.
  //
  // Every value here is chosen to differ from what the active repository's own
  // saved record would produce (branch "main", openChanges 0 -> clean). A
  // foreign status that happens to agree with the fallback proves nothing: the
  // assertions could pass whether the guard exists or not.
  const otherRepositoryStatus: GitStatusSummary = {
    repositoryId: "repo-somewhere-else",
    repositoryPath: "/somewhere/else",
    branch: "other-branch",
    headSha: "9999999",
    isGitRepository: true,
    isClean: false,
    changedFileCount: 7,
    stagedCount: 3,
    unstagedCount: 4,
    untrackedCount: 0,
    conflictedCount: 0,
    files: [
      {
        path: "somewhere/else/file.ts",
        kind: "modified",
        stage: "unstaged",
        statusCode: " M",
      },
    ],
    refreshedAt: "1783532100",
  };

  it("never reports another repository's changed-file count as this one's", async () => {
    const { user } = renderApp({ gitStatus: otherRepositoryStatus });

    // The app enters through Review; this guards the Overview Active Work card,
    // so open Overview explicitly.
    await user.click(screen.getByRole("button", { name: "Overview" }));
    const overview = await screen.findByLabelText("Active work");

    // The foreign repository has 7 changes and is dirty; this one's own saved
    // record says 0 and clean. Falling back to this repository's own record is
    // correct — reporting the other one's 7 is the lie.
    expect(overview.textContent).not.toContain("7");
    expect(overview.textContent).toContain("0");
  });

  // The derived Git facts are not only rendered — they are sent to the provider
  // as context describing the active repository. A branch, cleanliness, and
  // changed-file count read from a different repository would be labelled with
  // this repository's id and name and shipped to OpenAI. That is the honesty
  // failure with a consequence beyond the screen.
  it("never sends another repository's Git facts to the provider as this one's", async () => {
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "gpt-5.6-luna",
      reason: undefined,
    });
    vi.mocked(requestOpenAiPlan).mockResolvedValue({
      summary: "Bounded plan",
      steps: [],
      affectedFiles: [],
      risks: [],
      validation: [],
      patchArtifacts: [],
      approvalRequired: true,
    });
    const { user } = renderApp({ gitStatus: otherRepositoryStatus });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    const providerSelect = screen.getByRole("combobox", {
      name: "Agent provider",
    });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "OpenAI · gpt-5.6-luna" }),
      ).toBeEnabled();
    });
    await user.selectOptions(providerSelect, "openai");
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Plan something",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate plan with OpenAI" }),
    );

    await waitFor(() => expect(requestOpenAiPlan).toHaveBeenCalled());
    const [payload] = vi.mocked(requestOpenAiPlan).mock.calls[0] as [
      {
        context: {
          branch: string;
          git: { isClean: boolean; changedFileCount: number };
        };
      },
    ];
    expect(payload.context.branch).not.toBe("other-branch");
    expect(payload.context.git.isClean).not.toBe(false);
    expect(payload.context.git.changedFileCount).not.toBe(7);
  });

  // A second hardcoded index, alongside repositories[0]. An indexing job knows
  // the repository it describes; taking the first one rendered whichever
  // repository indexed most recently as though it were the active one.
  it("never reports another repository's indexing job as this one's", async () => {
    vi.mocked(loadIndexingJobs).mockResolvedValue([
      {
        id: "job-elsewhere",
        repositoryId: "repo-somewhere-else",
        repositoryName: "Somewhere Else",
        status: "running",
        progress: 42,
        step: "Indexing a repository you are not looking at",
        createdAt: "1783532100",
        updatedAt: "1783532100",
      },
    ]);
    renderApp();

    await screen.findByRole("button", { name: "Repositories" });

    expect(
      screen.queryByText("Indexing a repository you are not looking at"),
    ).not.toBeInTheDocument();
  });

  it("keeps apply readiness unknown rather than trusting another repository's tree", async () => {
    renderApp({ gitStatus: otherRepositoryStatus });

    await screen.findByRole("button", { name: "Agent Runs" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    // The eighteen gates are behind the Advanced control now.
    await user.click(
      await screen.findByRole("button", { name: /readiness gates/i }),
    );

    // The working-tree gate feeds apply readiness. A foreign clean tree must
    // never read as this repository's clean tree.
    expect(
      await screen.findByText("Refresh Git status to check the working tree."),
    ).toBeInTheDocument();
  });
});

describe("repository switching", () => {
  const secondRepository: RepositorySummary = {
    id: "repo-disposable",
    name: "Disposable-QA-Repo",
    path: "/tmp/disposable",
    isGitRepository: true,
    branch: "qa-branch",
    status: "indexed",
    openChanges: 5,
    lastIndexedAt: "Today, 11:00",
  };

  const bothRepositories = [mockState.repositories[0], secondRepository];

  /** Indexed files differ per repository, so a stale list is visible. */
  function filesFor(repositoryId: string): IndexedFileFact[] {
    return repositoryId === secondRepository.id
      ? [
          {
            repositoryId,
            path: "disposable/only-here.ts",
            sizeBytes: 10,
            extension: "ts",
            modifiedAt: "1783532100",
          },
        ]
      : defaultFiles;
  }

  it("selects a saved repository and describes it, not the first one", async () => {
    vi.mocked(loadIndexedFileFacts).mockImplementation(async (repositoryId: string) =>
      filesFor(repositoryId),
    );
    const { user } = renderApp({ repositories: bothRepositories });

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    await user.click(
      await screen.findByRole("button", { name: /Disposable-QA-Repo/ }),
    );

    // The repository detail must describe the repository that was chosen.
    expect(await screen.findByText("/tmp/disposable")).toBeInTheDocument();
    expect(await screen.findAllByText("qa-branch")).not.toHaveLength(0);
    // The first repository's identity must be gone from the detail.
    expect(screen.queryByText("/workspace")).not.toBeInTheDocument();
    // And its indexed files must be reloaded for it, not left as the first
    // repository's.
    await waitFor(() =>
      expect(loadIndexedFileFacts).toHaveBeenCalledWith("repo-disposable"),
    );
  });

  it("indexes an unindexed repository the moment it is selected, with no control in between", async () => {
    const unindexedRepository: RepositorySummary = {
      id: "repo-unindexed",
      name: "Never-Indexed-Repo",
      path: "/tmp/never-indexed",
      isGitRepository: true,
      branch: "main",
      status: "not_indexed",
      openChanges: 0,
      lastIndexedAt: null,
    };
    const { user } = renderApp({
      repositories: [mockState.repositories[0], unindexedRepository],
    });

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    // Selecting the repository is the only interaction. No "Reindex repository"
    // control is touched between selection and the indexed state.
    await user.click(
      await screen.findByRole("button", { name: /Never-Indexed-Repo/ }),
    );

    await waitFor(() =>
      expect(scanRepositoryFileTree).toHaveBeenCalledWith(
        "repo-unindexed",
        "/tmp/never-indexed",
      ),
    );
    // Exactly once: selection must not double-index, and nothing else indexes.
    expect(scanRepositoryFileTree).toHaveBeenCalledTimes(1);
    // The repository reaches the indexed state from selection alone.
    await waitFor(() =>
      expect(saveRepositories).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "repo-unindexed", status: "indexed" }),
        ]),
      ),
    );
  });

  // The leak this task exists to close, and the one worth its own test:
  // indexed files were loaded once at hydrate for repositories[0] and never
  // again. They are not merely rendered -- they are sent to the provider as
  // context describing the active repository, so a run created after a switch
  // would ship the previous repository's file paths to OpenAI under this
  // repository's id and name.
  it("never sends the previous repository's indexed file paths to the provider", async () => {
    vi.mocked(loadIndexedFileFacts).mockImplementation(async (repositoryId: string) =>
      filesFor(repositoryId),
    );
    vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
      configured: true,
      model: "gpt-5.6-luna",
      reason: undefined,
    });
    vi.mocked(requestOpenAiPlan).mockResolvedValue({
      summary: "Bounded plan",
      steps: [],
      affectedFiles: [],
      risks: [],
      validation: [],
      patchArtifacts: [],
      approvalRequired: true,
    });
    const { user } = renderApp({ repositories: bothRepositories });

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    await user.click(
      await screen.findByRole("button", { name: /Disposable-QA-Repo/ }),
    );
    // Wait on the UI settling, not on the reload mock: if the wait itself is
    // what discriminates, the leak assertion below never gets evaluated.
    await screen.findByText("/tmp/disposable");

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    const providerSelect = screen.getByRole("combobox", {
      name: "Agent provider",
    });
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "OpenAI · gpt-5.6-luna" }),
      ).toBeEnabled();
    });
    await user.selectOptions(providerSelect, "openai");
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Plan against the disposable repository",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate plan with OpenAI" }),
    );

    await waitFor(() => expect(requestOpenAiPlan).toHaveBeenCalled());
    const [payload] = vi.mocked(requestOpenAiPlan).mock.calls[0] as [
      {
        repositoryId: string;
        context: { indexedFileCount: number; keyFiles: string[] };
      },
    ];
    expect(payload.repositoryId).toBe("repo-disposable");
    // The count discriminates in both directions, which `keyFiles` cannot:
    // leave the previous repository's files in place and it is defaultFiles's
    // length; drop the reload and it is 0. Only a reload that actually loaded
    // this repository's one file gives 1.
    expect(payload.context.indexedFileCount).toBe(1);
    expect(payload.context.keyFiles).not.toContain("package.json");
    expect(payload.context.keyFiles).not.toContain("README.md");
  });

  it("refuses to switch while a patch operation is in flight, and says why", async () => {
    vi.mocked(loadIndexedFileFacts).mockImplementation(async (repositoryId: string) =>
      filesFor(repositoryId),
    );
    // An apply that never settles: the operation stays in flight.
    vi.mocked(applyApprovedPatchArtifact).mockImplementation(
      () => new Promise(() => {}),
    );
    const { user } = renderApp({
      gitStatus: {
        ...mockState.gitStatus,
        isClean: true,
        changedFileCount: 0,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        files: [],
      },
      repositories: bothRepositories,
    });

    // Drive a real apply to a real in-flight state: `Apply Patch` only appears
    // once validation, approval, and every readiness gate have passed.
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    // Checks run on open; no validate control to click.
    await screen.findByText("checks passed");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(await screen.findByRole("button", { name: "Apply Patch" }));
    await user.type(
      screen.getByRole("textbox", { name: "Confirmation phrase" }),
      "APPLY PATCH",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm Apply Patch" }),
    );

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    expect(
      await screen.findByText(/Switching repositories is unavailable/),
    ).toBeInTheDocument();

    const row = screen.getByRole("button", { name: /Disposable-QA-Repo/ });
    expect(row).toBeDisabled();
    await user.click(row);

    // Still the original repository: the in-flight operation's result must not
    // land under a repository the user switched to mid-write.
    expect(screen.queryByText("/tmp/disposable")).not.toBeInTheDocument();
  });
});

describe("repository-scoped agent runs and approvals", () => {
  /**
   * Real-shaped ids on purpose. The default fixture repository is
   * `repo-workspace`, which is exactly the id the shipped demo proposals carry
   * -- against that fixture a "demo records are unlinked" assertion is not
   * merely vacuous, it is wrong, because there they genuinely do link.
   */
  const activeRepository: RepositorySummary = {
    id: "repo-/tmp/scoped",
    name: "Scoped-Repo",
    path: "/tmp/scoped",
    isGitRepository: true,
    branch: "release-2026-07",
    status: "indexed",
    openChanges: 0,
    lastIndexedAt: "Today, 11:00",
  };

  const otherRepository: RepositorySummary = {
    id: "repo-/tmp/other",
    name: "Other-Repo",
    path: "/tmp/other",
    isGitRepository: true,
    branch: "other-branch",
    status: "indexed",
    openChanges: 0,
    lastIndexedAt: "Today, 11:20",
  };

  /** `repositories[0]` is the active one when nothing is selected. */
  const bothRepositories = [activeRepository, otherRepository];

  function proposalsFor(
    mvpShellRepositoryId: string,
    indexRefreshRepositoryId?: string,
  ): PersistedProposedChange[] {
    return defaultProposedChanges
      .map((change) =>
        change.id === "proposal-mvp-shell"
          ? { ...change, repositoryId: mvpShellRepositoryId }
          : { ...change, repositoryId: indexRefreshRepositoryId ?? "" },
      )
      .filter(
        (change) =>
          change.id !== "proposal-index-refresh" ||
          indexRefreshRepositoryId !== undefined,
      );
  }

  it("splits agent runs into the active repository's work and an explicit unlinked group", async () => {
    // `run-mvp-shell` links to this repository. `run-index-refresh` loses its
    // proposal entirely, so nothing can say which repository it belongs to.
    const { user } = renderApp({
      repositories: [activeRepository],
      proposedChanges: proposalsFor(activeRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    const unlinkedGroup = await screen.findByRole("group", {
      name: "Not linked to a saved repository",
    });

    // Fails in both directions: with no filter the unlinked run sits in the
    // main list and the group never renders; over-filter and the scoped run
    // disappears from it.
    expect(
      within(unlinkedGroup).getByRole("button", {
        name: /Refresh repository context index/,
      }),
    ).toBeInTheDocument();
    expect(
      within(unlinkedGroup).queryByRole("button", {
        name: /Draft app shell implementation plan/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Open agent run Draft app shell implementation plan/,
      }),
    ).toBeInTheDocument();
  });

  it("hides another saved repository's agent run without grouping it as unlinked", async () => {
    const { user } = renderApp({
      repositories: bothRepositories,
      proposedChanges: proposalsFor(activeRepository.id, otherRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    expect(
      await screen.findByRole("button", {
        name: /Open agent run Draft app shell implementation plan/,
      }),
    ).toBeInTheDocument();
    // Another repository's work: not shown here, and not mislabelled as
    // unlinked either -- its link resolves perfectly well.
    expect(
      screen.queryByRole("button", {
        name: /Open agent run Refresh repository context index/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Not linked to a saved repository" }),
    ).not.toBeInTheDocument();
  });

  it("does not print the active repository's branch beside an unlinked run", async () => {
    const { user } = renderApp({
      repositories: [activeRepository],
      proposedChanges: proposalsFor(activeRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(
      await screen.findByRole("button", {
        name: /Open agent run Refresh repository context index/,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Refresh repository context index",
      }),
    ).toBeInTheDocument();
    // The whole defect: one repository's name printed directly above another
    // repository's branch. `release-2026-07` belongs to no run on this screen.
    expect(screen.queryByText("release-2026-07")).not.toBeInTheDocument();
    expect(
      screen.getByText("Not linked to a saved repository", {
        selector: "dd",
      }),
    ).toBeInTheDocument();
  });

  it("renders an empty agent run detail rather than crashing when no run is visible", async () => {
    // Both demo runs belong to the other saved repository, so the active
    // repository has no runs and nothing is unlinked. Before the guard, the
    // detail card dereferenced an undefined run and the render threw.
    const { user } = renderApp({
      repositories: bothRepositories,
      proposedChanges: proposalsFor(otherRepository.id, otherRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    expect(
      await screen.findByRole("heading", { name: "No agent run selected" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Not linked to a saved repository" }),
    ).not.toBeInTheDocument();
  });

  it("splits approvals into the active repository's work and an explicit unlinked group", async () => {
    const { user } = renderApp({
      repositories: [activeRepository],
      proposedChanges: proposalsFor(activeRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    const unlinkedGroup = await screen.findByRole("group", {
      name: "Not linked to a saved repository",
    });

    expect(
      within(unlinkedGroup).getByRole("button", {
        name: /Approve indexing job persistence follow-up/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review approval Approve provider abstraction patch plan/,
      }),
    ).toBeInTheDocument();
    expect(
      within(unlinkedGroup).queryByRole("button", {
        name: /Approve provider abstraction patch plan/,
      }),
    ).not.toBeInTheDocument();
  });

  it("hides another saved repository's approval without grouping it as unlinked", async () => {
    const { user } = renderApp({
      repositories: bothRepositories,
      proposedChanges: proposalsFor(activeRepository.id, otherRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(
      await screen.findByRole("button", {
        name: /Review approval Approve provider abstraction patch plan/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Review approval Approve indexing job persistence follow-up/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Not linked to a saved repository" }),
    ).not.toBeInTheDocument();
  });

  it("does not print the active repository's branch beside an unlinked approval", async () => {
    const { user } = renderApp({
      repositories: [activeRepository],
      proposedChanges: proposalsFor(activeRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Approvals" }));
    await user.click(
      await screen.findByRole("button", {
        name: /Review approval Approve indexing job persistence follow-up/,
      }),
    );

    // Exactly one survivor, and it is the "Repository Context" side card, which
    // prints the active repository's branch under the active repository's own
    // name and is honest. The approval fact grid printed the same branch under
    // the *approval's* repository name -- two rows, one lie. Without the fix
    // this is 2 and the assertion fails.
    expect(screen.getAllByText("release-2026-07", { selector: "dd" })).toHaveLength(
      1,
    );
    expect(
      screen.getByText("Not linked to a saved repository", {
        selector: "dd",
      }),
    ).toBeInTheDocument();
  });

  it("counts only the approvals it shows above the list it shows them in", async () => {
    // One scoped approval, one unlinked, one belonging elsewhere. The hero
    // counted every repository's pending approvals above a scoped list.
    const { user } = renderApp({
      repositories: bothRepositories,
      proposedChanges: proposalsFor(activeRepository.id, otherRepository.id),
    });

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(
      await screen.findByRole("heading", { name: "1 pending approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "2 pending approvals" }),
    ).not.toBeInTheDocument();
  });
});

describe("no fabricated repository", () => {
  /**
   * Hydration's `catch` never calls `setRepositories`, so whatever the initial
   * state is survives a storage failure for the whole session. While that
   * initial state was `createMockRepositories()`, a failed hydrate left a
   * *fabricated* repository active -- named, branched, and indexed -- and the
   * app went on describing it as though a human had chosen it.
   */
  function failStorage() {
    vi.mocked(loadSavedRepositories).mockRejectedValueOnce(
      new Error("native storage unavailable"),
    );
  }

  it("does not invent a repository when local storage is unavailable", async () => {
    failStorage();
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Repositories" }));

    expect(
      await screen.findByRole("heading", { name: "No repository selected" }),
    ).toBeInTheDocument();
    // `queryAllByText`, not `queryByText`: the latter throws on multiple
    // matches, which fails the test for the wrong reason and hides what broke.
    expect(screen.queryAllByText("AI-Developer-Workspace")).toHaveLength(0);
    expect(
      screen.queryAllByText(/Documents\/AI Developer Workspace/),
    ).toHaveLength(0);
  });

  it("groups the demo records as unlinked when local storage is unavailable", async () => {
    // The roadmap claimed demo records "can never match a real repo-${path}, so
    // they land in that group permanently". That was false while a fixture
    // repository carrying the id `repo-workspace` outlived a failed hydrate:
    // the demo records linked to it correctly and read as real work. With no
    // fixture there is nothing for them to link to, and the claim is finally
    // true on this path too.
    failStorage();
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    const unlinkedGroup = await screen.findByRole("group", {
      name: "Not linked to a saved repository",
    });
    expect(
      within(unlinkedGroup).getByRole("button", {
        name: /Open agent run Draft app shell implementation plan/,
      }),
    ).toBeInTheDocument();
  });
});

describe("one apply entry point (#8 / #11 slice A)", () => {
  // A clean tree lets the readiness gates reach the live apply affordance; a
  // dirty tree would block it and make "no Apply Patch in Agent Runs" vacuous.
  const cleanGitStatus: GitStatusSummary = {
    ...defaultGitStatus,
    isClean: true,
    changedFileCount: 0,
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
    files: [],
  };

  it("renders the apply affordance only in Approvals, never in Agent Runs", async () => {
    const { user } = renderApp({ gitStatus: cleanGitStatus });

    // Drive the artifact all the way to a live apply: validated and approved,
    // entirely inside Approvals, which is now the sole apply surface.
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    // Checks run on open; no validate control to click.
    await screen.findByText("checks passed");
    await user.click(screen.getByRole("button", { name: "Approve" }));

    // Exactly one apply affordance render site, and it is here in Approvals.
    expect(
      await screen.findByRole("button", { name: "Apply Patch" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Apply Patch" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("region", { name: "Patch artifact detail" }),
    ).toHaveLength(1);

    // The same approved, validated run seen from Agent Runs offers no apply
    // affordance and renders no patch artifact detail at all.
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    expect(
      screen.queryByRole("button", { name: "Apply Patch" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Patch artifact detail" }),
    ).not.toBeInTheDocument();
  });

  it("navigates from an Agent Run to its linked approval, with that approval selected", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    // Pick the run whose linked approval is NOT the Approvals default, so the
    // control must actually set the selection rather than land on it by chance.
    await user.click(
      await screen.findByRole("button", {
        name: "Open agent run Refresh repository context index",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Review approval" }));

    // The section switched to Approvals...
    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();
    // ...with the run's own linked approval selected, not the default one.
    expect(
      screen.getByRole("heading", {
        name: "Approve indexing job persistence follow-up",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Approve provider abstraction patch plan",
      }),
    ).not.toBeInTheDocument();
  });
});

// Slice C (#11): validation and dry-run collapse into one "Checks" line that
// runs on review-open. The line is a projection of evaluateApplyReadiness, not
// of the durable `validationStatus` -- which records that a dry-run once passed
// and is never cleared (#4d), so reading it would say "passed" forever even
// once the repository moves out from under the artifact.
describe("checks collapse into one line (#11 slice C)", () => {
  const AI_ARTIFACT_ID = "proposal-file-ai-patch-artifact";

  async function openGeneratedArtifact(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
  }

  it("runs the native dry-run once on open, with no Validate control, and reports a passed checks line with its observation time", async () => {
    const { user } = renderApp();
    await openGeneratedArtifact(user);

    // Opening the approval and landing on the generated artifact runs the
    // native dry-run exactly once. No human clicks a validate button.
    await waitFor(() =>
      expect(dryRunGeneratedPatch).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.queryByRole("button", { name: "Validate & dry-run" }),
    ).not.toBeInTheDocument();

    // One checks line: a passed verdict, one reason, and the time it was
    // observed. It is a static observation, not a live watcher.
    expect(await screen.findByText("checks passed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Structure validation and the read-only Git dry-run passed, and the validated repository state still matches.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Checks observed at 1783532400/)).toBeInTheDocument();
  });

  it("does not re-invoke the native dry-run when an already-checked artifact is re-opened", async () => {
    const { user } = renderApp();
    await openGeneratedArtifact(user);
    await waitFor(() =>
      expect(dryRunGeneratedPatch).toHaveBeenCalledTimes(1),
    );
    await screen.findByText("checks passed");

    // Move to another artifact, then return to the already-checked one.
    await user.click(
      screen.getByRole("button", {
        name: /not generated apps\/desktop\/src\/App\.tsx/,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );

    // The observation is not refreshed: still exactly one native invocation.
    expect(await screen.findByText(/Checks observed at 1783532400/)).toBeInTheDocument();
    expect(dryRunGeneratedPatch).toHaveBeenCalledTimes(1);
  });

  // CRITICAL. The durable validationStatus is "dry_run_passed" and is never
  // cleared, but the repository snapshot no longer matches the validated one.
  // A line that reads validationStatus says "passed" here -- a stale, false
  // account. The line must project the evaluator, which blocks on staleness.
  it("reports checks failed from the evaluator, not a stale passed status, when the repository moved under a validated artifact", async () => {
    // The artifact content is unchanged; only the repository moved. The digest
    // gate is left unbound (validatedArtifactDigest omitted), so the one gate
    // that blocks is repository staleness -- the point under test. The app
    // recomputes `artifactDigest` from the rawDiff on hydrate, so the current
    // digest is present and the current-snapshot load fires.
    const staleProposal: PersistedProposedChange = {
      ...defaultProposedChanges[0],
      patchArtifacts: defaultProposedChanges[0].patchArtifacts.map((artifact) =>
        artifact.id === AI_ARTIFACT_ID
          ? {
              ...artifact,
              validationStatus: "dry_run_passed" as const,
              validationMessage:
                "Git reported the patch applicable at validation time.",
              validatedAt: "1783532400",
              dryRunAt: "1783532400",
              validationRepositorySnapshot: {
                repositoryId: "repo-workspace",
                branch: "main",
                headSha: "abc1234",
                isClean: false,
                changedFileCount: 3,
                relevantFilePaths: ["packages/ai/src/index.ts"],
                artifactDigest: "a".repeat(64),
                targetFileFingerprints: [
                  {
                    path: "packages/ai/src/index.ts",
                    exists: true,
                    sizeBytes: 120,
                    modifiedAt: "1783532000",
                    contentSha256: "f".repeat(64),
                    status: "captured" as const,
                  },
                ],
                // Stale: the working tree the artifact was validated against no
                // longer matches the current repository snapshot ("a".repeat).
                repositorySnapshotDigest: "b".repeat(64),
                capturedAt: "1783532400",
                fingerprintedAt: "1783532400",
              },
            }
          : artifact,
      ),
    };
    const { user } = renderApp({
      proposedChanges: [staleProposal, ...defaultProposedChanges.slice(1)],
    });
    await openGeneratedArtifact(user);

    expect(await screen.findByText("checks failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Repository state changed after validation. Re-run validation before future apply.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("checks passed")).not.toBeInTheDocument();
    // A stale observation is reported, never silently re-run.
    expect(dryRunGeneratedPatch).not.toHaveBeenCalled();
  });

  // The riskiest property: the checks line fires a native git subprocess on
  // render. It must never fire in the browser preview, which cannot run git.
  it("never fires the native dry-run subprocess in the browser runtime", async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(false);
    const { user } = renderApp();
    await openGeneratedArtifact(user);

    expect(
      await screen.findByText(/Checks run in the native desktop app/),
    ).toBeInTheDocument();
    expect(dryRunGeneratedPatch).not.toHaveBeenCalled();
  });
});

// Slice G (#11 slice 5): the six distinctions as copy. Each names, at a surface
// where the two ideas are easiest to confuse, the line between them. These tests
// prove the string is PRESENT at the surface -- not that it reads well or lands
// with the operator. That judgment is eyes-only and is recorded in the report.
describe("Slice G: the six distinctions as copy", () => {
  async function openGeneratedArtifact(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.click(screen.getByRole("button", { name: "Review approval" }));
    await user.click(
      await screen.findByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
  }

  // 1. Approve vs apply is already asserted at the Apply Readiness surface
  //    ("approval alone never applies a patch") and pinned by
  //    "keeps patch application disabled while safety gates are blocked". Not
  //    re-pinned here.

  // 2. Checks vs apply: a green check is evidence, not permission.
  it("distinguishes checks as read-only evidence from apply at the Checks surface", async () => {
    const { user } = renderApp();
    await openGeneratedArtifact(user);

    expect(
      await screen.findByText(
        "Checks are read-only evidence — they never modify your working tree, and passing checks are not approval to apply.",
      ),
    ).toBeInTheDocument();
  });

  // 3. Proposed vs actual: the diff is what the model suggested, not what is on
  //    disk; only post-apply verification reports the actual change.
  it("distinguishes the proposed diff from the actual change at the diff preview", async () => {
    const { user } = renderApp();
    await openGeneratedArtifact(user);

    expect(
      await screen.findByText(
        "This is the proposed change, not the actual one. Nothing is written to disk until you apply; post-apply verification then reports what actually changed.",
      ),
    ).toBeInTheDocument();
  });

  // 4. Demo vs real provider. This test used to pin "Mock Provider is a demo
  //    that plans only; applying and rolling back a patch needs a real provider
  //    such as OpenAI." The demo unlock made that sentence false -- the demo
  //    provider now generates a real, applyable patch -- and this test would
  //    have stayed green over the lie, because a string assertion cannot tell
  //    that the world moved underneath it. The distinction survives; the claim
  //    that carries it had to change.
  it("distinguishes the demo provider from a real one at Provider Context", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));

    expect(
      await screen.findByText(
        "Demo Provider is a demo, not a model. It returns one fixed patch that creates airlock-demo.md so you can exercise apply and rollback for real; proposing changes to your own code needs a real provider such as OpenAI.",
      ),
    ).toBeInTheDocument();
  });

  // The old sentence must not survive anywhere: it is now a false statement
  // about what this product can do, and it is exactly the sentence a reader
  // would trust.
  it("no longer claims the demo provider cannot apply or roll back", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await screen.findByText(/Demo Provider is a demo, not a model/);

    expect(screen.queryByText(/plans only/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Mock runs do not generate patch content/),
    ).not.toBeInTheDocument();
  });

  // 5. Quarantine vs failed: a quarantine blocks every further apply to the
  //    repository until INSPECTED; a failed apply changes nothing and blocks
  //    nothing. Both reach the recovery surface, so the line is drawn there.
  it("distinguishes a blocking quarantine from a non-blocking failed apply", async () => {
    const quarantinedChanges = defaultProposedChanges.map((change) =>
      change.id === "proposal-mvp-shell"
        ? {
            ...change,
            status: "quarantine_required" as const,
            patchArtifacts: change.patchArtifacts.map((artifact) =>
              artifact.id === "proposal-file-ai-patch-artifact"
                ? { ...artifact, applyStatus: "quarantine_required" as const }
                : artifact,
            ),
          }
        : change,
    );
    vi.mocked(reconcileInterruptedPatchApplyAttempts).mockResolvedValue([
      {
        applyAttemptId: "apply-quarantine-1",
        repositoryId: "repo-workspace",
        proposedChangeId: "proposal-mvp-shell",
        approvalRequestId: "approval-provider-rfc",
        patchArtifactId: "proposal-file-ai-patch-artifact",
        backupId: "backup-quarantine-1",
        status: "quarantine_required",
        startedAt: "1783532400",
        completedAt: "1783532500",
        sanitizedError: "Post-apply verification found an unexpected path.",
        currentGitStatusChanged: true,
        message: "Quarantined for manual inspection.",
      },
    ]);
    const { user } = renderApp({ proposedChanges: quarantinedChanges });
    await openGeneratedArtifact(user);

    expect(
      await screen.findByText(
        "A quarantine blocks every further apply to this repository until you record an inspection — unlike a failed apply, which changes nothing and blocks nothing.",
      ),
    ).toBeInTheDocument();
  });

  // 6. Backup vs rollback: a backup is only a receipt of the pre-apply bytes;
  //    restoring them is a separate, explicit rollback.
  it("distinguishes the backup receipt from the rollback restore at Apply Readiness", async () => {
    const { user } = renderApp();
    await openGeneratedArtifact(user);

    expect(
      await screen.findByText(
        /The backup is only a receipt of the original bytes; restoring them later is a separate, explicit rollback\./,
      ),
    ).toBeInTheDocument();
  });
});
