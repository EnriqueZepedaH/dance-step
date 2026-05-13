"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Tiny toggle for event_sources.enabled. Optimistic update with
// rollback on failure. Lives next to the row in the sources table.

type Props = { sourceKey: string; initial: boolean };

export function SourceToggle({ sourceKey, initial }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    try {
      const res = await fetch("/api/admin/scene/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: sourceKey, enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setEnabled(!next);
      setError(e instanceof Error ? e.message : "toggle failed");
    }
  }

  return (
    <label className="source-toggle">
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={flip}
      />
      <span>{enabled ? "Enabled" : "Disabled"}</span>
      {error ? <span className="source-toggle-err"> · {error}</span> : null}
    </label>
  );
}
