import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovalRequest, PersistedProposedChange } from "@ai-dev/ai";
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
import {
  saveApprovalRequest,
  updateApprovalRequestStatus,
} from "./storage/approvalRequestStore";
import { saveAgentRunRecord } from "./storage/agentRunStore";
import {
  saveProposedChange,
  saveProposedChanges,
} from "./storage/proposedChangeStore";
import {
  loadSavedRepositories,
  saveRepositories,
} from "./storage/repositoryStore";
import {
  pickRepositoryDirectories,
  RepositoryPickerError,
} from "./storage/repositoryPicker";
import {
  loadOpenAiProviderConfiguration,
  requestOpenAiPlan,
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
              "diff --git a/packages/ai/src/index.ts b/packages/ai/src/index.ts\n@@ -1,2 +1,3 @@\n-export type OldPlan = string;\n+export type NewPlan = string;\n+export type PatchArtifact = string;",
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

vi.mock("./storage/approvalRequestStore", () => ({
  loadApprovalRequests: vi.fn(async () => mockState.approvals),
  saveApprovalRequest: vi.fn(async () => undefined),
  saveApprovalRequests: vi.fn(async () => undefined),
  updateApprovalRequestStatus: vi.fn(async () => undefined),
}));

vi.mock("./storage/agentRunStore", () => ({
  loadAgentRunRecords: vi.fn(async () => []),
  saveAgentRunRecord: vi.fn(async () => undefined),
}));

vi.mock("./storage/proposedChangeStore", () => ({
  loadProposedChanges: vi.fn(async () => mockState.proposedChanges),
  saveProposedChange: vi.fn(async () => undefined),
  saveProposedChanges: vi.fn(async () => undefined),
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
}));

function renderApp(options?: {
  files?: IndexedFileFact[];
  gitDiff?: GitFileDiff;
  gitStatus?: GitStatusSummary;
  preview?: FileContentPreview | Promise<FileContentPreview>;
  proposedChanges?: PersistedProposedChange[];
  repositories?: RepositorySummary[];
}) {
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
  vi.mocked(pickRepositoryDirectories).mockResolvedValue(null);
  vi.mocked(saveRepositories).mockResolvedValue(undefined);
  vi.mocked(loadOpenAiProviderConfiguration).mockResolvedValue({
    configured: false,
    model: "gpt-5.6-luna",
    reason: "Set OPENAI_API_KEY in the native app environment.",
  });
  vi.mocked(requestOpenAiPlan).mockReset();
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

describe("App smoke tests", () => {
  it("renders all six tabs and updates the active surface from sidebar navigation", async () => {
    const { user } = renderApp();

    expect(
      await screen.findByRole("heading", {
        name: "Draft app shell implementation plan",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Repositories" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Repository Intelligence",
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
    expect(screen.getAllByText("demo workflow").length).toBeGreaterThan(0);
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
    expect(screen.getByText("Artifact placeholders")).toBeInTheDocument();
    expect(
      screen.getByText(/No patch content has been generated or applied/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Patch not generated").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(
        "Future agent execution will attach a reviewable generated patch here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("not generated").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Generated patch artifact preview"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /generated packages\/ai\/src\/index\.ts/,
      }),
    );
    expect(screen.getByText("Generated patch artifact")).toBeInTheDocument();
    expect(
      screen.getByText("Generated patch artifact preview"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sample/demo generated artifact data"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("+export type PatchArtifact = string;"),
    ).toBeInTheDocument();
    expect(screen.getByText(/real Git diffs yet/)).toBeInTheDocument();
    expect(screen.getByText(String(defaultFiles.length))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review approval" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Diffs not generated yet" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Review approval" }));

    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();
  });

  it("creates a persisted mock agent run with a review-only proposal and approval", async () => {
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

    const savedChange = vi.mocked(saveProposedChange).mock.calls[0][0];
    expect(
      savedChange.patchArtifacts.every(
        (artifact) => artifact.status === "not_generated",
      ),
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
        "OpenAI run created and saved. Review the structured plan before approving it.",
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
        patchArtifacts: [expect.objectContaining({ status: "not_generated" })],
      }),
    );
    expect(saveApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
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

  it("keeps a mock run in session without invoking persistence in the web fallback", async () => {
    vi.mocked(loadSavedRepositories).mockRejectedValueOnce(
      new Error("native storage unavailable"),
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    await user.type(
      screen.getByRole("textbox", { name: "Agent task request" }),
      "Document the repository entry points",
    );
    await user.click(screen.getByRole("button", { name: "Run mock agent" }));

    expect(
      await screen.findByText(
        "Mock run created for this session. Native persistence is unavailable in the web preview.",
      ),
    ).toBeInTheDocument();
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
    expect(screen.getByText("Patch artifact placeholders")).toBeInTheDocument();
    expect(
      screen.getByText(
        /They are not local Git diffs and no patch has been written/,
      ),
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
    expect(screen.getByText("Request approved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();

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
