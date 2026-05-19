"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FlyerDropzone, type FlyerExtractionResult } from "./FlyerDropzone";
import { FlyerFieldBadge } from "./FlyerFieldBadge";
import { computeFieldsEdited } from "@/lib/admin/fieldsEdited";
import type { ExtractedEvent } from "@/lib/llm/extractedSchema";

export type VenueOption = {
  id: string;
  name: string;
  neighborhood: string | null;
};

export type EventFormInitial = {
  id: string;
  title: string;
  startsAtLocal: string;
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
const DEFAULT_TZ = "America/Chicago";
const DEFAULT_COUNTRY = "US";
const DEFAULT_CITY = "Chicago";

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

  // Flyer-extraction state. `original` is the untouched ExtractedEvent
  // we got back from /api/admin/flyers/extract — kept separate from
  // the editable form state so the fields-edited diff at submit time
  // is reliable. `extractionId` is the foreign key we ship back to
  // /api/admin/events on POST.
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [original, setOriginal] = useState<ExtractedEvent | null>(null);

  // Per-event location overrides. Default to Chicago/US/America/Chicago
  // so the current admin flow keeps working byte-for-byte; flyer
  // extraction can overwrite these on prefill.
  const [city, setCity] = useState(DEFAULT_CITY);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geocode probe state for the "new venue" flow. Lets the admin
  // verify Mapbox can resolve the venue BEFORE submitting the form,
  // so geocode misses can be debugged inline without burning the
  // current state (or tempting a flyer re-extraction).
  type GeocodeProbe =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "ok"; placeName: string; precision: "address" | "city" }
    | { status: "error"; message: string };
  const [probe, setProbe] = useState<GeocodeProbe>({ status: "idle" });

  async function probeGeocode() {
    setProbe({ status: "checking" });
    try {
      const res = await fetch("/api/admin/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVenueName.trim() || undefined,
          address: newVenueAddress.trim() || undefined,
          city: city.trim(),
          country: country.trim(),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setProbe({
          status: "error",
          message: payload.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const hit = (await res.json()) as {
        placeName: string;
        precision: "address" | "city";
      };
      setProbe({
        status: "ok",
        placeName: hit.placeName,
        precision: hit.precision,
      });
    } catch (e) {
      setProbe({
        status: "error",
        message: e instanceof Error ? e.message : "probe failed",
      });
    }
  }

  function applyExtraction(result: FlyerExtractionResult) {
    const ex = result.extracted;
    setExtractionId(result.extractionId);
    setOriginal(ex);

    if (ex.title) setTitle(ex.title);
    if (ex.description) setDescription(ex.description);
    if (ex.startsLocal) setStartsAt(ex.startsLocal);
    if (ex.endsLocal) setEndsAt(ex.endsLocal);
    if (ex.kind) setKind(ex.kind);
    if (ex.sourceUrl) setUrl(ex.sourceUrl);

    // When the flyer doesn't surface city/country/timezone, clear the
    // Chicago defaults so the form's `required` attribute forces the
    // admin to type them. Better than silently saving an MX event as
    // Chicago/US/America/Chicago.
    setCity(ex.city ?? "");
    setCountry(ex.country ?? "");
    setTimezone(ex.timezone ?? "");

    if (ex.venueName || ex.venueAddress) {
      setUseNewVenue(true);
      if (ex.venueName) setNewVenueName(ex.venueName);
      if (ex.venueAddress) setNewVenueAddress(ex.venueAddress);
    }
  }

  function clearExtraction() {
    setExtractionId(null);
    setOriginal(null);
  }

  function snapshot() {
    return {
      title,
      description: description || null,
      startsLocal: startsAt || null,
      endsLocal: endsAt || null,
      venueName: useNewVenue ? newVenueName : null,
      venueAddress: useNewVenue ? newVenueAddress : null,
      city,
      country,
      timezone,
      kind: kind || null,
      sourceUrl: url || null,
    };
  }

  function badgeFor(field: string) {
    if (!original) return null;
    const edited =
      computeFieldsEdited(original, snapshot()).includes(
        field as keyof ReturnType<typeof snapshot>,
      );
    return (
      <FlyerFieldBadge
        field={field}
        confidence={original.confidence}
        edited={edited}
      />
    );
  }

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
        const fieldsEdited = original
          ? computeFieldsEdited(original, snapshot())
          : [];
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
                    city: city || undefined,
                    country: country || undefined,
                    timezone: timezone || undefined,
                  },
                }
              : { venueId }),
            city,
            country,
            timezone,
            flyerExtractionId: extractionId ?? undefined,
            fieldsEdited: extractionId ? fieldsEdited : undefined,
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
      {mode === "create" ? (
        <FlyerDropzone
          onExtracted={applyExtraction}
          onCleared={clearExtraction}
        />
      ) : null}

      <label>
        <span className="admin-form-label">
          Title {badgeFor("title")}
        </span>
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
          <span className="admin-form-label">
            Starts (local) {badgeFor("startsLocal")}
          </span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="admin-form-label">
            Ends (local) {badgeFor("endsLocal")}
          </span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      {mode === "create" ? (
        <div className="form-row">
          <label>
            <span className="admin-form-label">
              City {badgeFor("city")}
            </span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="admin-form-label">
              Country {badgeFor("country")}
            </span>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              required
            />
          </label>
          <label>
            <span className="admin-form-label">
              Timezone {badgeFor("timezone")}
            </span>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Chicago"
              required
            />
          </label>
        </div>
      ) : null}

      <label>
        <span className="admin-form-label">
          Kind {badgeFor("kind")}
        </span>
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
                <span className="admin-form-label">
                  Name {badgeFor("venueName")}
                </span>
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  required
                />
              </label>
              <label>
                <span className="admin-form-label">
                  Address {badgeFor("venueAddress")}
                </span>
                <input
                  type="text"
                  value={newVenueAddress}
                  onChange={(e) => {
                    setNewVenueAddress(e.target.value);
                    setProbe({ status: "idle" });
                  }}
                  placeholder="123 N Main St, Chicago, IL"
                  required
                />
              </label>

              <div className="geocode-probe">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={probeGeocode}
                  disabled={
                    probe.status === "checking" ||
                    !newVenueName.trim() ||
                    !city.trim() ||
                    !country.trim()
                  }
                >
                  {probe.status === "checking"
                    ? "Checking…"
                    : "Retry geocoding"}
                </button>
                {probe.status === "ok" ? (
                  <span
                    className={`geocode-probe-status geocode-probe-status--${probe.precision}`}
                  >
                    {probe.precision === "address" ? "✓" : "⚠"}{" "}
                    {probe.precision === "address"
                      ? "Resolved"
                      : "City-only pin"}
                    : {probe.placeName}
                  </span>
                ) : null}
                {probe.status === "error" ? (
                  <span className="geocode-probe-status geocode-probe-status--error">
                    ✗ {probe.message}
                  </span>
                ) : null}
              </div>
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
        <span className="admin-form-label">
          Description {badgeFor("description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </label>

      <label>
        <span className="admin-form-label">
          URL {badgeFor("sourceUrl")}
        </span>
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
