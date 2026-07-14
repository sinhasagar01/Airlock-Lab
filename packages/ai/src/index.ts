export type ProviderCapability = {
  id: string;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
};

export type ProviderAdapter = {
  id: string;
  displayName: string;
  capabilities: ProviderCapability[];
  status: "connected" | "disconnected" | "limited";
};

export type AgentProviderId = "mock" | "openai" | "anthropic" | "local";

export type AgentProviderCapabilities = {
  supportsPlanGeneration: boolean;
  supportsPatchGeneration: boolean;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
};

export type AgentProviderErrorCode =
  | "not_configured"
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "invalid_input"
  | "invalid_output"
  | "request_failed";

export class AgentProviderError extends Error {
  constructor(
    public readonly code: AgentProviderErrorCode,
    public readonly providerId: AgentProviderId,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AgentProviderError";
  }
}

export type AgentRunExtensionSummary = {
  extension: string;
  count: number;
};

export type AgentRunGitContext = {
  isGitRepository: boolean;
  isClean: boolean;
  changedFileCount: number;
};

export type AgentRunContext = {
  branch: string;
  indexedFilePaths: string[];
  indexedFileCount?: number;
  keyFiles?: string[];
  projectFolders?: string[];
  topExtensions?: AgentRunExtensionSummary[];
  git?: AgentRunGitContext;
};

export type CreateAgentPlanInput = {
  runId: string;
  repositoryId: string;
  repositoryName?: string;
  taskTitle: string;
  taskPrompt: string;
  context: AgentRunContext;
};

export type CreateAgentPlanResult = {
  providerId: AgentProviderId;
  model: string;
  summary: string;
  steps: ProposedChangeStep[];
  affectedFiles: ProposedChangeFile[];
  risks: ProposedRisk[];
  validation: ProposedValidationCheck[];
  patchArtifacts: ProviderPatchArtifact[];
  approvalRequired: boolean;
};

export interface AgentProviderAdapter {
  id: AgentProviderId;
  name: string;
  capabilities: AgentProviderCapabilities;

  createPlan(input: CreateAgentPlanInput): Promise<CreateAgentPlanResult>;
}

export type OpenAiPlanRequest = {
  runId: string;
  repositoryId: string;
  repositoryName?: string;
  taskTitle: string;
  taskPrompt: string;
  context: {
    branch: string;
    indexedFileCount: number;
    keyFiles: string[];
    projectFolders: string[];
    topExtensions: AgentRunExtensionSummary[];
    git: AgentRunGitContext;
  };
};

export type OpenAiPlanTransport = (
  input: OpenAiPlanRequest,
) => Promise<unknown>;

export type OpenAiProviderAdapterOptions = {
  model: string;
  requestPlan: OpenAiPlanTransport;
};

export type AgentRun = {
  id: string;
  title: string;
  taskSummary: string;
  repository: string;
  providerId: AgentProviderId;
  model: string;
  status: "queued" | "running" | "waiting_for_approval" | "completed";
  nextStep: string;
  startedAt: string;
  elapsed: string;
  confidence: "low" | "medium" | "high";
  approvalRequired: boolean;
};

export type AgentRunRecord = {
  run: AgentRun;
  plan: ProposedChangePlan;
  createdAt: string;
};

export type ProposedChangeStepStatus =
  "planned" | "in_progress" | "completed" | "blocked";

export type ProposedChangeStep = {
  id: string;
  title: string;
  description: string;
  status: ProposedChangeStepStatus;
};

export type ProposedAffectedFile = {
  path: string;
  reason: string;
  changeType: "create" | "modify" | "delete" | "unknown";
};

export type ProposedRisk = {
  level: "low" | "medium" | "high";
  title: string;
  description: string;
};

export type ProposedValidationCheck = {
  label: string;
  status: "planned" | "passed" | "failed" | "not_run";
};

export type ProposedChangePlan = {
  id: string;
  runId: string;
  summary: string;
  steps: ProposedChangeStep[];
  affectedFiles: ProposedAffectedFile[];
  risks: ProposedRisk[];
  validation: ProposedValidationCheck[];
  approvalRequired: boolean;
};

export type ProposedChangeStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "applied";

export type ProposedPatchArtifactStatus =
  "not_generated" | "generated" | "failed" | "unavailable";

export type PatchValidationStatus =
  | "not_validated"
  | "valid_structure"
  | "invalid_structure"
  | "dry_run_passed"
  | "dry_run_failed"
  | "unavailable";

export type PatchValidationResult = {
  status: PatchValidationStatus;
  message: string;
  validatedAt?: string;
};

export type ProposedChangeFileOperation =
  "create" | "modify" | "delete" | "rename" | "unknown";

export type ProposedChangeFile = {
  id: string;
  path: string;
  oldPath?: string;
  operation: ProposedChangeFileOperation;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  patchArtifactStatus: ProposedPatchArtifactStatus;
};

export type ProposedPatchArtifact = {
  id: string;
  proposedChangeId: string;
  filePath: string;
  status: ProposedPatchArtifactStatus;
  isBinary: boolean;
  isTooLarge: boolean;
  additions?: number;
  deletions?: number;
  rawDiff?: string;
  createdAt?: string;
  validationStatus?: PatchValidationStatus;
  validationMessage?: string;
  validatedAt?: string;
};

