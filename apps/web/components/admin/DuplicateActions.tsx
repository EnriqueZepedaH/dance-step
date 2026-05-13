"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { id: string };

// Merge keeps the existing event; Replace archives existing and
// promotes the duplicate candidate in its place. POST hits a
// single endpoint that branches on action.

export function DuplicateActions({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "merge" | "replace") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scene/duplicates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dup-actions">
      <button
        type="button"
        className="btn btn-small"
        onClick={() => act("merge")}
        disabled={busy || pending}
        title="Keep the existing event; close this rejection"
      >
        Merge (keep existing)
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => act("replace")}
        disabled={busy || pending}
        title="Archive existing; promote candidate"
      >
        Replace
      </button>
      {error ? <div className="row-error" style={{ marginTop: 6 }}>{error}</div> : null}
    </div>
  );
}
