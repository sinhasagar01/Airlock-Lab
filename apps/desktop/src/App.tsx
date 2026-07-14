import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type PersistedProposedChange,
  type ProposedChangeFileOperation,
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
  SummaryCard,
  StatusBadge,
  StatusPill,
} from "@ai-dev/ui";
import { AppHeader, AppShell, Sidebar } from "./components/AppShell";
import { GitDiffPreviewPanel } from "./features/changes/GitDiffPreviewPanel";
import { demoWorkflow } from "./features/demo-workflow/demoWorkflow";
import { IndexedFileBrowser } from "./features/file-preview/IndexedFileBrowser";
import {
  PatchArtifactDetail,
  PatchArtifactList,
} from "./features/proposed-changes/PatchArtifacts";
import {
  agentRuns,
  changeFeatureBlocks,
  dashboardActivity,
  emptyRepository,
  mockApprovalRequests,
  mockProposedChanges,
  mockRepositories,
  proposedChangePlans,
  provider,
  quickStartItems,
  sectionEyebrows,
  sectionHeaders,
  settingsRows,
  statusTone,
  workspace,
} from "./lib/appData";
import { mergeSeedApprovalRequests, mergeSeedProposedChanges } from "./lib/seedMerging";
import {
  agentRunTone,
  approvalRiskTone,
  approvalStatusTone,
  changeKindTone,
  fileNameFromPath,
  formatGitRefreshedAt,
  patchArtifactTone,
  proposedChangeStatusTone,
  repositoryTone,
  riskTone,
  stepStatusTone,
} from "./lib/uiState";
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
  const [maintenanceReindexState, setMaintenanceReindexState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [maintenanceReindexMessage, setMaintenanceReindexMessage] = useState(
    "Ready to refresh indexed file facts for the selected repository.",
  );
  const [maintenanceReindexLastRunAt, setMaintenanceReindexLastRunAt] =
    useState<string | null>(null);
  const [resetConfirmationText, setResetConfirmationText] = useState("");

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
      gitStatusSummary?.files.some((changedFile) => changedFile.path === file.path),
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

  function openDemoAgentRun() {
    setSelectedAgentRunId(demoWorkflow.runId);
    setActiveSection("agents");
  }

  function openDemoApprovalReview() {
    setSelectedAgentRunId(demoWorkflow.runId);
    setSelectedApprovalRequestId(demoWorkflow.approvalRequestId);
    setActiveSection("approvals");
  }

  function openDemoChangeReview() {
    const firstMatchingFile = demoWorkflowProposal?.files.find((file) =>
      gitStatusSummary?.files.some((changedFile) => changedFile.path === file.path),
    );

    if (firstMatchingFile) {
      setSelectedGitFilePath(firstMatchingFile.path);
    }

    setActiveSection("changes");
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
        const hydratedApprovalRequests =
          savedApprovalRequests.length > 0
            ? mergeSeedApprovalRequests(savedApprovalRequests)
            : mockApprovalRequests;
        setApprovalRequests(hydratedApprovalRequests);
        await saveApprovalRequests(hydratedApprovalRequests);

        const hydratedProposedChanges =
          savedProposedChanges.length > 0
            ? mergeSeedProposedChanges(savedProposedChanges)
            : mockProposedChanges;
        setPersistedProposedChanges(hydratedProposedChanges);
        await saveProposedChanges(hydratedProposedChanges);

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

  function renderIndexedFileBrowser(variant: "compact" | "full") {
    return (
      <IndexedFileBrowser
        activeRepository={activeRepository}
        extensionCounts={extensionCounts}
        extensionFilter={extensionFilter}
        filePreview={filePreview}
        fileSearch={fileSearch}
        filteredIndexedFiles={filteredIndexedFiles}
        indexedFiles={indexedFiles}
        isPreviewLoading={isPreviewLoading}
        onExtensionFilterChange={setExtensionFilter}
        onFileSearchChange={setFileSearch}
        onSelectedFilePathChange={setSelectedFilePath}
        selectedIndexedFile={selectedIndexedFile}
        variant={variant}
      />
    );
  }

  return (
    <AppShell
      workspaceClassName={
        activeSection === "overview"
          ? "workspace--overview"
          : "workspace--feature"
      }
      sidebar={
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          pendingApprovalCount={pendingApprovalCount}
        />
      }
    >
        <AppHeader
          compact={activeSection !== "overview"}
          description={sectionHeaders[activeSection].description}
          eyebrow={sectionEyebrows[activeSection]}
          onChooseRepository={selectRepositories}
          pendingApprovalCount={pendingApprovalCount}
          providerName={provider.displayName}
          title={sectionHeaders[activeSection].title}
        />

        <section
          className={`overview-grid${
            activeSection === "overview" ? "" : " overview-grid--compact"
          }`}
          aria-label="Workspace metrics"
        >
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
                        disabled={!demoWorkflowRun}
                        icon="play"
                        onClick={openDemoAgentRun}
                      >
                        Continue review workflow
                      </PrimaryButton>
                      <SecondaryButton
                        disabled={!demoWorkflowApproval}
                        icon="approval"
                        onClick={openDemoApprovalReview}
                      >
                        Review approval
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
                      {run.id === demoWorkflow.runId ? (
                        <StatusPill tone="agent" size="sm" showDot={false}>
                          demo workflow
                        </StatusPill>
                      ) : null}
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

              {activeAgentRun.id === demoWorkflow.runId ? (
                <div className="agent-detail-section demo-workflow-inline">
                  <div className="overview-card__header">
                    <p className="card-eyebrow">Demo workflow</p>
                    <StatusPill tone="warning" size="sm">
                      seeded path
                    </StatusPill>
                  </div>
                  <p>
                    This run is linked to persisted proposal{" "}
                    <strong>{demoWorkflowProposal?.id ?? "not available"}</strong>
                    , approval{" "}
                    <strong>{demoWorkflowApproval?.id ?? "not available"}</strong>
                    , generated patch artifact records, and matching local Git
                    diffs when the same paths appear in Git status.
                  </p>
                </div>
              ) : null}

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

                  <section className="plan-section plan-files-section">
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

                  <section className="plan-section plan-artifacts-section">
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

                  <section className="plan-section plan-risk-section">
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

                  <section className="plan-section plan-validation-section">
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
                  {activeAgentRun.id === demoWorkflow.runId ? (
                    <SecondaryButton icon="changes" onClick={openDemoChangeReview}>
                      Inspect local diffs
                    </SecondaryButton>
                  ) : null}
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
                          {approval.id === demoWorkflow.approvalRequestId ? (
                            <StatusPill tone="agent" size="sm" showDot={false}>
                              demo workflow
                            </StatusPill>
                          ) : null}
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

                  {selectedApprovalRequest.id === demoWorkflow.approvalRequestId ? (
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
                        <SecondaryButton icon="play" onClick={openDemoAgentRun}>
                          Open agent run
                        </SecondaryButton>
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
                  Local Git diffs remain repository state. They are only shown
                  as related to the demo approval when their paths exactly match
                  proposed affected files.
                </p>
                <div className="demo-workflow-actions">
                  <SecondaryButton icon="approval" onClick={openDemoApprovalReview}>
                    Review approval
                  </SecondaryButton>
                  <SecondaryButton icon="play" onClick={openDemoAgentRun}>
                    Open agent run
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
                            {file.oldPath ? <span>Renamed from {file.oldPath}</span> : null}
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
                  const isIndexingPolicy = row.title === "Indexing policy";
                  const action = isIndexingPolicy
                    ? () => {
                        void runMaintenanceReindex();
                      }
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
                        disabled={!action || (isIndexingPolicy && !hasActiveRepository)}
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

                <div className="maintenance-action">
                  <IconBadge icon="database" tone="neutral" size="md" />
                  <div className="maintenance-action__body">
                    <div className="maintenance-action__title-row">
                      <h3>Clear workspace caches</h3>
                      <StatusPill tone="neutral" size="sm">
                        unavailable
                      </StatusPill>
                    </div>
                    <p>
                      Cache clearing is unavailable until cache boundaries are
                      formalized.
                    </p>
                    <p className="maintenance-action__note">
                      No local cache delete command exists yet, so this action
                      stays disabled instead of guessing what data is safe to
                      remove.
                    </p>
                  </div>
                  <SecondaryButton disabled icon="database">
                    Clear workspace caches
                  </SecondaryButton>
                </div>

                <div className="maintenance-action maintenance-action--danger">
                  <IconBadge icon="settings" tone="danger" size="md" />
                  <div className="maintenance-action__body">
                    <div className="maintenance-action__title-row">
                      <h3>Reset workspace</h3>
                      <StatusPill tone="danger" size="sm">
                        guarded
                      </StatusPill>
                    </div>
                    <p>
                      Reset workspace is destructive app-local maintenance only;
                      it must never touch repository files or mutate Git state.
                    </p>
                    <label className="maintenance-confirmation">
                      <span>Type RESET WORKSPACE to confirm</span>
                      <input
                        aria-label="Type RESET WORKSPACE to confirm reset"
                        autoComplete="off"
                        onChange={(event) =>
                          setResetConfirmationText(event.target.value)
                        }
                        placeholder="RESET WORKSPACE"
                        value={resetConfirmationText}
                      />
                    </label>
                    <p className="maintenance-action__note">
                      Reset is unavailable until app-local delete boundaries are
                      formalized. The confirmation phrase is shown now so the
                      future destructive path is explicitly gated.
                    </p>
                  </div>
                  <SecondaryButton className="danger-action" disabled>
                    Reset workspace
                  </SecondaryButton>
                </div>
              </div>
            </article>
          </section>
        ) : null}
    </AppShell>
  );
}
