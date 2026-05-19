"use client";

// Small inline indicator next to form fields that were prefilled
// from a flyer extraction. Three visual states:
//
//   - "extracted 0.92"     when confidence ≥ 0.5 and the user has not
//                          edited the field
//   - "low conf 0.31"      when confidence < 0.5
//   - "edited"             once the form value diverges from the
//                          original extracted value
//
// `field` is the ExtractedEvent key. Returns null when there's no
// per-field signal (no extraction yet, or field wasn't populated).

type Props = {
  field: string;
  confidence?: Record<string, number> | null;
  edited: boolean;
};

export function FlyerFieldBadge({ field, confidence, edited }: Props) {
  if (edited) {
    return <span className="flyer-field-badge flyer-field-badge--edited">edited</span>;
  }
  if (!confidence) return null;
  const score = confidence[field];
  if (typeof score !== "number") return null;

  const variant = score < 0.5 ? "low" : "extracted";
  const label = variant === "low" ? "low conf" : "extracted";
  return (
    <span className={`flyer-field-badge flyer-field-badge--${variant}`}>
      {label} {score.toFixed(2)}
    </span>
  );
}
