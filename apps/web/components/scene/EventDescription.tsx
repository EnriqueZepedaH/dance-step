import { ExternalLink } from "lucide-react";
import {
  parseEventDescription,
  type EventDescriptionPart,
} from "@/lib/scene/description";

type Props = {
  description: string | null;
  className: string;
  maxLength?: number;
};

function renderPart(part: EventDescriptionPart, index: number) {
  if (part.type === "text") {
    return <span key={`text-${index}`}>{part.text}</span>;
  }

  return (
    <a
      key={`${part.href}-${index}`}
      className="event-description-link"
      href={part.href}
      target="_blank"
      rel="noreferrer"
      title={part.href}
      aria-label={`Open ${part.href}`}
    >
      <ExternalLink size={13} strokeWidth={2} aria-hidden />
    </a>
  );
}

export function EventDescription({ description, className, maxLength }: Props) {
  const blocks = parseEventDescription(description, { maxLength });
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => (
        <p
          key={
            block.parts.map((part) => part.text).join("").slice(0, 48) ||
            blockIndex
          }
        >
          {block.parts.map(renderPart)}
        </p>
      ))}
    </div>
  );
}
