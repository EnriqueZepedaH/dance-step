"use client";

import { useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
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
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export function EventsMap({ venues, mapboxToken }: Props) {
  const [selected, setSelected] = useState<VenueWithEvents | null>(null);

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
      <Map
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
              setSelected(v);
            }}
          >
            <span className="map-pin" aria-label={v.name} />
          </Marker>
        ))}

        {selected ? (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            offset={12}
            closeOnClick={false}
            onClose={() => setSelected(null)}
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
      </Map>
    </div>
  );
}
