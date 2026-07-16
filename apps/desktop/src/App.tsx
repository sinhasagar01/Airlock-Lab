import { useEffect, useMemo, useState } from "react";
import {
  AgentProviderError,
  type AgentRun,
  type AgentProviderId,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  createMockAgentProviderAdapter,
  createOpenAiAgentProviderAdapter,
  computePatchArtifactDigest,
  ensureProposedPatchArtifactDigests,
  executeAgentRun,
  type PersistedProposedChange,
  type PatchApplyAttempt,
  type PatchValidationResult,
  type ProposedPatchArtifact,
  type ProposedChangePlan,
  type ProposedChangeFileOperation,
  type RepositoryValidationSnapshot,
  validatePatchArtifactStructure,
} from "@ai-dev/ai";
import {
  type GitFileDiff,
  type GitStatusSummary,
  type NavigationSection,
} from "@ai-dev/core";
import {
  createIndexingJob,
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
  StatusBadge,
  StatusPill,
} from "@ai-dev/ui";
import { AppHeader, AppShell, Sidebar } from "./components/AppShell";
import { GitDiffPreviewPanel } from "./features/changes/GitDiffPreviewPanel";
import { demoWorkflow } from "./features/demo-workflow/demoWorkflow";
import {
  isSeededRecordId,
  isUntouchedSeededApproval,
  isUntouchedSeededProposal,
} from "./lib/seedRecords";
import {
  PatchArtifactDetail,
  PatchArtifactList,
} from "./features/proposed-changes/PatchArtifacts";
import {
  agentRuns as mockAgentRuns,
  emptyRepository,
  mockApprovalRequests,
  mockProposedChanges,
  proposedChangePlans as mockProposedChangePlans,
  provider,
  sectionEyebrows,
  sectionHeaders,
  settingsRows,
  statusTone,
  workspace,
} from "./lib/appData";
import {
  resolveApprovalRepositoryId,
  scopeRecordsToRepository,
} from "./lib/repositoryScoping";
import {
  mergeSeedApprovalRequests,
  mergeSeedProposedChanges,
  preserveInMemoryValidation,
  reconcileAgentRunApprovalStatuses,
} from "./lib/seedMerging";
import {
  approvalRiskTone,
  approvalStatusTone,
  changeKindTone,
  fileNameFromPath,
  formatGitRefreshedAt,
  formatRecordTimestamp,
  patchArtifactTone,
  repositoryTone,
  riskTone,
  stepStatusTone,
} from "./lib/uiState";
import {
  loadApprovalRequests,
  saveApprovalRequest,
  deleteApprovalRequestById,
  saveApprovalRequests,
  updateApprovalRequestStatus,
} from "./storage/approvalRequestStore";
import {
  loadAgentRunRecords,
  saveAgentRunRecord,
} from "./storage/agentRunStore";
import { previewRepositoryFile } from "./storage/filePreview";
import { scanRepositoryFileTree } from "./storage/fileTreeScanner";
import { loadGitFileDiff, loadGitStatusSummary } from "./storage/gitChanges";
import { loadRepositoriesGitMetadata } from "./storage/gitMetadata";
import {
  applyApprovedPatchArtifact,
  PatchApplicationError,
  acknowledgePatchApplyAttempt,
  reconcileInterruptedPatchApplyAttempts,
  rollbackAppliedPatchArtifact,
} from "./storage/patchApplication";
import { dryRunGeneratedPatch } from "./storage/patchValidation";
import { loadRepositoryValidationSnapshot } from "./storage/repositoryValidationSnapshot";
import {
  loadIndexedFileFacts,
  replaceIndexedFileFacts,
} from "./storage/indexedFileStore";
import { loadIndexingJobs, saveIndexingJob } from "./storage/indexingJobStore";
import {
  loadProposedChanges,
  saveProposedChange,
  deleteProposedChangeById,
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
  type OpenAiConnectionDiagnostic,
  type OpenAiProviderConfiguration,
} from "./storage/providerRuntime";

function agentProviderName(providerId: AgentProviderId) {
  return providerId === "openai" ? "OpenAI" : "Mock Provider";
}

