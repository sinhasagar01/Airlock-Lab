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
import { loadRepositoriesGitMetadata } from "./storage/gitMetadata";
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
        } else {
          const repositoriesWithGitMetadata =
            await loadRepositoriesGitMetadata(mockRepositories);
          setRepositories(repositoriesWithGitMetadata);
          await saveRepositories(repositoriesWithGitMetadata);
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
      progress: 35,
      step: "Reading repository metadata and preparing file tree scan",
      updatedAt: timestamp,
    };

    setIndexingJobs((currentJobs) => [job, ...currentJobs]);
    await saveIndexingJob(job);
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
            </article>
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
          <EmptyState title="No local changes waiting for review">
            Change review will connect repository status, generated diffs,
            tests, and release readiness checks.
          </EmptyState>
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
