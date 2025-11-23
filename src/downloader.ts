import { saveTrack } from "./db";

export type ProgressEvent = {
  done: number;
  total: number;
  url: string;
  ok: boolean;
  error?: string;
};

// Build URL from a T-number
export function makeMp3Url(tNumber: string) {
  const clean = tNumber.trim();
  return `http://5fi.sh/${clean}-001.mp3`;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function downloadAll(
  tNumbers: string[],
  onProgress?: (e: ProgressEvent) => void
) {
  let done = 0;
  const total = tNumbers.length;

  for (const t of tNumbers) {
    const url = makeMp3Url(t);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      await saveTrack(url, blob);

      done++;
      onProgress?.({ done, total, url, ok: true });
    } catch (err: unknown) {
      done++;
      onProgress?.({
        done,
        total,
        url,
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
}
