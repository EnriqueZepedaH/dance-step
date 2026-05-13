const BLOCK_TAG_RE =
  /<\/?\s*(address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;
const LINK_TAG_RE = /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi;
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const LINK_TOKEN_RE = /\uE000(\d+)\uE001/g;
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "-",
  emdash: "-",
  endash: "-",
  gt: ">",
  hellip: "...",
  laquo: '"',
  ldquo: '"',
  lsquo: "'",
  lt: "<",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  quot: '"',
  raquo: '"',
  rdquo: '"',
  rsquo: "'",
};

function fromCodePointOrFallback(codePoint: number, fallback: string): string {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}

export type EventDescriptionPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

export type EventDescriptionBlock = {
  parts: EventDescriptionPart[];
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi,
    (match, entity) => {
      const key = String(entity).toLowerCase();

      if (key.startsWith("#x")) {
        const codePoint = Number.parseInt(key.slice(2), 16);
        return fromCodePointOrFallback(codePoint, match);
      }

      if (key.startsWith("#")) {
        const codePoint = Number.parseInt(key.slice(1), 10);
        return fromCodePointOrFallback(codePoint, match);
      }

      return NAMED_ENTITIES[key] ?? match;
    },
  );
}

function stripMarkup(value: string): string {
  return value
    .replace(/<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(BLOCK_TAG_RE, "\n\n")
    .replace(/<[^>]+>/g, " ");
}

function cleanPlainText(value: string): string {
  return decodeHtmlEntities(stripMarkup(decodeHtmlEntities(value)))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeHref(rawHref: string | undefined): string | null {
  if (!rawHref) return null;

  const href = decodeHtmlEntities(rawHref).trim();
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function extractHref(attrs: string): string | undefined {
  const match = attrs.match(HREF_RE);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function normalizeInput(value: string): {
  text: string;
  links: { text: string; href: string }[];
} {
  const links: { text: string; href: string }[] = [];
  let text = decodeHtmlEntities(decodeHtmlEntities(value));

  text = text
    .replace(/<\s*(script|style)\b[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(LINK_TAG_RE, (_match, attrs: string, inner: string) => {
      const linkText = cleanPlainText(inner);
      const href = sanitizeHref(extractHref(attrs));

      if (!href || !linkText) return linkText;

      const index = links.push({ text: linkText, href }) - 1;
      return ` \uE000${index}\uE001 `;
    });

  return { text: cleanPlainText(text), links };
}

function splitTrailingPunctuation(value: string): {
  body: string;
  trailing: string;
} {
  const match = value.match(/^(.+?)([),.;:!?]+)?$/);
  return {
    body: match?.[1] ?? value,
    trailing: match?.[2] ?? "",
  };
}

function mergeText(parts: EventDescriptionPart[]): EventDescriptionPart[] {
  const merged: EventDescriptionPart[] = [];
  for (const part of parts) {
    const prev = merged.at(-1);
    if (part.type === "text" && prev?.type === "text") {
      prev.text += part.text;
    } else if (part.text) {
      merged.push(part);
    }
  }
  return merged;
}

function linkifyText(text: string): EventDescriptionPart[] {
  const parts: EventDescriptionPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_RE)) {
    const rawUrl = match[0];
    const index = match.index ?? 0;
    const { body, trailing } = splitTrailingPunctuation(rawUrl);
    const href = sanitizeHref(
      body.startsWith("www.") ? `https://${body}` : body,
    );

    if (index > cursor) {
      parts.push({ type: "text", text: text.slice(cursor, index) });
    }

    if (href) {
      parts.push({ type: "link", text: body, href });
    } else {
      parts.push({ type: "text", text: body });
    }

    if (trailing) parts.push({ type: "text", text: trailing });
    cursor = index + rawUrl.length;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", text: text.slice(cursor) });
  }

  return mergeText(parts);
}

function parseParts(
  paragraph: string,
  links: { text: string; href: string }[],
): EventDescriptionPart[] {
  const parts: EventDescriptionPart[] = [];
  let cursor = 0;

  for (const match of paragraph.matchAll(LINK_TOKEN_RE)) {
    const index = match.index ?? 0;
    const link = links[Number(match[1])];

    if (index > cursor) {
      parts.push(...linkifyText(paragraph.slice(cursor, index)));
    }

    if (link) parts.push({ type: "link", text: link.text, href: link.href });
    cursor = index + match[0].length;
  }

  if (cursor < paragraph.length) {
    parts.push(...linkifyText(paragraph.slice(cursor)));
  }

  return mergeText(parts);
}

function truncateBlocks(
  blocks: EventDescriptionBlock[],
  maxLength: number,
): EventDescriptionBlock[] {
  let remaining = maxLength;
  const nextBlocks: EventDescriptionBlock[] = [];

  for (const block of blocks) {
    const nextParts: EventDescriptionPart[] = [];

    for (const part of block.parts) {
      if (remaining <= 0) break;
      if (part.text.length <= remaining) {
        nextParts.push(part);
        remaining -= part.text.length;
        continue;
      }

      const clipped = part.text.slice(0, remaining + 1);
      const boundary = Math.max(
        clipped.lastIndexOf(" "),
        clipped.lastIndexOf("\n"),
        clipped.lastIndexOf("."),
        clipped.lastIndexOf(","),
      );
      const text = clipped
        .slice(0, boundary > remaining * 0.65 ? boundary : remaining)
        .trimEnd();
      if (text) nextParts.push({ ...part, text: `${text}...` });
      remaining = 0;
      break;
    }

    if (nextParts.length > 0) nextBlocks.push({ parts: nextParts });
    if (remaining <= 0) break;
  }

  return nextBlocks;
}

export function parseEventDescription(
  value: string | null | undefined,
  options: { maxLength?: number } = {},
): EventDescriptionBlock[] {
  if (!value) return [];

  const { text, links } = normalizeInput(value);
  const blocks = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ parts: parseParts(paragraph, links) }))
    .filter((block) => block.parts.length > 0);

  return options.maxLength ? truncateBlocks(blocks, options.maxLength) : blocks;
}
