"use client";

import type { SceneViewMode } from "./SceneShell";

type Props = {
  view: SceneViewMode;
  onChange: (next: SceneViewMode) => void;
};

const VIEWS: { value: SceneViewMode; label: string }[] = [
  { value: "list", label: "List View" },
  { value: "calendar", label: "Calendar" },
  { value: "map", label: "Map" },
];

export function SceneViewNav({ view, onChange }: Props) {
  return (
    <div className="scene-view-nav" role="tablist" aria-label="View">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          role="tab"
          aria-selected={view === v.value}
          className={view === v.value ? "is-active" : ""}
          onClick={() => onChange(v.value)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
