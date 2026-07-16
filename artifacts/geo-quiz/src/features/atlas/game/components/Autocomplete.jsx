import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT } from "../theme";
import { search } from "../lib/countries";

// Country input with keyboard-accessible autocomplete. Owns its own query state and
// calls onGuess(country) on selection. Already-guessed countries are excluded.
export default function Autocomplete({ onGuess, guessedNames, shake, inputRef }) {
  const [input, setInput] = useState("");
  const [hi, setHi] = useState(0);
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  const listId = "atlas-suggestions";

  const suggestions = useMemo(
    () => search(input, guessedNames),
    [input, guessedNames]
  );

  useEffect(() => setHi(0), [input]);

  function choose(country) {
    if (!country) return;
    onGuess(country);
    setInput("");
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && suggestions.length) {
      e.preventDefault();
      choose(suggestions[hi]);
    } else if (e.key === "Escape") {
      setInput("");
    }
  }

  return (
    <div style={{ position: "relative", marginTop: 4, animation: shake ? "nudge 0.3s ease" : "none" }}>
      <input
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a country…"
        aria-label="Guess a country"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={suggestions.length ? `atlas-opt-${hi}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{
          width: "100%",
          background: C.panelLite,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          color: C.ink,
          padding: "12px 14px",
          fontSize: 16,
          fontFamily: "inherit",
        }}
      />
      {suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 10,
            background: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {suggestions.map((c, i) => (
            <li key={c.name} role="option" id={`atlas-opt-${i}`} aria-selected={i === hi}>
              <button
                onClick={() => choose(c)}
                onMouseEnter={() => setHi(i)}
                tabIndex={-1}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 15,
                  color: C.ink,
                  background: i === hi ? C.panelLite : "transparent",
                  border: "none",
                }}
              >
                <span aria-hidden="true">{c.flag}</span> {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
