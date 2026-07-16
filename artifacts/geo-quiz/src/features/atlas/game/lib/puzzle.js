// Deterministic daily puzzle selection. Every player on the same UTC date gets the
// same country. The index is scrambled so consecutive days are not alphabetical
// neighbours (SPEC.md rule 1).

// Whole days elapsed since the Unix epoch, in UTC.
export function daysSinceEpoch(date = new Date()) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor(utc / 86400000);
}

// Knuth-multiplicative scramble → index into a list of `count` countries.
export function dailyIndex(days, count) {
  return ((days * 2654435761) >>> 0) % count;
}

// Human-facing puzzle number. Offset so numbering starts around mid-2026.
const EPOCH_OFFSET = 20635; // days-since-epoch for ~2026-07-06 → puzzle #1
export function puzzleNumber(days) {
  return days - EPOCH_OFFSET;
}

// Milliseconds until the next UTC midnight (for the countdown timer).
export function msToNextUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}
