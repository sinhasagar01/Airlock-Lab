import {
  initialPatchValidationStatus,
  type PatchValidationStatus,
  type ProposedPatchArtifact,
} from "@ai-dev/ai";
import { IconBadge, SecondaryButton, StatusPill } from "@ai-dev/ui";
import { patchArtifactTone } from "../../lib/uiState";

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

function patchArtifactSummary(artifact: ProposedPatchArtifact) {
  if (artifact.status === "generated") {
    if (artifact.isBinary) {
      return "Binary proposal · inline preview unavailable";
    }

    if (artifact.isTooLarge) {
      return "Generated proposal · inline preview size limit exceeded";
    }

    return `${artifact.additions ?? 0} additions · ${artifact.deletions ?? 0} deletions`;
  }

  if (artifact.status === "failed") {
    return "Provider could not produce reviewable patch content";
  }

  if (artifact.status === "unavailable") {
    return "Bounded context was insufficient for safe generation";
  }

  return "No generated patch content is stored";
}

function patchValidationTone(status: PatchValidationStatus) {
  if (status === "dry_run_passed") {
    return "success" as const;
  }

  if (status === "invalid_structure" || status === "dry_run_failed") {
    return "danger" as const;
  }

  if (status === "valid_structure") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function PatchArtifactList({
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
                {patchArtifactSummary(artifact)} · Validation:{" "}
                {initialPatchValidationStatus(artifact).replaceAll("_", " ")}
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
  isValidating?: boolean;
  onValidate?: () => void;
};

export function PatchArtifactDetail({
  artifact,
  isValidating = false,
  onValidate,
}: PatchArtifactDetailProps) {
  const validationStatus = artifact
    ? initialPatchValidationStatus(artifact)
    : "unavailable";
  const canValidate = Boolean(
    artifact?.status === "generated" &&
    !artifact.isBinary &&
    !artifact.isTooLarge &&
    artifact.rawDiff,
  );

  return (
    <section
      className="patch-artifact-detail"
      aria-label="Patch artifact detail"
    >
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

      {artifact ? (
        <div className="patch-validation-panel">
          <div>
            <div className="patch-validation-panel__title">
              <span>Validation and dry-run</span>
              <StatusPill
                tone={patchValidationTone(validationStatus)}
                size="sm"
                showDot={false}
              >
                {validationStatus.replaceAll("_", " ")}
              </StatusPill>
            </div>
            <p>
              {artifact.validationMessage ??
                (validationStatus === "not_validated"
                  ? "Structure and applicability have not been checked against the selected repository."
                  : "This artifact does not have reviewable text content for validation.")}
            </p>
          </div>
          <SecondaryButton
            disabled={!canValidate || isValidating}
            icon="approval"
            onClick={onValidate}
          >
            {isValidating ? "Checking patch" : "Validate & dry-run"}
          </SecondaryButton>
        </div>
      ) : null}

      {!artifact ? (
        <div className="patch-artifact-state">
          <IconBadge icon="changes" tone="neutral" size="md" />
          <div>
            <h4>No artifact selected</h4>
            <p>
              Select an artifact record to inspect its generated patch state.
            </p>
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
            Provider-generated proposal · not applied
          </div>
          <pre className="git-diff-code" tabIndex={0}>
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
