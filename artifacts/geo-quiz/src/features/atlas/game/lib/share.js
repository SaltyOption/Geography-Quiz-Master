import { MAX_GUESSES, PLAY_URL } from "./constants.js";

// One emoji row per guess (SPEC.md "Share card format").
export function shareRows(guesses) {
  return guesses.map((g) => {
    if (g.correct) return "🟩🟩🟩🟩🟩 🎯";
    let greens = Math.floor(g.prox / 20);
    let partial = g.prox % 20 >= 10 ? 1 : 0;
    if (greens >= 5) {
      greens = 4;
      partial = 1;
    }
    return "🟩".repeat(greens) + "🟨".repeat(partial) + "⬛".repeat(5 - greens - partial) + " " + g.arrow;
  });
}

export function buildShareText({ mode, puzzleNum, guesses, status }) {
  const score = status === "won" ? guesses.length : "X";
  const head =
    mode === "daily"
      ? `Where's Atlas? 🐦 #${puzzleNum} ${score}/${MAX_GUESSES}`
      : `Where's Atlas? 🐦 Practice ${score}/${MAX_GUESSES}`;
  return [head, ...shareRows(guesses), PLAY_URL].join("\n");
}

// Copy with the async Clipboard API, falling back to execCommand for older/insecure
// contexts. Returns true on success.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