export type ProviderPatchArtifact = {
  filePath: string;
  status: Exclude<ProposedPatchArtifactStatus, "not_generated">;
  isBinary: boolean;
  rawDiff?: string;
};

export const MAX_GENERATED_PATCH_ARTIFACT_BYTES = 64 * 1024;
export const MAX_GENERATED_PATCH_ARTIFACT_LINES = 4_000;

const PATCH_VALIDATION_STATUSES: PatchValidationStatus[] = [
  "not_validated",
  "valid_structure",
  "invalid_structure",
  "dry_run_passed",
  "dry_run_failed",
  "unavailable",
];

export function initialPatchValidationStatus(
  artifact: ProposedPatchArtifact,
): PatchValidationStatus {
  if (artifact.status !== "generated" || artifact.isBinary) {
    return "unavailable";
  }

  if (artifact.isTooLarge) {
    return "invalid_structure";
  }

  if (!artifact.rawDiff) {
    return "unavailable";
  }

  if (
    artifact.validationStatus &&
    PATCH_VALIDATION_STATUSES.includes(artifact.validationStatus)
  ) {
    return artifact.validationStatus;
  }

  return "not_validated";
}

export function validatePatchArtifactStructure(
  artifact: ProposedPatchArtifact,
  file: ProposedChangeFile,
): PatchValidationResult {
  if (artifact.status !== "generated") {
    return {
      status: "unavailable",
      message: "Only generated patch artifacts can be validated.",
    };
  }

  if (artifact.filePath !== file.path || !isSafeProviderFilePath(file.path)) {
    return {
      status: "invalid_structure",
      message: "The patch path is unsafe or does not match the proposed file.",
    };
  }

  if (artifact.isBinary) {
    return {
      status: "unavailable",
      message: "Binary patch artifacts cannot use the text dry-run boundary.",
    };
  }

  if (artifact.isTooLarge) {
    return {
      status: "invalid_structure",
      message: "The patch exceeds the 64 KiB validation limit.",
    };
  }

  const rawDiff = artifact.rawDiff;

  if (!rawDiff) {
    return {
      status: "unavailable",
      message: "No generated patch content is available to validate.",
    };
  }

  const lines = rawDiff.split("\n");

  if (
    new TextEncoder().encode(rawDiff).byteLength >
      MAX_GENERATED_PATCH_ARTIFACT_BYTES ||
    lines.length > MAX_GENERATED_PATCH_ARTIFACT_LINES
  ) {
    return {
      status: "invalid_structure",
      message: "The patch exceeds the validation size or line-count limit.",
    };
  }

  if (
    rawDiff.includes("\0") ||
    rawDiff.includes("\r") ||
    rawDiff.includes("GIT binary patch") ||
    rawDiff.includes("Binary files ") ||
    rawDiff.includes("new file mode 120000") ||
    rawDiff.includes("new file mode 160000") ||
    lines.some(
      (line) =>
        line.startsWith("rename from ") ||
        line.startsWith("rename to ") ||
        line.startsWith("copy from ") ||
        line.startsWith("copy to "),
    )
  ) {
    return {
      status: "invalid_structure",
      message:
        "The text patch contains unsupported binary, link, or path metadata.",
    };
  }

  if (file.operation === "rename") {
    return {
      status: "unavailable",
      message:
        "Rename dry-runs are unavailable until old-path validation is supported.",
    };
  }

  const expectedDiffHeader = `diff --git a/${file.path} b/${file.path}`;
  const diffHeaders = lines.filter((line) => line.startsWith("diff --git "));
  const firstHunkIndex = lines.findIndex((line) => line.startsWith("@@ "));
  const metadataLines =
    firstHunkIndex >= 0 ? lines.slice(0, firstHunkIndex) : [];
  const oldHeaders = metadataLines.filter((line) => line.startsWith("--- "));
  const newHeaders = metadataLines.filter((line) => line.startsWith("+++ "));
  const expectedOldHeader = `--- a/${file.path}`;
  const expectedNewHeader = `+++ b/${file.path}`;

  if (
    diffHeaders.length !== 1 ||
    diffHeaders[0] !== expectedDiffHeader ||
    firstHunkIndex < 0 ||
    oldHeaders.length !== 1 ||
    newHeaders.length !== 1
  ) {
    return {
      status: "invalid_structure",
      message:
        "The artifact must contain one matching single-file unified diff.",
    };
  }

  const operationMatches =
    file.operation === "create"
      ? oldHeaders[0] === "--- /dev/null" && newHeaders[0] === expectedNewHeader
      : file.operation === "delete"
        ? oldHeaders[0] === expectedOldHeader &&
          newHeaders[0] === "+++ /dev/null"
        : file.operation === "modify"
          ? oldHeaders[0] === expectedOldHeader &&
            newHeaders[0] === expectedNewHeader
          : [expectedOldHeader, "--- /dev/null"].includes(oldHeaders[0]) &&
            [expectedNewHeader, "+++ /dev/null"].includes(newHeaders[0]);

  if (!operationMatches) {
    return {
      status: "invalid_structure",
      message: "The patch headers do not match the proposed file operation.",
    };
  }

  return {
    status: "valid_structure",
    message:
      "The patch has one bounded unified diff with matching paths and operation.",
  };
}

