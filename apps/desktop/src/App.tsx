import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  createMockAgentRuns,
  createMockApprovalRequests,
  createMockProvider,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type ApprovalRisk,
} from "@ai-dev/ai";
import {
  createMockWorkspaceSnapshot,
  primaryNavigation,
  type DomainStatus,
  type NavigationSection,
} from "@ai-dev/core";
import {
  createIndexingJob,
  createMockRepositories,
  createRepositorySummaryFromPath,
  type FileContentPreview,
  type IndexedFileFact,
  type IndexingJob,
  summarizeScanTarget,
  type RepositorySummary,
} from "@ai-dev/indexing";
import { EmptyState, StatTile, StatusBadge } from "@ai-dev/ui";
import {
  loadApprovalRequests,
  saveApprovalRequests,
  updateApprovalRequestStatus,
} from "./storage/approvalRequestStore";
import { previewRepositoryFile } from "./storage/filePreview";
import { scanRepositoryFileTree } from "./storage/fileTreeScanner";
import { loadRepositoriesGitMetadata } from "./storage/gitMetadata";
import {
  loadIndexedFileFacts,
  replaceIndexedFileFacts,
} from "./storage/indexedFileStore";
import { loadIndexingJobs, saveIndexingJob } from "./storage/indexingJobStore";
import {
  loadSavedRepositories,
  saveRepositories,
} from "./storage/repositoryStore";

const workspace = createMockWorkspaceSnapshot();
const provider = createMockProvider();
const mockRepositories = createMockRepositories();
const agentRuns = createMockAgentRuns();
const mockApprovalRequests = createMockApprovalRequests();

const statusTone: Record<
  DomainStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  ready: "success",
  pending_approval: "warning",
  running: "neutral",
  paused: "warning",
  completed: "success",
  failed: "danger",
};

function repositoryTone(
  status: RepositorySummary["status"],
): "neutral" | "success" | "warning" {
  if (status === "indexed") {
    return "success";
  }

  if (status === "indexing") {
    return "neutral";
  }

  return "warning";
}

function approvalRiskTone(
  risk: ApprovalRisk,
): "neutral" | "success" | "warning" | "danger" {
  if (risk === "high") {
    return "danger";
  }

  if (risk === "medium") {
    return "warning";
  }

  return "success";
}

function approvalStatusTone(
  status: ApprovalRequestStatus,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "approved") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "warning";
}

