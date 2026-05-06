"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";

type Props = {
  id: string;
  name: string;
  description: string | null;
};

const MAX_NAME = 40;

export function PlaylistRow({ id, name, description }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function saveRename() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name cannot be blank.");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone — bookmarks stay saved, but the playlist itself goes away.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/playlists?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Delete failed (HTTP ${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <li className="playlist-row">
      {editing ? (
        <div className="playlist-row-edit">
          <div className="char-input">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_NAME}
              disabled={busy}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") {
                  setDraft(name);
                  setEditing(false);
                  setError(null);
                }
              }}
            />
            {draft.length >= MAX_NAME - 8 ? (
              <span
                className={`char-counter${draft.length === MAX_NAME ? " at-max" : ""}`}
                aria-live="polite"
              >
                {draft.length}/{MAX_NAME}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={saveRename}
            disabled={busy}
            title="Save"
            aria-label="Save"
          >
            <Check size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setDraft(name);
              setEditing(false);
              setError(null);
            }}
            disabled={busy}
            title="Cancel"
            aria-label="Cancel"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <>
          <Link href={`/library/playlists/${id}`} className="playlist-link">
            <strong>{name}</strong>
            {description ? (
              <span className="playlist-desc">{description}</span>
            ) : null}
          </Link>
          <div className="playlist-row-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setEditing(true)}
              disabled={busy || pending}
              title="Rename"
              aria-label="Rename playlist"
            >
              <Pencil size={15} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={handleDelete}
              disabled={busy || pending}
              title="Delete"
              aria-label="Delete playlist"
            >
              <Trash2 size={15} strokeWidth={1.7} />
            </button>
          </div>
        </>
      )}
      {error ? <span className="row-error">{error}</span> : null}
    </li>
  );
}
