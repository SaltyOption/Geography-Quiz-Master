import { useEffect, useState } from "react";
import { FONT, C } from "../theme";
import { msToNextUtcMidnight } from "../lib/puzzle";

const pad = (n) => String(n).padStart(2, "0");

// Live countdown to the next puzzle (midnight UTC).
export default function Countdown() {
  const [ms, setMs] = useState(() => msToNextUtcMidnight());

  useEffect(() => {
    const id = setInterval(() => setMs(msToNextUtcMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.faded }}>NEXT ATLAS IN</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: "0.04em" }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>
    </div>
  );
}
