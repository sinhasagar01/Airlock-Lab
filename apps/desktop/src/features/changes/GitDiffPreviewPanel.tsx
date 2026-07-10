import type { GitChangedFile, GitFileDiff } from "@ai-dev/core";
import { IconBadge, StatusPill } from "@ai-dev/ui";

type GitDiffPreviewState = "idle" | "loading" | "ready" | "error";

function gitDiffStateTitle(
  file: GitChangedFile | null,
  diff: GitFileDiff | null,
  state: GitDiffPreviewState,
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
  state: GitDiffPreviewState;
  emptyDescription: string;
};

export function GitDiffPreviewPanel({
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
