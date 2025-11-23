import JSZip from "jszip";
import { getTrack } from "./db";

function getFileNameFromUrl(url: string) {
  // e.g. https://5fi.sh/T62808-001.mp3 -> T62808-001.mp3
  return url.split("/").pop() || "track.mp3";
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export type ZipProgress = {
  done: number;
  total: number;
  url: string;
  ok: boolean;
  error?: string;
};

export async function exportZipFromIndexedDb(
  urls: string[],
  zipName = "mp3-library.zip",
  onProgress?: (p: ZipProgress) => void
) {
  const zip = new JSZip();
  let done = 0;
  const total = urls.length;

  for (const url of urls) {
    try {
      const row = await getTrack(url);
      if (!row?.blob) throw new Error("Not found in IndexedDB");

      const fileName = getFileNameFromUrl(url);
      zip.file(fileName, row.blob);

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

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(zipBlob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
}