export type PersistedProposedChange = {
  id: string;
  runId: string;
  approvalRequestId?: string;
  repositoryId: string;
  title: string;
  summary: string;
  status: ProposedChangeStatus;
  files: ProposedChangeFile[];
  patchArtifacts: ProposedPatchArtifact[];
  createdAt: string;
  updatedAt: string;
};

export function createProposedPatchArtifactPlaceholder(
  proposedChangeId: string,
  file: ProposedChangeFile,
): ProposedPatchArtifact {
  return {
    id: `${file.id}-patch-artifact`,
    proposedChangeId,
    filePath: file.path,
    status: file.patchArtifactStatus,
    isBinary: false,
    isTooLarge: false,
    validationStatus: "unavailable",
    validationMessage: "No generated patch content is available to validate.",
  };
}

export function ensureProposedPatchArtifacts(
  change: PersistedProposedChange,
): PersistedProposedChange {
  const existingArtifactsByPath = new Map(
    change.patchArtifacts.map((artifact) => [artifact.filePath, artifact]),
  );
  const patchArtifacts = change.files.map((file) => {
    const existingArtifact = existingArtifactsByPath.get(file.path);

    if (existingArtifact) {
      return {
        ...existingArtifact,
        validationStatus: initialPatchValidationStatus(existingArtifact),
      };
    }

    return createProposedPatchArtifactPlaceholder(change.id, file);
  });

  return {
    ...change,
    files: change.files.map((file) => {
      const artifact = patchArtifacts.find(
        (candidate) => candidate.filePath === file.path,
      );

      return {
        ...file,
        patchArtifactStatus: artifact?.status ?? file.patchArtifactStatus,
      };
    }),
    patchArtifacts,
  };
}

export type ApprovalRequestStatus = "pending" | "approved" | "rejected";

export type ApprovalRisk = "low" | "medium" | "high";

export type ApprovalRequest = {
  id: string;
  title: string;
  repository: string;
  agentRunId: string;
  status: ApprovalRequestStatus;
  risk: ApprovalRisk;
  summary: string;
  files: string[];
  createdAt: string;
};

export type AgentRunExecutionRequest = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  task: string;
  context: AgentRunContext;
  startedAt: string;
  createdAt: string;
};

export type MockAgentRunRequest = AgentRunExecutionRequest;

export type AgentRunExecutionResult = AgentRunRecord & {
  proposedChange: PersistedProposedChange;
  approvalRequest: ApprovalRequest;
};

export type MockAgentRunResult = AgentRunExecutionResult;

function createMockRunTitle(task: string) {
  const normalizedTask = task.replace(/\s+/g, " ").trim();

  if (normalizedTask.length <= 68) {
    return normalizedTask;
  }

  return `${normalizedTask.slice(0, 65)}...`;
}

