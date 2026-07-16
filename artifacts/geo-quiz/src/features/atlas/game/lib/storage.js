// localStorage persistence. All access is guarded so the game still runs if storage
// is unavailable (private mode, disabled cookies) — it just won't remember anything.

const K = {
  STATS: "wa_stats_v1",
  DAILY: "wa_daily_v1",
  HOWTO: "wa_howto_v1",
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / unavailable */
  }
}

export const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0], // wins by guess count (index 0 = solved in 1)
};

export function loadStats() {
  const s = read(K.STATS, null);
  if (!s) return { ...DEFAULT_STATS };
  return {
    ...DEFAULT_STATS,
    ...s,
    dist: Array.isArray(s.dist) && s.dist.length === 6 ? s.dist.slice() : [...DEFAULT_STATS.dist],
  };
}
export function saveStats(stats) {
  write(K.STATS, stats);
}

// Pure reducer: fold a finished daily game into the stats. Daily only — practice
// never calls this.
export function applyResult(stats, won, guessCount) {
  const s = { ...stats, dist: stats.dist.slice() };
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.currentStreak += 1;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
    s.dist[guessCount - 1] += 1;
  } else {
    s.currentStreak = 0;
  }
  return s;
}

// Today's daily game state, or null if none stored for this puzzle number.
export function loadDaily(puzzleNum) {
  const d = read(K.DAILY, null);
  return d && d.puzzleNum === puzzleNum ? d : null;
}
export function saveDaily(state) {
  write(K.DAILY, state);
}

export function getHowToSeen() {
  return read(K.HOWTO, false) === true;
}
export function setHowToSeen() {
  write(K.HOWTO, true);
}
