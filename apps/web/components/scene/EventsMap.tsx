"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapboxMap, {
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";

export type EventLite = {
  id: string;
  title: string;
  starts_at: string;
  kind: string | null;
};

export type VenueWithEvents = {
  id: string;
  name: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  events: EventLite[];
};

type Props = {
  venues: VenueWithEvents[];
  mapboxToken: string | undefined;
  selectedVenueId?: string | null;
  onSelectVenue?: (id: string | null) => void;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export function EventsMap({
  venues,
  mapboxToken,
  selectedVenueId,
  onSelectVenue,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const controlled = selectedVenueId !== undefined;
  const [internal, setInternal] = useState<string | null>(null);
  const currentId = controlled ? (selectedVenueId ?? null) : internal;

  const venueById = useMemo(() => {
    const m = new Map<string, VenueWithEvents>();
    for (const v of venues) m.set(v.id, v);
    return m;
  }, [venues]);

  const selected = currentId ? (venueById.get(currentId) ?? null) : null;

  // When the sidebar selects a venue, pan the map to it so the user
  // sees the highlighted pin without scrolling the map manually.
  useEffect(() => {
    if (!selected) return;
    mapRef.current?.flyTo({
      center: [selected.lng, selected.lat],
      zoom: 13,
      duration: 600,
    });
  }, [selected]);

  function setSelection(id: string | null) {
    if (onSelectVenue) onSelectVenue(id);
    if (!controlled) setInternal(id);
  }

  if (!mapboxToken) {
    return (
      <div className="map-shell map-shell-empty">
        <p>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
          <code>apps/web/.env.local</code> to render the Chicago map.
        </p>
      </div>
    );
  }

  return (
    <div className="map-shell">
      <MapboxMap
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{ longitude: -87.65, latitude: 41.88, zoom: 11 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />

        {venues.map((v) => (
          <Marker
            key={v.id}
            longitude={v.lng}
            latitude={v.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelection(v.id);
            }}
          >
            <span
              className={`map-pin${currentId === v.id ? " is-selected" : ""}`}
              aria-label={v.name}
            />
          </Marker>
        ))}

        {selected ? (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            offset={12}
            closeOnClick={false}
            onClose={() => setSelection(null)}
          >
            <div className="map-popup">
              <h3>{selected.name}</h3>
              {selected.neighborhood ? (
                <p className="map-popup-meta">{selected.neighborhood}</p>
              ) : null}
              {selected.events.length === 0 ? (
                <p className="map-popup-meta">No upcoming events.</p>
              ) : (
                <ul>
                  {selected.events.slice(0, 4).map((e) => (
                    <li key={e.id}>
                      <Link href={`/scene/events/${e.id}`}>
                        <strong>{e.title}</strong>
                        <span>{dateFmt.format(new Date(e.starts_at))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Popup>
        ) : null}
      </MapboxMap>
    </div>
  );
}
