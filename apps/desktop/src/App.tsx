import { type ReactNode, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  createMockAgentRuns,
  createMockApprovalRequests,
  createMockPersistedProposedChanges,
  createMockProposedChangePlans,
  createMockProvider,
  ensureProposedPatchArtifacts,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type ApprovalRisk,
  type AgentRun,
  type PersistedProposedChange,
  type ProposedChangeFile,
  type ProposedChangeFileOperation,
  type ProposedPatchArtifact,
  type ProposedChangeStepStatus,
  type ProposedRisk,
} from "@ai-dev/ai";
import {
  createMockWorkspaceSnapshot,
  primaryNavigation,
  type DomainStatus,
  type GitChangedFile,
  type GitFileDiff,
  type GitStatusSummary,
  type NavigationSection,
} from "@ai-dev/core";
import {
  createIndexingJob,
  createMockRepositories,
  createRepositorySummaryFromPath,
  deriveRepositoryIntelligence,
  type FileContentPreview,
  type IndexedFileFact,
  type IndexingJob,
  summarizeScanTarget,
  type RepositorySummary,
} from "@ai-dev/indexing";
import {
  Icon,
  IconBadge,
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
import { loadGitFileDiff, loadGitStatusSummary } from "./storage/gitChanges";
import { loadRepositoriesGitMetadata } from "./storage/gitMetadata";
import {
  loadIndexedFileFacts,
  replaceIndexedFileFacts,
} from "./storage/indexedFileStore";
import { loadIndexingJobs, saveIndexingJob } from "./storage/indexingJobStore";
import {
  loadProposedChanges,
  saveProposedChanges,
} from "./storage/proposedChangeStore";
import {
  loadSavedRepositories,
  saveRepositories,
} from "./storage/repositoryStore";

const workspace = createMockWorkspaceSnapshot();
const provider = createMockProvider();
const mockRepositories = createMockRepositories();
const emptyRepository: RepositorySummary = {
  id: "no-repository",
  name: "No repository selected",
  path: "Choose a local repository to begin",
  isGitRepository: false,
  branch: "Not available yet",
  status: "not_indexed",
  openChanges: 0,
  lastIndexedAt: null,
};
const agentRuns = createMockAgentRuns();
const proposedChangePlans = createMockProposedChangePlans();
const mockApprovalRequests = createMockApprovalRequests();
const mockProposedChanges = createMockPersistedProposedChanges();
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

const changeFeatureBlocks = [
  {
    description:
      "Current branch, Git cleanliness, and repository readiness are checked before review.",
    icon: "repository" as IconName,
    title: "Repository status",
  },
  {
    description:
      "Generated patches will be grouped into readable diffs with file-level context.",
    icon: "changes" as IconName,
    title: "Generated diffs",
  },
  {
    description:
      "Release checks summarize risk, approvals, and follow-up work before merge.",
    icon: "approval" as IconName,
    title: "Release readiness",
  },
];

const settingsRows = [
  {
    action: "Manage",
    description:
      "Provider adapters route model calls through approved local contracts.",
    icon: "agent" as IconName,
    title: "Provider adapters",
  },
  {
    action: "Inspect",
    description:
      "Workspace data stays local in SQLite-backed desktop storage.",
    icon: "database" as IconName,
    title: "Local storage",
  },
  {
    action: "Reindex",
    description:
      "Repository facts include file trees, Git state, and documentation hints.",
    icon: "index" as IconName,
    title: "Indexing policy",
  },
  {
    action: "Review",
    description:
      "Human approval remains required before agent-generated changes proceed.",
    icon: "approval" as IconName,
    title: "Approval defaults",
  },
];

const maintenanceActions = [
  {
    description: "Refresh file facts and Git metadata for the active repository.",
    icon: "index" as IconName,
    title: "Reindex repositories",
  },
  {
    description: "Remove temporary derived state without deleting workspace data.",
    icon: "database" as IconName,
    title: "Clear caches",
  },
  {
    description: "Return local workspace preferences to their initial state.",
    icon: "settings" as IconName,
    title: "Reset workspace",
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

function fileNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function agentRunTone(status: AgentRun["status"]) {
  if (status === "waiting_for_approval") {
    return "warning";
  }

  if (status === "running" || status === "queued") {
    return "agent";
  }

  return "success";
}

function stepStatusTone(status: ProposedChangeStepStatus) {
  if (status === "completed") {
    return "success";
  }

  if (status === "in_progress") {
    return "agent";
  }

  if (status === "blocked") {
    return "danger";
  }

  return "neutral";
}

function riskTone(level: ProposedRisk["level"]) {
  if (level === "high") {
    return "danger";
  }

  if (level === "medium") {
    return "warning";
  }

  return "success";
}

function changeKindTone(kind: string) {
  if (kind === "added" || kind === "untracked") {
    return "success";
  }

  if (kind === "deleted" || kind === "conflicted") {
    return "danger";
  }

  if (kind === "renamed" || kind === "copied") {
    return "agent";
  }

  return "warning";
}

function proposedChangeStatusTone(status: PersistedProposedChange["status"]) {
  if (status === "approved" || status === "applied") {
    return "success";
  }

  if (status === "rejected" || status === "superseded") {
    return "danger";
  }

  if (status === "ready_for_review") {
    return "warning";
  }

  return "neutral";
}

function patchArtifactTone(status: ProposedPatchArtifact["status"]) {
  if (status === "generated") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  if (status === "unavailable") {
    return "warning";
  }

  return "neutral";
}

function formatGitRefreshedAt(refreshedAt: string | null | undefined) {
  if (!refreshedAt) {
    return "Not refreshed yet";
  }

  const timestamp = Number(refreshedAt);

  if (!Number.isNaN(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return refreshedAt;
}

function gitDiffStateTitle(
  file: GitChangedFile | null,
  diff: GitFileDiff | null,
  state: "idle" | "loading" | "ready" | "error",
) {
  if (!file) {
    return "Select a changed file";
  }

  if (state === "loading") {
    return "Loading local diff";
  }

  if (state === "error") {
    return "Diff unavailable";
  }

  if (!diff) {
    return "Diff not loaded yet";
  }

  if (diff.isTooLarge) {
    return "Diff is too large to preview";
  }

  if (diff.isBinary || diff.kind === "binary") {
    return "Binary diff unavailable";
  }

  if (diff.kind === "untracked") {
    return "Untracked file";
  }

  if (diff.kind === "unavailable" || diff.lines.length === 0) {
    return "No local diff available";
  }

  return "Local Git diff";
}

type GitDiffPreviewPanelProps = {
  file: GitChangedFile | null;
  diff: GitFileDiff | null;
  state: "idle" | "loading" | "ready" | "error";
  emptyDescription: string;
};

function GitDiffPreviewPanel({
  file,
  diff,
  emptyDescription,
  state,
}: GitDiffPreviewPanelProps) {
  return (
    <section className="git-diff-panel" aria-label="Selected file diff">
      <div className="git-diff-panel__header">
        <div>
          <p className="card-eyebrow">Read-only diff</p>
          <h3>{gitDiffStateTitle(file, diff, state)}</h3>
          <p>{file?.path ?? emptyDescription}</p>
        </div>
        <StatusPill
          tone={
            diff?.kind === "unavailable" || state === "error"
              ? "warning"
              : diff?.kind === "untracked"
                ? "neutral"
                : "success"
          }
          size="sm"
        >
          {state === "loading" ? "loading" : diff?.kind ?? "idle"}
        </StatusPill>
      </div>

      <dl className="diff-metadata-grid">
        <div>
          <dt>Additions</dt>
          <dd>+{diff?.additions ?? 0}</dd>
        </div>
        <div>
          <dt>Deletions</dt>
          <dd>-{diff?.deletions ?? 0}</dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>{diff?.lineCount ?? 0}</dd>
        </div>
      </dl>

      {state === "loading" ? (
        <div className="git-diff-state">
          <IconBadge icon="search" tone="accent" size="md" />
          <div>
            <h4>Loading diff safely</h4>
            <p>
              The workspace is running a fixed read-only Git diff command inside
              the selected repository.
            </p>
          </div>
        </div>
      ) : state === "error" ? (
        <div className="git-diff-state">
          <IconBadge icon="changes" tone="danger" size="md" />
          <div>
            <h4>Diff could not be loaded</h4>
            <p>
              No write operation was attempted. Refresh Git status and try
              selecting the file again.
            </p>
          </div>
        </div>
      ) : diff?.isTooLarge ? (
        <div className="git-diff-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Diff exceeds preview limits</h4>
            <p>
              This local diff is too large for the inline preview. It remains
              read-only and unavailable for review here.
            </p>
          </div>
        </div>
      ) : diff?.isBinary || diff?.kind === "binary" ? (
        <div className="git-diff-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Binary diff</h4>
            <p>
              Git reported this file as binary, so there is no text diff to
              render in the workspace.
            </p>
          </div>
        </div>
      ) : diff?.kind === "untracked" ? (
        <div className="git-diff-state">
          <IconBadge icon="file" tone="neutral" size="md" />
          <div>
            <h4>No tracked baseline yet</h4>
            <p>
              This file is untracked. A text diff will be available after a
              tracked baseline exists.
            </p>
          </div>
        </div>
      ) : diff?.kind === "unavailable" || !diff || diff.lines.length === 0 ? (
        <div className="git-diff-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>No diff content available</h4>
            <p>
              Git did not return a diff for this file and stage. The file
              remains visible in the status list.
            </p>
          </div>
        </div>
      ) : (
        <pre className="git-diff-code" tabIndex={0}>
          {diff.lines.map((line, index) => (
            <code
              className={`git-diff-line git-diff-line--${line.type}`}
              key={`${line.type}-${index}-${line.content}`}
            >
              {line.content}
            </code>
          ))}
        </pre>
      )}
    </section>
  );
}

type PatchArtifactListProps = {
  artifacts: ProposedPatchArtifact[];
  onSelectArtifact?: (artifactId: string) => void;
  selectedArtifactId?: string | null;
};

function patchArtifactStateTitle(artifact: ProposedPatchArtifact | null) {
  if (!artifact) {
    return "Select a patch artifact";
  }

  if (artifact.status === "generated") {
    return "Generated patch artifact";
  }

  if (artifact.status === "failed") {
    return "Patch generation failed";
  }

  if (artifact.status === "unavailable") {
    return "Patch unavailable";
  }

  return "Patch not generated";
}

function PatchArtifactList({
  artifacts,
  onSelectArtifact,
  selectedArtifactId,
}: PatchArtifactListProps) {
  if (artifacts.length === 0) {
    return (
      <div className="patch-artifact-empty">
        <IconBadge icon="changes" tone="neutral" size="md" />
        <div>
          <h4>No patch artifact records yet</h4>
          <p>
            Placeholder artifacts will appear here before any generated patch
            content is available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="patch-artifact-list" aria-label="Generated patch artifacts">
      {artifacts.map((artifact) => {
        const isSelected = selectedArtifactId === artifact.id;
        const itemContent = (
          <>
            <StatusPill
              tone={patchArtifactTone(artifact.status)}
              size="sm"
              showDot={false}
            >
              {artifact.status.replaceAll("_", " ")}
            </StatusPill>
            <div>
              <strong>{artifact.filePath}</strong>
              <span>
                {artifact.status === "generated"
                  ? `${artifact.additions ?? 0} additions · ${
                      artifact.deletions ?? 0
                    } deletions`
                  : "Generated patch artifact placeholder only"}
              </span>
            </div>
          </>
        );

        if (!onSelectArtifact) {
          return (
            <div className="patch-artifact-item" key={artifact.id}>
              {itemContent}
            </div>
          );
        }

        return (
          <button
            aria-pressed={isSelected}
            className={`patch-artifact-item patch-artifact-item--button ${
              isSelected ? "is-selected" : ""
            }`}
            key={artifact.id}
            onClick={() => onSelectArtifact(artifact.id)}
            type="button"
          >
            {itemContent}
          </button>
        );
      })}
    </div>
  );
}

type PatchArtifactDetailProps = {
  artifact: ProposedPatchArtifact | null;
};

function PatchArtifactDetail({ artifact }: PatchArtifactDetailProps) {
  return (
    <section className="patch-artifact-detail" aria-label="Patch artifact detail">
      <div className="patch-artifact-detail__header">
        <div>
          <p className="card-eyebrow">Generated Patch Artifact</p>
          <h3>{patchArtifactStateTitle(artifact)}</h3>
          <p>
            {artifact?.filePath ??
              "Choose a generated patch artifact record to inspect its review state."}
          </p>
        </div>
        <StatusPill
          tone={artifact ? patchArtifactTone(artifact.status) : "neutral"}
          size="sm"
          showDot={false}
        >
          {artifact?.status.replaceAll("_", " ") ?? "none"}
        </StatusPill>
      </div>

      <dl className="diff-metadata-grid">
        <div>
          <dt>Additions</dt>
          <dd>+{artifact?.additions ?? 0}</dd>
        </div>
        <div>
          <dt>Deletions</dt>
          <dd>-{artifact?.deletions ?? 0}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{artifact?.createdAt ?? "Not generated"}</dd>
        </div>
      </dl>

      {!artifact ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>No artifact selected</h4>
            <p>Select an artifact record to inspect its generated patch state.</p>
          </div>
        </div>
      ) : artifact.status === "not_generated" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>Patch not generated</h4>
            <p>
              Future agent execution will attach a reviewable generated patch
              here.
            </p>
          </div>
        </div>
      ) : artifact.status === "failed" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="danger" size="md" />
          <div>
            <h4>Patch generation failed</h4>
            <p>
              Generation failed before reviewable patch content was available.
              No fake diff is shown.
            </p>
          </div>
        </div>
      ) : artifact.status === "unavailable" ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="warning" size="md" />
          <div>
            <h4>Patch unavailable</h4>
            <p>
              This patch artifact is unavailable for review. No generated diff
              content is attached.
            </p>
          </div>
        </div>
      ) : artifact.isBinary ? (
        <div className="patch-artifact-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Binary generated patch</h4>
            <p>Binary generated patches are not rendered as text previews.</p>
          </div>
        </div>
      ) : artifact.isTooLarge ? (
        <div className="patch-artifact-state">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Generated patch too large</h4>
            <p>This generated patch is too large for inline preview.</p>
          </div>
        </div>
      ) : artifact.rawDiff ? (
        <div className="generated-patch-preview">
          <div className="generated-patch-preview__label">
            Generated patch artifact preview
          </div>
          <pre className="git-diff-code" tabIndex={0}>
            <code className="git-diff-line git-diff-line--metadata">
              Sample/demo generated artifact data
            </code>
            {artifact.rawDiff.split("\n").map((line, index) => (
              <code
                className={`git-diff-line ${
                  line.startsWith("diff ") ||
                  line.startsWith("index ") ||
                  line.startsWith("---") ||
                  line.startsWith("+++")
                    ? "git-diff-line--metadata"
                    : line.startsWith("@@")
                      ? "git-diff-line--hunk"
                      : line.startsWith("+")
                        ? "git-diff-line--added"
                        : line.startsWith("-")
                          ? "git-diff-line--removed"
                          : ""
                }`}
                key={`${artifact.id}-${index}-${line}`}
              >
                {line}
              </code>
            ))}
          </pre>
        </div>
      ) : (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="warning" size="md" />
          <div>
            <h4>Generated patch has no preview</h4>
            <p>
              This artifact is marked generated, but no raw diff content is
              attached.
            </p>
          </div>
        </div>
      )}
    </section>
  );
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
      aria-label={label}
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
  const [persistedProposedChanges, setPersistedProposedChanges] =
    useState<PersistedProposedChange[]>(mockProposedChanges);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFileFact[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedAgentRunId, setSelectedAgentRunId] = useState(agentRuns[0].id);
  const [selectedApprovalRequestId, setSelectedApprovalRequestId] = useState(
    mockApprovalRequests[0].id,
  );
  const [gitStatusSummary, setGitStatusSummary] =
    useState<GitStatusSummary | null>(null);
  const [gitStatusState, setGitStatusState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [selectedGitFilePath, setSelectedGitFilePath] = useState<string | null>(
    null,
  );
  const [gitFileDiff, setGitFileDiff] = useState<GitFileDiff | null>(null);
  const [gitFileDiffState, setGitFileDiffState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [selectedApprovalDiffPath, setSelectedApprovalDiffPath] = useState<
    string | null
  >(null);
  const [approvalGitFileDiff, setApprovalGitFileDiff] =
    useState<GitFileDiff | null>(null);
  const [approvalGitFileDiffState, setApprovalGitFileDiffState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [selectedAgentPatchArtifactId, setSelectedAgentPatchArtifactId] =
    useState<string | null>(null);
  const [selectedApprovalPatchArtifactId, setSelectedApprovalPatchArtifactId] =
    useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FileContentPreview | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const hasActiveRepository = repositories.length > 0;
  const activeRepository = repositories[0] ?? emptyRepository;
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
  const activeAgentRun =
    agentRuns.find((run) => run.id === selectedAgentRunId) ?? agentRuns[0];
  const activeProposedPlan =
    proposedChangePlans.find((plan) => plan.runId === activeAgentRun.id) ??
    null;
  const activePersistedProposedChange =
    persistedProposedChanges.find((change) => change.runId === activeAgentRun.id) ??
    null;
  const activeRunApproval =
    approvalRequests.find(
      (approval) => approval.agentRunId === activeAgentRun.id,
    ) ?? null;
  const selectedApprovalRequest =
    approvalRequests.find((approval) => approval.id === selectedApprovalRequestId) ??
    approvalRequests[0] ??
    null;
  const selectedApprovalRun = selectedApprovalRequest
    ? agentRuns.find((run) => run.id === selectedApprovalRequest.agentRunId) ?? null
    : null;
  const selectedApprovalPlan = selectedApprovalRequest
    ? proposedChangePlans.find(
        (plan) => plan.runId === selectedApprovalRequest.agentRunId,
      ) ?? null
    : null;
  const selectedApprovalProposedChange = selectedApprovalRequest
    ? persistedProposedChanges.find(
        (change) =>
          change.approvalRequestId === selectedApprovalRequest.id ||
          change.runId === selectedApprovalRequest.agentRunId,
      ) ?? null
    : null;
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
  const repositoryIntelligence = useMemo(
    () => deriveRepositoryIntelligence(indexedFiles),
    [indexedFiles],
  );
  const effectiveChangedFileCount =
    gitStatusSummary?.changedFileCount ?? activeRepository.openChanges;
  const effectiveBranch = gitStatusSummary?.branch ?? activeRepository.branch;
  const isWorkingDirectoryClean =
    gitStatusSummary?.isClean ?? activeRepository.openChanges === 0;
  const selectedGitChangedFile =
    gitStatusSummary?.files.find((file) => file.path === selectedGitFilePath) ??
    gitStatusSummary?.files[0] ??
    null;
  const approvalAffectedFiles = useMemo(() => {
    if (selectedApprovalProposedChange?.files.length) {
      return selectedApprovalProposedChange.files.map((file) => ({
        changeType: file.operation,
        patchArtifactStatus: file.patchArtifactStatus,
        path: file.path,
        reason: file.reason,
        riskLevel: file.riskLevel,
      }));
    }

    if (selectedApprovalPlan?.affectedFiles.length) {
      return selectedApprovalPlan.affectedFiles.map((file) => ({
        changeType: file.changeType,
        patchArtifactStatus: "not_generated" as const,
        path: file.path,
        reason: file.reason,
        riskLevel: "medium" as const,
      }));
    }

    return (
      selectedApprovalRequest?.files.map((path) => ({
        changeType: "unknown" as ProposedChangeFileOperation,
        patchArtifactStatus: "not_generated" as const,
        path,
        reason: "Listed on the approval request.",
        riskLevel: "medium" as const,
      })) ?? []
    );
  }, [
    selectedApprovalPlan,
    selectedApprovalProposedChange,
    selectedApprovalRequest,
  ]);
  const approvalDiffEntries = useMemo(
    () =>
      approvalAffectedFiles.map((file) => ({
        ...file,
        changedFile:
          gitStatusSummary?.files.find((changedFile) => changedFile.path === file.path) ??
          null,
      })),
    [approvalAffectedFiles, gitStatusSummary],
  );
  const approvalLocalDiffCount = approvalDiffEntries.filter(
    (entry) => entry.changedFile,
  ).length;
  const selectedApprovalDiffEntry =
    approvalDiffEntries.find((entry) => entry.path === selectedApprovalDiffPath) ??
    approvalDiffEntries.find((entry) => entry.changedFile) ??
    approvalDiffEntries[0] ??
    null;
  const selectedApprovalChangedFile =
    selectedApprovalDiffEntry?.changedFile ?? null;
  const selectedAgentPatchArtifact =
    activePersistedProposedChange?.patchArtifacts.find(
      (artifact) => artifact.id === selectedAgentPatchArtifactId,
    ) ??
    activePersistedProposedChange?.patchArtifacts[0] ??
    null;
  const selectedApprovalPatchArtifact =
    selectedApprovalProposedChange?.patchArtifacts.find(
      (artifact) => artifact.id === selectedApprovalPatchArtifactId,
    ) ??
    selectedApprovalProposedChange?.patchArtifacts[0] ??
    null;

  async function refreshGitStatus(repository = activeRepository) {
    if (!hasActiveRepository || repository.id === emptyRepository.id) {
      setGitStatusSummary(null);
      setGitStatusState("idle");
      return;
    }

    setGitStatusState("loading");

    try {
      const status = await loadGitStatusSummary(repository.id, repository.path);
      setGitStatusSummary(status);
      setGitStatusState("ready");
    } catch {
      setGitStatusSummary(null);
      setGitStatusState("error");
    }
  }

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
    void refreshGitStatus();
  }, [activeRepository.id, activeRepository.path, hasActiveRepository]);

  useEffect(() => {
    if (!gitStatusSummary || gitStatusSummary.files.length === 0) {
      setSelectedGitFilePath(null);
      return;
    }

    const selectedFileStillExists = gitStatusSummary.files.some(
      (file) => file.path === selectedGitFilePath,
    );

    if (!selectedFileStillExists) {
      setSelectedGitFilePath(gitStatusSummary.files[0].path);
    }
  }, [gitStatusSummary, selectedGitFilePath]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedDiff() {
      if (!selectedGitChangedFile || !hasActiveRepository) {
        setGitFileDiff(null);
        setGitFileDiffState("idle");
        return;
      }

      setGitFileDiffState("loading");

      try {
        const diff = await loadGitFileDiff(
          activeRepository.id,
          activeRepository.path,
          selectedGitChangedFile,
        );

        if (isMounted) {
          setGitFileDiff(diff);
          setGitFileDiffState("ready");
        }
      } catch {
        if (isMounted) {
          setGitFileDiff(null);
          setGitFileDiffState("error");
        }
      }
    }

    void loadSelectedDiff();

    return () => {
      isMounted = false;
    };
  }, [
    activeRepository.id,
    activeRepository.path,
    hasActiveRepository,
    selectedGitChangedFile?.kind,
    selectedGitChangedFile?.oldPath,
    selectedGitChangedFile?.path,
    selectedGitChangedFile?.stage,
  ]);

  useEffect(() => {
    if (approvalDiffEntries.length === 0) {
      setSelectedApprovalDiffPath(null);
      return;
    }

    const selectedFileStillExists = approvalDiffEntries.some(
      (entry) => entry.path === selectedApprovalDiffPath,
    );

    if (!selectedFileStillExists) {
      setSelectedApprovalDiffPath(
        approvalDiffEntries.find((entry) => entry.changedFile)?.path ??
          approvalDiffEntries[0].path,
      );
    }
  }, [approvalDiffEntries, selectedApprovalDiffPath]);

  useEffect(() => {
    const artifacts = activePersistedProposedChange?.patchArtifacts ?? [];

    if (artifacts.length === 0) {
      setSelectedAgentPatchArtifactId(null);
      return;
    }

    const selectedArtifactStillExists = artifacts.some(
      (artifact) => artifact.id === selectedAgentPatchArtifactId,
    );

    if (!selectedArtifactStillExists) {
      setSelectedAgentPatchArtifactId(artifacts[0].id);
    }
  }, [activePersistedProposedChange, selectedAgentPatchArtifactId]);

  useEffect(() => {
    const artifacts = selectedApprovalProposedChange?.patchArtifacts ?? [];

    if (artifacts.length === 0) {
      setSelectedApprovalPatchArtifactId(null);
      return;
    }

    const selectedArtifactStillExists = artifacts.some(
      (artifact) => artifact.id === selectedApprovalPatchArtifactId,
    );

    if (!selectedArtifactStillExists) {
      setSelectedApprovalPatchArtifactId(artifacts[0].id);
    }
  }, [selectedApprovalProposedChange, selectedApprovalPatchArtifactId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedApprovalDiff() {
      if (
        activeSection !== "approvals" ||
        !selectedApprovalChangedFile ||
        !hasActiveRepository
      ) {
        setApprovalGitFileDiff(null);
        setApprovalGitFileDiffState("idle");
        return;
      }

      setApprovalGitFileDiffState("loading");

      try {
        const diff = await loadGitFileDiff(
          activeRepository.id,
          activeRepository.path,
          selectedApprovalChangedFile,
        );

        if (isMounted) {
          setApprovalGitFileDiff(diff);
          setApprovalGitFileDiffState("ready");
        }
      } catch {
        if (isMounted) {
          setApprovalGitFileDiff(null);
          setApprovalGitFileDiffState("error");
        }
      }
    }

    void loadSelectedApprovalDiff();

    return () => {
      isMounted = false;
    };
  }, [
    activeRepository.id,
    activeRepository.path,
    activeSection,
    hasActiveRepository,
    selectedApprovalChangedFile?.kind,
    selectedApprovalChangedFile?.oldPath,
    selectedApprovalChangedFile?.path,
    selectedApprovalChangedFile?.stage,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateRepositories() {
      try {
        const savedRepositories = await loadSavedRepositories();
        const savedIndexingJobs = await loadIndexingJobs();
        const savedApprovalRequests = await loadApprovalRequests();
        const savedProposedChanges = await loadProposedChanges();

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
        if (savedProposedChanges.length > 0) {
          const normalizedProposedChanges = savedProposedChanges.map(
            ensureProposedPatchArtifacts,
          );
          setPersistedProposedChanges(normalizedProposedChanges);
          await saveProposedChanges(normalizedProposedChanges);
        } else {
          setPersistedProposedChanges(mockProposedChanges);
          await saveProposedChanges(mockProposedChanges);
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
          setRepositories([]);
          setIndexedFiles([]);
          setSelectedFilePath(null);
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
    let updatedProposal: PersistedProposedChange | null = null;

    if (status === "approved" || status === "rejected") {
      const linkedProposal = persistedProposedChanges.find(
        (change) => change.approvalRequestId === approvalId,
      );

      if (linkedProposal) {
        updatedProposal = {
          ...linkedProposal,
          status,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    setApprovalRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === approvalId ? { ...request, status } : request,
      ),
    );
    if (updatedProposal) {
      setPersistedProposedChanges((currentChanges) =>
        currentChanges.map((change) =>
          change.id === updatedProposal.id ? updatedProposal : change,
        ),
      );
    }
    await updateApprovalRequestStatus(approvalId, status);
    if (updatedProposal) {
      await saveProposedChanges([updatedProposal]);
    }
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
      return (
        <div className="preview-state preview-state--loading">
          <IconBadge icon="search" tone="context" size="md" />
          <div>
            <h4>Loading preview...</h4>
            <p>Reading this file through the safe local preview boundary.</p>
          </div>
        </div>
      );
    }

    if (!filePreview || !selectedIndexedFile) {
      return (
        <div className="preview-state">
          <IconBadge icon="file" tone="neutral" size="md" />
          <div>
            <h4>Select a file to load a preview.</h4>
            <p>Choose an indexed file to inspect its safe preview state.</p>
          </div>
        </div>
      );
    }

    if (filePreview.status === "ready") {
      return (
        <div className="file-preview-frame">
          <div className="file-preview-toolbar">
            <span>Text preview</span>
            <StatusPill tone="success" size="sm">
              safe read
            </StatusPill>
          </div>
          <pre className="file-preview">{filePreview.content}</pre>
        </div>
      );
    }

    if (filePreview.status === "too_large") {
      return (
        <div className="preview-state preview-state--warning">
          <IconBadge icon="file" tone="warning" size="md" />
          <div>
            <h4>Preview skipped</h4>
            <p>
              Preview skipped because this file is{" "}
              {formatFileSize(filePreview.sizeBytes)}. The preview limit is{" "}
              {formatFileSize(filePreview.maxSizeBytes)}.
            </p>
          </div>
        </div>
      );
    }

    if (filePreview.status === "binary") {
      return (
        <div className="preview-state preview-state--neutral">
          <IconBadge icon="file" tone="neutral" size="md" />
          <div>
            <h4>Binary file</h4>
            <p>Preview skipped for binary content.</p>
          </div>
        </div>
      );
    }

    if (filePreview.status === "outside_repository") {
      return (
        <div className="preview-state preview-state--danger">
          <IconBadge icon="approval" tone="danger" size="md" />
          <div>
            <h4>Preview blocked</h4>
            <p>
              Preview blocked because the resolved path is outside the
              repository.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="preview-state preview-state--danger">
        <IconBadge icon="file" tone="danger" size="md" />
        <div>
          <h4>Preview unavailable</h4>
          <p>Preview unavailable for this file.</p>
        </div>
      </div>
    );
  }

  function renderIndexedFileBrowser(variant: "compact" | "full") {
    const visibleFiles =
      variant === "compact"
        ? filteredIndexedFiles.slice(0, 8)
        : filteredIndexedFiles;

    return (
      <article className={`panel file-browser ${variant}`}>
        <div className="file-browser-heading">
          <div>
            <p className="card-eyebrow">Indexed files</p>
            <h2>{activeRepository.name}</h2>
            <p>
              Browse indexed repository facts and inspect files through the safe
              preview boundary.
            </p>
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
          <section className="file-results-panel" aria-label="Indexed file browser">
            <div className="file-results-heading">
              <div>
                <p className="card-eyebrow">Files</p>
                <h3>{visibleFiles.length} visible</h3>
              </div>
              <IconBadge icon="folder" tone="context" size="md" />
            </div>
            <div className="file-results" aria-label="Indexed file results">
            {visibleFiles.length > 0 ? (
              visibleFiles.map((file) => (
                <button
                  aria-label={`${file.path}, ${file.extension ?? "no extension"}, ${formatFileSize(file.sizeBytes)}`}
                  aria-current={
                    selectedIndexedFile?.path === file.path ? "true" : undefined
                  }
                  className="file-list-item"
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  type="button"
                >
                  <span className="file-list-item__icon">
                    <Icon name="file" size="sm" />
                  </span>
                  <span className="file-list-item__body">
                    <strong>{fileNameFromPath(file.path)}</strong>
                    <span>{file.path}</span>
                  </span>
                  <span className="file-list-item__meta">
                    <small>{file.extension ?? "none"}</small>
                    <small>{formatFileSize(file.sizeBytes)}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="file-empty-state">
                <IconBadge icon="search" tone="neutral" size="md" />
                <div>
                  <h3>No files match the current filter.</h3>
                  <p>
                    Search results will appear here after indexing finds files
                    that match the current query.
                  </p>
                </div>
              </div>
            )}
            </div>
          </section>

          <section className="file-detail" aria-label="Selected file details">
            {selectedIndexedFile ? (
              <>
                <div className="file-detail-header">
                  <div>
                    <p className="card-eyebrow">Selected file</p>
                    <h3>{fileNameFromPath(selectedIndexedFile.path)}</h3>
                    <p>{selectedIndexedFile.path}</p>
                  </div>
                  <StatusPill
                    tone={filePreview?.status === "ready" ? "success" : "neutral"}
                    size="sm"
                  >
                    {isPreviewLoading
                      ? "loading"
                      : filePreview?.status?.replace("_", " ") ?? "selected"}
                  </StatusPill>
                </div>

                <dl className="file-metadata-grid">
                  <div>
                    <dt>Size</dt>
                    <dd>{formatFileSize(selectedIndexedFile.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{selectedIndexedFile.extension ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Repository</dt>
                    <dd>{activeRepository.name}</dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd>{selectedIndexedFile.modifiedAt ?? "unknown"}</dd>
                  </div>
                </dl>

                <div className="preview-content-area">
                  {renderFilePreview()}
                </div>
              </>
            ) : (
              <div className="file-empty-state file-empty-state--detail">
                <IconBadge icon="file" tone="neutral" size="lg" />
                <div>
                  <h3>No file selected</h3>
                  <p>Select a file after running indexing.</p>
                </div>
              </div>
            )}
          </section>
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
          <section className="repository-intelligence-dashboard">
            {repositoryPickerError ? (
              <div className="inline-notice" role="status">
                {repositoryPickerError}
              </div>
            ) : null}

            {!hasActiveRepository ? (
              <article className="overview-card repository-empty-card">
                <IconBadge icon="repository" tone="accent" size="lg" />
                <div>
                  <p className="card-eyebrow">Repository Intelligence</p>
                  <h2>No repository selected</h2>
                  <p>
                    Choose a local repository to build indexed facts, Git state,
                    project structure, and safe file preview context.
                  </p>
                </div>
                <PrimaryButton icon="repository" onClick={selectRepositories}>
                  Choose repository
                </PrimaryButton>
              </article>
            ) : (
              <>
                <article className="overview-card repository-intelligence-hero">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Repository Intelligence</p>
                      <h2>{activeRepository.name}</h2>
                    </div>
                    <StatusPill tone={repositoryTone(activeRepository.status)}>
                      {activeRepository.status.replace("_", " ")}
                    </StatusPill>
                  </div>

                  <p className="tab-card-copy">
                    Workspace context derived from saved repository metadata,
                    Git state, and indexed file facts.
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

                  <dl className="tab-fact-grid repository-overview-facts">
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
                </article>

                <section className="repository-intelligence-grid">
                  <article className="overview-card repository-index-summary-card">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Index Summary</p>
                        <h3>Indexed facts</h3>
                      </div>
                      <IconBadge icon="index" tone="context" size="md" />
                    </div>

                    <dl className="intelligence-metric-grid">
                      <div>
                        <dt>Indexed Files</dt>
                        <dd>{repositoryIntelligence.totalIndexedFiles}</dd>
                      </div>
                      <div>
                        <dt>Directories</dt>
                        <dd>
                          {repositoryIntelligence.totalIndexedDirectories ??
                            "Not available yet"}
                        </dd>
                      </div>
                      <div>
                        <dt>Index Status</dt>
                        <dd>{activeIndexingJob?.status ?? activeRepository.status}</dd>
                      </div>
                      <div>
                        <dt>Progress</dt>
                        <dd>
                          {activeIndexingJob
                            ? `${activeIndexingJob.progress}%`
                            : "Not running"}
                        </dd>
                      </div>
                    </dl>

                    <div
                      className="intelligence-chip-group"
                      aria-label="Top file extensions"
                    >
                      {repositoryIntelligence.topExtensions.length > 0 ? (
                        repositoryIntelligence.topExtensions.map((extension) => (
                          <span key={extension.extension}>
                            {extension.extension} {extension.count}
                          </span>
                        ))
                      ) : (
                        <span>Not available yet</span>
                      )}
                    </div>
                  </article>

                  <article className="overview-card project-structure-card">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Project Structure</p>
                        <h3>Important folders</h3>
                      </div>
                      <IconBadge icon="folder" tone="agent" size="md" />
                    </div>

                    {repositoryIntelligence.projectFolders.length > 0 ? (
                      <div className="project-folder-list">
                        {repositoryIntelligence.projectFolders.map((folder) => (
                          <div className="project-folder-item" key={folder.name}>
                            <Icon name="folder" size="sm" />
                            <strong>{folder.name}</strong>
                            <span>{folder.fileCount} files</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="intelligence-empty-copy">
                        Not available yet. Run indexing to discover important
                        project folders.
                      </p>
                    )}
                  </article>

                  <article className="overview-card key-files-card">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Key Files</p>
                        <h3>Docs and config</h3>
                      </div>
                      <IconBadge icon="file" tone="accent" size="md" />
                    </div>

                    {repositoryIntelligence.keyFiles.length > 0 ? (
                      <div className="key-file-list">
                        {repositoryIntelligence.keyFiles.map((file) => (
                          <div className="key-file-item" key={file.path}>
                            <Icon name="file" size="sm" />
                            <div>
                              <strong>{file.name}</strong>
                              <span>{file.path}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="intelligence-empty-copy">
                        Not available yet. Key files appear after indexing.
                      </p>
                    )}
                  </article>

                  <article className="overview-card framework-hints-card">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Package / Framework Hints</p>
                        <h3>Path-derived hints</h3>
                      </div>
                      <IconBadge icon="spark" tone="context" size="md" />
                    </div>

                    {repositoryIntelligence.frameworkHints.length > 0 ? (
                      <div className="framework-hint-list">
                        {repositoryIntelligence.frameworkHints.map((hint) => (
                          <div className="framework-hint-item" key={hint.name}>
                            <strong>{hint.name}</strong>
                            <span>{hint.evidence}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="intelligence-empty-copy">
                        Not available yet. Hints are derived from indexed file
                        paths and known config files.
                      </p>
                    )}

                    <div className="package-metadata-note">
                      <StatusPill tone="neutral" size="sm" showDot={false}>
                        Package scripts unavailable
                      </StatusPill>
                      <p>
                        Package.json contents are not parsed until a safe,
                        explicit package metadata reader is added.
                      </p>
                    </div>
                  </article>

                  <article className="overview-card repository-entry-card">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Entry Points</p>
                        <h3>Next actions</h3>
                      </div>
                    </div>
                    <div className="repository-entry-actions">
                      <PrimaryButton
                        icon="file"
                        onClick={() => setActiveSection("changes")}
                      >
                        Browse indexed files
                      </PrimaryButton>
                      <SecondaryButton
                        icon="index"
                        onClick={() => startIndexingJob(activeRepository)}
                      >
                        Reindex repository
                      </SecondaryButton>
                      <SecondaryButton
                        icon="play"
                        onClick={() => setActiveSection("agents")}
                      >
                        Start agent run
                      </SecondaryButton>
                      <SecondaryButton
                        icon="changes"
                        onClick={() => setActiveSection("changes")}
                      >
                        View changes
                      </SecondaryButton>
                    </div>
                  </article>
                </section>

                <aside className="repository-support-grid">
                  <article className="overview-card connect-repository-card">
                    <div className="small-card-icon">
                      <Icon name="repository" />
                    </div>
                    <h3>Connect another local repository</h3>
                    <p>
                      Open the native directory picker and add more repositories
                      to the local-first workspace.
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
              </>
            )}
          </section>
        ) : null}

        {activeSection === "agents" ? (
          <section className="agent-run-workspace">
            <aside className="overview-card agent-run-list-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Run List</p>
                  <h2>Recent agent runs</h2>
                </div>
                <StatusPill tone="agent" size="sm">
                  {agentRuns.length} runs
                </StatusPill>
              </div>

              <div className="agent-run-list">
                {agentRuns.map((run) => {
                  const runApproval = approvalRequests.find(
                    (approval) => approval.agentRunId === run.id,
                  );

                  return (
                    <button
                      aria-current={
                        activeAgentRun.id === run.id ? "true" : undefined
                      }
                      aria-label={`Open agent run ${run.title}`}
                      className="agent-run-list-item"
                      key={run.id}
                      onClick={() => setSelectedAgentRunId(run.id)}
                      type="button"
                    >
                      <IconBadge icon="agent" tone="agent" size="sm" />
                      <span>
                        <strong>{run.title}</strong>
                        <small>
                          {run.repository} · {provider.displayName} · {run.model}
                        </small>
                      </span>
                      <StatusPill
                        tone={agentRunTone(run.status)}
                        size="sm"
                        showDot={false}
                      >
                        {run.status.replaceAll("_", " ")}
                      </StatusPill>
                      <small>
                        {run.startedAt} ·{" "}
                        {runApproval ? "approval required" : "no approval"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </aside>

            <article className="overview-card agent-run-detail-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow card-eyebrow--dot">
                    Selected Agent Run
                  </p>
                  <h2>{activeAgentRun.title}</h2>
                </div>
                <StatusPill tone={agentRunTone(activeAgentRun.status)}>
                  {activeAgentRun.status.replaceAll("_", " ")}
                </StatusPill>
              </div>

              <p className="tab-card-copy">{activeAgentRun.taskSummary}</p>

              <dl className="tab-fact-grid agent-detail-fact-grid">
                <div>
                  <dt>Provider / Model</dt>
                  <dd>
                    {provider.displayName} · {activeAgentRun.model}
                  </dd>
                </div>
                <div>
                  <dt>Repository</dt>
                  <dd>{activeAgentRun.repository}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{activeRepository.branch}</dd>
                </div>
                <div>
                  <dt>Started / Elapsed</dt>
                  <dd>
                    {activeAgentRun.startedAt} · {activeAgentRun.elapsed}
                  </dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{activeAgentRun.confidence}</dd>
                </div>
                <div>
                  <dt>Approval Requirement</dt>
                  <dd>
                    {activeAgentRun.approvalRequired
                      ? "Human approval required"
                      : "No approval required"}
                  </dd>
                </div>
              </dl>

              <div className="agent-detail-section provider-context-card">
                <div className="overview-card__header">
                  <p className="card-eyebrow">Provider Context</p>
                  <StatusPill tone="success" size="sm">
                    {provider.status}
                  </StatusPill>
                </div>
                <p>
                  Structured-output mock provider is connected for local
                  planning, approval, and safe implementation dry-runs. This run
                  has not produced real Git diffs yet.
                </p>
              </div>
            </article>

            <article className="overview-card proposed-plan-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Proposed Plan</p>
                  <h2>Structured implementation plan</h2>
                </div>
                <StatusPill
                  tone={
                    activePersistedProposedChange
                      ? proposedChangeStatusTone(activePersistedProposedChange.status)
                      : activeProposedPlan?.approvalRequired
                        ? "warning"
                        : "success"
                  }
                >
                  {activePersistedProposedChange?.status.replaceAll("_", " ") ??
                    (activeProposedPlan?.approvalRequired
                      ? "approval required"
                      : "approval not required")}
                </StatusPill>
              </div>

              <p className="tab-card-copy">
                {activePersistedProposedChange?.summary ??
                  activeProposedPlan?.summary ??
                  "No structured proposed plan is available for this run yet."}
              </p>

              {activePersistedProposedChange ? (
                <dl className="tab-fact-grid proposal-link-fact-grid">
                  <div>
                    <dt>Proposal Record</dt>
                    <dd>{activePersistedProposedChange.id}</dd>
                  </div>
                  <div>
                    <dt>Approval Link</dt>
                    <dd>
                      {activePersistedProposedChange.approvalRequestId ??
                        "Not linked"}
                    </dd>
                  </div>
                  <div>
                    <dt>Patch Artifacts</dt>
                    <dd>
                      {activePersistedProposedChange.patchArtifacts.length > 0
                        ? `${activePersistedProposedChange.patchArtifacts.length} stored`
                        : "Not generated"}
                    </dd>
                  </div>
                </dl>
              ) : null}

              {activeProposedPlan ? (
                <div className="proposed-plan-grid">
                  <section className="plan-section plan-steps-section">
                    <div className="plan-section__header">
                      <IconBadge icon="index" tone="context" size="md" />
                      <div>
                        <p className="card-eyebrow">Implementation Steps</p>
                        <h3>Ordered plan</h3>
                      </div>
                    </div>
                    <ol className="plan-step-list">
                      {activeProposedPlan.steps.map((step) => (
                        <li key={step.id}>
                          <StatusPill
                            tone={stepStatusTone(step.status)}
                            size="sm"
                            showDot={false}
                          >
                            {step.status.replaceAll("_", " ")}
                          </StatusPill>
                          <div>
                            <strong>{step.title}</strong>
                            <p>{step.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className="plan-section">
                    <div className="plan-section__header">
                      <IconBadge icon="file" tone="accent" size="md" />
                      <div>
                        <p className="card-eyebrow">Expected Files</p>
                        <h3>Affected files</h3>
                      </div>
                    </div>
                    <div className="plan-file-list">
                      {(activePersistedProposedChange?.files ??
                        activeProposedPlan.affectedFiles.map((file) => ({
                          operation: file.changeType,
                          patchArtifactStatus: "not_generated" as const,
                          path: file.path,
                          reason: file.reason,
                          riskLevel: "medium" as const,
                        }))).map((file) => (
                        <div className="plan-file-item" key={file.path}>
                          <StatusPill tone="neutral" size="sm" showDot={false}>
                            {file.operation}
                          </StatusPill>
                          <div>
                            <strong>{file.path}</strong>
                            <span>{file.reason}</span>
                          </div>
                          <StatusPill
                            tone={patchArtifactTone(file.patchArtifactStatus)}
                            size="sm"
                            showDot={false}
                          >
                            {file.patchArtifactStatus.replaceAll("_", " ")}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="plan-section">
                    <div className="plan-section__header">
                      <IconBadge icon="changes" tone="agent" size="md" />
                      <div>
                        <p className="card-eyebrow">Generated Patch Artifacts</p>
                        <h3>Artifact placeholders</h3>
                      </div>
                    </div>
                    <p className="patch-artifact-copy">
                      These records reserve generated patch slots for each
                      proposed file. No patch content has been generated or
                      applied.
                    </p>
                    <PatchArtifactList
                      artifacts={
                        activePersistedProposedChange?.patchArtifacts ?? []
                      }
                      onSelectArtifact={setSelectedAgentPatchArtifactId}
                      selectedArtifactId={selectedAgentPatchArtifact?.id}
                    />
                  </section>

                  <section className="plan-section patch-artifact-detail-section">
                    <PatchArtifactDetail artifact={selectedAgentPatchArtifact} />
                  </section>

                  <section className="plan-section">
                    <div className="plan-section__header">
                      <IconBadge icon="approval" tone="warning" size="md" />
                      <div>
                        <p className="card-eyebrow">Risk Summary</p>
                        <h3>Known risks</h3>
                      </div>
                    </div>
                    <div className="plan-risk-list">
                      {activeProposedPlan.risks.map((risk) => (
                        <div className="plan-risk-item" key={risk.title}>
                          <StatusPill
                            tone={riskTone(risk.level)}
                            size="sm"
                            showDot={false}
                          >
                            {risk.level}
                          </StatusPill>
                          <div>
                            <strong>{risk.title}</strong>
                            <span>{risk.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="plan-section">
                    <div className="plan-section__header">
                      <IconBadge icon="search" tone="agent" size="md" />
                      <div>
                        <p className="card-eyebrow">Validation</p>
                        <h3>Check strategy</h3>
                      </div>
                    </div>
                    <div className="plan-validation-list">
                      {activeProposedPlan.validation.map((check) => (
                        <div className="plan-validation-item" key={check.label}>
                          <Icon name="approval" size="sm" />
                          <span>{check.label}</span>
                          <StatusPill tone="neutral" size="sm" showDot={false}>
                            {check.status.replaceAll("_", " ")}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </article>

            <aside className="agent-run-side-column">
              <article className="overview-card run-repository-context-card">
                <div className="overview-card__header">
                  <div>
                    <p className="card-eyebrow">Repository Context</p>
                    <h3>{activeRepository.name}</h3>
                  </div>
                  <StatusPill tone={repositoryTone(activeRepository.status)} size="sm">
                    {activeRepository.status.replace("_", " ")}
                  </StatusPill>
                </div>
                <dl className="agent-context-facts">
                  <div>
                    <dt>Indexed files</dt>
                    <dd>{repositoryIntelligence.totalIndexedFiles}</dd>
                  </div>
                  <div>
                    <dt>Open changes</dt>
                    <dd>{activeRepository.openChanges}</dd>
                  </div>
                  <div>
                    <dt>Key folders</dt>
                    <dd>
                      {repositoryIntelligence.projectFolders
                        .slice(0, 3)
                        .map((folder) => folder.name)
                        .join(", ") || "Not available yet"}
                    </dd>
                  </div>
                  <div>
                    <dt>Key files</dt>
                    <dd>
                      {repositoryIntelligence.keyFiles
                        .slice(0, 3)
                        .map((file) => file.name)
                        .join(", ") || "Not available yet"}
                    </dd>
                  </div>
                </dl>
              </article>

              <article className="overview-card approval-handoff-card">
                <div className="overview-card__header">
                  <div>
                    <p className="card-eyebrow">Approval Handoff</p>
                    <h3>
                      {activeRunApproval
                        ? activeRunApproval.title
                        : "No linked approval yet"}
                    </h3>
                  </div>
                  <StatusPill
                    tone={
                      activeRunApproval
                        ? approvalStatusTone(activeRunApproval.status)
                        : "neutral"
                    }
                    size="sm"
                  >
                    {activeRunApproval?.status ?? "planned"}
                  </StatusPill>
                </div>
                <p>
                  {activeRunApproval
                    ? activeRunApproval.summary
                    : "Approval review will attach here when the run produces a reviewable request."}
                </p>
                <div className="approval-handoff-actions">
                  <PrimaryButton
                    disabled={!activeRunApproval}
                    icon="approval"
                    onClick={() => {
                      if (activeRunApproval) {
                        setSelectedApprovalRequestId(activeRunApproval.id);
                      }

                      setActiveSection("approvals");
                    }}
                  >
                    Review approval
                  </PrimaryButton>
                  <SecondaryButton disabled icon="changes">
                    Diffs not generated yet
                  </SecondaryButton>
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
                  <p className="card-eyebrow">Human Approval Review</p>
                  <h2>{pendingApprovalCount} pending approvals</h2>
                </div>
                <StatusPill tone="warning">
                  Review before execution
                </StatusPill>
              </div>
              <p>
                Select a request, inspect the linked agent run and structured
                plan, then approve or reject the work before any implementation
                proceeds.
              </p>
            </article>

            <section className="approval-review-workspace">
              <aside className="overview-card approval-queue-list-card">
                <div className="overview-card__header">
                  <div>
                    <p className="card-eyebrow">Approval Queue</p>
                    <h2>Requests</h2>
                  </div>
                  <StatusPill tone="warning" size="sm">
                    {approvalRequests.length} total
                  </StatusPill>
                </div>

                <div className="approval-queue-list">
                  {approvalRequests.map((approval) => {
                    const linkedRun = agentRuns.find(
                      (run) => run.id === approval.agentRunId,
                    );

                    return (
                      <button
                        aria-current={
                          selectedApprovalRequest?.id === approval.id
                            ? "true"
                            : undefined
                        }
                        aria-label={`Review approval ${approval.title}`}
                        className="approval-queue-item"
                        key={approval.id}
                        onClick={() => setSelectedApprovalRequestId(approval.id)}
                        type="button"
                      >
                        <IconBadge icon="approval" tone="warning" size="sm" />
                        <span>
                          <strong>{approval.title}</strong>
                          <small>
                            {linkedRun?.title ?? "No linked run"} ·{" "}
                            {approval.files.length} files · {approval.createdAt}
                          </small>
                        </span>
                        <span className="approval-queue-item__status">
                          <StatusPill
                            tone={approvalStatusTone(approval.status)}
                            size="sm"
                            showDot={false}
                          >
                            {approval.status}
                          </StatusPill>
                          <StatusPill
                            tone={approvalRiskTone(approval.risk)}
                            size="sm"
                            showDot={false}
                          >
                            {approval.risk} risk
                          </StatusPill>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {selectedApprovalRequest ? (
                <article className="overview-card approval-detail-card">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Selected Approval</p>
                      <h2>{selectedApprovalRequest.title}</h2>
                    </div>
                    <StatusPill
                      tone={approvalStatusTone(selectedApprovalRequest.status)}
                    >
                      {selectedApprovalRequest.status}
                    </StatusPill>
                  </div>

                  <p className="tab-card-copy">{selectedApprovalRequest.summary}</p>

                  <dl className="tab-fact-grid approval-detail-fact-grid">
                    <div>
                      <dt>Linked Agent Run</dt>
                      <dd>{selectedApprovalRun?.title ?? "Not linked"}</dd>
                    </div>
                    <div>
                      <dt>Provider / Model</dt>
                      <dd>
                        {selectedApprovalRun
                          ? `${provider.displayName} · ${selectedApprovalRun.model}`
                          : "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt>Repository</dt>
                      <dd>{selectedApprovalRequest.repository}</dd>
                    </div>
                    <div>
                      <dt>Branch</dt>
                      <dd>{activeRepository.branch}</dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{selectedApprovalRequest.risk}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{selectedApprovalRequest.createdAt}</dd>
                    </div>
                    <div>
                      <dt>Proposal Status</dt>
                      <dd>
                        {selectedApprovalProposedChange?.status.replaceAll(
                          "_",
                          " ",
                        ) ?? "Not persisted"}
                      </dd>
                    </div>
                    <div>
                      <dt>Patch Artifacts</dt>
                      <dd>
                        {selectedApprovalProposedChange?.patchArtifacts.length
                          ? `${selectedApprovalProposedChange.patchArtifacts.length} stored`
                          : "Not generated"}
                      </dd>
                    </div>
                  </dl>

                  <div className="approval-review-section">
                    <div className="plan-section__header">
                      <IconBadge icon="file" tone="accent" size="md" />
                      <div>
                        <p className="card-eyebrow">Affected Files</p>
                        <h3>Files requiring review</h3>
                      </div>
                    </div>
                    <div className="file-list" aria-label="Files requiring review">
                      {selectedApprovalRequest.files.map((file) => (
                        <span key={file}>{file}</span>
                      ))}
                    </div>
                  </div>

                  <div className="approval-decision-card">
                    <div>
                      <p className="card-eyebrow">Decision</p>
                      <h3>
                        {selectedApprovalRequest.status === "pending"
                          ? "Approve or reject this request"
                          : `Request ${selectedApprovalRequest.status}`}
                      </h3>
                      <p>
                        Approval changes only the saved approval status. It does
                        not apply patches, write files, or execute Git commands.
                      </p>
                    </div>
                    <div className="approval-decision-actions">
                      <SecondaryButton
                        disabled={selectedApprovalRequest.status !== "pending"}
                        icon="approval"
                        onClick={() =>
                          updateApprovalStatus(
                            selectedApprovalRequest.id,
                            "rejected",
                          )
                        }
                      >
                        Reject
                      </SecondaryButton>
                      <PrimaryButton
                        disabled={selectedApprovalRequest.status !== "pending"}
                        icon="approval"
                        onClick={() =>
                          updateApprovalStatus(
                            selectedApprovalRequest.id,
                            "approved",
                          )
                        }
                      >
                        Approve
                      </PrimaryButton>
                    </div>
                  </div>
                </article>
              ) : null}

              <article className="overview-card approval-plan-review-card">
                <div className="overview-card__header">
                  <div>
                    <p className="card-eyebrow">Proposed Plan Review</p>
                    <h2>Plan attached to approval</h2>
                  </div>
                  <StatusPill
                    tone={
                      selectedApprovalProposedChange
                        ? proposedChangeStatusTone(
                            selectedApprovalProposedChange.status,
                          )
                        : selectedApprovalPlan?.approvalRequired
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {selectedApprovalProposedChange?.status.replaceAll("_", " ") ??
                      (selectedApprovalPlan?.approvalRequired
                        ? "approval required"
                        : "no plan attached")}
                  </StatusPill>
                </div>

                <p className="tab-card-copy">
                  {selectedApprovalProposedChange?.summary ??
                    selectedApprovalPlan?.summary ??
                    "No structured proposed plan is linked to this approval yet."}
                </p>

                {selectedApprovalPlan ? (
                  <div className="proposed-plan-grid approval-plan-grid">
                    <section className="plan-section plan-steps-section">
                      <div className="plan-section__header">
                        <IconBadge icon="index" tone="context" size="md" />
                        <div>
                          <p className="card-eyebrow">Implementation Steps</p>
                          <h3>Ordered plan</h3>
                        </div>
                      </div>
                      <ol className="plan-step-list">
                        {selectedApprovalPlan.steps.map((step) => (
                          <li key={step.id}>
                            <StatusPill
                              tone={stepStatusTone(step.status)}
                              size="sm"
                              showDot={false}
                            >
                              {step.status.replaceAll("_", " ")}
                            </StatusPill>
                            <div>
                              <strong>{step.title}</strong>
                              <p>{step.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    <section className="plan-section">
                      <div className="plan-section__header">
                        <IconBadge icon="approval" tone="warning" size="md" />
                        <div>
                          <p className="card-eyebrow">Risk Summary</p>
                          <h3>Review risks</h3>
                        </div>
                      </div>
                      <div className="plan-risk-list">
                        {selectedApprovalPlan.risks.map((risk) => (
                          <div className="plan-risk-item" key={risk.title}>
                            <StatusPill
                              tone={riskTone(risk.level)}
                              size="sm"
                              showDot={false}
                            >
                              {risk.level}
                            </StatusPill>
                            <div>
                              <strong>{risk.title}</strong>
                              <span>{risk.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="plan-section">
                      <div className="plan-section__header">
                        <IconBadge icon="search" tone="agent" size="md" />
                        <div>
                          <p className="card-eyebrow">Validation</p>
                          <h3>Check strategy</h3>
                        </div>
                      </div>
                      <div className="plan-validation-list">
                        {selectedApprovalPlan.validation.map((check) => (
                          <div className="plan-validation-item" key={check.label}>
                            <Icon name="approval" size="sm" />
                            <span>{check.label}</span>
                            <StatusPill tone="neutral" size="sm" showDot={false}>
                              {check.status.replaceAll("_", " ")}
                            </StatusPill>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : null}
              </article>

              <aside className="approval-side-column">
                <article className="overview-card approval-repository-context-card">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Repository Context</p>
                      <h3>{activeRepository.name}</h3>
                    </div>
                    <StatusPill
                      tone={repositoryTone(activeRepository.status)}
                      size="sm"
                    >
                      {activeRepository.status.replace("_", " ")}
                    </StatusPill>
                  </div>
                  <dl className="agent-context-facts">
                    <div>
                      <dt>Indexed files</dt>
                      <dd>{repositoryIntelligence.totalIndexedFiles}</dd>
                    </div>
                    <div>
                      <dt>Open changes</dt>
                      <dd>{activeRepository.openChanges}</dd>
                    </div>
                    <div>
                      <dt>Branch</dt>
                      <dd>{activeRepository.branch}</dd>
                    </div>
                  </dl>
                </article>

                <article className="overview-card patch-artifact-card">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Generated Patch Artifacts</p>
                      <h3>Patch artifact placeholders</h3>
                    </div>
                    <StatusPill tone="neutral" size="sm" showDot={false}>
                      {selectedApprovalProposedChange?.patchArtifacts.length ?? 0}{" "}
                      records
                    </StatusPill>
                  </div>
                  <p>
                    These records are reserved for future generated diffs. They
                    are not local Git diffs and no patch has been written or
                    applied.
                  </p>
                  <PatchArtifactList
                    artifacts={
                      selectedApprovalProposedChange?.patchArtifacts ?? []
                    }
                    onSelectArtifact={setSelectedApprovalPatchArtifactId}
                    selectedArtifactId={selectedApprovalPatchArtifact?.id}
                  />
                  <PatchArtifactDetail artifact={selectedApprovalPatchArtifact} />
                </article>

                <article className="overview-card approval-diff-review-card">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Diff Review</p>
                        <h3>Local repository diffs</h3>
                      </div>
                    <StatusPill
                      tone={approvalLocalDiffCount > 0 ? "success" : "neutral"}
                      size="sm"
                      showDot={false}
                    >
                      {approvalLocalDiffCount} available
                    </StatusPill>
                  </div>
                  <p>
                    This shows matching local Git diffs. Generated patch diffs
                    will be attached after the proposed change model is
                    connected to file writes.
                  </p>
                  <dl className="diff-review-summary">
                    <div>
                      <dt>Affected Files</dt>
                      <dd>{approvalDiffEntries.length}</dd>
                    </div>
                    <div>
                      <dt>Local Diffs</dt>
                      <dd>{approvalLocalDiffCount}</dd>
                    </div>
                    <div>
                      <dt>Missing</dt>
                      <dd>{approvalDiffEntries.length - approvalLocalDiffCount}</dd>
                    </div>
                  </dl>

                  <div
                    className="approval-diff-file-list"
                    aria-label="Approval diff files"
                  >
                    {approvalDiffEntries.length > 0 ? (
                      approvalDiffEntries.map((entry) => {
                        const isSelected =
                          selectedApprovalDiffEntry?.path === entry.path;

                        return (
                          <button
                            aria-pressed={isSelected}
                            className={`approval-diff-file ${isSelected ? "is-selected" : ""}`}
                            key={entry.path}
                            onClick={() => setSelectedApprovalDiffPath(entry.path)}
                            type="button"
                          >
                            <span>
                              <strong>{entry.path}</strong>
                              <small>
                                {entry.changedFile
                                  ? `${entry.changedFile.kind} · ${entry.changedFile.stage}`
                                  : entry.reason}
                              </small>
                            </span>
                            <StatusPill
                              tone={patchArtifactTone(entry.patchArtifactStatus)}
                              size="sm"
                              showDot={false}
                            >
                              {entry.patchArtifactStatus.replaceAll("_", " ")}
                            </StatusPill>
                            <StatusPill
                              tone={entry.changedFile ? "success" : "neutral"}
                              size="sm"
                              showDot={false}
                            >
                              {entry.changedFile
                                ? "Local diff available"
                                : "No local diff yet"}
                            </StatusPill>
                          </button>
                        );
                      })
                    ) : (
                      <div className="git-diff-state">
                        <IconBadge icon="changes" tone="neutral" size="md" />
                        <div>
                          <h4>No affected files listed</h4>
                          <p>
                            This approval does not have proposed affected files
                            to match against local Git status.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <GitDiffPreviewPanel
                    diff={approvalGitFileDiff}
                    emptyDescription={
                      selectedApprovalDiffEntry
                        ? "No matching local Git change exists for the selected affected file."
                        : "Select an affected file to inspect matching local repository diffs."
                    }
                    file={selectedApprovalChangedFile}
                    state={approvalGitFileDiffState}
                  />
                </article>
              </aside>
            </section>
          </section>
        ) : null}

        {activeSection === "changes" ? (
          <section className="changes-dashboard">
            <article className="overview-card changes-hero-card">
              <div className="changes-hero-card__content">
                <div className="changes-hero-card__mark">
                  <Icon name="changes" />
                </div>
                <div>
                  <p className="card-eyebrow">Change Review</p>
                  <h2>
                    {effectiveChangedFileCount > 0
                      ? `${effectiveChangedFileCount} local changes waiting for review`
                      : "No local changes waiting for review"}
                  </h2>
                  <p>
                    Change review now reads real Git status for the selected
                    repository. Diff review remains planned for the next layer.
                  </p>
                </div>
              </div>
              <div className="changes-hero-actions">
                <PrimaryButton
                  icon="search"
                  onClick={() => void refreshGitStatus()}
                >
                  Refresh Git status
                </PrimaryButton>
                <SecondaryButton
                  icon="play"
                  onClick={() => setActiveSection("agents")}
                >
                  Start an agent run
                </SecondaryButton>
              </div>
            </article>

            <section className="changes-feature-grid" aria-label="Change review readiness">
              {changeFeatureBlocks.map((block) => (
                <article className="overview-card changes-feature-card" key={block.title}>
                  <IconBadge icon={block.icon} tone="accent" size="md" />
                  <h3>{block.title}</h3>
                  <p>{block.description}</p>
                </article>
              ))}
            </section>

            <article className="overview-card changes-status-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Repository Status</p>
                  <h3>{activeRepository.name}</h3>
                </div>
                <StatusPill tone={isWorkingDirectoryClean ? "success" : "warning"}>
                  {gitStatusState === "loading"
                    ? "refreshing"
                    : isWorkingDirectoryClean
                      ? "clean"
                      : "changes detected"}
                </StatusPill>
              </div>
              <dl className="tab-fact-grid changes-fact-grid">
                <div>
                  <dt>Branch</dt>
                  <dd>{effectiveBranch}</dd>
                </div>
                <div>
                  <dt>Changed Files</dt>
                  <dd>{effectiveChangedFileCount}</dd>
                </div>
                <div>
                  <dt>Staged / Unstaged</dt>
                  <dd>
                    {gitStatusSummary
                      ? `${gitStatusSummary.stagedCount} / ${gitStatusSummary.unstagedCount}`
                      : "Not refreshed"}
                  </dd>
                </div>
                <div>
                  <dt>Last Refreshed</dt>
                  <dd>
                    {formatGitRefreshedAt(gitStatusSummary?.refreshedAt)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="overview-card git-changes-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Git Status</p>
                  <h3>
                    {isWorkingDirectoryClean
                      ? "Clean working directory"
                      : "Changed files"}
                  </h3>
                </div>
                <StatusPill
                  tone={
                    gitStatusState === "error"
                      ? "danger"
                      : gitStatusSummary?.isGitRepository === false
                        ? "warning"
                        : "neutral"
                  }
                  size="sm"
                >
                  {gitStatusState === "error"
                    ? "unavailable"
                    : gitStatusSummary?.isGitRepository === false
                      ? "not a git repository"
                      : "read only"}
                </StatusPill>
              </div>

              {gitStatusState === "error" ? (
                <div className="git-status-empty">
                  <IconBadge icon="changes" tone="danger" size="md" />
                  <div>
                    <h3>Git status unavailable</h3>
                    <p>
                      The workspace could not read Git status for the selected
                      repository. No write operations were attempted.
                    </p>
                  </div>
                </div>
              ) : gitStatusSummary && gitStatusSummary.files.length > 0 ? (
                <div className="git-review-layout">
                  <div className="git-change-list" aria-label="Changed files">
                    {gitStatusSummary.files.map((file) => {
                      const isSelected = selectedGitChangedFile?.path === file.path;

                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`git-change-item ${isSelected ? "is-selected" : ""}`}
                          key={`${file.statusCode}-${file.oldPath ?? ""}-${file.path}`}
                          onClick={() => setSelectedGitFilePath(file.path)}
                          type="button"
                        >
                          <StatusPill
                            tone={changeKindTone(file.kind)}
                            size="sm"
                            showDot={false}
                          >
                            {file.kind}
                          </StatusPill>
                          <div>
                            <strong>{file.path}</strong>
                            {file.oldPath ? <span>Renamed from {file.oldPath}</span> : null}
                          </div>
                          <span className="git-change-stage">{file.stage}</span>
                        </button>
                      );
                    })}
                  </div>

                  <GitDiffPreviewPanel
                    diff={gitFileDiff}
                    emptyDescription="Choose a changed file to inspect its local Git diff."
                    file={selectedGitChangedFile}
                    state={gitFileDiffState}
                  />
                </div>
              ) : (
                <div className="git-status-empty">
                  <IconBadge icon="approval" tone="success" size="md" />
                  <div>
                    <h3>No local changes waiting for review</h3>
                    <p>
                      Git status reports a clean working directory for the
                      selected repository.
                    </p>
                  </div>
                </div>
              )}
            </article>

            <section className="file-browser-shell">
              {renderIndexedFileBrowser("full")}
            </section>
          </section>
        ) : null}

        {activeSection === "settings" ? (
          <section className="settings-dashboard">
            <article className="overview-card settings-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Workspace Settings</p>
                  <h2>Local-first workspace controls</h2>
                </div>
                <StatusPill
                  tone={storageStatus === "ready" ? "success" : "warning"}
                >
                  storage {storageStatus}
                </StatusPill>
              </div>

              <div className="settings-row-list">
                {settingsRows.map((row) => {
                  const value =
                    row.title === "Provider adapters"
                      ? provider.displayName
                      : row.title === "Local storage"
                        ? storageStatus
                        : row.title === "Indexing policy"
                          ? scanTarget.includes.join(", ")
                          : `${pendingApprovalCount} pending`;
                  const action =
                    row.title === "Indexing policy"
                      ? () => startIndexingJob(activeRepository)
                      : row.title === "Approval defaults"
                        ? () => setActiveSection("approvals")
                        : undefined;

                  return (
                    <div className="settings-row" key={row.title}>
                      <IconBadge icon={row.icon} tone="context" size="md" />
                      <div className="settings-row__content">
                        <h3>{row.title}</h3>
                        <p>{row.description}</p>
                      </div>
                      <span className="settings-row__value">{value}</span>
                      <SecondaryButton
                        disabled={!action}
                        onClick={action}
                      >
                        {row.action}
                      </SecondaryButton>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="overview-card maintenance-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Workspace Maintenance</p>
                  <h2>Keep local intelligence current</h2>
                </div>
              </div>

              <div className="maintenance-action-list">
                {maintenanceActions.map((action) => {
                  const isReindex = action.title === "Reindex repositories";
                  const isDanger = action.title === "Reset workspace";

                  return (
                    <div
                      className={`maintenance-action${
                        isDanger ? " maintenance-action--danger" : ""
                      }`}
                      key={action.title}
                    >
                      <IconBadge
                        icon={action.icon}
                        tone={isDanger ? "danger" : "accent"}
                        size="md"
                      />
                      <div>
                        <h3>{action.title}</h3>
                        <p>{action.description}</p>
                      </div>
                      <SecondaryButton
                        className={isDanger ? "danger-action" : ""}
                        disabled={!isReindex}
                        icon={isReindex ? "index" : undefined}
                        onClick={
                          isReindex
                            ? () => startIndexingJob(activeRepository)
                            : undefined
                        }
                      >
                        {isReindex ? "Run" : "Unavailable"}
                      </SecondaryButton>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        ) : null}
    </AppShell>
  );
}
