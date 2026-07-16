import Modal from "./Modal";
import { C, FONT } from "../theme";

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.faded, letterSpacing: "0.08em", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

export default function StatsModal({ stats, onClose, highlightGuess }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <Modal title="STATISTICS" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Stat value={stats.played} label="PLAYED" />
        <Stat value={`${winPct}%`} label="WIN %" />
        <Stat value={stats.currentStreak} label="STREAK" />
        <Stat value={stats.maxStreak} label="MAX STREAK" />
      </div>

      <div style={{ fontSize: 11, color: C.faded, letterSpacing: "0.1em", marginBottom: 8 }}>GUESS DISTRIBUTION</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {stats.dist.map((count, i) => {
          const isHi = highlightGuess === i + 1;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, width: 10, color: C.faded }}>{i + 1}</span>
              <div style={{ flex: 1, background: "transparent" }}>
                <div
                  style={{
                    width: `${Math.max(count ? 8 : 0, (count / maxDist) * 100)}%`,
                    minWidth: count ? 24 : 0,
                    background: isHi ? C.teal : C.line,
                    color: isHi ? C.ocean : C.ink,
                    borderRadius: 4,
                    padding: "3px 8px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {count}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stats.played === 0 && (
        <p style={{ color: C.faded, fontSize: 13, marginTop: 16, marginBottom: 0, textAlign: "center" }}>
          Play your first daily puzzle to start your stats.
        </p>
      )}
    </Modal>
  );
}
