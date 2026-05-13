"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { id: string };

export function PromoteRejectionButton({ id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scene/rejections/${id}/promote`, {
        method: "POST",
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
    <span>
      <button
        type="button"
        className="btn btn-small"
        onClick={promote}
        disabled={busy || pending}
      >
        {busy ? "Promoting…" : "Promote anyway"}
      </button>
      {error ? (
        <div className="row-error" style={{ marginTop: 6 }}>{error}</div>
      ) : null}
    </span>
  );
}
