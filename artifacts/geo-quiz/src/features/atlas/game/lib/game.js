import { haversineKm, bearingDeg, arrowFor, proximity } from "./geo.js";

// Build a guess record for `country` against the mystery `target`.
export function makeGuess(country, target) {
  const correct = country.name === target.name;
  const km = haversineKm(country, target);
  return {
    name: country.name,
    flag: country.flag,
    capital: country.capital,
    km,
    prox: proximity(km),
    correct,
    arrow: correct ? "🎯" : arrowFor(bearingDeg(country, target)),
  };
}
