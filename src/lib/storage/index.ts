import "server-only";
import { env } from "@/lib/env";
import type { Format } from "@/lib/plans";
import { localStorageAdapter } from "./local";
import { r2StorageAdapter } from "./r2";

export const CONTENT_TYPES: Record<Format, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  srt: "application/x-subrip",
};

export type GetOptions = { filename: string; contentType: string; download: boolean };

export interface StorageAdapter {
  /** Short-lived URL the worker can PUT the file to (Content-Type must match). */
  putUrl(key: string, contentType: string): Promise<string>;
  /** Short-lived URL for the browser to play or download the file. */
  getUrl(key: string, opts: GetOptions): Promise<string>;
}

export const URL_TTL_SEC = 15 * 60;

export function jobFileKey(userId: string, jobId: string, format: Format): string {
  return `jobs/${userId}/${jobId}.${format}`;
}

export function storage(): StorageAdapter {
  return env().STORAGE_BACKEND === "r2" ? r2StorageAdapter() : localStorageAdapter();
}
