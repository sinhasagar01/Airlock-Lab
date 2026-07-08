import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import {
  EmptyState,
  Icon,
  PrimaryButton,
  SecondaryButton,
  SummaryCard,
  StatusBadge,
  StatusPill,
  type IconName,
} from "@ai-dev/ui";
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
const dashboardActivity = [
  {
    badge: "ready",
    detail: "Source tree, docs map, and Git status available.",
    status: "ready" as DomainStatus,
    time: "2m ago",
    title: "Intelligence Warmed",
  },
  {
    badge: "pending",
    detail: "Provider abstraction spike produced a patch plan.",
    status: "pending_approval" as DomainStatus,
    time: "5m ago",
    title: "Agent run awaiting approval",
  },
  {
    badge: "completed",
    detail: "Shell wired through package contracts successfully.",
    status: "completed" as DomainStatus,
    time: "12m ago",
    title: "Mock provider connected",
  },
];

const quickStartItems = [
  {
    description: "Add a repository to begin",
    icon: "repository" as IconName,
    tone: "agent",
    title: "Import repository",
  },
  {
    description: "Execute a task with AI assistance",
    icon: "play" as IconName,
    tone: "context",
    title: "Run agent",
  },
  {
    description: "Review and approve pending changes",
    icon: "approval" as IconName,
    tone: "agent",
    title: "Review approvals",
  },
];

const navigationIcons: Record<NavigationSection, IconName> = {
  overview: "grid",
  repositories: "repository",
  agents: "play",
  approvals: "approval",
  changes: "changes",
  settings: "settings",
};

const sectionEyebrows: Record<NavigationSection, string> = {
  overview: "Workspace overview",
  repositories: "Repository intelligence",
  agents: "Agent runs",
  approvals: "Human approval",
  changes: "Workspace changes",
  settings: "Workspace settings",
};

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

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <main className="app-shell">
      {sidebar}
      <section className="workspace">{children}</section>
    </main>
  );
}

type SidebarProps = {
  activeSection: NavigationSection;
  pendingApprovalCount: number;
  onSelectSection: (section: NavigationSection) => void;
};

function Sidebar({
  activeSection,
  pendingApprovalCount,
  onSelectSection,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="product-mark">ADW</span>
        <div className="brand">AI Developer Workspace</div>
      </div>

      <nav aria-label="Primary navigation" className="sidebar-nav">
        {primaryNavigation.map((item) => (
          <SidebarNavItem
            count={item.id === "approvals" ? pendingApprovalCount : 0}
            icon={navigationIcons[item.id]}
            isActive={activeSection === item.id}
            key={item.id}
            label={item.label}
            onClick={() => onSelectSection(item.id)}
          />
        ))}
      </nav>

      <UpgradeCard />

      <div className="sidebar-user" aria-label="Current user">
        <span className="sidebar-user__avatar" aria-hidden="true">
          S
        </span>
        <div>
          <strong>Sagar</strong>
          <span>Admin</span>
        </div>
        <Icon name="chevron" size="sm" />
      </div>
    </aside>
  );
}

type SidebarNavItemProps = {
  count?: number;
  icon: IconName;
  isActive: boolean;
  label: string;
  onClick: () => void;
};