export function App() {
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("overview");
  const [repositories, setRepositories] =
    useState<RepositorySummary[]>(mockRepositories);
  const [repositoryPickerError, setRepositoryPickerError] = useState<
    string | null
  >(null);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [indexingJobs, setIndexingJobs] = useState<IndexingJob[]>([]);
  const [approvalRequests, setApprovalRequests] =
    useState<ApprovalRequest[]>(mockApprovalRequests);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFileFact[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FileContentPreview | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const activeRepository = repositories[0];
  const indexedRepositoryCount = useMemo(
    () =>
      repositories.filter((repository) => repository.status === "indexed")
        .length,
    [repositories],
  );
  const scanTarget = summarizeScanTarget({
    path: activeRepository?.path ?? workspace.summary.name,
    includeGitState: true,
    includeDocumentation: true,
  });
  const activeIndexingJob = indexingJobs[0];
  const pendingApprovalCount = approvalRequests.filter(
    (approval) => approval.status === "pending",
  ).length;
  const extensionCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const file of indexedFiles) {
      const extension = file.extension ?? "none";
      counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }

    return [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [indexedFiles]);
  const filteredIndexedFiles = useMemo(() => {
    const normalizedSearch = fileSearch.trim().toLowerCase();

    return indexedFiles.filter((file) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        file.path.toLowerCase().includes(normalizedSearch);
      const matchesExtension =
        extensionFilter === "all" ||
        (extensionFilter === "none" && file.extension === null) ||
        file.extension === extensionFilter;

      return matchesSearch && matchesExtension;
    });
  }, [extensionFilter, fileSearch, indexedFiles]);
  const selectedIndexedFile =
    filteredIndexedFiles.find((file) => file.path === selectedFilePath) ??
    filteredIndexedFiles[0] ??
    null;

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      if (!selectedIndexedFile || !activeRepository) {
        setFilePreview(null);
        return;
      }

      setIsPreviewLoading(true);

      try {
        const preview = await previewRepositoryFile(
          activeRepository.path,
          selectedIndexedFile.path,
        );

        if (isMounted) {
          setFilePreview(preview);
        }
      } catch {
        if (isMounted) {
          setFilePreview({
            path: selectedIndexedFile.path,
            status: "unavailable",
            content: null,
            sizeBytes: selectedIndexedFile.sizeBytes,
            maxSizeBytes: 0,
          });
        }
      } finally {
        if (isMounted) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [activeRepository, selectedIndexedFile]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateRepositories() {
      try {
        const savedRepositories = await loadSavedRepositories();
        const savedIndexingJobs = await loadIndexingJobs();
        const savedApprovalRequests = await loadApprovalRequests();

        if (!isMounted) {
          return;
        }

        setIndexingJobs(savedIndexingJobs);
        if (savedApprovalRequests.length > 0) {
          setApprovalRequests(savedApprovalRequests);
        } else {
          setApprovalRequests(mockApprovalRequests);
          await saveApprovalRequests(mockApprovalRequests);
        }

        if (savedRepositories.length > 0) {
          const repositoriesWithGitMetadata =
            await loadRepositoriesGitMetadata(savedRepositories);
          setRepositories(repositoriesWithGitMetadata);
          await saveRepositories(repositoriesWithGitMetadata);
          const savedFiles = await loadIndexedFileFacts(
            repositoriesWithGitMetadata[0].id,
          );
          setIndexedFiles(savedFiles);
          setSelectedFilePath(savedFiles[0]?.path ?? null);
        } else {
          const repositoriesWithGitMetadata =
            await loadRepositoriesGitMetadata(mockRepositories);
          setRepositories(repositoriesWithGitMetadata);
          await saveRepositories(repositoriesWithGitMetadata);
          const savedFiles = await loadIndexedFileFacts(
            repositoriesWithGitMetadata[0].id,
          );
          setIndexedFiles(savedFiles);
          setSelectedFilePath(savedFiles[0]?.path ?? null);
        }

        setStorageStatus("ready");
      } catch {
        if (!isMounted) {
          return;
        }

        setStorageStatus("unavailable");
        setRepositoryPickerError(
          "Local repository storage is available in the native Tauri app. The web preview uses in-memory data.",
        );
      }
    }

    void hydrateRepositories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function selectRepositories() {
    setRepositoryPickerError(null);

    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Choose repositories",
      });

      if (!selected) {
        return;
      }

      const selectedPaths = Array.isArray(selected) ? selected : [selected];
      const selectedRepositories = await loadRepositoriesGitMetadata(
        selectedPaths.map((path) => createRepositorySummaryFromPath(path)),
      );

      const nextRepositories = (() => {
        const currentRepositories = repositories;
        const existingPaths = new Set(
          currentRepositories.map((repository) => repository.path),
        );
        const newRepositories = selectedRepositories.filter(
          (repository) => !existingPaths.has(repository.path),
        );

        return [...currentRepositories, ...newRepositories];
      })();

      setRepositories(nextRepositories);
      await saveRepositories(nextRepositories);
      setStorageStatus("ready");
      setActiveSection("repositories");
    } catch {
      setRepositoryPickerError(
        "Repository selection is available in the native Tauri app. The web preview cannot open local folders.",
      );
      setActiveSection("repositories");
    }
  }

  async function startIndexingJob(repository: RepositorySummary) {
    const timestamp = new Date().toISOString();
    const job: IndexingJob = {
      ...createIndexingJob(repository),
      status: "running",
      progress: 15,
      step: "Scanning repository file tree",
      updatedAt: timestamp,
    };

    setIndexingJobs((currentJobs) => [job, ...currentJobs]);
    await saveIndexingJob(job);

    try {
      const scanResult = await scanRepositoryFileTree(
        repository.id,
        repository.path,
      );
      await replaceIndexedFileFacts(repository.id, scanResult.files);

      const completedAt = new Date().toISOString();
      const completedJob: IndexingJob = {
        ...job,
        status: "completed",
        progress: 100,
        step: `Indexed ${scanResult.scannedFiles} files; skipped ${scanResult.skippedEntries} entries`,
        updatedAt: completedAt,
      };
      const indexedRepository: RepositorySummary = {
        ...repository,
        status: "indexed",
        lastIndexedAt: completedAt,
      };
      const nextRepositories = repositories.map((currentRepository) =>
        currentRepository.id === repository.id
          ? indexedRepository
          : currentRepository,
      );

      setIndexedFiles(scanResult.files);
      setSelectedFilePath(scanResult.files[0]?.path ?? null);
      setIndexingJobs((currentJobs) =>
        currentJobs.map((currentJob) =>
          currentJob.id === job.id ? completedJob : currentJob,
        ),
      );
      setRepositories(nextRepositories);
      await saveIndexingJob(completedJob);
      await saveRepositories(nextRepositories);
    } catch {
      const failedJob: IndexingJob = {
        ...job,
        status: "failed",
        progress: 100,
        step: "File-tree scan failed before facts could be persisted",
        updatedAt: new Date().toISOString(),
      };

      setIndexingJobs((currentJobs) =>
        currentJobs.map((currentJob) =>
          currentJob.id === job.id ? failedJob : currentJob,
        ),
      );
      await saveIndexingJob(failedJob);
    }
  }

  async function updateApprovalStatus(
    approvalId: string,
    status: ApprovalRequestStatus,
  ) {
    setApprovalRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === approvalId ? { ...request, status } : request,
      ),
    );
    await updateApprovalRequestStatus(approvalId, status);
  }

  function formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderFilePreview() {
    if (isPreviewLoading) {
      return <p className="preview-state">Loading preview...</p>;
    }

    if (!filePreview || !selectedIndexedFile) {
      return <p className="preview-state">Select a file to load a preview.</p>;
    }

    if (filePreview.status === "ready") {
      return <pre className="file-preview">{filePreview.content}</pre>;
    }

    if (filePreview.status === "too_large") {
      return (
        <p className="preview-state">
          Preview skipped because this file is{" "}
          {formatFileSize(filePreview.sizeBytes)}. The preview limit is{" "}
          {formatFileSize(filePreview.maxSizeBytes)}.
        </p>
      );
    }

    if (filePreview.status === "binary") {
      return (
        <p className="preview-state">Preview skipped for binary content.</p>
      );
    }

    if (filePreview.status === "outside_repository") {
      return (
        <p className="preview-state">
          Preview blocked because the resolved path is outside the repository.
        </p>
      );
    }

    return <p className="preview-state">Preview unavailable for this file.</p>;
  }

  function renderIndexedFileBrowser(variant: "compact" | "full") {
    const visibleFiles =
      variant === "compact"
        ? filteredIndexedFiles.slice(0, 8)
        : filteredIndexedFiles;

    return (
      <article className={`panel file-browser ${variant}`}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Indexed files</p>
            <h2>{activeRepository.name}</h2>
          </div>
          <StatusBadge tone={indexedFiles.length > 0 ? "success" : "warning"}>
            {indexedFiles.length} files
          </StatusBadge>
        </div>

        <div className="file-browser-controls">
          <input
            aria-label="Search indexed files"
            onChange={(event) => setFileSearch(event.target.value)}
            placeholder="Search paths"
            type="search"
            value={fileSearch}
          />
          <select
            aria-label="Filter indexed files by extension"
            onChange={(event) => setExtensionFilter(event.target.value)}
            value={extensionFilter}
          >
            <option value="all">All extensions</option>
            {extensionCounts.map(([extension, count]) => (
              <option key={extension} value={extension}>
                {extension} ({count})
              </option>
            ))}
          </select>
        </div>

        <div
          className="extension-summary"
          aria-label="File counts by extension"
        >
          {extensionCounts.length > 0 ? (
            extensionCounts.slice(0, 10).map(([extension, count]) => (
              <button
                aria-pressed={extensionFilter === extension}
                key={extension}
                onClick={() => setExtensionFilter(extension)}
                type="button"
              >
                {extension} {count}
              </button>
            ))
          ) : (
            <span>No indexed file facts yet</span>
          )}
        </div>

        <div className="file-browser-grid">
          <div className="file-results" aria-label="Indexed file results">
            {visibleFiles.length > 0 ? (
              visibleFiles.map((file) => (
                <button
                  aria-current={
                    selectedIndexedFile?.path === file.path ? "true" : undefined
                  }
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  type="button"
                >
                  <span>{file.path}</span>
                  <small>{formatFileSize(file.sizeBytes)}</small>
                </button>
              ))
            ) : (
              <p>No files match the current filter.</p>
            )}
          </div>

          <div className="file-detail" aria-label="Selected file details">
            {selectedIndexedFile ? (
              <>
                <h3>{selectedIndexedFile.path}</h3>
                <dl className="metadata-list">
                  <div>
                    <dt>Size</dt>
                    <dd>{formatFileSize(selectedIndexedFile.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Extension</dt>
                    <dd>{selectedIndexedFile.extension ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd>{selectedIndexedFile.modifiedAt ?? "unknown"}</dd>
                  </div>
                </dl>
                {renderFilePreview()}
              </>
            ) : (
              <p>Select a file after running indexing.</p>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <span className="product-mark">ADW</span>
          <div className="brand">AI Developer Workspace</div>
        </div>

        <nav aria-label="Primary navigation">
          {primaryNavigation.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{workspace.summary.name}</h1>
            <p>{workspace.summary.description}</p>
          </div>
          <div className="status-row">
            <StatusBadge tone="success">
              Provider: {provider.displayName}
            </StatusBadge>
            <StatusBadge tone="warning">
              Pending approvals: {pendingApprovalCount}
            </StatusBadge>
            <StatusBadge
              tone={storageStatus === "ready" ? "success" : "warning"}
            >
              Storage: {storageStatus}
            </StatusBadge>
            <button
              className="primary-action"
              onClick={selectRepositories}
              type="button"
            >
              Choose repository
            </button>
          </div>
        </header>

        <section className="overview-grid" aria-label="Workspace metrics">
          <StatTile
            detail={`Last indexed ${workspace.summary.lastIndexedAt}`}
            label="Repositories"
            value={repositories.length}
          />
          <StatTile
            detail="One run is waiting for human approval"
            label="Agent runs"
            value={workspace.summary.activeRuns}
          />
          <StatTile
            detail={
              activeIndexingJob
                ? activeIndexingJob.step
                : `${indexedRepositoryCount} indexed, ${scanTarget.includes.join(", ")}`
            }
            label="Indexing"
            value={activeIndexingJob?.status ?? scanTarget.mode}
          />
        </section>

        {activeSection === "overview" ? (
          <section className="content-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Active repository</p>
                  <h2>{activeRepository.name}</h2>
                </div>
                <StatusBadge tone={repositoryTone(activeRepository.status)}>
                  {activeRepository.status.replace("_", " ")}
                </StatusBadge>
              </div>
              <dl className="metadata-list">
                <div>
                  <dt>Path</dt>
                  <dd>{activeRepository.path}</dd>
                </div>
                <div>
                  <dt>Git repository</dt>
                  <dd>{activeRepository.isGitRepository ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{activeRepository.branch}</dd>
                </div>
                <div>
                  <dt>Open changes</dt>
                  <dd>{activeRepository.openChanges}</dd>
                </div>
              </dl>
              <button
                className="secondary-action"
                onClick={() => startIndexingJob(activeRepository)}
                type="button"
              >
                Start indexing
              </button>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Recent activity</p>
                  <h2>Workspace pulse</h2>
                </div>
              </div>
              <div className="activity-list">
                {workspace.activity.map((activity) => (
                  <div className="activity-item" key={activity.id}>
                    <StatusBadge tone={statusTone[activity.status]}>
                      {activity.status.replace("_", " ")}
                    </StatusBadge>
                    <div>
                      <h3>{activity.title}</h3>
                      <p>{activity.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel indexing-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Indexing</p>
                  <h2>{activeIndexingJob?.repositoryName ?? "No job yet"}</h2>
                </div>
                <StatusBadge tone={activeIndexingJob ? "neutral" : "warning"}>
                  {activeIndexingJob?.status ?? "idle"}
                </StatusBadge>
              </div>
              {activeIndexingJob ? (
                <div className="progress-stack">
                  <div
                    aria-label="Indexing progress"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={activeIndexingJob.progress}
                    className="progress-track"
                    role="progressbar"
                  >
                    <span style={{ width: `${activeIndexingJob.progress}%` }} />
                  </div>
                  <p>{activeIndexingJob.step}</p>
                </div>
              ) : (
                <p>
                  Start an indexing job from the active repository to prepare
                  the local context pipeline.
                </p>
              )}
              <p className="supporting-note">
                Persisted file facts: {indexedFiles.length}
              </p>
            </article>

            {renderIndexedFileBrowser("compact")}
          </section>
        ) : null}

        {activeSection === "repositories" ? (
          <section className="content-grid">
            {repositoryPickerError ? (
              <div className="inline-notice" role="status">
                {repositoryPickerError}
              </div>
            ) : null}

            {repositories.map((repository) => (
              <article className="panel repository-card" key={repository.id}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Repository</p>
                    <h2>{repository.name}</h2>
                  </div>
                  <StatusBadge tone={repositoryTone(repository.status)}>
                    {repository.status.replace("_", " ")}
                  </StatusBadge>
                </div>
                <p>{repository.path}</p>
                <dl className="metadata-list">
                  <div>
                    <dt>Git repository</dt>
                    <dd>{repository.isGitRepository ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{repository.branch}</dd>
                  </div>
                  <div>
                    <dt>Open changes</dt>
                    <dd>{repository.openChanges}</dd>
                  </div>
                </dl>
              </article>
            ))}

            <EmptyState
              action={
                <button onClick={selectRepositories} type="button">
                  Choose repository
                </button>
              }
              title="Connect another local repository"
            >
              The native app opens a local directory picker and adds selected
              repositories to this workspace.
            </EmptyState>
          </section>
        ) : null}

        {activeSection === "agents" ? (
          <section className="content-grid">
            {agentRuns.map((run) => (
              <article className="panel" key={run.id}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{run.repository}</p>
                    <h2>{run.title}</h2>
                  </div>
                  <StatusBadge
                    tone={
                      run.status === "waiting_for_approval"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {run.status.replaceAll("_", " ")}
                  </StatusBadge>
                </div>
                <p>{run.nextStep}</p>
              </article>
            ))}
          </section>
        ) : null}

        {activeSection === "approvals" ? (
          <section className="approval-queue">
            {approvalRequests.map((approval) => (
              <article className="panel approval-card" key={approval.id}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{approval.repository}</p>
                    <h2>{approval.title}</h2>
                  </div>
                  <div className="status-row compact">
                    <StatusBadge tone={approvalStatusTone(approval.status)}>
                      {approval.status}
                    </StatusBadge>
                    <StatusBadge tone={approvalRiskTone(approval.risk)}>
                      {approval.risk} risk
                    </StatusBadge>
                  </div>
                </div>

                <p>{approval.summary}</p>

                <div className="file-list" aria-label="Files requiring review">
                  {approval.files.map((file) => (
                    <span key={file}>{file}</span>
                  ))}
                </div>

                <div className="approval-actions">
                  <button
                    className="secondary-action"
                    disabled={approval.status !== "pending"}
                    onClick={() =>
                      updateApprovalStatus(approval.id, "rejected")
                    }
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    className="primary-action"
                    disabled={approval.status !== "pending"}
                    onClick={() =>
                      updateApprovalStatus(approval.id, "approved")
                    }
                    type="button"
                  >
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {activeSection === "changes" ? (
          <section className="file-browser-shell">
            {renderIndexedFileBrowser("full")}
          </section>
        ) : null}

        {activeSection === "settings" ? (
          <EmptyState title="Provider and workspace settings">
            Settings will manage provider adapters, local storage, indexing
            policy, and approval defaults.
          </EmptyState>
        ) : null}
      </section>
    </main>
  );
}