function formatProviderCheckTime(checkedAt: string) {
  const unixSeconds = Number(checkedAt);

  if (!Number.isFinite(unixSeconds)) {
    return checkedAt;
  }

  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function App() {
  // Review is the front door: the app enters through the approval surface,
  // where the product's decision lives, rather than a summary dashboard. The
  // one exception is an empty workspace, which has nothing to review -- it is
  // redirected to Repositories (the section that names the next action,
  // choosing a repository) once hydration confirms no repository is saved. The
  // redirect only fires while the user is still on this initial landing, so a
  // click during a slow hydrate is respected.
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("review");
  // Empty, not a fixture. Hydration's `catch` never calls `setRepositories`, so
  // whatever starts here survives a storage failure for the entire session --
  // and what used to start here was a fabricated repository with a real
  // absolute home path baked in. A failed hydrate left it active, named, and
  // branded as indexed, and every repository-scoped surface described it as
  // though a human had chosen it. Nothing is a repository until someone picks
  // one; `activeRepository` falls back to `emptyRepository` and says so.
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [repositoryPickerError, setRepositoryPickerError] = useState<
    string | null
  >(null);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [indexingJobs, setIndexingJobs] = useState<IndexingJob[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>(mockAgentRuns);
  const [proposedChangePlans, setProposedChangePlans] = useState<
    ProposedChangePlan[]
  >(mockProposedChangePlans);
  const [approvalRequests, setApprovalRequests] =
    useState<ApprovalRequest[]>(mockApprovalRequests);
  const [persistedProposedChanges, setPersistedProposedChanges] =
    useState<PersistedProposedChange[]>(mockProposedChanges);
  const [indexedFiles, setIndexedFiles] = useState<IndexedFileFact[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [agentTask, setAgentTask] = useState("");
  const [selectedAgentProviderId, setSelectedAgentProviderId] =
    useState<AgentProviderId>("mock");
  const [openAiProviderConfiguration, setOpenAiProviderConfiguration] =
    useState<OpenAiProviderConfiguration>({
      configured: false,
      model: "gpt-5.6-luna",
      reason: "Checking native provider configuration...",
    });
  const [openAiConfigurationState, setOpenAiConfigurationState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [openAiConnectionTestState, setOpenAiConnectionTestState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [openAiConnectionDiagnostic, setOpenAiConnectionDiagnostic] =
    useState<OpenAiConnectionDiagnostic | null>(null);
  const [agentExecutionState, setAgentExecutionState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [agentExecutionMessage, setAgentExecutionMessage] = useState(
    "Describe a task to create a review-only plan with the mock provider.",
  );
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
  const [selectedApprovalPatchArtifactId, setSelectedApprovalPatchArtifactId] =
    useState<string | null>(null);
  const [validatingPatchArtifactId, setValidatingPatchArtifactId] = useState<
    string | null
  >(null);
  const [applyingPatchArtifactId, setApplyingPatchArtifactId] = useState<
    string | null
  >(null);
  const [patchApplyFeedback, setPatchApplyFeedback] = useState<{
    artifactId: string;
    status: "success" | "error";
    message: string;
  } | null>(null);
  // The proof of a verified apply, carried to Changes so it can be the primary
  // content there rather than a pill left behind on the approval surface. Scoped
  // by repository id at the render site; cleared when the same artifact is rolled
  // back so the claim never outlives its truth.
  const [lastVerifiedApply, setLastVerifiedApply] = useState<{
    artifactId: string;
    repositoryId: string;
    path: string;
    appliedAt?: string;
    backupId?: string;
  } | null>(null);
  const [rollingBackPatchArtifactId, setRollingBackPatchArtifactId] = useState<
    string | null
  >(null);
  const [patchRollbackFeedback, setPatchRollbackFeedback] = useState<{
    artifactId: string;
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [acknowledgingApplyAttemptId, setAcknowledgingApplyAttemptId] =
    useState<string | null>(null);
  const [acknowledgeFeedback, setAcknowledgeFeedback] = useState<{
    artifactId: string;
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [patchApplyAttempts, setPatchApplyAttempts] = useState<
    PatchApplyAttempt[]
  >([]);
  const [currentFingerprintSnapshot, setCurrentFingerprintSnapshot] = useState<{
    artifactId: string;
    snapshot: RepositoryValidationSnapshot;
  } | null>(null);
  const [filePreview, setFilePreview] = useState<FileContentPreview | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [maintenanceReindexState, setMaintenanceReindexState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [maintenanceReindexMessage, setMaintenanceReindexMessage] = useState(
    "Ready to refresh indexed file facts for the selected repository.",
  );
  const [maintenanceReindexLastRunAt, setMaintenanceReindexLastRunAt] =
    useState<string | null>(null);

  // In-memory only, defaulting to the first saved repository.
  //
  // Persisting the selection needs a key-value store this app does not have --
  // every storage module is a purpose-built table -- so it is recorded as its
  // own roadmap item rather than half-built here. Without it a restart falls
  // back to the first repository, which is exactly today's behaviour: no
  // regression, one click to re-select.
  const [activeRepositoryId, setActiveRepositoryId] = useState<string | null>(
    null,
  );
  const hasActiveRepository = repositories.length > 0;
  const hasNativeRuntime = isTauriRuntime();
  // Falls back to the first repository when nothing is selected, or when the
  // selected one is gone: a selection that no longer resolves must not leave the
  // app pointing at a repository that does not exist.
  const activeRepository =
    repositories.find((repository) => repository.id === activeRepositoryId) ??
    repositories[0] ??
    emptyRepository;
  const scanTarget = summarizeScanTarget({
    path: activeRepository?.path ?? workspace.summary.name,
    includeGitState: true,
    includeDocumentation: true,
  });
  // Scoped by id, not position. `indexingJobs[0]` was a second hardcoded index
  // alongside `repositories[0]`: an indexing job carries the repository it
  // describes, and taking the first one rendered whichever repository indexed
  // most recently as though it were the active one.
  const activeIndexingJob = indexingJobs.find(
    (job) => job.repositoryId === activeRepository.id,
  );
  const savedRepositoryIds = useMemo(
    () => repositories.map((repository) => repository.id),
    [repositories],
  );
  // Approvals were repository-blind: they rendered every repository's work
  // under one repository's selector. An approval cannot answer which
  // repository it belongs to on its own -- it carries `repository` as a
  // display *name* -- so the durable link runs through the proposal. Records
  // whose link does not resolve are grouped, never dropped.
  const scopedApprovalRequests = useMemo(
    () =>
      scopeRecordsToRepository({
        records: approvalRequests,
        resolveRepositoryId: (approval) =>
          resolveApprovalRepositoryId(approval, persistedProposedChanges),
        activeRepositoryId: activeRepository.id,
        savedRepositoryIds,
      }),
    [
      activeRepository.id,
      approvalRequests,
      persistedProposedChanges,
      savedRepositoryIds,
    ],
  );
  const visibleApprovalRequests = useMemo(
    () => [
      ...scopedApprovalRequests.scoped,
      ...scopedApprovalRequests.unlinked,
    ],
    [scopedApprovalRequests],
  );
  const selectedApprovalRequest =
    visibleApprovalRequests.find(
      (approval) => approval.id === selectedApprovalRequestId,
    ) ??
    visibleApprovalRequests[0] ??
    null;
  const selectedApprovalIsScopedToRepository = visibleApprovalRequests.some(
    (approval) =>
      approval.id === selectedApprovalRequest?.id &&
      scopedApprovalRequests.scoped.includes(approval),
  );
  const selectedApprovalRun = selectedApprovalRequest
    ? (agentRuns.find((run) => run.id === selectedApprovalRequest.agentRunId) ??
      null)
    : null;
  const selectedApprovalPlan = selectedApprovalRequest
    ? (proposedChangePlans.find(
        (plan) => plan.runId === selectedApprovalRequest.agentRunId,
      ) ?? null)
    : null;
  const selectedApprovalProposedChange = selectedApprovalRequest
    ? (persistedProposedChanges.find(
        (change) =>
          change.approvalRequestId === selectedApprovalRequest.id ||
          change.runId === selectedApprovalRequest.agentRunId,
      ) ?? null)
    : null;
  // Two figures, deliberately. `pendingApprovalCount` is the workspace total
  // and is only rendered where it says so; the Approvals surfaces count the
  // list they sit above. A count that labels a scoped list must count that
  // list -- Overview disagreeing with Changes was exactly this shape.
  const pendingApprovalCount = approvalRequests.filter(
    (approval) => approval.status === "pending",
  ).length;
  const visiblePendingApprovalCount = visibleApprovalRequests.filter(
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
  // Live Git state is only evidence about the repository it was read from.
  //
  // Every derived value below used to read `gitStatusSummary` unconditionally,
  // which was correct only because the active repository was pinned to
  // `repositories[0]` and the summary could therefore only ever be its own.
  // Once the active repository can change there is a window -- an async refresh,
  // or an apply result arriving late -- where the summary in hand describes a
  // different repository than the one being named. These facts are then not just
  // rendered: they are sent to the provider as context describing the active
  // repository.
  //
  // So a mismatched summary is treated as no summary at all. It falls back to
  // the saved repository's own record, and the gates that cannot be answered
  // without live Git fall back to `unknown` -- never to the other repository's
  // numbers.
  const activeGitStatusSummary =
    gitStatusSummary?.repositoryId === activeRepository.id
      ? gitStatusSummary
      : null;
  // A destructive native operation targets the repository its proposal names,
  // and it re-derives everything from durable records -- so a switch cannot
  // misdirect the write. What a switch *can* do is move the surface out from
  // under the result: the operation would finish and report against a
  // repository the user is no longer looking at. Blocked while in flight.
  const isPatchOperationInFlight = Boolean(
    applyingPatchArtifactId || rollingBackPatchArtifactId,
  );
  const effectiveChangedFileCount =
    activeGitStatusSummary?.changedFileCount ?? activeRepository.openChanges;
  const effectiveBranch =
    activeGitStatusSummary?.branch ?? activeRepository.branch;
  const isWorkingDirectoryClean =
    activeGitStatusSummary?.isClean ?? activeRepository.openChanges === 0;
  // Only surface the proof for the repository the operator is actually looking
  // at. The write targets the repository its proposal names, so a switch must
  // not let one repository's verification render over another's Git state.
  const activeVerifiedApply =
    lastVerifiedApply && lastVerifiedApply.repositoryId === activeRepository.id
      ? lastVerifiedApply
      : null;
  const applyReadinessWorkingTreeState = !hasActiveRepository
    ? ("unknown" as const)
    : gitStatusState === "ready" && activeGitStatusSummary
      ? activeGitStatusSummary.isClean
        ? ("clean" as const)
        : ("dirty" as const)
      : ("unknown" as const);
  const currentRepositoryValidationSnapshot: RepositoryValidationSnapshot | null =
    gitStatusState === "ready" && activeGitStatusSummary
      ? {
          repositoryId: activeGitStatusSummary.repositoryId,
          branch: activeGitStatusSummary.branch,
          headSha: activeGitStatusSummary.headSha,
          isClean: activeGitStatusSummary.isClean,
          changedFileCount: activeGitStatusSummary.changedFileCount,
          relevantFilePaths: [],
          capturedAt: activeGitStatusSummary.refreshedAt,
        }
      : null;
  const selectedGitChangedFile =
    activeGitStatusSummary?.files.find(
      (file) => file.path === selectedGitFilePath,
    ) ??
    activeGitStatusSummary?.files[0] ??
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
          activeGitStatusSummary?.files.find(
            (changedFile) => changedFile.path === file.path,
          ) ?? null,
      })),
    [approvalAffectedFiles, activeGitStatusSummary],
  );
  const approvalLocalDiffCount = approvalDiffEntries.filter(
    (entry) => entry.changedFile,
  ).length;
  const selectedApprovalDiffEntry =
    approvalDiffEntries.find(
      (entry) => entry.path === selectedApprovalDiffPath,
    ) ??
    approvalDiffEntries.find((entry) => entry.changedFile) ??
    approvalDiffEntries[0] ??
    null;
  const selectedApprovalChangedFile =
    selectedApprovalDiffEntry?.changedFile ?? null;
  const selectedApprovalPatchArtifact =
    selectedApprovalProposedChange?.patchArtifacts.find(
      (artifact) => artifact.id === selectedApprovalPatchArtifactId,
    ) ??
    selectedApprovalProposedChange?.patchArtifacts[0] ??
    null;
  const selectedApprovalPatchApplyAttempt =
    patchApplyAttempts.find(
      (attempt) =>
        attempt.patchArtifactId === selectedApprovalPatchArtifact?.id &&
        attempt.proposedChangeId === selectedApprovalProposedChange?.id,
    ) ?? null;
  // Review is the only surface with an apply lifecycle now (part 5 folded
  // Agent Runs in), so the readiness subject is always the selected approval's.
  const selectedReadinessArtifact = selectedApprovalPatchArtifact;
  const selectedReadinessChange = selectedApprovalProposedChange;
  const selectedReadinessRepositorySnapshot =
    currentFingerprintSnapshot &&
    currentFingerprintSnapshot.artifactId === selectedReadinessArtifact?.id
      ? currentFingerprintSnapshot.snapshot
      : currentRepositoryValidationSnapshot;
  const demoWorkflowRun =
    agentRuns.find((run) => run.id === demoWorkflow.runId) ?? null;
  const demoWorkflowApproval =
    approvalRequests.find(
      (approval) => approval.id === demoWorkflow.approvalRequestId,
    ) ?? null;
  const demoWorkflowProposal =
    persistedProposedChanges.find(
      (change) => change.id === demoWorkflow.proposedChangeId,
    ) ?? null;
  const demoWorkflowGeneratedArtifactCount =
    demoWorkflowProposal?.patchArtifacts.filter(
      (artifact) => artifact.status === "generated",
    ).length ?? 0;
  const demoWorkflowLocalDiffCount =
    demoWorkflowProposal?.files.filter((file) =>
      activeGitStatusSummary?.files.some(
        (changedFile) => changedFile.path === file.path,
      ),
    ).length ?? 0;
  const approvalMatchByPath = useMemo(() => {
    const matches = new Map<string, PersistedProposedChange>();

    for (const change of persistedProposedChanges) {
      if (!change.approvalRequestId) {
        continue;
      }

      for (const file of change.files) {
        matches.set(file.path, change);
      }
    }

    return matches;
  }, [persistedProposedChanges]);

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

  async function startAgentRun() {
    const task = agentTask.trim();
    const selectedProviderName = agentProviderName(selectedAgentProviderId);
    const runLabel =
      selectedAgentProviderId === "mock" ? "Mock" : selectedProviderName;

    if (!hasActiveRepository) {
      setAgentExecutionState("error");
      setAgentExecutionMessage(
        "Choose a repository before starting an agent run.",
      );
      return;
    }

    if (!task) {
      setAgentExecutionState("error");
      setAgentExecutionMessage(
        `Enter a task request for ${selectedProviderName}.`,
      );
      return;
    }

    if (selectedAgentProviderId === "mock" && provider.status !== "connected") {
      setAgentExecutionState("error");
      setAgentExecutionMessage("The mock provider is not connected.");
      return;
    }

    if (
      selectedAgentProviderId === "openai" &&
      !openAiProviderConfiguration.configured
    ) {
      setAgentExecutionState("error");
      setAgentExecutionMessage(
        openAiProviderConfiguration.reason ??
          "OpenAI is not configured for native plan generation.",
      );
      return;
    }

    setAgentExecutionState("running");
    setAgentExecutionMessage(
      selectedAgentProviderId === "openai"
        ? "OpenAI is creating a structured plan and review-only patch artifact states. No files will be written."
        : "Mock Provider is creating a structured review plan. No files will be written.",
    );

    const createdAt = new Date();
    const runId = `run-${createdAt.getTime()}`;
    // ISO, not a "Today, ..." display string: this flows into the run's
    // startedAt and the proposal's createdAt/updatedAt, which persist and must
    // sort chronologically. The display layer formats it (formatRecordTimestamp).
    const startedAt = createdAt.toISOString();

    try {
      const adapter =
        selectedAgentProviderId === "openai"
          ? createOpenAiAgentProviderAdapter({
              model: openAiProviderConfiguration.model,
              requestPlan: requestOpenAiPlan,
            })
          : createMockAgentProviderAdapter();
      const result = await executeAgentRun(
        {
          id: runId,
          repositoryId: activeRepository.id,
          repositoryName: activeRepository.name,
          task,
          context: {
            branch: effectiveBranch,
            indexedFilePaths: indexedFiles.map((file) => file.path),
            indexedFileCount: repositoryIntelligence.totalIndexedFiles,
            keyFiles: repositoryIntelligence.keyFiles.map((file) => file.path),
            projectFolders: repositoryIntelligence.projectFolders.map(
              (folder) => folder.name,
            ),
            topExtensions: repositoryIntelligence.topExtensions,
            git: {
              isGitRepository:
                activeGitStatusSummary?.isGitRepository ??
                activeRepository.isGitRepository,
              isClean: isWorkingDirectoryClean,
              changedFileCount: effectiveChangedFileCount,
            },
          },
          startedAt,
          createdAt: createdAt.toISOString(),
        },
        adapter,
      );

      setAgentRuns((currentRuns) => [
        result.run,
        ...currentRuns.filter((run) => run.id !== result.run.id),
      ]);
      setProposedChangePlans((currentPlans) => [
        result.plan,
        ...currentPlans.filter((plan) => plan.id !== result.plan.id),
      ]);
      setPersistedProposedChanges((currentChanges) => [
        result.proposedChange,
        ...currentChanges.filter(
          (change) => change.id !== result.proposedChange.id,
        ),
      ]);
      setApprovalRequests((currentRequests) => [
        result.approvalRequest,
        ...currentRequests.filter(
          (request) => request.id !== result.approvalRequest.id,
        ),
      ]);
      // Select the freshly-composed proposal so review continues on this same
      // surface without a navigation step (part 5).
      setSelectedApprovalRequestId(result.approvalRequest.id);
      setAgentTask("");

      let persistenceUnavailable = storageStatus !== "ready";

      if (!persistenceUnavailable) {
        const persistenceResults = await Promise.allSettled([
          saveAgentRunRecord({
            run: result.run,
            plan: result.plan,
            createdAt: result.createdAt,
          }),
          saveProposedChange(result.proposedChange),
          saveApprovalRequest(result.approvalRequest),
        ]);
        persistenceUnavailable = persistenceResults.some(
          (persistenceResult) => persistenceResult.status === "rejected",
        );
      }

      setAgentExecutionState("success");
      const generatedArtifactCount =
        result.proposedChange.patchArtifacts.filter(
          (artifact) => artifact.status === "generated",
        ).length;
      setAgentExecutionMessage(
        persistenceUnavailable
          ? `${runLabel} run created for this session. Native persistence is unavailable in the web preview.`
          : selectedAgentProviderId === "openai"
            ? `OpenAI run created and saved with ${generatedArtifactCount} generated patch artifact${generatedArtifactCount === 1 ? "" : "s"}. Review every proposal before approval.`
            : "Mock run created and saved. Review the structured plan before approving it.",
      );
    } catch (error) {
      setAgentExecutionState("error");
      setAgentExecutionMessage(
        error instanceof AgentProviderError
          ? error.message
          : `${selectedProviderName} could not create a run. No files or repository state were changed.`,
      );
    }
  }

  async function validatePatchArtifact(
    change: PersistedProposedChange,
    artifact: ProposedPatchArtifact,
  ) {
    if (validatingPatchArtifactId) {
      return;
    }

    const file = change.files.find(
      (candidate) => candidate.path === artifact.filePath,
    );

    if (!file) {
      return;
    }

    setValidatingPatchArtifactId(artifact.id);
    const validatedAt = new Date().toISOString();
    let artifactDigest = artifact.artifactDigest;

    if (artifact.rawDiff) {
      try {
        artifactDigest = await computePatchArtifactDigest(artifact.rawDiff);
      } catch {
        artifactDigest = undefined;
      }
    }

    let validation: PatchValidationResult = {
      ...validatePatchArtifactStructure(artifact, file),
      artifactDigest,
      validatedAt,
    };

    if (validation.status === "valid_structure") {
      if (!artifactDigest) {
        validation = {
          status: "valid_structure",
          message:
            "Patch structure is valid, but its SHA-256 digest is unavailable. Re-run validation in a supported runtime.",
          validatedAt,
        };
      } else if (
        !hasActiveRepository ||
        change.repositoryId !== activeRepository.id
      ) {
        validation = {
          status: "valid_structure",
          message:
            "Patch structure is valid. Select its linked repository to run the native Git dry-run.",
          artifactDigest,
          validatedAt,
        };
      } else {
        try {
          validation = await dryRunGeneratedPatch(
            activeRepository.id,
            activeRepository.path,
            artifact,
            file,
            artifactDigest,
            change.files.map((candidate) => candidate.path),
          );
        } catch {
          validation = {
            status: "valid_structure",
            message:
              "Patch structure is valid. The native Git dry-run is unavailable in this runtime.",
            artifactDigest,
            validatedAt,
          };
        }
      }
    }

    const nextChange: PersistedProposedChange = {
      ...change,
      patchArtifacts: change.patchArtifacts.map((candidate) =>
        candidate.id === artifact.id
          ? {
              ...candidate,
              validationStatus: validation.status,
              validationMessage: validation.message,
              artifactDigest,
              validatedArtifactDigest: validation.artifactDigest,
              validationRepositorySnapshot: validation.repositorySnapshot,
              validatedAt: validation.validatedAt,
              dryRunAt: validation.dryRunAt,
            }
          : candidate,
      ),
      updatedAt: validatedAt,
    };

    setPersistedProposedChanges((currentChanges) =>
      currentChanges.map((candidate) =>
        candidate.id === nextChange.id ? nextChange : candidate,
      ),
    );

    if (storageStatus === "ready") {
      try {
        await saveProposedChange(nextChange);
      } catch {
        setPersistedProposedChanges((currentChanges) =>
          currentChanges.map((candidate) =>
            candidate.id === nextChange.id
              ? {
                  ...candidate,
                  patchArtifacts: candidate.patchArtifacts.map(
                    (candidateArtifact) =>
                      candidateArtifact.id === artifact.id
                        ? {
                            ...candidateArtifact,
                            validationMessage: `${validation.message} The result could not be saved.`,
                          }
                        : candidateArtifact,
                  ),
                }
              : candidate,
          ),
        );
      }
    }

    if (validation.repositorySnapshot) {
      setCurrentFingerprintSnapshot({
        artifactId: artifact.id,
        snapshot: validation.repositorySnapshot,
      });
    }

    if (hasActiveRepository && change.repositoryId === activeRepository.id) {
      await refreshGitStatus(activeRepository);
    }

    setValidatingPatchArtifactId(null);
  }

  async function applyPatchArtifact(
    change: PersistedProposedChange,
    artifact: ProposedPatchArtifact,
    approvalRequest: ApprovalRequest,
    confirmationPhrase: string,
  ) {
    if (applyingPatchArtifactId) {
      return;
    }

    setApplyingPatchArtifactId(artifact.id);
    setPatchApplyFeedback(null);

    try {
      const result = await applyApprovedPatchArtifact(
        change.repositoryId,
        change.id,
        approvalRequest.id,
        artifact.id,
        confirmationPhrase,
      );
      const isVerifiedApply = result.status === "applied_verified";
      const appliedChange: PersistedProposedChange = {
        ...change,
        status: isVerifiedApply ? "applied" : "quarantine_required",
        patchArtifacts: change.patchArtifacts.map((candidate) =>
          candidate.id === artifact.id
            ? {
                ...candidate,
                applyStatus: result.status,
                appliedAt: result.appliedAt,
                appliedBy: "local_user",
                applyError: isVerifiedApply ? undefined : result.message,
                backupId: result.backupId,
                postApplyGitStatus: result.postApplyGitStatus,
                postApplyVerification: result.postApplyVerification,
              }
            : candidate,
        ),
        updatedAt: result.appliedAt,
      };

      setPersistedProposedChanges((currentChanges) =>
        currentChanges.map((candidate) =>
          candidate.id === appliedChange.id ? appliedChange : candidate,
        ),
      );
      // Belt and braces alongside the in-flight switch block: the derived
      // facts already fail closed on a repository-id mismatch, and switching is
      // blocked while this runs -- but a result must never install itself as the
      // live status of a repository it does not describe. One comparison.
      if (result.postApplyGitStatus.repositoryId === activeRepository.id) {
        setGitStatusSummary(result.postApplyGitStatus);
        setGitStatusState("ready");
      }
      setRepositories((currentRepositories) =>
        currentRepositories.map((repository) =>
          repository.id === result.postApplyGitStatus.repositoryId
            ? {
                ...repository,
                branch: result.postApplyGitStatus.branch ?? repository.branch,
                openChanges: result.postApplyGitStatus.changedFileCount,
              }
            : repository,
        ),
      );
      setCurrentFingerprintSnapshot(null);
      setPatchApplyFeedback({
        artifactId: artifact.id,
        status: isVerifiedApply ? "success" : "error",
        message: result.message,
      });
      // Proof is the destination. A verified apply lands the operator in Changes
      // on real read-only Git state, with the exact-path verification as the
      // primary content rather than a pill on the surface they just left. A
      // quarantined result keeps them on the approval surface, where the recovery
      // evidence and acknowledgement live.
      if (isVerifiedApply) {
        setLastVerifiedApply({
          artifactId: artifact.id,
          repositoryId: change.repositoryId,
          path:
            result.postApplyVerification.expectedPaths.join(", ") ||
            artifact.filePath,
          appliedAt: result.appliedAt,
          backupId: result.backupId,
        });
        setActiveSection("working-tree");
      }

      try {
        const attempts = await reconcileInterruptedPatchApplyAttempts();
        const savedChanges = await loadProposedChanges();
        const hydratedChanges = await Promise.all(
          savedChanges.map(ensureProposedPatchArtifactDigests),
        );
        setPatchApplyAttempts(attempts);
        setPersistedProposedChanges(hydratedChanges);
      } catch {
        // The native result remains visible even if the follow-up reload fails.
      }
    } catch (error) {
      try {
        const attempts = await reconcileInterruptedPatchApplyAttempts();
        const savedChanges = await loadProposedChanges();
        const hydratedChanges = await Promise.all(
          savedChanges.map(ensureProposedPatchArtifactDigests),
        );
        setPatchApplyAttempts(attempts);
        setPersistedProposedChanges(hydratedChanges);
      } catch {
        // Keep the sanitized native error visible if recovery state cannot reload.
      }
      setPatchApplyFeedback({
        artifactId: artifact.id,
        status: "error",
        message:
          error instanceof PatchApplicationError
            ? error.message
            : "The native patch application failed safely. Review validation and repository state before retrying.",
      });
    } finally {
      setApplyingPatchArtifactId(null);
    }
  }

  /**
   * Switches the active repository.
   *
   * Every repository-scoped slot is cleared before the new repository's data
   * arrives. The alternative -- leaving the previous repository's files, diffs,
   * and previews in place until an async reload replaces them -- renders one
   * repository's contents under another's name for as long as the load takes.
   * The derived Git facts already fail closed on a repository-id mismatch; this
   * clears the slots that carry no id to check.
   *
   * Git status reloads through the effect keyed on the active repository's id.
   * Indexed files do not: they were loaded once at hydrate for the first
   * repository, so they are reloaded here explicitly.
   */
  async function switchActiveRepository(repositoryId: string) {
    if (repositoryId === activeRepository.id || isPatchOperationInFlight) {
      return;
    }

    setActiveRepositoryId(repositoryId);
    setGitStatusSummary(null);
    setGitStatusState("idle");
    setSelectedGitFilePath(null);
    setGitFileDiff(null);
    setGitFileDiffState("idle");
    setSelectedApprovalDiffPath(null);
    setApprovalGitFileDiff(null);
    setApprovalGitFileDiffState("idle");
    setCurrentFingerprintSnapshot(null);
    setIndexedFiles([]);
    setSelectedFilePath(null);
    setFilePreview(null);
    setFileSearch("");
    setExtensionFilter("all");

    const selectedRepository = repositories.find(
      (repository) => repository.id === repositoryId,
    );

    // Selection is the only step between choosing a repository and its indexed
    // facts. A repository that has never been indexed is indexed here -- no
    // control sits between select and indexed. Reindex stays an explicit action
    // for refreshing one that is already indexed, so an already-indexed
    // repository restores its persisted facts rather than re-scanning on every
    // switch.
    if (selectedRepository && selectedRepository.status !== "indexed") {
      await startIndexingJob(selectedRepository);
      return;
    }

    try {
      const savedFiles = await loadIndexedFileFacts(repositoryId);
      setIndexedFiles(savedFiles);
      setSelectedFilePath(savedFiles[0]?.path ?? null);
    } catch {
      // An unreadable index leaves no files rather than the previous
      // repository's.
      setIndexedFiles([]);
      setSelectedFilePath(null);
    }
  }

  /**
   * Builds the display-only rollback context for an artifact.
   *
   * Derived in one place so Agent Runs and Approval Review cannot disagree about
   * whether a patch is rollbackable — the same class of split-brain that made
   * Overview and Changes disagree about clean.
   */
  function rollbackEligibilityContextFor(
    change: PersistedProposedChange | null | undefined,
    artifact: ProposedPatchArtifact | null | undefined,
    attempt: PatchApplyAttempt | null | undefined,
  ) {
    if (!change || !artifact) {
      return null;
    }

    const repositoryMatches = Boolean(
      hasActiveRepository && change.repositoryId === activeRepository.id,
    );

    return {
      attempt: attempt ?? null,
      // Only the live status for the matching repository may speak about this
      // target; another repository's status would be evidence about the wrong
      // tree.
      currentGitStatus:
        repositoryMatches &&
        gitStatusSummary?.repositoryId === change.repositoryId
          ? gitStatusSummary
          : null,
      currentRepositorySnapshot:
        currentFingerprintSnapshot?.artifactId === artifact.id
          ? currentFingerprintSnapshot.snapshot
          : null,
      hasDurableStorage: storageStatus === "ready",
      isNativeRuntime: hasNativeRuntime,
      operation:
        change.files.find((file) => file.path === artifact.filePath)
          ?.operation ?? "unknown",
      repositoryMatches,
    };
  }

  /**
   * Restores one verified apply from its app-local pre-apply backup.
   *
   * React sends durable IDs and the exact phrase only — never the path, the
   * bytes, or a Git argument. Native reloads every record, re-derives every
   * precondition, and decides. A `quarantine_required` result is a real outcome
   * rather than an error: the write happened and could not be proven, so it is
   * surfaced as loudly as a failure and the artifact stays ineligible.
   */
  async function rollbackPatchArtifact(
    change: PersistedProposedChange,
    artifact: ProposedPatchArtifact,
    confirmationPhrase: string,
  ) {
    if (rollingBackPatchArtifactId) {
      return;
    }

    setRollingBackPatchArtifactId(artifact.id);
    setPatchRollbackFeedback(null);

    try {
      const result = await rollbackAppliedPatchArtifact(
        change.repositoryId,
        change.id,
        artifact.id,
        confirmationPhrase,
      );
      const isVerifiedRollback = result.status === "rolled_back";
      const rolledBackChange: PersistedProposedChange = {
        ...change,
        status: isVerifiedRollback ? "rolled_back" : "quarantine_required",
        patchArtifacts: change.patchArtifacts.map((candidate) =>
          candidate.id === artifact.id
            ? {
                ...candidate,
                applyStatus: result.status,
                rolledBackAt: result.rolledBackAt,
                rolledBackBy: "local_user",
                applyError: isVerifiedRollback ? undefined : result.message,
                rollbackBackupId: result.rollbackBackupId,
                postApplyGitStatus: result.postRollbackGitStatus,
                postRollbackVerification: result.postRollbackVerification,
              }
            : candidate,
        ),
        updatedAt: result.rolledBackAt,
      };

      setPersistedProposedChanges((currentChanges) =>
        currentChanges.map((candidate) =>
          candidate.id === rolledBackChange.id ? rolledBackChange : candidate,
        ),
      );
      if (result.postRollbackGitStatus.repositoryId === activeRepository.id) {
        setGitStatusSummary(result.postRollbackGitStatus);
        setGitStatusState("ready");
      }
      setRepositories((currentRepositories) =>
        currentRepositories.map((repository) =>
          repository.id === result.postRollbackGitStatus.repositoryId
            ? {
                ...repository,
                branch:
                  result.postRollbackGitStatus.branch ?? repository.branch,
                openChanges: result.postRollbackGitStatus.changedFileCount,
              }
            : repository,
        ),
      );
      setCurrentFingerprintSnapshot(null);
      setPatchRollbackFeedback({
        artifactId: artifact.id,
        status: isVerifiedRollback ? "success" : "error",
        message: result.message,
      });
      // A rolled-back artifact's apply is no longer true; retract its Changes
      // proof so the destination cannot keep claiming a write that was undone.
      if (isVerifiedRollback) {
        setLastVerifiedApply((current) =>
          current?.artifactId === artifact.id ? null : current,
        );
      }
    } catch (error) {
      setPatchRollbackFeedback({
        artifactId: artifact.id,
        status: "error",
        message:
          error instanceof PatchApplicationError
            ? error.message
            : "The native rollback failed safely. Nothing was restored. Review repository state before retrying.",
      });
    } finally {
      // Durable state is reloaded on every path, including refusals: a refusal
      // may have been caused by state this app has not seen yet.
      try {
        const attempts = await reconcileInterruptedPatchApplyAttempts();
        const savedChanges = await loadProposedChanges();
        const hydratedChanges = await Promise.all(
          savedChanges.map(ensureProposedPatchArtifactDigests),
        );
        setPatchApplyAttempts(attempts);
        setPersistedProposedChanges(hydratedChanges);
      } catch {
        // The native result stays visible even if the follow-up reload fails.
      }
      setRollingBackPatchArtifactId(null);
    }
  }

  /**
   * Records that a human inspected an unresolved apply attempt. React sends the
   * durable attempt ID and the exact phrase only; native code re-checks both and
   * remains the authority. This never applies, retries, or rolls anything back,
   * and the artifact stays permanently ineligible for application.
   */
  async function acknowledgeApplyAttempt(
    attempt: PatchApplyAttempt,
    confirmationPhrase: string,
  ) {
    if (acknowledgingApplyAttemptId) {
      return;
    }

    setAcknowledgingApplyAttemptId(attempt.applyAttemptId);
    setAcknowledgeFeedback(null);

    try {
      const result = await acknowledgePatchApplyAttempt(
        attempt.applyAttemptId,
        confirmationPhrase,
      );

      setAcknowledgeFeedback({
        artifactId: attempt.patchArtifactId,
        status: "success",
        message: result.message,
      });

      try {
        const attempts = await reconcileInterruptedPatchApplyAttempts();
        setPatchApplyAttempts(attempts);
      } catch {
        // The native result stays visible even if the follow-up reload fails.
      }
    } catch (error) {
      setAcknowledgeFeedback({
        artifactId: attempt.patchArtifactId,
        status: "error",
        message:
          error instanceof PatchApplicationError
            ? error.message
            : "The inspection could not be recorded. No patch state changed.",
      });
    } finally {
      setAcknowledgingApplyAttemptId(null);
    }
  }

  function openDemoApprovalReview() {
    setSelectedApprovalRequestId(demoWorkflow.approvalRequestId);
    setActiveSection("review");
  }

  function openDemoChangeReview() {
    const firstMatchingFile = demoWorkflowProposal?.files.find((file) =>
      activeGitStatusSummary?.files.some(
        (changedFile) => changedFile.path === file.path,
      ),
    );

    if (firstMatchingFile) {
      setSelectedGitFilePath(firstMatchingFile.path);
    }

    setActiveSection("working-tree");
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
    if (!activeGitStatusSummary || activeGitStatusSummary.files.length === 0) {
      setSelectedGitFilePath(null);
      return;
    }

    const selectedFileStillExists = activeGitStatusSummary.files.some(
      (file) => file.path === selectedGitFilePath,
    );

    if (!selectedFileStillExists) {
      setSelectedGitFilePath(activeGitStatusSummary.files[0].path);
    }
  }, [activeGitStatusSummary, selectedGitFilePath]);

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

    async function loadCurrentFingerprintSnapshot() {
      if (
        activeSection !== "review" ||
        !hasActiveRepository ||
        !selectedReadinessArtifact?.artifactDigest ||
        !selectedReadinessArtifact.validationRepositorySnapshot
          ?.repositorySnapshotDigest ||
        !selectedReadinessChange ||
        selectedReadinessChange.repositoryId !== activeRepository.id
      ) {
        setCurrentFingerprintSnapshot(null);
        return;
      }

      try {
        const snapshot = await loadRepositoryValidationSnapshot(
          activeRepository.id,
          activeRepository.path,
          selectedReadinessArtifact.artifactDigest,
          selectedReadinessChange.files.map((file) => file.path),
        );

        if (isMounted) {
          setCurrentFingerprintSnapshot({
            artifactId: selectedReadinessArtifact.id,
            snapshot,
          });
        }
      } catch {
        if (isMounted) {
          setCurrentFingerprintSnapshot(null);
        }
      }
    }

    void loadCurrentFingerprintSnapshot();

    return () => {
      isMounted = false;
    };
  }, [
    activeRepository.id,
    activeRepository.path,
    activeSection,
    activeGitStatusSummary?.refreshedAt,
    hasActiveRepository,
    selectedReadinessArtifact?.artifactDigest,
    selectedReadinessArtifact?.id,
    selectedReadinessArtifact?.validationRepositorySnapshot
      ?.repositorySnapshotDigest,
    selectedReadinessChange,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadSelectedApprovalDiff() {
      if (
        activeSection !== "review" ||
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

    async function loadProviderConfiguration() {
      try {
        const configuration = await loadOpenAiProviderConfiguration();

        if (isMounted) {
          setOpenAiProviderConfiguration(configuration);
          setOpenAiConfigurationState("ready");
        }
      } catch {
        if (isMounted) {
          setOpenAiProviderConfiguration({
            configured: false,
            model: "gpt-5.6-luna",
            reason:
              "OpenAI planning requires the native Tauri app and OPENAI_API_KEY.",
          });
          setOpenAiConfigurationState("unavailable");
        }
      }
    }

    void loadProviderConfiguration();

    return () => {
      isMounted = false;
    };
  }, []);

  // The front door is Review, but an empty workspace has nothing to review, so
  // it lands on the next-action section instead. Only redirect while the user
  // is still on the initial Review landing: a navigation during a slow hydrate
  // must not be yanked back.
  function redirectEmptyWorkspaceToRepositories() {
    setActiveSection((current) =>
      current === "review" ? "repositories" : current,
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateRepositories() {
      try {
        const savedRepositories = await loadSavedRepositories();
        const savedIndexingJobs = await loadIndexingJobs();
        const savedAgentRunRecords = await loadAgentRunRecords();
        const savedApprovalRequests = await loadApprovalRequests();
        const savedProposedChanges = await loadProposedChanges();

        if (!isMounted) {
          return;
        }

        // Past versions wrote demo fixtures into storage on every launch, with
        // no user action, into the same tables as real records. Remove the ones
        // nobody ever decided on. A fixture carrying a human decision or apply
        // evidence is retained: the subject is fabricated, the act is not.
        const purgedApprovalIds = new Set<string>();
        const purgedProposalIds = new Set<string>();

        for (const request of savedApprovalRequests) {
          if (isUntouchedSeededApproval(request)) {
            try {
              await deleteApprovalRequestById(request.id);
              purgedApprovalIds.add(request.id);
            } catch {
              // A failed purge is not fatal: the record stays marked on display.
            }
          }
        }
        for (const change of savedProposedChanges) {
          if (isUntouchedSeededProposal(change)) {
            try {
              await deleteProposedChangeById(change.id);
              purgedProposalIds.add(change.id);
            } catch {
              // A failed purge is not fatal: the record stays marked on display.
            }
          }
        }

        const retainedApprovalRequests = savedApprovalRequests.filter(
          (request) => !purgedApprovalIds.has(request.id),
        );
        const retainedProposedChanges = savedProposedChanges.filter(
          (change) => !purgedProposalIds.has(change.id),
        );

        setIndexingJobs(savedIndexingJobs);
        const savedRunIds = new Set(
          savedAgentRunRecords.map((record) => record.run.id),
        );
        const savedPlanIds = new Set(
          savedAgentRunRecords.map((record) => record.plan.id),
        );
        const hydratedAgentRuns =
          savedAgentRunRecords.length > 0
            ? [
                ...savedAgentRunRecords.map((record) => record.run),
                ...mockAgentRuns.filter((run) => !savedRunIds.has(run.id)),
              ]
            : mockAgentRuns;
        const hydratedPlans =
          savedAgentRunRecords.length > 0
            ? [
                ...savedAgentRunRecords.map((record) => record.plan),
                ...mockProposedChangePlans.filter(
                  (plan) => !savedPlanIds.has(plan.id),
                ),
              ]
            : mockProposedChangePlans;
        const hydratedApprovalRequests =
          retainedApprovalRequests.length > 0
            ? mergeSeedApprovalRequests(retainedApprovalRequests)
            : mockApprovalRequests;
        setAgentRuns(
          reconcileAgentRunApprovalStatuses(
            hydratedAgentRuns,
            hydratedApprovalRequests,
          ),
        );
        setProposedChangePlans(hydratedPlans);
        setApprovalRequests(hydratedApprovalRequests);

        const mergedProposedChanges =
          retainedProposedChanges.length > 0
            ? mergeSeedProposedChanges(retainedProposedChanges)
            : mockProposedChanges;
        // Hydration must not write. It merges demo fixtures for display only;
        // persisting them put fixtures into the same tables as real records
        // where nothing distinguished them afterwards.
        const hydratedProposedChanges = await Promise.all(
          mergedProposedChanges.map(ensureProposedPatchArtifactDigests),
        );
        let reconciledProposedChanges = hydratedProposedChanges;
        if (hasNativeRuntime) {
          try {
            const attempts = await reconcileInterruptedPatchApplyAttempts();
            const savedAfterReconciliation = await loadProposedChanges();
            reconciledProposedChanges = await Promise.all(
              savedAfterReconciliation.map(ensureProposedPatchArtifactDigests),
            );
            setPatchApplyAttempts(attempts);
          } catch {
            setPatchApplyAttempts([]);
          }
        }
        setPersistedProposedChanges(reconciledProposedChanges);

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
          // Empty workspace: send the operator to the section that names the
          // next action rather than the empty Review front door.
          redirectEmptyWorkspaceToRepositories();
        }

        setStorageStatus("ready");
      } catch {
        if (!isMounted) {
          return;
        }

        setStorageStatus("unavailable");
        // A failed hydrate leaves the workspace empty (repositories stays []),
        // so it too lands on the next-action section, not the Review door.
        redirectEmptyWorkspaceToRepositories();
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

  useEffect(() => {
    if (
      !hasNativeRuntime ||
      storageStatus !== "ready" ||
      activeSection !== "review"
    ) {
      return;
    }

    let isMounted = true;

    async function reconcileApplyAttemptsForReview() {
      try {
        const attempts = await reconcileInterruptedPatchApplyAttempts();
        const savedChanges = await loadProposedChanges();
        const hydratedChanges = await Promise.all(
          savedChanges.map(ensureProposedPatchArtifactDigests),
        );

        if (isMounted) {
          setPatchApplyAttempts(attempts);
          // Preserve a validation this reload raced: the checks run on the same
          // review-open, and their durable result must not be reverted by a
          // read that landed before the check wrote it (#4d).
          setPersistedProposedChanges((currentChanges) =>
            preserveInMemoryValidation(hydratedChanges, currentChanges),
          );
        }
      } catch {
        // Existing persisted state remains visible when diagnostics are unavailable.
      }
    }

    void reconcileApplyAttemptsForReview();

    return () => {
      isMounted = false;
    };
  }, [activeSection, hasNativeRuntime, storageStatus]);

  async function selectRepositories() {
    setRepositoryPickerError(null);

    let selectedPaths: string[] | null;

    try {
      selectedPaths = await pickRepositoryDirectories();
    } catch (error) {
      setRepositoryPickerError(
        error instanceof RepositoryPickerError &&
          error.code === "browser_runtime"
          ? "Repository selection is available in the native Tauri app. The web preview cannot open local folders."
          : "The native repository picker could not open. Restart the desktop app and try again.",
      );
      setActiveSection("repositories");
      return;
    }

    if (!selectedPaths) {
      return;
    }

    try {
      const selectedRepositories = await loadRepositoriesGitMetadata(
        selectedPaths.map((path) => createRepositorySummaryFromPath(path)),
      );

      const currentRepositories = repositories;
      const existingPaths = new Set(
        currentRepositories.map((repository) => repository.path),
      );
      const addedRepositories = selectedRepositories.filter(
        (repository) => !existingPaths.has(repository.path),
      );
      const nextRepositories = [...currentRepositories, ...addedRepositories];

      setRepositories(nextRepositories);
      await saveRepositories(nextRepositories);
      setStorageStatus("ready");
      setActiveSection("repositories");

      // When the workspace had no repository, the one just chosen becomes the
      // active repository by fallback, so choosing it *is* selecting it.
      // Selection starts indexing, so its facts are built here with no control
      // in between -- the same merge of select and index the saved-repository
      // list performs on switch. Adding to an existing workspace does not change
      // the active repository, so those repositories index when later selected.
      const firstSelectedRepository = addedRepositories[0];
      if (currentRepositories.length === 0 && firstSelectedRepository) {
        await startIndexingJob(firstSelectedRepository, nextRepositories);
      }
    } catch {
      setRepositoryPickerError(
        "The repository was selected, but the workspace could not save it. Check native storage access and try again.",
      );
      setActiveSection("repositories");
    }
  }

  // `baseRepositories` is the list the indexed-status update is applied to. It
  // defaults to the `repositories` state, but a caller that has just added a
  // repository (the picker) must pass the fresh list: the `repositories`
  // closure still holds the pre-add value, and mapping over it would drop the
  // repository this job is indexing.
  async function startIndexingJob(
    repository: RepositorySummary,
    baseRepositories: RepositorySummary[] = repositories,
  ) {
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
      const nextRepositories = baseRepositories.map((currentRepository) =>
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
      return true;
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
      return false;
    }
  }

  async function runMaintenanceReindex() {
    if (!hasActiveRepository) {
      setMaintenanceReindexState("error");
      setMaintenanceReindexMessage("Choose a repository before reindexing.");
      return;
    }

    setMaintenanceReindexState("running");
    setMaintenanceReindexMessage(
      "Reindexing repository facts through the safe indexing boundary.",
    );

    const didReindex = await startIndexingJob(activeRepository);

    if (didReindex) {
      setMaintenanceReindexState("success");
      setMaintenanceReindexMessage(
        "Repository intelligence refreshed from indexed file facts.",
      );
      setMaintenanceReindexLastRunAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      return;
    }

    setMaintenanceReindexState("error");
    setMaintenanceReindexMessage(
      "Reindex failed. No repository files were changed.",
    );
  }

  async function runOpenAiConnectionTest() {
    if (!openAiProviderConfiguration.configured) {
      setOpenAiConnectionTestState("error");
      setOpenAiConnectionDiagnostic({
        status: "not_configured",
        configured: false,
        model: openAiProviderConfiguration.model,
        checkedAt: String(Math.floor(Date.now() / 1000)),
        message:
          openAiProviderConfiguration.reason ??
          "OpenAI is not configured in the native environment.",
      });
      return;
    }

    setOpenAiConnectionTestState("running");
    setOpenAiConnectionDiagnostic(null);

    try {
      const diagnostic = await testOpenAiConnection();
      setOpenAiConnectionDiagnostic(diagnostic);
      setOpenAiConnectionTestState(
        diagnostic.status === "connected" ? "success" : "error",
      );
    } catch {
      setOpenAiConnectionDiagnostic({
        status: "unavailable",
        configured: openAiProviderConfiguration.configured,
        model: openAiProviderConfiguration.model,
        checkedAt: String(Math.floor(Date.now() / 1000)),
        message:
          "The native OpenAI connection test is unavailable. No credentials were exposed.",
      });
      setOpenAiConnectionTestState("error");
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

    // Persist the decision before the UI claims it. This was the only mutation
    // path that set UI state before -- and without guarding -- its write, so a
    // rejected write left the surface asserting an "approved" that SQLite never
    // held. When storage is unavailable the session is in-memory only, so there
    // is nothing durable to fail and the UI update is the state.
    if (storageStatus === "ready") {
      try {
        await updateApprovalRequestStatus(approvalId, status);
        if (updatedProposal) {
          await saveProposedChanges([updatedProposal]);
        }
      } catch {
        // The durable write failed: leave the decision unrecorded. The request
        // stays pending and its Approve/Reject controls stay live for a retry,
        // rather than the UI claiming a decision that did not persist.
        return;
      }
    }

    setApprovalRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === approvalId ? { ...request, status } : request,
      ),
    );
    const linkedApproval = approvalRequests.find(
      (request) => request.id === approvalId,
    );
    if (linkedApproval) {
      setAgentRuns((currentRuns) =>
        reconcileAgentRunApprovalStatuses(currentRuns, [
          { ...linkedApproval, status },
        ]),
      );
    }
    if (updatedProposal) {
      setPersistedProposedChanges((currentChanges) =>
        currentChanges.map((change) =>
          change.id === updatedProposal.id ? updatedProposal : change,
        ),
      );
    }
  }

  // Shared by the scoped list and the unlinked group so the two cannot drift
  // into rendering a record differently depending on which one it landed in.
  function renderApprovalRow(approval: ApprovalRequest) {
    const linkedRun = agentRuns.find((run) => run.id === approval.agentRunId);
    // The pill states the user's obligation, not the record's internal state:
    // a pending request is work the user owes ("Needs you"); a proposal that
    // carries no patch is not an apply the user can perform ("No patch").
    const linkedChange = persistedProposedChanges.find(
      (change) =>
        change.approvalRequestId === approval.id ||
        change.runId === approval.agentRunId,
    );
    const hasReviewablePatch = Boolean(
      linkedChange?.patchArtifacts.some((artifact) => artifact.rawDiff),
    );
    const obligation =
      approval.status === "pending"
        ? "Needs you"
        : hasReviewablePatch
          ? approval.status
          : "No patch";

    return (
      <button
        aria-current={
          selectedApprovalRequest?.id === approval.id ? "true" : undefined
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
            {linkedRun?.title ?? "No linked run"} · {approval.files.length}{" "}
            files · {formatRecordTimestamp(approval.createdAt)}
          </small>
        </span>
        <span className="approval-queue-item__status">
          <StatusPill
            tone={approvalStatusTone(approval.status)}
            size="sm"
            showDot={false}
          >
            {obligation}
          </StatusPill>
          <StatusPill
            tone={approvalRiskTone(approval.risk)}
            size="sm"
            showDot={false}
          >
            {approval.risk} risk
          </StatusPill>
          {isSeededRecordId(approval.id) ? (
            <StatusPill tone="agent" size="sm" showDot={false}>
              Demo record
            </StatusPill>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <AppShell
      // Every surviving section is a feature surface. `workspace--overview`
      // existed for the one dashboard section, which part 4 deleted.
      workspaceClassName="workspace--feature"
      sidebar={
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          pendingApprovalCount={visiblePendingApprovalCount}
        />
      }
    >
      <AppHeader
        compact
        description={sectionHeaders[activeSection].description}
        eyebrow={sectionEyebrows[activeSection]}
        onChooseRepository={selectRepositories}
        pendingApprovalCount={visiblePendingApprovalCount}
        providerName={agentProviderName(selectedAgentProviderId)}
        title={sectionHeaders[activeSection].title}
      />

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
                  Workspace context derived from saved repository metadata, Git
                  state, and indexed file facts.
                </p>

                <div className="active-path-box tab-path-box">
                  <Icon name="folder" />
                  <div>
                    <span>Local path</span>
                    <strong>{activeRepository.path}</strong>
                  </div>
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
                    <dd>
                      {activeRepository.lastIndexedAt ?? "Not indexed yet"}
                    </dd>
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
                      <dd>
                        {activeIndexingJob?.status ?? activeRepository.status}
                      </dd>
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
                      onClick={() => setActiveSection("working-tree")}
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
                      onClick={() => setActiveSection("review")}
                    >
                      Propose a change
                    </SecondaryButton>
                    <SecondaryButton
                      icon="changes"
                      onClick={() => setActiveSection("working-tree")}
                    >
                      View changes
                    </SecondaryButton>
                  </div>
                </article>

                <article className="overview-card demo-workflow-card">
                  <div className="overview-card__header">
                    <div>
                      <p className="card-eyebrow">Demo workflow</p>
                      <h3>Continue review workflow</h3>
                    </div>
                    <StatusPill tone="warning" size="sm">
                      safe demo
                    </StatusPill>
                  </div>
                  <p>
                    Follow the seeded MVP path from repository intelligence to
                    agent run, persisted proposed change, approval review,
                    generated patch artifact states, and matching local Git
                    diffs when available.
                  </p>
                  <dl className="demo-workflow-facts">
                    <div>
                      <dt>Agent Run</dt>
                      <dd>{demoWorkflowRun?.title ?? "Not available"}</dd>
                    </div>
                    <div>
                      <dt>Proposed Change</dt>
                      <dd>
                        {demoWorkflowProposal
                          ? `${demoWorkflowProposal.id} · ${demoWorkflowProposal.status.replaceAll("_", " ")}`
                          : "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt>Generated Artifacts</dt>
                      <dd>
                        {demoWorkflowGeneratedArtifactCount} generated ·{" "}
                        {demoWorkflowProposal?.patchArtifacts.length ?? 0} total
                      </dd>
                    </div>
                    <div>
                      <dt>Matching Local Diffs</dt>
                      <dd>{demoWorkflowLocalDiffCount} available</dd>
                    </div>
                  </dl>
                  <div className="demo-workflow-actions">
                    <PrimaryButton
                      disabled={!demoWorkflowApproval}
                      icon="approval"
                      onClick={openDemoApprovalReview}
                    >
                      Continue review workflow
                    </PrimaryButton>
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
                  {isPatchOperationInFlight ? (
                    <p className="repository-list__blocked" role="status">
                      A patch operation is running. Switching repositories is
                      unavailable until it finishes, so its result cannot land
                      under a different repository's name.
                    </p>
                  ) : null}
                  <div className="repository-list" aria-label="Saved repositories">
                    {repositories.map((repository) => {
                      const isActive = repository.id === activeRepository.id;

                      return (
                        <button
                          aria-current={isActive ? "true" : undefined}
                          className={`repository-list-item repository-list-item--button ${
                            isActive ? "is-active" : ""
                          }`}
                          disabled={isPatchOperationInFlight}
                          key={repository.id}
                          onClick={() => {
                            void switchActiveRepository(repository.id);
                          }}
                          type="button"
                        >
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
                            {isActive
                              ? "active"
                              : repository.status.replace("_", " ")}
                          </StatusPill>
                        </button>
                      );
                    })}
                  </div>
                </article>
              </aside>
            </>
          )}
        </section>
      ) : null}

      {activeSection === "review" ? (
        <section className="approvals-dashboard">
          {/*
            Compose lives on Review now (part 5). Agent Runs was a separate
            destination; the noun implied a loop that does not exist, so it was
            folded in rather than renamed. Proposing a change and deciding on it
            are one flow, so they share one surface. `startAgentRun` is unchanged
            -- only the form that calls it moved.
          */}
          <article className="overview-card agent-run-create-card">
            <div className="overview-card__header">
              <div>
                <p className="card-eyebrow">Propose a change</p>
                <h2>Start with {agentProviderName(selectedAgentProviderId)}</h2>
              </div>
              <StatusPill
                tone={
                  agentExecutionState === "success"
                    ? "success"
                    : agentExecutionState === "error"
                      ? "danger"
                      : agentExecutionState === "running"
                        ? "warning"
                        : "agent"
                }
                size="sm"
              >
                {agentExecutionState === "running"
                  ? "planning"
                  : selectedAgentProviderId === "openai"
                    ? openAiProviderConfiguration.configured
                      ? "configured"
                      : "not configured"
                    : provider.status}
              </StatusPill>
            </div>

            <form
              className="agent-run-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void startAgentRun();
              }}
            >
              <label className="agent-run-provider-field">
                <span>Planning provider</span>
                <select
                  aria-describedby="agent-provider-availability"
                  aria-label="Agent provider"
                  disabled={agentExecutionState === "running"}
                  onChange={(event) => {
                    setSelectedAgentProviderId(
                      event.target.value as AgentProviderId,
                    );
                    setAgentExecutionState("idle");
                    setAgentExecutionMessage(
                      event.target.value === "openai"
                        ? "OpenAI generates a structured plan from bounded repository facts only."
                        : "Describe a task to create a review-only plan with the mock provider.",
                    );
                  }}
                  value={selectedAgentProviderId}
                >
                  <option value="mock">Mock Provider</option>
                  <option
                    disabled={!openAiProviderConfiguration.configured}
                    value="openai"
                  >
                    OpenAI · {openAiProviderConfiguration.model}
                  </option>
                </select>
                <small id="agent-provider-availability">
                  {openAiConfigurationState === "loading"
                    ? "Checking native OpenAI configuration..."
                    : openAiProviderConfiguration.configured
                      ? "OpenAI is configured for plan generation only."
                      : openAiProviderConfiguration.reason}
                </small>
              </label>
              <label className="agent-run-task-field">
                <span>Task request</span>
                <textarea
                  aria-describedby="agent-run-execution-status"
                  aria-label="Agent task request"
                  maxLength={1200}
                  onChange={(event) => setAgentTask(event.target.value)}
                  placeholder="Describe a change to propose…"
                  rows={3}
                  value={agentTask}
                />
              </label>
              <div className="agent-run-create-actions">
                <div className="status-row compact">
                  <StatusPill tone="success" size="sm">
                    {agentProviderName(selectedAgentProviderId)}
                  </StatusPill>
                  <StatusPill
                    tone={hasActiveRepository ? "context" : "warning"}
                    size="sm"
                  >
                    {hasActiveRepository
                      ? activeRepository.name
                      : "repository required"}
                  </StatusPill>
                </div>
                <PrimaryButton
                  disabled={
                    !hasActiveRepository ||
                    (selectedAgentProviderId === "mock"
                      ? provider.status !== "connected"
                      : !openAiProviderConfiguration.configured) ||
                    agentExecutionState === "running"
                  }
                  icon="play"
                  type="submit"
                >
                  {agentExecutionState === "running"
                    ? "Creating plan..."
                    : "Propose"}
                </PrimaryButton>
              </div>
            </form>

            <p
              className={`agent-run-execution-status agent-run-execution-status--${agentExecutionState}`}
              id="agent-run-execution-status"
              role="status"
            >
              {agentExecutionMessage}
            </p>
            {/*
              Demo vs real provider, kept where the compose form makes the choice.
              The demo returns one fixed patch that creates airlock-demo.md so
              apply and rollback are exercisable for real; it does not author
              changes to your own code -- that needs a real provider.
            */}
            <p className="provider-context-card__distinction">
              Demo Provider is a demo, not a model. It returns one fixed patch
              that creates airlock-demo.md so you can exercise apply and rollback
              for real; proposing changes to your own code needs a real provider
              such as OpenAI.
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
                  {visibleApprovalRequests.length} total
                </StatusPill>
              </div>

              <div className="approval-queue-list">
                {scopedApprovalRequests.scoped.length > 0 ? (
                  scopedApprovalRequests.scoped.map(renderApprovalRow)
                ) : (
                  <p className="record-list-empty">
                    No approval belongs to this repository.
                  </p>
                )}
                {scopedApprovalRequests.unlinked.length > 0 ? (
                  <div
                    aria-label="Not linked to a saved repository"
                    className="record-list-group"
                    role="group"
                  >
                    <p className="record-list-group__label">
                      Not linked to a saved repository
                    </p>
                    {scopedApprovalRequests.unlinked.map(renderApprovalRow)}
                  </div>
                ) : null}
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

                <p className="tab-card-copy">
                  {selectedApprovalRequest.summary}
                </p>

                <dl className="tab-fact-grid approval-detail-fact-grid">
                  <div>
                    <dt>Linked Agent Run</dt>
                    <dd>{selectedApprovalRun?.title ?? "Not linked"}</dd>
                  </div>
                  <div>
                    <dt>Provider / Model</dt>
                    <dd>
                      {selectedApprovalRun
                        ? `${agentProviderName(selectedApprovalRun.providerId)} · ${selectedApprovalRun.model}`
                        : "Not available"}
                    </dd>
                  </div>
                  <div>
                    <dt>Repository</dt>
                    <dd>{selectedApprovalRequest.repository}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>
                      {selectedApprovalIsScopedToRepository
                        ? activeRepository.branch
                        : "Not linked to a saved repository"}
                    </dd>
                  </div>
                  <div>
                    <dt>Risk</dt>
                    <dd>{selectedApprovalRequest.risk}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatRecordTimestamp(selectedApprovalRequest.createdAt)}</dd>
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

                {selectedApprovalRequest.id ===
                demoWorkflow.approvalRequestId ? (
                  <div className="approval-review-section demo-workflow-inline">
                    <div className="overview-card__header">
                      <div>
                        <p className="card-eyebrow">Demo workflow</p>
                        <h3>Connected MVP review path</h3>
                      </div>
                      <StatusPill tone="warning" size="sm">
                        seeded demo
                      </StatusPill>
                    </div>
                    <p>
                      This approval links one seeded agent run, one persisted
                      proposed change, generated patch artifact states, and{" "}
                      {demoWorkflowLocalDiffCount} matching local Git diff
                      {demoWorkflowLocalDiffCount === 1 ? "" : "s"} when
                      repository paths match exactly.
                    </p>
                    <div className="demo-workflow-actions">
                      <SecondaryButton
                        icon="changes"
                        onClick={openDemoChangeReview}
                      >
                        Inspect local diffs
                      </SecondaryButton>
                    </div>
                  </div>
                ) : null}

                <div className="approval-review-section">
                  <div className="plan-section__header">
                    <IconBadge icon="file" tone="accent" size="md" />
                    <div>
                      <p className="card-eyebrow">Affected Files</p>
                      <h3>Files requiring review</h3>
                    </div>
                  </div>
                  <div
                    className="file-list"
                    aria-label="Files requiring review"
                  >
                    {selectedApprovalRequest.files.map((file) => (
                      <span key={file}>{file}</span>
                    ))}
                  </div>
                </div>

                {/*
                  The structured plan folded in from the retired Agent Runs
                  destination (part 5). A proposal now carries its own plan on
                  the surface where it is decided, so review does not require
                  navigating away to see what was proposed.
                */}
                {selectedApprovalPlan ? (
                  <div className="approval-review-section approval-plan-section">
                    <div className="plan-section__header">
                      <IconBadge icon="index" tone="context" size="md" />
                      <div>
                        <p className="card-eyebrow">Proposed Plan</p>
                        <h3>Structured implementation plan</h3>
                      </div>
                    </div>
                    <p className="tab-card-copy">
                      {selectedApprovalPlan.summary}
                    </p>
                    <div className="proposed-plan-grid">
                      <section className="plan-section plan-steps-section">
                        <div className="plan-section__header">
                          <IconBadge icon="index" tone="context" size="sm" />
                          <div>
                            <p className="card-eyebrow">Implementation Steps</p>
                            <h4>Ordered plan</h4>
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

                      <section className="plan-section plan-risk-section">
                        <div className="plan-section__header">
                          <IconBadge icon="approval" tone="warning" size="sm" />
                          <div>
                            <p className="card-eyebrow">Risk Summary</p>
                            <h4>Known risks</h4>
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
                    </div>
                  </div>
                ) : null}

                <div className="approval-review-section provider-context-card">
                  <div className="plan-section__header">
                    <IconBadge icon="agent" tone="agent" size="md" />
                    <div>
                      <p className="card-eyebrow">Provider Context</p>
                      <h3>
                        {selectedApprovalRun
                          ? agentProviderName(selectedApprovalRun.providerId)
                          : "Provider not linked"}
                      </h3>
                    </div>
                  </div>
                  <p>
                    {selectedApprovalRun?.providerId === "openai"
                      ? "OpenAI produced validated review records from bounded repository context. Generated artifacts are proposals only and remain separate from local Git diffs."
                      : "The deterministic demo provider is connected for local planning and approval rehearsal. It returns one fixed demo patch and does not author changes to your own code."}
                  </p>
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
                    {selectedApprovalRequest.status === "pending" ? (
                      <p className="approval-decision-hint">
                        Apply unlocks after approval
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : null}

            <aside className="approval-side-column">
              <article className="overview-card patch-artifact-card">
                <div className="overview-card__header">
                  <div>
                    <p className="card-eyebrow">Generated Patch Artifacts</p>
                    <h3>Patch artifact review</h3>
                  </div>
                  <StatusPill tone="neutral" size="sm" showDot={false}>
                    {selectedApprovalProposedChange?.patchArtifacts.length ?? 0}{" "}
                    records
                  </StatusPill>
                </div>
                <p>
                  These are provider-generated proposals or honest placeholder
                  states, separate from local Git diffs. Applied artifacts are
                  labeled and retain their native backup reference.
                </p>
                <PatchArtifactList
                  artifacts={
                    selectedApprovalProposedChange?.patchArtifacts ?? []
                  }
                  onSelectArtifact={setSelectedApprovalPatchArtifactId}
                  selectedArtifactId={selectedApprovalPatchArtifact?.id}
                />
                <PatchArtifactDetail
                  applyAttempt={selectedApprovalPatchApplyAttempt}
                  applyReadinessContext={{
                    approvalStatus: selectedApprovalRequest?.status ?? null,
                    hasDurableStorage: storageStatus === "ready",
                    hasSelectedRepository: hasActiveRepository,
                    isNativeRuntime: hasNativeRuntime,
                    repositoryMatches: Boolean(
                      hasActiveRepository &&
                      selectedApprovalProposedChange?.repositoryId ===
                        activeRepository.id,
                    ),
                    currentRepositorySnapshot:
                      selectedReadinessRepositorySnapshot,
                    workingTreeState: applyReadinessWorkingTreeState,
                  }}
                  applyFeedback={
                    patchApplyFeedback?.artifactId ===
                    selectedApprovalPatchArtifact?.id
                      ? patchApplyFeedback
                      : null
                  }
                  acknowledgeFeedback={
                    acknowledgeFeedback?.artifactId ===
                    selectedApprovalPatchArtifact?.id
                      ? acknowledgeFeedback
                      : null
                  }
                  artifact={selectedApprovalPatchArtifact}
                  isAcknowledging={
                    selectedApprovalPatchApplyAttempt?.applyAttemptId ===
                    acknowledgingApplyAttemptId
                  }
                  isApplying={
                    selectedApprovalPatchArtifact?.id ===
                    applyingPatchArtifactId
                  }
                  isRollingBack={
                    selectedApprovalPatchArtifact?.id ===
                    rollingBackPatchArtifactId
                  }
                  rollbackEligibilityContext={rollbackEligibilityContextFor(
                    selectedApprovalProposedChange,
                    selectedApprovalPatchArtifact,
                    selectedApprovalPatchApplyAttempt,
                  )}
                  rollbackFeedback={
                    patchRollbackFeedback?.artifactId ===
                    selectedApprovalPatchArtifact?.id
                      ? patchRollbackFeedback
                      : null
                  }
                  onRollback={(confirmationPhrase) => {
                    if (
                      selectedApprovalProposedChange &&
                      selectedApprovalPatchArtifact
                    ) {
                      void rollbackPatchArtifact(
                        selectedApprovalProposedChange,
                        selectedApprovalPatchArtifact,
                        confirmationPhrase,
                      );
                    }
                  }}
                  onAcknowledge={
                    selectedApprovalPatchApplyAttempt
                      ? (confirmationPhrase) => {
                          void acknowledgeApplyAttempt(
                            selectedApprovalPatchApplyAttempt,
                            confirmationPhrase,
                          );
                        }
                      : undefined
                  }
                  isRunningChecks={
                    selectedApprovalPatchArtifact?.id ===
                    validatingPatchArtifactId
                  }
                  onApply={(confirmationPhrase) => {
                    if (
                      selectedApprovalProposedChange &&
                      selectedApprovalPatchArtifact &&
                      selectedApprovalRequest
                    ) {
                      void applyPatchArtifact(
                        selectedApprovalProposedChange,
                        selectedApprovalPatchArtifact,
                        selectedApprovalRequest,
                        confirmationPhrase,
                      );
                    }
                  }}
                  onRunChecks={() => {
                    if (
                      selectedApprovalProposedChange &&
                      selectedApprovalPatchArtifact
                    ) {
                      void validatePatchArtifact(
                        selectedApprovalProposedChange,
                        selectedApprovalPatchArtifact,
                      );
                    }
                  }}
                />
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
                  This shows matching local Git diffs. Generated patch artifacts
                  remain separate and are not represented by these repository
                  diffs.
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
                    <dd>
                      {approvalDiffEntries.length - approvalLocalDiffCount}
                    </dd>
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
                          onClick={() =>
                            setSelectedApprovalDiffPath(entry.path)
                          }
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
                          This approval does not have proposed affected files to
                          match against local Git status.
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

      {activeSection === "working-tree" ? (
        <section className="changes-dashboard">
          {activeVerifiedApply ? (
            <article
              className="overview-card changes-verification-card"
              aria-label="Post-apply verification"
            >
              <div className="changes-verification-card__mark">
                <Icon name="approval" />
              </div>
              <div>
                <p className="card-eyebrow">Post-apply verification</p>
                <h2>
                  Applied {activeVerifiedApply.path} — nothing was staged or
                  committed
                </h2>
                <p>
                  Airlock's native verification confirmed that only the approved
                  path changed on disk. Nothing was staged and nothing was
                  committed; Git history is untouched.
                  {activeVerifiedApply.appliedAt
                    ? ` Applied at ${activeVerifiedApply.appliedAt}.`
                    : ""}
                  {activeVerifiedApply.backupId
                    ? ` Pre-apply backup: ${activeVerifiedApply.backupId}.`
                    : " Backup reference unavailable."}
                </p>
              </div>
            </article>
          ) : null}
          <article className="overview-card changes-hero-card">
            <div className="changes-hero-card__content">
              <div className="changes-hero-card__mark">
                <Icon name="changes" />
              </div>
              <div>
                <p className="card-eyebrow">Change Review</p>
                <h2>
                  {effectiveChangedFileCount > 0
                    ? `${effectiveChangedFileCount} local ${effectiveChangedFileCount === 1 ? "change" : "changes"} waiting for review`
                    : "No local changes waiting for review"}
                </h2>
                <p>
                  Change review now reads real Git status for the selected
                  repository and can show read-only local diffs for changed
                  files.
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
                onClick={() => setActiveSection("review")}
              >
                Propose a change
              </SecondaryButton>
            </div>
          </article>

          <article className="overview-card changes-status-card">
            <div className="overview-card__header">
              <div>
                <p className="card-eyebrow">Repository Status</p>
                <h3>{activeRepository.name}</h3>
              </div>
              <StatusPill
                tone={isWorkingDirectoryClean ? "success" : "warning"}
              >
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
                  {activeGitStatusSummary
                    ? `${activeGitStatusSummary.stagedCount} / ${activeGitStatusSummary.unstagedCount}`
                    : "Not refreshed"}
                </dd>
              </div>
              <div>
                <dt>Last Refreshed</dt>
                <dd>
                  {formatGitRefreshedAt(activeGitStatusSummary?.refreshedAt)}
                </dd>
              </div>
            </dl>
          </article>

          {demoWorkflowProposal ? (
            <article className="overview-card demo-workflow-card changes-demo-card">
              <div className="overview-card__header">
                <div>
                  <p className="card-eyebrow">Demo workflow</p>
                  <h3>Approval-linked local change review</h3>
                </div>
                <StatusPill
                  tone={demoWorkflowLocalDiffCount > 0 ? "success" : "neutral"}
                  size="sm"
                >
                  {demoWorkflowLocalDiffCount} matching local diff
                  {demoWorkflowLocalDiffCount === 1 ? "" : "s"}
                </StatusPill>
              </div>
              <p>
                Local Git diffs remain repository state. They are only shown as
                related to the demo approval when their paths exactly match
                proposed affected files.
              </p>
              <div className="demo-workflow-actions">
                <SecondaryButton
                  icon="approval"
                  onClick={openDemoApprovalReview}
                >
                  Review approval
                </SecondaryButton>
              </div>
            </article>
          ) : null}

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
                    : activeGitStatusSummary?.isGitRepository === false
                      ? "warning"
                      : "neutral"
                }
                size="sm"
              >
                {gitStatusState === "error"
                  ? "unavailable"
                  : activeGitStatusSummary?.isGitRepository === false
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
            ) : activeGitStatusSummary &&
              activeGitStatusSummary.files.length > 0 ? (
              <div className="git-review-layout">
                <div className="git-change-list" aria-label="Changed files">
                  {activeGitStatusSummary.files.map((file) => {
                    const isSelected =
                      selectedGitChangedFile?.path === file.path;
                    const matchingProposal = approvalMatchByPath.get(file.path);

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
                          {file.oldPath ? (
                            <span>Renamed from {file.oldPath}</span>
                          ) : null}
                          {matchingProposal ? (
                            <span>
                              Matches approval review · {matchingProposal.title}
                            </span>
                          ) : null}
                        </div>
                        <span className="git-change-stage">{file.stage}</span>
                        {matchingProposal ? (
                          <StatusPill tone="agent" size="sm" showDot={false}>
                            matches approval
                          </StatusPill>
                        ) : null}
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
            ) : null}
          </article>
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
                const isProviderAdapters = row.title === "Provider adapters";
                const value = isProviderAdapters
                  ? openAiProviderConfiguration.configured
                    ? `OpenAI · ${openAiProviderConfiguration.model}`
                    : "Mock Provider only"
                  : row.title === "Local storage"
                    ? storageStatus
                    : row.title === "Indexing policy"
                      ? scanTarget.includes.join(", ")
                      : `${pendingApprovalCount} pending (all repositories)`;
                const isIndexingPolicy = row.title === "Indexing policy";
                const action = isProviderAdapters
                  ? () => {
                      void runOpenAiConnectionTest();
                    }
                  : isIndexingPolicy
                    ? () => {
                        void runMaintenanceReindex();
                      }
                    : row.title === "Approval defaults"
                      ? () => setActiveSection("review")
                      : undefined;
                const providerStatus =
                  openAiConnectionTestState === "running"
                    ? "testing"
                    : (openAiConnectionDiagnostic?.status.replaceAll(
                        "_",
                        " ",
                      ) ??
                      (openAiProviderConfiguration.configured
                        ? "configured"
                        : "not configured"));
                const providerStatusTone =
                  openAiConnectionTestState === "running"
                    ? "warning"
                    : openAiConnectionDiagnostic?.status === "connected"
                      ? "success"
                      : openAiConnectionDiagnostic
                        ? "danger"
                        : openAiProviderConfiguration.configured
                          ? "context"
                          : "neutral";
                const providerDiagnosticMessage = openAiConnectionDiagnostic
                  ? `${openAiConnectionDiagnostic.message} Model ${openAiConnectionDiagnostic.model}.${
                      openAiConnectionDiagnostic.latencyMs === undefined
                        ? ""
                        : ` ${openAiConnectionDiagnostic.latencyMs} ms.`
                    } Checked ${formatProviderCheckTime(openAiConnectionDiagnostic.checkedAt)}.`
                  : openAiConfigurationState === "loading"
                    ? "Checking native provider configuration."
                    : openAiProviderConfiguration.configured
                      ? "Credential source: native environment. Connection not tested in this session."
                      : (openAiProviderConfiguration.reason ??
                        "OpenAI is not configured in the native environment.");

                return (
                  <div className="settings-row" key={row.title}>
                    <IconBadge icon={row.icon} tone="context" size="md" />
                    <div className="settings-row__content">
                      <h3>{row.title}</h3>
                      <p>{row.description}</p>
                      {isProviderAdapters ? (
                        <div
                          className="provider-connection-status"
                          id="provider-connection-status"
                          role="status"
                        >
                          <StatusPill
                            tone={providerStatusTone}
                            size="sm"
                            showDot={false}
                          >
                            {providerStatus}
                          </StatusPill>
                          <span>{providerDiagnosticMessage}</span>
                        </div>
                      ) : null}
                    </div>
                    <span className="settings-row__value">{value}</span>
                    <SecondaryButton
                      disabled={
                        !action ||
                        (isProviderAdapters &&
                          (!openAiProviderConfiguration.configured ||
                            openAiConnectionTestState === "running")) ||
                        (isIndexingPolicy && !hasActiveRepository)
                      }
                      onClick={action}
                    >
                      {isProviderAdapters
                        ? openAiConnectionTestState === "running"
                          ? "Testing..."
                          : "Test connection"
                        : row.action}
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
              <div className="maintenance-action">
                <IconBadge icon="index" tone="accent" size="md" />
                <div className="maintenance-action__body">
                  <div className="maintenance-action__title-row">
                    <h3>Reindex selected repository</h3>
                    <StatusPill
                      tone={
                        maintenanceReindexState === "success"
                          ? "success"
                          : maintenanceReindexState === "error"
                            ? "danger"
                            : maintenanceReindexState === "running"
                              ? "warning"
                              : "neutral"
                      }
                      size="sm"
                    >
                      {maintenanceReindexState === "running"
                        ? "running"
                        : maintenanceReindexState}
                    </StatusPill>
                  </div>
                  <p>
                    Refresh indexed file facts and repository intelligence for
                    the selected repository without writing to project files.
                  </p>
                  <p className="maintenance-action__note">
                    {maintenanceReindexMessage}
                    {maintenanceReindexLastRunAt
                      ? ` Last run ${maintenanceReindexLastRunAt}.`
                      : ""}
                  </p>
                </div>
                <PrimaryButton
                  disabled={
                    !hasActiveRepository ||
                    maintenanceReindexState === "running"
                  }
                  icon="index"
                  onClick={() => {
                    void runMaintenanceReindex();
                  }}
                >
                  {maintenanceReindexState === "running"
                    ? "Reindexing..."
                    : "Reindex repository"}
                </PrimaryButton>
              </div>

            </div>
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
