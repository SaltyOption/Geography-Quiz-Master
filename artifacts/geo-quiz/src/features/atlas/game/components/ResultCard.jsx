import { C, FONT } from "../theme";
import { MAX_GUESSES } from "../lib/constants";
import { shareRows } from "../lib/share";
import Countdown from "./Countdown";

// Shown after a game ends: reveal, message, emoji recap, share + next-round controls.
export default function ResultCard({ mode, target, status, guesses, copied, onCopy, onPractice, onBackToDaily }) {
  const won = status === "won";
  const message = won
    ? `You found Atlas in ${guesses.length}/${MAX_GUESSES}! He was perched in ${target.capital}.`
    : `Atlas stays hidden this time — he was in ${target.capital}. He migrates somewhere new tomorrow.`;

  const primaryBtn = {
    background: C.coral,
    color: C.ocean,
    fontWeight: 700,
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
  };
  const ghostBtn = {
    background: "transparent",
    color: C.ink,
    fontWeight: 500,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
  };

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${won ? C.teal : C.coral}`,
        borderRadius: 12,
        padding: 16,
        marginTop: 4,
        textAlign: "center",
        animation: "popIn 0.3s ease",
      }}
    >
      <div style={{ fontSize: 34 }} aria-hidden="true">{target.flag}</div>
      <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0" }}>{target.name}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 12, color: C.faded, marginBottom: 6 }}>
        Capital: {target.capital}
      </div>
      <div style={{ color: C.faded, fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>{message}</div>

      <div style={{ fontFamily: FONT.mono, fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
        {shareRows(guesses).map((r, i) => (
          <div key={i}>{r}</div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button style={primaryBtn} onClick={onCopy}>
          {copied ? "Copied ✓" : "Copy result"}
        </button>
        {mode === "daily" ? (
          <button style={ghostBtn} onClick={onPractice}>Practice round</button>
        ) : (
          <button style={ghostBtn} onClick={onBackToDaily}>Back to today's puzzle</button>
        )}
      </div>

      {mode === "daily" && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <Countdown />
        </div>
      )}
    </div>
  );
}
