"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type VenueOption = {
  id: string;
  name: string;
  neighborhood: string | null;
};

export type EventFormInitial = {
  id: string;
  title: string;
  startsAtLocal: string;        // "YYYY-MM-DDTHH:mm" in Chicago wall time
  endsAtLocal: string | null;
  kind: string | null;
  description: string | null;
  url: string | null;
  venueId: string | null;
};

type Props = {
  mode: "create" | "edit";
  venues: VenueOption[];
  initial?: EventFormInitial;
};

const KIND_OPTIONS = ["social", "class", "practica", "festival", "other"];

export function EventForm({ mode, venues, initial }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAtLocal ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAtLocal ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "social");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");

  const [useNewVenue, setUseNewVenue] = useState(false);
  const [venueId, setVenueId] = useState(
    initial?.venueId ?? venues[0]?.id ?? "",
  );
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const baseBody = {
        title: title.trim(),
        startsAt,
        endsAt: endsAt || null,
        kind: kind || null,
        description: description.trim() || null,
        url: url.trim() || null,
      };

      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...baseBody,
            ...(useNewVenue
              ? {
                  newVenue: {
                    name: newVenueName.trim(),
                    address: newVenueAddress.trim(),
                  },
                }
              : { venueId }),
          }),
        });
      } else {
        if (!initial) throw new Error("missing initial event");
        res = await fetch("/api/admin/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: initial.id,
            ...baseBody,
            venueId,
          }),
        });
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      router.push("/admin/events");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </label>

      <div className="form-row">
        <label>
          Starts (Chicago)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label>
          Ends (Chicago)
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {mode === "create" ? (
        <fieldset>
          <legend>Venue</legend>
          <label>
            <input
              type="radio"
              name="venue-mode"
              checked={!useNewVenue}
              onChange={() => setUseNewVenue(false)}
            />{" "}
            Existing
          </label>
          {!useNewVenue ? (
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              {venues.length === 0 ? (
                <option value="">No venues yet — create one below</option>
              ) : null}
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.neighborhood ? ` — ${v.neighborhood}` : ""}
                </option>
              ))}
            </select>
          ) : null}

          <label>
            <input
              type="radio"
              name="venue-mode"
              checked={useNewVenue}
              onChange={() => setUseNewVenue(true)}
            />{" "}
            New venue (will be geocoded)
          </label>
          {useNewVenue ? (
            <>
              <label>
                Name
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  required
                />
              </label>
              <label>
                Address
                <input
                  type="text"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                  placeholder="123 N Main St, Chicago, IL"
                  required
                />
              </label>
            </>
          ) : null}
        </fieldset>
      ) : (
        <label>
          Venue
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.neighborhood ? ` — ${v.neighborhood}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </label>

      <label>
        URL
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="admin-form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy
            ? "Saving…"
            : mode === "create"
            ? "Create event"
            : "Save changes"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => router.push("/admin/events")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