function SidebarNavItem({
  count = 0,
  icon,
  isActive,
  label,
  onClick,
}: SidebarNavItemProps) {
  return (
    <button
      aria-current={isActive ? "page" : undefined}
      className="sidebar-nav-item"
      onClick={onClick}
      type="button"
    >
      <Icon name={icon} />
      <span>{label}</span>
      {count > 0 ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

function UpgradeCard() {
  return (
    <div className="sidebar-upgrade">
      <div className="sidebar-upgrade__icon">
        <Icon name="spark" />
      </div>
      <h2>Pro Intelligence</h2>
      <p>Deeper local code insight for approved agent work.</p>
      <SecondaryButton className="sidebar-upgrade__button">Upgrade Plan</SecondaryButton>
    </div>
  );
}

type AppHeaderProps = {
  eyebrow: string;
  pendingApprovalCount: number;
  providerName: string;
  onChooseRepository: () => void;
};

function AppHeader({
  eyebrow,
  pendingApprovalCount,
  providerName,
  onChooseRepository,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{workspace.summary.name}</h1>
        <p className="hero-copy">{workspace.summary.description}</p>
      </div>
      <div className="app-header__actions">
        <div className="status-row">
          <StatusPill tone="success">Provider: {providerName}</StatusPill>
          <StatusPill tone="warning">
            Pending approvals: {pendingApprovalCount}
          </StatusPill>
        </div>
        <PrimaryButton icon="repository" onClick={onChooseRepository}>
          Choose repository
        </PrimaryButton>
      </div>
    </header>
  );
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
  const activeAgentRun = agentRuns[0];
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
    <AppShell
      sidebar={
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          pendingApprovalCount={pendingApprovalCount}
        />
      }
    >
        <AppHeader
          eyebrow={sectionEyebrows[activeSection]}
          onChooseRepository={selectRepositories}
          pendingApprovalCount={pendingApprovalCount}
          providerName={provider.displayName}
        />

        <section className="overview-grid" aria-label="Workspace metrics">
          <SummaryCard
            detail={`Last indexed ${workspace.summary.lastIndexedAt}`}
            icon="database"
            label="Repositories"
            tone="accent"
            value={repositories.length}
          />
          <SummaryCard
            detail="One run is waiting for human approval"
            icon="agent"
            label="Agent runs"
            tone="agent"
            value={workspace.summary.activeRuns}
          />
          <SummaryCard
            detail={
              activeIndexingJob
                ? activeIndexingJob.step
                : `${indexedRepositoryCount} indexed, ${scanTarget.includes.join(", ")}`
            }
            icon="index"
            label="Context mode"
            tone="context"
            value={scanTarget.mode}
          />
        </section>

        {activeSection === "overview" ? (
          <section className="overview-lower-grid">
            <article className="overview-card active-work-card">
              <div className="active-work-card__header">
                <div>
                  <p className="card-eyebrow card-eyebrow--dot">
                    Active Work
                  </p>
                  <h2>Draft app shell implementation plan</h2>
                </div>
                <StatusPill tone="warning" size="sm">
                  Waiting for approval
                </StatusPill>
              </div>

              <p className="active-work-card__description">
                Review proposed file edits before execution.
              </p>

              <div className="active-work-card__divider" />

              <dl className="active-work-meta">
                <div className="active-work-meta__item">
                  <Icon name="repository" />
                  <div>
                    <dt>Repository</dt>
                    <dd>{activeRepository.name}</dd>
                  </div>
                </div>

                <div className="active-work-meta__item">
                  <Icon name="branch" />
                  <div>
                    <dt>Branch</dt>
                    <dd>{activeRepository.branch}</dd>
                  </div>
                </div>
              </dl>

              <div className="active-path-box">
                <Icon name="folder" />
                <div>
                  <span>Local path</span>
                  <strong>{activeRepository.path}</strong>
                </div>
                <button aria-label="Copy repository path" type="button">
                  <Icon name="copy" size="sm" />
                </button>
              </div>

              <dl className="active-work-stats">
                <div>
                  <dt>Open Changes</dt>
                  <dd>{activeRepository.openChanges}</dd>
                </div>
                <div>
                  <dt>Clean Working Directory</dt>
                  <dd>
                    <span className="check-marker" aria-hidden="true">
                      ✓
                    </span>
                    {activeRepository.openChanges === 0 ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            </article>

            <div className="overview-side-column">
              <article className="overview-card recent-activity-card">
                <div className="overview-card__header">
                  <p className="card-eyebrow">Recent Activity</p>
                  <button className="text-action" type="button">
                    View all
                  </button>
                </div>

                <div className="reference-activity-list">
                  {dashboardActivity.map((activity) => (
                    <div
                      className={`reference-activity-item reference-activity-item--${
                        statusTone[activity.status]
                      }`}
                      key={activity.title}
                    >
                      <span className="reference-activity-marker">
                        {activity.status === "pending_approval" ? "!" : "✓"}
                      </span>
                      <div>
                        <h3>{activity.title}</h3>
                        <p>{activity.detail}</p>
                      </div>
                      <time>{activity.time}</time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="overview-card quick-start-card">
                <p className="card-eyebrow">Quick Start</p>
                <div className="quick-start-list">
                  {quickStartItems.map((item) => (
                    <button
                      className="quick-start-item"
                      key={item.title}
                      onClick={() => {
                        if (item.title === "Import repository") {
                          void selectRepositories();
                          return;
                        }

                        if (item.title === "Run agent") {
                          void startIndexingJob(activeRepository);
                          return;
                        }

                        setActiveSection("approvals");
                      }}
                      type="button"
                    >
                      <span
                        className={`quick-start-icon quick-start-icon--${item.tone}`}
                      >
                        <Icon name={item.icon} size="sm" />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                      <Icon name="chevron" size="sm" />
                    </button>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {activeSection === "repositories" ? (
          <section className="tab-dashboard-grid repositories-dashboard">
            {repositoryPickerError ? (
              <div className="inline-notice" role="status">
                {repositoryPickerError}
              </div>
            ) : null}

            <article className="overview-card tab-primary-card repository-focus-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Active Repository</p>
                  <h2>{activeRepository.name}</h2>
                </div>
                <StatusPill tone={repositoryTone(activeRepository.status)}>
                  {activeRepository.status.replace("_", " ")}
                </StatusPill>
              </div>

              <p className="tab-card-copy">
                Local repository state, Git metadata, and indexing readiness for
                the current workspace.
              </p>

              <div className="active-path-box tab-path-box">
                <Icon name="folder" />
                <div>
                  <span>Local path</span>
                  <strong>{activeRepository.path}</strong>
                </div>
                <button aria-label="Copy repository path" type="button">
                  <Icon name="copy" size="sm" />
                </button>
              </div>

              <dl className="tab-fact-grid">
                <div>
                  <dt>Git Repository</dt>
                  <dd>{activeRepository.isGitRepository ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{activeRepository.branch}</dd>
                </div>
                <div>
                  <dt>Open Changes</dt>
                  <dd>{activeRepository.openChanges}</dd>
                </div>
                <div>
                  <dt>Last Indexed</dt>
                  <dd>{activeRepository.lastIndexedAt ?? "Not indexed yet"}</dd>
                </div>
              </dl>

              <div className="tab-action-row">
                <PrimaryButton
                  icon="repository"
                  onClick={selectRepositories}
                >
                  Choose repository
                </PrimaryButton>
                <SecondaryButton
                  icon="index"
                  onClick={() => startIndexingJob(activeRepository)}
                >
                  Start indexing
                </SecondaryButton>
              </div>
            </article>

            <aside className="tab-side-stack">
              <article className="overview-card connect-repository-card">
                <div className="small-card-icon">
                  <Icon name="repository" />
                </div>
                <h3>Connect another local repository</h3>
                <p>
                  Open the native directory picker and add more repositories to
                  the local-first workspace.
                </p>
                <PrimaryButton icon="repository" onClick={selectRepositories}>
                  Choose repository
                </PrimaryButton>
              </article>

              <article className="overview-card repository-list-card">
                <div className="overview-card__header">
                  <p className="card-eyebrow">Saved Repositories</p>
                  <StatusPill tone="neutral" size="sm">
                    {repositories.length} total
                  </StatusPill>
                </div>
                <div className="repository-list">
                  {repositories.map((repository) => (
                    <div className="repository-list-item" key={repository.id}>
                      <Icon name="repository" size="sm" />
                      <div>
                        <strong>{repository.name}</strong>
                        <span>{repository.branch}</span>
                      </div>
                      <StatusPill
                        tone={repositoryTone(repository.status)}
                        size="sm"
                        showDot={false}
                      >
                        {repository.status.replace("_", " ")}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>
        ) : null}

        {activeSection === "agents" ? (
          <section className="tab-dashboard-grid agents-dashboard">
            <article className="overview-card tab-primary-card agent-active-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow card-eyebrow--dot">
                    Active Run
                  </p>
                  <h2>{activeAgentRun.title}</h2>
                </div>
                <StatusPill
                  tone={
                    activeAgentRun.status === "waiting_for_approval"
                      ? "warning"
                      : "agent"
                  }
                >
                  {activeAgentRun.status.replaceAll("_", " ")}
                </StatusPill>
              </div>

              <p className="tab-card-copy">{activeAgentRun.nextStep}</p>

              <dl className="tab-fact-grid agent-fact-grid">
                <div>
                  <dt>Repository</dt>
                  <dd>{activeAgentRun.repository}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{provider.displayName}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{activeRepository.branch}</dd>
                </div>
                <div>
                  <dt>Approval State</dt>
                  <dd>{pendingApprovalCount} pending</dd>
                </div>
              </dl>

              <div className="agent-progress-card">
                <div>
                  <span>Elapsed</span>
                  <strong>8m</strong>
                </div>
                <div>
                  <span>Progress</span>
                  <strong>Waiting for review</strong>
                </div>
              </div>
            </article>

            <aside className="tab-side-stack">
              <article className="overview-card provider-context-card">
                <div className="overview-card__header">
                  <p className="card-eyebrow">Provider Context</p>
                  <StatusPill tone="success" size="sm">
                    connected
                  </StatusPill>
                </div>
                <h3>{provider.displayName}</h3>
                <p>
                  Structured-output mock provider is connected for local
                  planning, approval, and safe implementation dry-runs.
                </p>
              </article>

              <article className="overview-card recent-runs-card">
                <p className="card-eyebrow">Recent Runs</p>
                <div className="run-list">
                  {agentRuns.map((run) => (
                    <div className="run-list-item" key={run.id}>
                      <Icon name="agent" size="sm" />
                      <div>
                        <strong>{run.title}</strong>
                        <span>{run.nextStep}</span>
                      </div>
                      <StatusPill
                        tone={
                          run.status === "waiting_for_approval"
                            ? "warning"
                            : run.status === "running"
                              ? "agent"
                              : "success"
                        }
                        size="sm"
                        showDot={false}
                      >
                        {run.status.replaceAll("_", " ")}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>
        ) : null}

        {activeSection === "approvals" ? (
          <section className="approvals-dashboard">
            <article className="overview-card approvals-hero-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Human Approval Queue</p>
                  <h2>{pendingApprovalCount} pending approvals</h2>
                </div>
                <StatusPill tone="warning">
                  Provider reasoning required
                </StatusPill>
              </div>
              <p>
                Review proposed changes, risk level, provider reasoning, and
                included files before approving or rejecting agent work.
              </p>
            </article>

            <section className="approval-card-grid">
              {approvalRequests.map((approval) => (
                <article className="overview-card approval-review-card" key={approval.id}>
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">{approval.repository}</p>
                      <h3>{approval.title}</h3>
                    </div>
                    <div className="status-row compact">
                      <StatusPill tone={approvalStatusTone(approval.status)}>
                        {approval.status}
                      </StatusPill>
                      <StatusPill
                        tone={approvalRiskTone(approval.risk)}
                        showDot={false}
                      >
                        {approval.risk} risk
                      </StatusPill>
                    </div>
                  </div>

                  <p>{approval.summary}</p>

                  <div className="approval-actions">
                    <button className="text-action" type="button">
                      View plan details
                    </button>
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

                  <div className="provider-reasoning-box">
                    <span>Provider reasoning</span>
                    <strong>
                      Patch plan affects shared contracts and should be reviewed
                      before implementation.
                    </strong>
                  </div>

                  <div className="file-list" aria-label="Files requiring review">
                    {approval.files.map((file) => (
                      <span key={file}>{file}</span>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            {pendingApprovalCount === 0 ? (
              <article className="overview-card approvals-empty-card">
                <h3>No approvals waiting</h3>
                <p>Approved and rejected requests remain visible above.</p>
              </article>
            ) : null}
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
    </AppShell>
  );
}
