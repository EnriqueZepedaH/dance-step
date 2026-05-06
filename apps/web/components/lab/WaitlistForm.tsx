"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("idle");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/lab-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setStatus("ok");
      setEmail("");
    } catch (e) {
      setStatus("error");
      setErrorMessage(
        e instanceof Error ? e.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "ok") {
    return (
      <p className="waitlist-success">
        You&rsquo;re on the list. We&rsquo;ll write when there&rsquo;s
        something honest to show.
      </p>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit}>
      <label htmlFor="lab-email" className="waitlist-label">
        Email
      </label>
      <div className="waitlist-row">
        <input
          id="lab-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={254}
          disabled={busy}
          autoComplete="email"
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : "Join the waitlist"}
        </button>
      </div>
      {status === "error" && errorMessage ? (
        <p className="form-error">{errorMessage}</p>
      ) : null}
      <p className="waitlist-fineprint">
        One email when there&rsquo;s a real preview to try. No newsletter,
        no marketing.
      </p>
    </form>
  );
}
