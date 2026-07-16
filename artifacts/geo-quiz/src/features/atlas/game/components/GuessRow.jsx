import { C, FONT, proxColor } from "../theme";

// A single filled guess row, or an empty placeholder slot when `guess` is null.
export default function GuessRow({ guess }) {
  if (!guess) {
    return (
      <div
        role="listitem"
        aria-label="Empty guess slot"
        style={{ height: 46, borderRadius: 10, marginBottom: 8, border: `1px dashed ${C.line}`, opacity: 0.5 }}
      />
    );
  }

  return (
    <div
      role="listitem"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.panel,
        border: `1px solid ${guess.correct ? C.teal : C.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
        animation: "rowIn 0.25s ease",
      }}
    >
      <span style={{ fontSize: 20 }} aria-hidden="true">{guess.flag}</span>
      <span style={{ flex: 1, fontWeight: 500, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {guess.name}
      </span>
      <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.faded }}>
        {guess.km.toLocaleString()} km
      </span>
      <span
        aria-label={guess.correct ? "Correct" : "Direction hint"}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: C.panelLite,
          border: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {guess.arrow}
      </span>
      <span style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 600, color: proxColor(guess.prox), width: 42, textAlign: "right" }}>
        {guess.prox}%
      </span>
    </div>
  );
}
