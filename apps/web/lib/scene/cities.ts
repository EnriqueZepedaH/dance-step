// Minimal multi-city allowlist for /scene. Chicago is the only city
// with seeded sources; Aguascalientes is added so the 4 admin-entered
// MX flyer events have somewhere to render. Adding a city = add it
// to this list, no schema changes needed.
//
// Known limitation: date-grouping in lib/scene/dates is still
// Chicago-anchored, so events near local midnight in non-Chicago
// cities may bucket one day off in list/calendar views. Acceptable
// for AGS v1; refactor to city-aware date keys is a deferred item.

export const SCENE_CITIES = ["Chicago", "Aguascalientes"] as const;
export type SceneCity = (typeof SCENE_CITIES)[number];

export const DEFAULT_SCENE_CITY: SceneCity = "Chicago";

export function resolveSceneCity(raw: string | undefined | null): SceneCity {
  if (!raw) return DEFAULT_SCENE_CITY;
  return (SCENE_CITIES as readonly string[]).includes(raw)
    ? (raw as SceneCity)
    : DEFAULT_SCENE_CITY;
}
