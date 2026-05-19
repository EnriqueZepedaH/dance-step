// One-shot utility: compute the text-only token overhead of the
// flyer-extraction call (system prompt + tool schema + the static
// user-message text). Subtract this from a live extraction's
// input_tokens to estimate how many tokens came from the image.
//
// Usage:
//   ANTHROPIC_API_KEY=... npx tsx apps/web/scripts/count-text-overhead.ts
//   (or via the workspace script: npm run -w web count:overhead)
//
// Re-run whenever SYSTEM_PROMPT or TOOL_SCHEMA changes — the overhead
// is otherwise fixed across every extraction.

import Anthropic from "@anthropic-ai/sdk";

import {
  SYSTEM_PROMPT,
  TOOL_SCHEMA,
  USER_PROMPT,
} from "../lib/llm/extractFlyer";

const MODEL = process.env.FLYER_EXTRACT_MODEL ?? "claude-sonnet-4-6";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.countTokens({
    model: MODEL,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "save_event",
        description: "Persist the extracted event fields.",
        input_schema: TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "save_event" },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: USER_PROMPT }],
      },
    ],
  });

  const overhead = response.input_tokens;
  console.log(`Model:        ${MODEL}`);
  console.log(`Text overhead: ${overhead} tokens`);
  console.log(`  (system prompt + save_event tool schema + user text)`);
  console.log("");
  console.log("Per-extraction breakdown:");
  console.log(`  image_tokens ≈ input_tokens − ${overhead}`);
  console.log(`  e.g. live run @ 2613 input → ~${2613 - overhead} image tokens`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
