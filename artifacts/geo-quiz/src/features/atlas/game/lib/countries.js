import data from "../data/countries.json";
import { ALIASES } from "./aliases.js";

// Each entry: { name, capital, lat, lng, flag, region }
export const COUNTRIES = data;
export const byName = new Map(COUNTRIES.map((c) => [c.name, c]));

// Lowercase + strip diacritics, so "cote divoire" matches "Côte d'Ivoire".
export const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// Precompute searchable haystacks (name + aliases, normalized) once.
const INDEX = COUNTRIES.map((c) => ({
  country: c,
  terms: [c.name, ...(ALIASES[c.name] || [])].map(normalize),
}));

// Autocomplete search. Returns up to `limit` countries not already in `exclude`,
// ranked so prefix matches come before substring matches.
export function search(query, exclude = new Set(), limit = 6) {
  const q = normalize(query);
  if (!q) return [];
  const matches = [];
  for (const { country, terms } of INDEX) {
    if (exclude.has(country.name)) continue;
    let rank = Infinity;
    for (const t of terms) {
      if (t.startsWith(q)) { rank = 0; break; }
      if (t.includes(q)) rank = Math.min(rank, 1);
    }
    if (rank !== Infinity) matches.push({ country, rank });
  }
  matches.sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name));
  return matches.slice(0, limit).map((m) => m.country);
}