export function createMockAgentProviderAdapter(): AgentProviderAdapter {
  return {
    id: "mock",
    name: "Mock Provider",
    capabilities: {
      supportsPlanGeneration: true,
      supportsPatchGeneration: false,
      supportsStreaming: false,
      supportsToolUse: false,
    },
    async createPlan(input) {
      const normalizedTask = input.taskPrompt.trim();

      if (!normalizedTask) {
        throw new Error("A task request is required.");
      }

      const planId = `plan-${input.runId}`;
      const repositoryName = input.repositoryName ?? "selected repository";
      const contextFilePaths = [...new Set(input.context.indexedFilePaths)]
        .filter((path) => path.trim().length > 0)
        .slice(0, 3);
      const affectedFiles: ProposedChangeFile[] = contextFilePaths.map(
        (path, index) => ({
          id: `${input.runId}-provider-file-${index + 1}`,
          path,
          operation: "unknown",
          reason:
            "Candidate file selected from indexed repository context for mock planning review.",
          riskLevel: "medium",
          patchArtifactStatus: "not_generated",
        }),
      );

      return {
        providerId: "mock",
        model: "mock-planner-v1",
        summary:
          "The mock provider produced a review-only implementation plan from the submitted task and indexed repository context. No patch content was generated.",
        approvalRequired: true,
        steps: [
          {
            id: `${planId}-context`,
            title: "Review repository context",
            description: `Use indexed facts from ${repositoryName} on ${input.context.branch} without reading outside the selected repository.`,
            status: "completed",
          },
          {
            id: `${planId}-plan`,
            title: "Compose structured mock plan",
            description:
              "Translate the task into a bounded plan, candidate files, risks, and validation checks.",
            status: "completed",
          },
          {
            id: `${planId}-approval`,
            title: "Wait for human approval",
            description:
              "Pause before any future patch generation or file write is allowed.",
            status: "planned",
          },
        ],
        affectedFiles,
        risks: [
          {
            level: contextFilePaths.length > 0 ? "medium" : "low",
            title: "Mock plan requires review",
            description:
              "Candidate files and steps are deterministic mock-provider output and must be reviewed before future execution is connected.",
          },
        ],
        validation: [
          { label: "Review proposed plan", status: "planned" },
          { label: "Confirm repository context", status: "planned" },
          { label: "Approve or reject request", status: "planned" },
        ],
        patchArtifacts: [],
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new AgentProviderError(
      "invalid_output",
      "openai",
      `OpenAI returned an invalid ${field}. No review records were created.`,
    );
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength) {
    throw new AgentProviderError(
      "invalid_output",
      "openai",
      `OpenAI returned an invalid ${field}. No review records were created.`,
    );
  }

  return normalized;
}

function requireBoundedArray(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new AgentProviderError(
      "invalid_output",
      "openai",
      `OpenAI returned an invalid ${field}. No review records were created.`,
    );
  }

  return value;
}

function isSensitivePathSegment(segment: string) {
  const normalized = segment.toLowerCase();

  return (
    normalized === ".env" ||
    normalized.startsWith(".env.") ||
    normalized === "id_rsa" ||
    normalized === "id_ed25519" ||
    normalized === "credentials.json" ||
    normalized.startsWith("secrets.") ||
    normalized.endsWith(".pem") ||
    normalized.endsWith(".key") ||
    normalized.endsWith(".p12") ||
    normalized.endsWith(".pfx")
  );
}

function isSafeProviderFilePath(path: string) {
  if (
    !path ||
    path.length > 320 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("\0") ||
    /^[A-Za-z]:/.test(path)
  ) {
    return false;
  }

  const segments = path.split("/");

  return segments.every(
    (segment) =>
      Boolean(segment) &&
      segment !== "." &&
      segment !== ".." &&
      !isSensitivePathSegment(segment),
  );
}

function createBoundedOpenAiPlanRequest(
  input: CreateAgentPlanInput,
): OpenAiPlanRequest {
  const taskTitle = input.taskTitle.trim();
  const taskPrompt = input.taskPrompt.trim();
  const branch = input.context.branch.trim();

  if (
    !taskTitle ||
    taskTitle.length > 160 ||
    !taskPrompt ||
    taskPrompt.length > 1_200 ||
    !branch ||
    branch.length > 200
  ) {
    throw new AgentProviderError(
      "invalid_input",
      "openai",
      "The OpenAI planning request is invalid or too large.",
    );
  }

  const keyFiles = (input.context.keyFiles ?? [])
    .map((path) => path.trim())
    .filter(isSafeProviderFilePath)
    .slice(0, 20);
  const projectFolders = (input.context.projectFolders ?? [])
    .map((folder) => folder.trim())
    .filter(
      (folder) =>
        Boolean(folder) &&
        folder.length <= 120 &&
        !folder.includes("/") &&
        !folder.includes("\\") &&
        !isSensitivePathSegment(folder),
    )
    .slice(0, 20);
  const topExtensions = (input.context.topExtensions ?? [])
    .filter(
      (extension) =>
        Boolean(extension.extension.trim()) &&
        extension.extension.length <= 24 &&
        Number.isInteger(extension.count) &&
        extension.count >= 0,
    )
    .slice(0, 12)
    .map((extension) => ({
      extension: extension.extension.trim(),
      count: extension.count,
    }));
  const git = input.context.git ?? {
    isGitRepository: false,
    isClean: true,
    changedFileCount: 0,
  };

  return {
    runId: input.runId,
    repositoryId: input.repositoryId,
    repositoryName: input.repositoryName,
    taskTitle,
    taskPrompt,
    context: {
      branch,
      indexedFileCount: Math.min(
        Math.max(
          input.context.indexedFileCount ??
            input.context.indexedFilePaths.length,
          0,
        ),
        5_000,
      ),
      keyFiles,
      projectFolders,
      topExtensions,
      git: {
        isGitRepository: Boolean(git.isGitRepository),
        isClean: Boolean(git.isClean),
        changedFileCount: Math.min(Math.max(git.changedFileCount, 0), 5_000),
      },
    },
  };
}

function normalizeOpenAiTransportError(error: unknown): AgentProviderError {
  if (error instanceof AgentProviderError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("provider_not_configured")) {
    return new AgentProviderError(
      "not_configured",
      "openai",
      "OpenAI is not configured. Set OPENAI_API_KEY in the native app environment.",
    );
  }

  if (normalized.includes("authentication_error")) {
    return new AgentProviderError(
      "authentication",
      "openai",
      "OpenAI authentication failed. No review records were created.",
    );
  }

  if (normalized.includes("rate_limit")) {
    return new AgentProviderError(
      "rate_limit",
      "openai",
      "OpenAI rate limited the planning request. Try again later.",
      true,
    );
  }

  if (normalized.includes("timeout")) {
    return new AgentProviderError(
      "timeout",
      "openai",
      "OpenAI planning timed out. No review records were created.",
      true,
    );
  }

  if (normalized.includes("provider_unavailable")) {
    return new AgentProviderError(
      "unavailable",
      "openai",
      "OpenAI is currently unavailable. No review records were created.",
      true,
    );
  }

  if (normalized.includes("invalid_configuration")) {
    return new AgentProviderError(
      "invalid_input",
      "openai",
      "The OpenAI model configuration is invalid. No review records were created.",
    );
  }

  if (normalized.includes("invalid_output")) {
    return new AgentProviderError(
      "invalid_output",
      "openai",
      "OpenAI returned malformed plan output. No review records were created.",
    );
  }

  return new AgentProviderError(
    "request_failed",
    "openai",
    "OpenAI could not generate a plan. No review records were created.",
    true,
  );
}

function validateOpenAiPlanResult(
  value: unknown,
  input: CreateAgentPlanInput,
  model: string,
): CreateAgentPlanResult {
  if (!isRecord(value) || value.approvalRequired !== true) {
    throw new AgentProviderError(
      "invalid_output",
      "openai",
      "OpenAI returned malformed plan output. No review records were created.",
    );
  }

  const summary = requireBoundedString(value.summary, "plan summary", 2_000);
  const steps = requireBoundedArray(
    value.steps,
    "implementation steps",
    1,
    12,
  ).map((step, index): ProposedChangeStep => {
    if (!isRecord(step)) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned invalid implementation steps. No review records were created.",
      );
    }

    return {
      id: `plan-${input.runId}-step-${index + 1}`,
      title: requireBoundedString(step.title, "step title", 160),
      description: requireBoundedString(
        step.description,
        "step description",
        1_000,
      ),
      status: "planned",
    };
  });
  const affectedFilePaths = new Set<string>();
  const affectedFiles = requireBoundedArray(
    value.affectedFiles,
    "affected files",
    0,
    20,
  ).map((file, index): ProposedChangeFile => {
    if (!isRecord(file)) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned invalid affected files. No review records were created.",
      );
    }

    const path = requireBoundedString(file.path, "affected file path", 320);
    const operations: ProposedChangeFileOperation[] = [
      "create",
      "modify",
      "delete",
      "rename",
      "unknown",
    ];
    const riskLevels: ApprovalRisk[] = ["low", "medium", "high"];

    if (
      !isSafeProviderFilePath(path) ||
      affectedFilePaths.has(path) ||
      typeof file.operation !== "string" ||
      !operations.includes(file.operation as ProposedChangeFileOperation) ||
      typeof file.riskLevel !== "string" ||
      !riskLevels.includes(file.riskLevel as ApprovalRisk)
    ) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned an unsafe or invalid affected file. No review records were created.",
      );
    }

    affectedFilePaths.add(path);

    return {
      id: `${input.runId}-provider-file-${index + 1}`,
      path,
      operation: file.operation as ProposedChangeFileOperation,
      reason: requireBoundedString(file.reason, "affected file reason", 1_000),
      riskLevel: file.riskLevel as ApprovalRisk,
      patchArtifactStatus: "not_generated",
    };
  });
  const risks = requireBoundedArray(value.risks, "risks", 1, 10).map(
    (risk): ProposedRisk => {
      if (!isRecord(risk)) {
        throw new AgentProviderError(
          "invalid_output",
          "openai",
          "OpenAI returned invalid risks. No review records were created.",
        );
      }

      const levels: ApprovalRisk[] = ["low", "medium", "high"];

      if (
        typeof risk.level !== "string" ||
        !levels.includes(risk.level as ApprovalRisk)
      ) {
        throw new AgentProviderError(
          "invalid_output",
          "openai",
          "OpenAI returned an invalid risk level. No review records were created.",
        );
      }

      return {
        level: risk.level as ApprovalRisk,
        title: requireBoundedString(risk.title, "risk title", 160),
        description: requireBoundedString(
          risk.description,
          "risk description",
          1_000,
        ),
      };
    },
  );
  const validation = requireBoundedArray(
    value.validation,
    "validation checks",
    1,
    12,
  ).map((check): ProposedValidationCheck => {
    if (!isRecord(check)) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned invalid validation checks. No review records were created.",
      );
    }

    return {
      label: requireBoundedString(check.label, "validation label", 240),
      status: "planned",
    };
  });
  const artifactPaths = new Set<string>();
  const patchArtifacts = requireBoundedArray(
    value.patchArtifacts,
    "patch artifacts",
    0,
    affectedFiles.length,
  ).map((artifact): ProviderPatchArtifact => {
    if (!isRecord(artifact)) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned invalid patch artifacts. No review records were created.",
      );
    }

    const filePath = requireBoundedString(
      artifact.filePath,
      "patch artifact path",
      320,
    );
    const statuses: ProviderPatchArtifact["status"][] = [
      "generated",
      "failed",
      "unavailable",
    ];

    if (
      !isSafeProviderFilePath(filePath) ||
      !affectedFilePaths.has(filePath) ||
      artifactPaths.has(filePath) ||
      typeof artifact.status !== "string" ||
      !statuses.includes(artifact.status as ProviderPatchArtifact["status"]) ||
      typeof artifact.isBinary !== "boolean" ||
      typeof artifact.rawDiff !== "string"
    ) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned an unsafe or mismatched patch artifact. No review records were created.",
      );
    }

    const status = artifact.status as ProviderPatchArtifact["status"];
    const rawDiff = artifact.rawDiff.trim();

    if (status === "generated" && !artifact.isBinary) {
      const expectedHeader = `diff --git a/${filePath} b/${filePath}`;
      const diffHeaders = rawDiff
        .split("\n")
        .filter((line) => line.startsWith("diff --git "));

      if (
        !rawDiff ||
        rawDiff.includes("\0") ||
        diffHeaders.length !== 1 ||
        diffHeaders[0] !== expectedHeader ||
        !rawDiff
          .split("\n")
          .some(
            (line) => line === `--- a/${filePath}` || line === "--- /dev/null",
          ) ||
        !rawDiff
          .split("\n")
          .some(
            (line) => line === `+++ b/${filePath}` || line === "+++ /dev/null",
          )
      ) {
        throw new AgentProviderError(
          "invalid_output",
          "openai",
          "OpenAI returned an invalid single-file patch artifact. No review records were created.",
        );
      }
    } else if (rawDiff) {
      throw new AgentProviderError(
        "invalid_output",
        "openai",
        "OpenAI returned patch content for a non-previewable artifact. No review records were created.",
      );
    }

    artifactPaths.add(filePath);

    return {
      filePath,
      status,
      isBinary: artifact.isBinary,
      rawDiff: rawDiff || undefined,
    };
  });

  return {
    providerId: "openai",
    model,
    summary,
    steps,
    affectedFiles,
    risks,
    validation,
    patchArtifacts,
    approvalRequired: true,
  };
}

