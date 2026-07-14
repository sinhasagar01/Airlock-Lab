import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTauriRuntime,
  pickRepositoryDirectories,
} from "./repositoryPicker";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(open).mockReset();
});

describe("repository picker runtime boundary", () => {
  it("attempts the native directory dialog and normalizes selected paths", async () => {
    vi.mocked(open).mockResolvedValueOnce("/workspace/one");
    await expect(pickRepositoryDirectories()).resolves.toEqual([
      "/workspace/one",
    ]);

    vi.mocked(open).mockResolvedValueOnce(["/workspace/one", "/workspace/two"]);
    await expect(pickRepositoryDirectories()).resolves.toEqual([
      "/workspace/one",
      "/workspace/two",
    ]);

    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: true,
      title: "Choose repositories",
    });
  });

  it("returns null when the user cancels the native dialog", async () => {
    vi.mocked(open).mockResolvedValue(null);

    await expect(pickRepositoryDirectories()).resolves.toBeNull();
  });

  it("classifies dialog failure as browser-only after attempting the API", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(open).mockRejectedValue(new Error("IPC unavailable"));

    await expect(pickRepositoryDirectories()).rejects.toMatchObject({
      code: "browser_runtime",
    });
    expect(open).toHaveBeenCalledOnce();
    expect(isTauriRuntime()).toBe(false);
  });

  it("keeps native dialog failures distinct from browser fallback", async () => {
    vi.mocked(open).mockRejectedValue(new Error("dialog denied"));

    await expect(pickRepositoryDirectories()).rejects.toMatchObject({
      code: "native_dialog_failed",
    });
    expect(open).toHaveBeenCalledOnce();
    expect(isTauriRuntime()).toBe(true);
  });
});
