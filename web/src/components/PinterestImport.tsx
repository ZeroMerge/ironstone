import { useState } from "react";
import { importPinterestBoard, pinterestImageProxyUrl } from "../lib/api";
import { normalizeImage } from "../lib/images";
import { putImage } from "../db/repo";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; added: number };

function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

function isValidBoardUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    const u = new URL(normalized);
    const isPinIt = /(^|\.)pin\.it$/i.test(u.hostname);
    const isPinterest = /(^|\.)pinterest\./i.test(u.hostname);
    if (isPinIt && u.pathname.replace(/\/+$/, '').length > 1) return true;
    if (isPinterest && u.pathname.split('/').filter(Boolean).length >= 1) return true;
    return false;
  } catch {
    return false;
  }
}

export default function PinterestImport({
  projectId,
  existingImages, onClose,
  onImported,
}: {
  projectId: string;
  existingImages: any[]; onClose?: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [progress, setProgress] = useState("");

  async function run() {
    const normalized = normalizeUrl(url);
    if (!isValidBoardUrl(normalized)) {
      setPhase({ kind: "error", message: "Please enter a valid Pinterest board URL (e.g. pinterest.com/user/board or pin.it/...)" });
      return;
    }
    setPhase({ kind: "loading" });
    setProgress("Fetching board...");
    try {
      const { pins } = await importPinterestBoard(normalized);
      if (pins.length === 0) {
        setPhase({ kind: "error", message: "This board has no images." });
        return;
      }
      let added = 0;
      for (const [i, pin] of pins.entries()) {
        setProgress(`Saving image ${i + 1} of ${pins.length}...`);
        try {
          if (existingImages.some(img => img.originalUrl === pin.imageUrl)) continue;
          const res = await fetch(pinterestImageProxyUrl(pin.imageUrl));
          if (!res.ok) continue;
          const blob = await normalizeImage(await res.blob());
          await putImage({ projectId, styleGroupId: null, blob, source: "pinterest", originalUrl: pin.imageUrl });
          added += 1;
        } catch {
          // Skip individual failures
        }
      }
      
      setUrl("");
      setPhase({ kind: "idle" });
      onImported();
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error && err.message.includes('configured') ? 'Pinterest import is not currently configured. Contact support.' : "Pinterest board couldn't be imported. Check the board URL and try again.",
      });
    }
  }

  return (
    <div className="mb-8 p-5 bg-surface rounded-lg shadow-lift ">
      <h2 className="text-sm font-bold text-text-muted mb-4">Import from Pinterest</h2>
      
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="board-url">
            Board URL
          </label>
          <input
            id="board-url"
            className="input"
            placeholder="https://www.pinterest.com/you/your-board/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={phase.kind === "loading"}
          />
        </div>

        {phase.kind === "error" && (
          <div className="rounded-md bg-accent-soft px-4 py-3 text-sm">
            <p className="font-semibold">Pinterest board couldn't be imported.</p>
            <p className="mt-0.5 text-text-muted">{phase.message}</p>
          </div>
        )}
        
        {phase.kind === "loading" && (
          <p className="text-sm text-text-muted">{progress}</p>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-primary" onClick={run} disabled={phase.kind === "loading"}>
            {phase.kind === "loading"
              ? "Importing..."
              : phase.kind === "error"
                ? "Try again"
                : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}





