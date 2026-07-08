import { invoke } from "@tauri-apps/api/core";
import type { FileTreeScanResult, IndexedFileFact } from "@ai-dev/indexing";

type NativeIndexedFileFact = {
  repository_id: string;
  path: string;
  size_bytes: number;
  extension: string | null;
  modified_at: string | null;
};

type NativeFileTreeScanResult = {
  repository_path: string;
  scanned_files: number;
  skipped_entries: number;
  files: NativeIndexedFileFact[];
};

function mapIndexedFileFact(file: NativeIndexedFileFact): IndexedFileFact {
  return {
    repositoryId: file.repository_id,
    path: file.path,
    sizeBytes: file.size_bytes,
    extension: file.extension,
    modifiedAt: file.modified_at,
  };
}

export async function scanRepositoryFileTree(
  repositoryId: string,
  repositoryPath: string,
): Promise<FileTreeScanResult> {
  const result = await invoke<NativeFileTreeScanResult>(
    "scan_repository_file_tree",
    {
      repositoryId,
      repositoryPath,
    },
  );

  return {
    repositoryPath: result.repository_path,
    scannedFiles: result.scanned_files,
    skippedEntries: result.skipped_entries,
    files: result.files.map(mapIndexedFileFact),
  };
}