export function createOpenAiAgentProviderAdapter(
  options: OpenAiProviderAdapterOptions,
): AgentProviderAdapter {
  return {
    id: "openai",
    name: "OpenAI",
    capabilities: {
      supportsPlanGeneration: true,
      supportsPatchGeneration: true,
      supportsStreaming: false,
      supportsToolUse: false,
    },
    async createPlan(input) {
      const request = createBoundedOpenAiPlanRequest(input);

      try {
        const result = await options.requestPlan(request);
        return validateOpenAiPlanResult(result, input, options.model);
      } catch (error) {
        throw normalizeOpenAiTransportError(error);
      }
    },
  };
}

function highestApprovalRisk(risks: ProposedRisk[]): ApprovalRisk {
  if (risks.some((risk) => risk.level === "high")) {
    return "high";
  }

  if (risks.some((risk) => risk.level === "medium")) {
    return "medium";
  }

  return "low";
}

export async function executeAgentRun(
  request: AgentRunExecutionRequest,
  adapter: AgentProviderAdapter,
): Promise<AgentRunExecutionResult> {
  const normalizedTask = request.task.trim();

  if (!normalizedTask) {
    throw new Error("A task request is required.");
  }

  const title = createMockRunTitle(normalizedTask);
  const planId = `plan-${request.id}`;
  const proposedChangeId = `proposal-${request.id}`;
  const approvalRequestId = `approval-${request.id}`;
  const providerResult = await adapter.createPlan({
    runId: request.id,
    repositoryId: request.repositoryId,
    repositoryName: request.repositoryName,
    taskTitle: title,
    taskPrompt: normalizedTask,
    context: request.context,
  });

  if (providerResult.providerId !== adapter.id) {
    throw new AgentProviderError(
      "invalid_output",
      adapter.id,
      `${adapter.name} returned mismatched provider output. No review records were created.`,
    );
  }

  const affectedFiles: ProposedAffectedFile[] =
    providerResult.affectedFiles.map((file) => ({
      path: file.path,
      reason: file.reason,
      changeType: file.operation === "rename" ? "unknown" : file.operation,
    }));
  const plan: ProposedChangePlan = {
    id: planId,
    runId: request.id,
    summary: providerResult.summary,
    approvalRequired: providerResult.approvalRequired,
    steps: providerResult.steps,
    affectedFiles,
    risks: providerResult.risks,
    validation: providerResult.validation,
  };
  const files: ProposedChangeFile[] = providerResult.affectedFiles.map(
    (file, index) => ({
      id: `${proposedChangeId}-file-${index + 1}`,
      path: file.path,
      operation: file.operation,
      reason: file.reason,
      riskLevel: file.riskLevel,
      patchArtifactStatus: file.patchArtifactStatus,
    }),
  );
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const patchArtifacts: ProposedPatchArtifact[] =
    providerResult.patchArtifacts.map((artifact, index) => {
      const rawDiff = artifact.rawDiff;
      const isTooLarge = rawDiff
        ? new TextEncoder().encode(rawDiff).byteLength >
          MAX_GENERATED_PATCH_ARTIFACT_BYTES
        : false;
      const previewDiff = isTooLarge ? undefined : rawDiff;
      const diffLines = previewDiff?.split("\n") ?? [];
      const additions = diffLines.filter(
        (line) => line.startsWith("+") && !line.startsWith("+++"),
      ).length;
      const deletions = diffLines.filter(
        (line) => line.startsWith("-") && !line.startsWith("---"),
      ).length;
      const linkedFile = filesByPath.get(artifact.filePath);

      if (linkedFile) {
        linkedFile.patchArtifactStatus = artifact.status;
      }

      return {
        id: `${proposedChangeId}-artifact-${index + 1}`,
        proposedChangeId,
        filePath: artifact.filePath,
        status: artifact.status,
        isBinary: artifact.isBinary,
        isTooLarge,
        additions: previewDiff ? additions : undefined,
        deletions: previewDiff ? deletions : undefined,
        rawDiff: previewDiff,
        createdAt: request.startedAt,
        validationStatus: isTooLarge
          ? "invalid_structure"
          : artifact.status === "generated" && !artifact.isBinary && previewDiff
            ? "not_validated"
            : "unavailable",
        validationMessage: isTooLarge
          ? "The patch exceeds the 64 KiB validation limit."
          : undefined,
      };
    });
  const proposedChange = ensureProposedPatchArtifacts({
    id: proposedChangeId,
    runId: request.id,
    approvalRequestId,
    repositoryId: request.repositoryId,
    title,
    summary: plan.summary,
    status: "ready_for_review",
    files,
    patchArtifacts,
    createdAt: request.startedAt,
    updatedAt: request.startedAt,
  });
  const approvalRequest: ApprovalRequest = {
    id: approvalRequestId,
    title: `Review ${title}`,
    repository: request.repositoryName,
    agentRunId: request.id,
    status: "pending",
    risk: highestApprovalRisk(providerResult.risks),
    summary: `Review the ${adapter.id === "mock" ? "mock provider" : adapter.name} plan before any generated patch or repository write is permitted.`,
    files: files.map((file) => file.path),
    createdAt: request.startedAt,
  };
  const run: AgentRun = {
    id: request.id,
    title,
    taskSummary: normalizedTask,
    repository: request.repositoryName,
    providerId: providerResult.providerId,
    model: providerResult.model,
    status: providerResult.approvalRequired
      ? "waiting_for_approval"
      : "completed",
    nextStep:
      adapter.id === "mock"
        ? "Review the structured mock plan and approval request."
        : `Review the structured ${adapter.name} plan and approval request.`,
    startedAt: request.startedAt,
    elapsed: "<1m",
    confidence: files.length > 0 ? "medium" : "low",
    approvalRequired: providerResult.approvalRequired,
  };

  return {
    run,
    plan,
    proposedChange,
    approvalRequest,
    createdAt: request.createdAt,
  };
}

