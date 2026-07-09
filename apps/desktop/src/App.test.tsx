import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovalRequest } from "@ai-dev/ai";
import type {
  FileContentPreview,
  IndexedFileFact,
  IndexingJob,
  RepositorySummary,
} from "@ai-dev/indexing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { previewRepositoryFile } from "./storage/filePreview";
import { updateApprovalRequestStatus } from "./storage/approvalRequestStore";

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
    indexingJobs: [] as IndexingJob[],
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

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
}));

vi.mock("./storage/repositoryStore", () => ({
  loadSavedRepositories: vi.fn(async () => mockState.repositories),
  saveRepositories: vi.fn(async () => undefined),
}));

vi.mock("./storage/gitMetadata", () => ({
  loadRepositoriesGitMetadata: vi.fn(async (repositories: RepositorySummary[]) =>
    repositories,
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

vi.mock("./storage/approvalRequestStore", () => ({
  loadApprovalRequests: vi.fn(async () => mockState.approvals),
  saveApprovalRequests: vi.fn(async () => undefined),
  updateApprovalRequestStatus: vi.fn(async () => undefined),
}));

vi.mock("./storage/filePreview", () => ({
  previewRepositoryFile: vi.fn(() => Promise.resolve(mockState.preview)),
}));

function renderApp(options?: {
  files?: IndexedFileFact[];
  preview?: FileContentPreview | Promise<FileContentPreview>;
}) {
  mockState.files = options?.files ?? [...defaultFiles];
  mockState.preview = options?.preview ?? defaultPreview;

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
const defaultPreview = mockState.preview;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockState.files = [...defaultFiles];
  mockState.preview = defaultPreview;
  mockState.repositories = mockState.repositories.map((repository) => ({
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
      await screen.findByText(
        "Local repository state, Git metadata, and indexing readiness for the current workspace.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agent Runs" }));
    expect(await screen.findByText("Provider Context")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approvals" }));
    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Changes" }));
    expect(
      await screen.findByRole("heading", {
        name: "No local changes waiting for review",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      await screen.findByRole("heading", {
        name: "Local-first workspace controls",
      }),
    ).toBeInTheDocument();
  });

  it("keeps approval actions visible, wired, and reflected in pending count", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Approvals" }));

    expect(
      await screen.findByRole("heading", { name: "2 pending approvals" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    expect(updateApprovalRequestStatus).toHaveBeenCalledWith(
      "approval-provider-rfc",
      "approved",
    );
    expect(
      await screen.findByRole("heading", { name: "1 pending approvals" }),
    ).toBeInTheDocument();

    const enabledRejectButton = screen
      .getAllByRole("button", { name: "Reject" })
      .find((button) => !button.hasAttribute("disabled"));

    expect(enabledRejectButton).toBeDefined();
    await user.click(enabledRejectButton as HTMLButtonElement);

    expect(updateApprovalRequestStatus).toHaveBeenCalledWith(
      "approval-indexing-job",
      "rejected",
    );
    expect(
      await screen.findByRole("heading", { name: "0 pending approvals" }),
    ).toBeInTheDocument();
  });

  it("shows the no-file-selected preview state when no indexed files exist", async () => {
    renderApp({ files: [] });

    await goToTab("Changes");

    expect(
      await screen.findByText("Select a file after running indexing."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading preview...")).not.toBeInTheDocument();
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
});
