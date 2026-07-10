import type { ProposedPatchArtifact } from "@ai-dev/ai";
import { IconBadge, StatusPill } from "@ai-dev/ui";
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

export function PatchArtifactDetail({ artifact }: PatchArtifactDetailProps) {
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