export async function executeMockAgentRun(
  request: MockAgentRunRequest,
): Promise<MockAgentRunResult> {
  return executeAgentRun(request, createMockAgentProviderAdapter());
}

export function createMockProvider(): ProviderAdapter {
  return {
    id: "mock",
    displayName: "Mock Provider",
    status: "connected",
    capabilities: [
      {
        id: "mock-planning",
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsStructuredOutput: true,
      },
    ],
  };
}

export function createMockApprovalRequests(): ApprovalRequest[] {
  return [
    {
      id: "approval-provider-rfc",
      title: "Approve provider abstraction patch plan",
      repository: "AI-Developer-Workspace",
      agentRunId: "run-mvp-shell",
      status: "pending",
      risk: "medium",
      summary:
        "Review the proposed provider adapter sequence before implementation touches shared AI package contracts.",
      files: [
        "packages/ai/src/index.ts",
        "docs/specs/provider-api.md",
        "docs/rfcs/provider-abstraction.md",
      ],
      createdAt: "Today, 10:42",
    },
    {
      id: "approval-indexing-job",
      title: "Approve indexing job persistence follow-up",
      repository: "AI-Developer-Workspace",
      agentRunId: "run-index-refresh",
      status: "pending",
      risk: "low",
      summary:
        "Confirm the stub indexing job flow before it begins recording file-tree facts.",
      files: [
        "packages/indexing/src/index.ts",
        "apps/desktop/src/storage/indexingJobStore.ts",
      ],
      createdAt: "Today, 10:46",
    },
  ];
}

