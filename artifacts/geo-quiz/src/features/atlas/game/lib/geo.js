// Great-circle geometry. All inputs are { lat, lng } (capital coordinates).
// Distances and bearings are capital-to-capital by design — see SPEC.md rule 3.

export const ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];

const toRad = (d) => (d * Math.PI) / 180;

// Haversine great-circle distance in whole kilometres.
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Initial great-circle bearing from a → b, in degrees clockwise from north (0–360).
export function bearingDeg(a, b) {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Bearing snapped to the nearest of 8 compass arrows.
export const arrowFor = (deg) => ARROWS[Math.round(deg / 45) % 8];

// Proximity score: 100% at 0 km, 0% at ≥20,000 km.
export const proximity = (km) => Math.max(0, Math.round((1 - km / 20000) * 100));
