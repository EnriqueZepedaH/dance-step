"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { id: string; title: string };

export function DeleteEventButton({ id, title }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError(`Delete failed (HTTP ${res.status})`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        className="btn-link-danger"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <span className="row-error"> · {error}</span> : null}
    </>
  );
}