export function createMockAgentRuns(): AgentRun[] {
  return [
    {
      id: "run-mvp-shell",
      title: "Draft app shell implementation plan",
      taskSummary:
        "Prepare the desktop app shell plan for repository-aware navigation, approval surfaces, and local-first implementation boundaries.",
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      model: "mock-planner-v1",
      status: "waiting_for_approval",
      nextStep: "Review proposed file edits before execution.",
      startedAt: "Today, 10:34",
      elapsed: "8m",
      confidence: "medium",
      approvalRequired: true,
    },
    {
      id: "run-index-refresh",
      title: "Refresh repository context index",
      taskSummary:
        "Refresh repository facts so future agent runs can use indexed file paths, documentation, and package boundaries.",
      repository: "AI-Developer-Workspace",
      providerId: "mock",
      model: "mock-context-v1",
      status: "running",
      nextStep: "Collect package boundaries and document references.",
      startedAt: "Today, 10:46",
      elapsed: "3m",
      confidence: "high",
      approvalRequired: true,
    },
  ];
}

export function createMockProposedChangePlans(): ProposedChangePlan[] {
  return [
    {
      id: "plan-mvp-shell",
      runId: "run-mvp-shell",
      summary:
        "Refine the desktop shell contract, keep implementation bounded to UI/data wiring, and require human review before any file edits are applied.",
      approvalRequired: true,
      steps: [
        {
          id: "step-review-shell",
          title: "Review current shell structure",
          description:
            "Inspect navigation, repository context, approval queue, and file-preview surfaces before changing shared UI behavior.",
          status: "completed",
        },
        {
          id: "step-compose-plan",
          title: "Compose implementation plan",
          description:
            "Prepare a scoped plan that identifies UI contracts, affected modules, safety boundaries, and verification checks.",
          status: "completed",
        },
        {
          id: "step-await-approval",
          title: "Wait for human approval",
          description:
            "Pause before executing edits so the proposed plan can be reviewed against repository state and risk.",
          status: "planned",
        },
      ],
      affectedFiles: [
        {
          path: "apps/desktop/src/App.tsx",
          reason: "Primary shell and run-detail composition lives here today.",
          changeType: "modify",
        },
        {
          path: "packages/ai/src/index.ts",
          reason:
            "Agent run and proposed plan contracts need reusable typed shapes.",
          changeType: "modify",
        },
        {
          path: "apps/desktop/src/App.test.tsx",
          reason:
            "Smoke coverage should confirm run detail, proposed plan, and approval handoff are visible.",
          changeType: "modify",
        },
      ],
      risks: [
        {
          level: "medium",
          title: "Shared shell regression",
          description:
            "Agent run detail touches the existing six-tab shell and must preserve navigation, approvals, indexing, and preview state.",
        },
        {
          level: "low",
          title: "Mock plan overreach",
          description:
            "The plan must stay honest about missing real diffs and avoid implying that file edits have been generated.",
        },
      ],
      validation: [
        {
          label: "Typecheck workspace packages",
          status: "planned",
        },
        {
          label: "Run desktop smoke tests",
          status: "planned",
        },
        {
          label: "Build desktop bundle",
          status: "planned",
        },
      ],
    },
    {
      id: "plan-index-refresh",
      runId: "run-index-refresh",
      summary:
        "Refresh repository context from indexed facts and report what package boundaries, docs, and file categories are available.",
      approvalRequired: true,
      steps: [
        {
          id: "step-load-index",
          title: "Load indexed facts",
          description:
            "Read persisted file facts for the selected repository without scanning outside the repository boundary.",
          status: "completed",
        },
        {
          id: "step-derive-context",
          title: "Derive context summary",
          description:
            "Summarize folders, key files, and extension counts for future agent context.",
          status: "in_progress",
        },
      ],
      affectedFiles: [
        {
          path: "packages/indexing/src/index.ts",
          reason: "Repository intelligence helpers derive context from facts.",
          changeType: "modify",
        },
      ],
      risks: [
        {
          level: "low",
          title: "Incomplete context",
          description:
            "Index facts may not include package metadata until a safe reader exists.",
        },
      ],
      validation: [
        {
          label: "Confirm indexed facts render",
          status: "planned",
        },
      ],
    },
  ];
}

