import { distance as levenshteinDistance } from "fastest-levenshtein";

// Two similarity functions used by dedup.ts. Both return values in
// [0, 1] where 1 is identical.
//
// Levenshtein-normalized similarity is the obvious "edit distance
// divided by max length" — good for event titles where two strings
// differ by a few characters ("Salsa Tuesdays" vs "Salsa Tuesday").
// Cheap to compute (fastest-levenshtein C-port lookalike).
//
// Jaro-Winkler weights matches near the start of the string and
// allows transpositions — better for venue names where word order
// is similar but punctuation/casing varies ("Alhambra Palace" vs
// "Alhambra Palace Banquet Hall"). Implemented locally; no extra
// dependency.

export function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// Jaro similarity (the body of Jaro-Winkler). 0 if one string empty.
function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);
  const aMatches = new Array<boolean>(aLen).fill(false);
  const bMatches = new Array<boolean>(bLen).fill(false);
  let matches = 0;

  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const t = transpositions / 2;
  return (matches / aLen + matches / bLen + (matches - t) / matches) / 3;
}

// Jaro-Winkler with the standard prefix scaling factor 0.1 (capped
// at a prefix length of 4 characters).
export function jaroWinklerSimilarity(a: string, b: string): number {
  const jaro = jaroSimilarity(a, b);
  if (jaro < 0.7) return jaro;
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}
