import type { FileContentPreview, IndexedFileFact, RepositorySummary } from "@ai-dev/indexing";
import {
  Icon,
  IconBadge,
  StatusBadge,
  StatusPill,
} from "@ai-dev/ui";
import { fileNameFromPath } from "../../lib/uiState";

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FilePreviewContentProps = {
  filePreview: FileContentPreview | null;
  isPreviewLoading: boolean;
  selectedIndexedFile: IndexedFileFact | null;
};

function FilePreviewContent({
  filePreview,
  isPreviewLoading,
  selectedIndexedFile,
}: FilePreviewContentProps) {
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
            Preview skipped because this file is {formatFileSize(filePreview.sizeBytes)}.
            The preview limit is {formatFileSize(filePreview.maxSizeBytes)}.
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
            Preview blocked because the resolved path is outside the repository.
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

type IndexedFileBrowserProps = {
  activeRepository: RepositorySummary;
  extensionCounts: [string, number][];
  extensionFilter: string;
  filePreview: FileContentPreview | null;
  fileSearch: string;
  filteredIndexedFiles: IndexedFileFact[];
  indexedFiles: IndexedFileFact[];
  isPreviewLoading: boolean;
  selectedIndexedFile: IndexedFileFact | null;
  variant: "compact" | "full";
  onExtensionFilterChange: (extension: string) => void;
  onFileSearchChange: (search: string) => void;
  onSelectedFilePathChange: (path: string) => void;
};

export function IndexedFileBrowser({
  activeRepository,
  extensionCounts,
  extensionFilter,
  filePreview,
  fileSearch,
  filteredIndexedFiles,
  indexedFiles,
  isPreviewLoading,
  selectedIndexedFile,
  variant,
  onExtensionFilterChange,
  onFileSearchChange,
  onSelectedFilePathChange,
}: IndexedFileBrowserProps) {
  const visibleFiles =
    variant === "compact" ? filteredIndexedFiles.slice(0, 8) : filteredIndexedFiles;

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
          onChange={(event) => onFileSearchChange(event.target.value)}
          placeholder="Search paths"
          type="search"
          value={fileSearch}
        />
        <select
          aria-label="Filter indexed files by extension"
          onChange={(event) => onExtensionFilterChange(event.target.value)}
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

      <div className="extension-summary" aria-label="File counts by extension">
        {extensionCounts.length > 0 ? (
          extensionCounts.slice(0, 10).map(([extension, count]) => (
            <button
              aria-pressed={extensionFilter === extension}
              key={extension}
              onClick={() => onExtensionFilterChange(extension)}
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
                  aria-current={
                    selectedIndexedFile?.path === file.path ? "true" : undefined
                  }
                  aria-label={`${file.path}, ${file.extension ?? "no extension"}, ${formatFileSize(file.sizeBytes)}`}
                  className="file-list-item"
                  key={file.path}
                  onClick={() => onSelectedFilePathChange(file.path)}
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
                <FilePreviewContent
                  filePreview={filePreview}
                  isPreviewLoading={isPreviewLoading}
                  selectedIndexedFile={selectedIndexedFile}
                />
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