export function createMockPersistedProposedChanges(): PersistedProposedChange[] {
  const changes: PersistedProposedChange[] = [
    {
      id: "proposal-mvp-shell",
      runId: "run-mvp-shell",
      approvalRequestId: "approval-provider-rfc",
      repositoryId: "repo-workspace",
      title: "Draft app shell implementation plan",
      summary:
        "Durable proposal record for reviewing the app shell plan before any implementation writes are permitted.",
      status: "ready_for_review",
      files: [
        {
          id: "proposal-mvp-shell-app",
          path: "apps/desktop/src/App.tsx",
          operation: "modify",
          reason: "Primary shell and run-detail composition lives here today.",
          riskLevel: "medium",
          patchArtifactStatus: "not_generated",
        },
        {
          id: "proposal-mvp-shell-ai",
          path: "packages/ai/src/index.ts",
          operation: "modify",
          reason:
            "Agent run and proposed plan contracts need reusable typed shapes.",
          riskLevel: "medium",
          patchArtifactStatus: "generated",
        },
        {
          id: "proposal-mvp-shell-test",
          path: "apps/desktop/src/App.test.tsx",
          operation: "modify",
          reason:
            "Smoke coverage should confirm run detail, proposed plan, and approval handoff are visible.",
          riskLevel: "low",
          patchArtifactStatus: "not_generated",
        },
        {
          id: "proposal-mvp-shell-provider-docs",
          path: "docs/specs/provider-api.md",
          operation: "modify",
          reason:
            "Provider API docs need review before adapter sequence work begins.",
          riskLevel: "low",
          patchArtifactStatus: "failed",
        },
        {
          id: "proposal-mvp-shell-provider-rfc",
          path: "docs/rfcs/provider-abstraction.md",
          operation: "modify",
          reason:
            "Provider abstraction RFC should remain linked to the approval review.",
          riskLevel: "low",
          patchArtifactStatus: "unavailable",
        },
      ],
      patchArtifacts: [
        {
          id: "proposal-mvp-shell-ai-patch-artifact",
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
          id: "proposal-mvp-shell-provider-docs-patch-artifact",
          proposedChangeId: "proposal-mvp-shell",
          filePath: "docs/specs/provider-api.md",
          status: "failed",
          isBinary: false,
          isTooLarge: false,
          createdAt: "Today, 10:45",
        },
        {
          id: "proposal-mvp-shell-provider-rfc-patch-artifact",
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
      repositoryId: "repo-workspace",
      title: "Refresh repository context index",
      summary:
        "Durable proposal record for indexing persistence follow-up work before file writes or generated diffs exist.",
      status: "ready_for_review",
      files: [
        {
          id: "proposal-index-refresh-indexing",
          path: "packages/indexing/src/index.ts",
          operation: "modify",
          reason: "Repository intelligence helpers derive context from facts.",
          riskLevel: "low",
          patchArtifactStatus: "not_generated",
        },
      ],
      patchArtifacts: [],
      createdAt: "Today, 10:46",
      updatedAt: "Today, 10:46",
    },
  ];

  return changes.map(ensureProposedPatchArtifacts);
}
