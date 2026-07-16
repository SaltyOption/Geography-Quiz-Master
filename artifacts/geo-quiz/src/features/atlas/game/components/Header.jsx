import { useState } from "react";
import { C, FONT } from "../theme";

// Atlas mascot (public/atlas-mascot.png, 361×460). Falls back to the 🐦 emoji if the
// image is missing so the header never breaks.
const MASCOT_RATIO = 361 / 460;
function Mascot({ size = 34 }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span aria-hidden="true" style={{ fontSize: size }}>🐦</span>;
  return (
    <img
      src="/atlas-mascot.png"
      alt="Atlas the swallow"
      width={Math.round(size * MASCOT_RATIO)}
      height={size}
      onError={() => setOk(false)}
      style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
    />
  );
}

export default function Header({ mode, puzzleNum, streak, onStats, onHelp }) {
  const iconBtn = {
    background: "transparent",
    border: `1px solid ${C.line}`,
    color: C.ink,
    borderRadius: 8,
    width: 32,
    height: 32,
    fontSize: 14,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: `1px solid ${C.line}`,
        paddingBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Mascot size={36} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.01em", margin: 0, whiteSpace: "nowrap" }}>
            WHERE'S <span style={{ color: C.coral }}>ATLAS?</span>
          </h1>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.faded, letterSpacing: "0.12em" }}>
            {mode === "daily" ? `PUZZLE #${puzzleNum}` : "PRACTICE ROUND"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ textAlign: "right", fontFamily: FONT.mono, marginRight: 2 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.sand, lineHeight: 1 }}>{streak}🔥</div>
          <div style={{ fontSize: 9, color: C.faded, letterSpacing: "0.12em" }}>STREAK</div>
        </div>
        <button style={iconBtn} onClick={onStats} aria-label="Statistics" title="Statistics">📊</button>
        <button style={iconBtn} onClick={onHelp} aria-label="How to play" title="How to play">?</button>
      </div>
    </header>
  );
}
