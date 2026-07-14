import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type RepositoryPickerErrorCode =
  "browser_runtime" | "native_dialog_failed";

export class RepositoryPickerError extends Error {
  constructor(
    public readonly code: RepositoryPickerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryPickerError";
  }
}

export function isTauriRuntime() {
  return isTauri();
}

export async function pickRepositoryDirectories(): Promise<string[] | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: true,
      title: "Choose repositories",
    });

    if (!selected) {
      return null;
    }

    return Array.isArray(selected) ? selected : [selected];
  } catch {
    if (!isTauriRuntime()) {
      throw new RepositoryPickerError(
        "browser_runtime",
        "Repository selection requires the native Tauri app.",
      );
    }

    throw new RepositoryPickerError(
      "native_dialog_failed",
      "The native repository picker could not be opened.",
    );
  }
}
