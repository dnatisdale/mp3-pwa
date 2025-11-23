import { useEffect, useState } from "react";
import { downloadAll, makeMp3Url } from "./downloader";
import { getTrack } from "./db";
import { exportZipFromIndexedDb } from "./zipExport";
import type { ZipProgress } from "./zipExport";

function parseCsv(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0]?.toLowerCase();
  const hasHeader =
    first === "tnumber" || first === "t_number" || first === "t";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map((line) => line.split(",")[0].trim());
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function BulkDownloader() {
  const [tNumbers, setTNumbers] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading CSV…");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const urls = tNumbers.map(makeMp3Url);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/tracks.csv");
        const text = await res.text();
        const list = parseCsv(text);
        setTNumbers(list);
        setProgress({ done: 0, total: list.length });
        setStatus(`Loaded ${list.length} tracks from tracks.csv`);
      } catch (err: unknown) {
        setStatus(`Could not load /tracks.csv: ${getErrorMessage(err)}`);
      }
    })();
  }, []);

  async function startDownload() {
    if (!tNumbers.length) {
      setStatus("No tracks loaded.");
      return;
    }

    setIsDownloading(true);
    setErrors([]);
    setProgress({ done: 0, total: tNumbers.length });
    setStatus("Starting download…");

    await downloadAll(tNumbers, (e) => {
      setProgress({ done: e.done, total: e.total });

      if (!e.ok) {
        setErrors((prev) => [...prev, `${e.url} → ${e.error}`]);
      }

      setStatus(
        e.done === e.total
          ? "Download finished."
          : `Downloading ${e.done} / ${e.total}`
      );
    });

    setIsDownloading(false);
  }

  async function startZipExport() {
    if (!urls.length) {
      setStatus("No tracks loaded.");
      return;
    }

    setIsZipping(true);
    setErrors([]);
    setProgress({ done: 0, total: urls.length });
    setStatus("Building ZIP…");

    await exportZipFromIndexedDb(
      urls,
      "tgn-mp3-library.zip",
      (p: ZipProgress) => {
        setProgress({ done: p.done, total: p.total });

        if (!p.ok) {
          setErrors((prev) => [...prev, `${p.url} → ${p.error}`]);
        }

        setStatus(
          p.done === p.total
            ? "ZIP ready! Download should start automatically."
            : `Zipping ${p.done} / ${p.total}`
        );
      }
    );

    setIsZipping(false);
  }

  async function testFirstOffline() {
    if (!tNumbers[0]) return;
    const url = makeMp3Url(tNumbers[0]);
    const saved = await getTrack(url);
    alert(saved ? "First track saved offline ✅" : "First track NOT saved.");
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
      <h2>MP3 Offline Bulk Downloader</h2>

      <p>
        Base URL pattern:
        <br />
        <code>https://5fi.sh/T#####-001.mp3</code>
      </p>

      <div style={{ marginTop: 12 }}>
        <button onClick={startDownload} disabled={isDownloading || isZipping}>
          {isDownloading ? "Downloading…" : "Download All for Offline Use"}
        </button>

        <button
          onClick={startZipExport}
          disabled={isDownloading || isZipping}
          style={{ marginLeft: 8 }}
        >
          {isZipping ? "Zipping…" : "Export ZIP to Downloads"}
        </button>

        <button onClick={testFirstOffline} style={{ marginLeft: 8 }}>
          Check first offline?
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ marginTop: 8 }}>
        <progress
          value={progress.done}
          max={progress.total}
          style={{ width: "100%" }}
        />
        <div>
          {progress.done} / {progress.total}
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4>Errors ({errors.length})</h4>
          <ul>
            {errors.slice(0, 60).map((err, i) => (
              <li key={i} style={{ color: "crimson" }}>
                {err}
              </li>
            ))}
          </ul>
          {errors.length > 60 && <p>Showing first 60 errors.</p>}
        </div>
      )}
    </div>
  );
}
