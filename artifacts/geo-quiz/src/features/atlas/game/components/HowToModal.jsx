import Modal from "./Modal";
import { C, FONT } from "../theme";
import { MAX_GUESSES } from "../lib/constants";

function Line({ children }) {
  return <li style={{ marginBottom: 8, lineHeight: 1.45 }}>{children}</li>;
}

export default function HowToModal({ onClose }) {
  const mono = { fontFamily: FONT.mono };
  return (
    <Modal title="HOW TO PLAY" onClose={onClose}>
      <p style={{ color: C.ink, fontSize: 14, marginTop: 0, lineHeight: 1.5 }}>
        Atlas the swallow has flown to a mystery country. Find it in {MAX_GUESSES} guesses.
      </p>
      <ul style={{ paddingLeft: 18, margin: "0 0 4px", color: C.faded, fontSize: 13.5 }}>
        <Line>Each guess reveals the <span style={{ color: C.ink }}>distance</span> and a <span style={{ color: C.ink }}>direction arrow</span> from your country's capital to the mystery capital.</Line>
        <Line>The <span style={{ color: C.teal, ...mono }}>proximity %</span> shows how close you are — 100% is a bullseye.</Line>
        <Line>A <span aria-hidden="true">🎯</span> means you found Atlas.</Line>
        <Line>All distances and directions are measured <span style={{ color: C.ink }}>capital to capital</span>.</Line>
      </ul>
      <div style={{ background: C.panelLite, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", ...mono, fontSize: 13, color: C.ink, margin: "10px 0" }}>
        🇫🇷 France · 878 km · <span aria-hidden="true">↗️</span> · <span style={{ color: C.sand }}>96%</span>
      </div>
      <p style={{ color: C.faded, fontSize: 13, marginBottom: 0 }}>
        A new puzzle appears every day at midnight UTC — the same one for everyone.
      </p>
    </Modal>
  );
}
