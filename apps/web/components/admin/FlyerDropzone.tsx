"use client";

import { useCallback, useRef, useState } from "react";
import { Image as ImageIcon, RotateCw, X } from "lucide-react";

import type { ExtractedEvent } from "@/lib/llm/extractedSchema";

// Drag-and-drop + file picker for the admin flyer extraction flow.
// States: idle → uploading → extracting → done | error. The same
// `extracting` state covers the full POST since the route does
// upload + vision in one request; the dropzone shows two distinct
// messages just so the user sees progress.
//
// On success the parent gets the full ExtractedEvent plus the
// extractionId (referenced on submit) and the signed flyer URL (for
// the thumbnail). Re-extract reposts the held File against the same
// endpoint — useful when the first model run mis-reads something
// obvious and the admin wants a second attempt without re-uploading.

export type FlyerExtractionResult = {
  extractionId: string;
  flyerUrl: string;
  extracted: ExtractedEvent;
};

type Status = "idle" | "uploading" | "extracting" | "done" | "error";

type Props = {
  onExtracted: (result: FlyerExtractionResult) => void;
  onCleared: () => void;
};

export function FlyerDropzone({ onExtracted, onCleared }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const run = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      setError(null);
      setStatus("uploading");

      const localPreview = URL.createObjectURL(file);
      setThumbnailUrl(localPreview);

      const form = new FormData();
      form.set("flyer", file);

      try {
        setStatus("extracting");
        const res = await fetch("/api/admin/flyers/extract", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as FlyerExtractionResult;
        setThumbnailUrl(data.flyerUrl);
        setStatus("done");
        onExtracted(data);
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "extraction failed");
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    },
    [onExtracted],
  );

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    void run(files[0]);
  }

  function handleClear() {
    lastFileRef.current = null;
    setStatus("idle");
    setError(null);
    setThumbnailUrl(null);
    if (inputRef.current) inputRef.current.value = "";
    onCleared();
  }

  function handleReExtract() {
    if (!lastFileRef.current) return;
    void run(lastFileRef.current);
  }

  const busy = status === "uploading" || status === "extracting";
  const showThumb = thumbnailUrl !== null;

  return (
    <div
      className={`flyer-dropzone${isDragging ? " is-dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (busy) return;
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {showThumb ? (
        <div className="flyer-dropzone-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="Flyer preview" />
          <div className="flyer-dropzone-preview-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleReExtract}
              disabled={busy}
              aria-label="Re-extract"
            >
              <RotateCw size={14} aria-hidden /> Re-extract
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClear}
              disabled={busy}
              aria-label="Remove flyer"
            >
              <X size={14} aria-hidden /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flyer-dropzone-cta"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon size={20} aria-hidden />
          <span>Drop a flyer here, or click to upload</span>
          <small>JPEG / PNG / WebP · max 5 MB</small>
        </button>
      )}

      <div className="flyer-dropzone-status" role="status">
        {status === "uploading" ? "Uploading…" : null}
        {status === "extracting" ? "Reading flyer with Claude…" : null}
        {status === "done" ? "Form prefilled — review and edit below." : null}
        {status === "error" && error ? <span className="form-error">{error}</span> : null}
      </div>
    </div>
  );
}
