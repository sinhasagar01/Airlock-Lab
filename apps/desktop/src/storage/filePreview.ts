import { invoke } from "@tauri-apps/api/core";
import type { FileContentPreview, FilePreviewStatus } from "@ai-dev/indexing";

type NativeFileContentPreview = {
  path: string;
  status: FilePreviewStatus;
  content: string | null;
  size_bytes: number;
  max_size_bytes: number;
};

export async function previewRepositoryFile(
  repositoryPath: string,
  filePath: string,
): Promise<FileContentPreview> {
  const preview = await invoke<NativeFileContentPreview>(
    "preview_repository_file",
    {
      repositoryPath,
      filePath,
    },
  );

  return {
    path: preview.path,
    status: preview.status,
    content: preview.content,
    sizeBytes: preview.size_bytes,
    maxSizeBytes: preview.max_size_bytes,
  };
}
