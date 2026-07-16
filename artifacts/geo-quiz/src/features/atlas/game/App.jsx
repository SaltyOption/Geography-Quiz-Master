import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT } from "./theme";
import { MAX_GUESSES, SITE } from "./lib/constants";
import { COUNTRIES, byName } from "./lib/countries";
import { daysSinceEpoch, dailyIndex, puzzleNumber } from "./lib/puzzle";
import { makeGuess } from "./lib/game";
import { buildShareText, copyText } from "./lib/share";
import {
  loadStats,
  saveStats,
  applyResult,
  loadDaily,
  saveDaily,
  getHowToSeen,
  setHowToSeen,
} from "./lib/storage";

import Header from "./components/Header";
import GuessRow from "./components/GuessRow";
import Autocomplete from "./components/Autocomplete";
import ResultCard from "./components/ResultCard";
import StatsModal from "./components/StatsModal";
import HowToModal from "./components/HowToModal";

export default function App() {
  // Today's puzzle is fixed for the session (computed once from the UTC date).
  const today = useMemo(() => {
    const days = daysSinceEpoch();
    return { days, num: puzzleNumber(days), idx: dailyIndex(days, COUNTRIES.length) };
  }, []);

  const [mode, setMode] = useState("daily"); // "daily" | "practice"
  const [targetIdx, setTargetIdx] = useState(today.idx);
  const [guesses, setGuesses] = useState([]);
  const [status, setStatus] = useState(null); // null | "won" | "lost"
  const [stats, setStats] = useState(loadStats);
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const inputRef = useRef(null);

  const target = COUNTRIES[targetIdx];
  const guessedNames = useMemo(() => new Set(guesses.map((g) => g.name)), [guesses]);

  // On first mount: restore today's daily game, and show how-to on first ever visit.
  useEffect(() => {
    const saved = loadDaily(today.num);
    if (saved) {
      const t = COUNTRIES[today.idx];
      setGuesses(saved.guesses.map((n) => makeGuess(byName.get(n), t)));
      setStatus(saved.status);
    }
    if (!getHowToSeen()) {
      setShowHowTo(true);
      setHowToSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(country) {
    if (status || !country || guessedNames.has(country.name)) return;
    const g = makeGuess(country, target);
    const next = [...guesses, g];
    setGuesses(next);

    const won = g.correct;
    const lost = !won && next.length >= MAX_GUESSES;
    const newStatus = won ? "won" : lost ? "lost" : null;

    if (newStatus) setStatus(newStatus);
    else {
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }

    // Persistence + stats are daily-only; practice never touches them.
    if (mode === "daily") {
      if (newStatus) {
        const ns = applyResult(stats, won, next.length);
        setStats(ns);
        saveStats(ns);
        if (won) setTimeout(() => setShowStats(true), 900);
      }
      saveDaily({ puzzleNum: today.num, guesses: next.map((x) => x.name), status: newStatus });
    }
  }

  function startPractice() {
    setMode("practice");
    setTargetIdx(Math.floor(Math.random() * COUNTRIES.length));
    setGuesses([]);
    setStatus(null);
    setCopied(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function backToDaily() {
    setMode("daily");
    setTargetIdx(today.idx);
    setCopied(false);
    const saved = loadDaily(today.num);
    if (saved) {
      const t = COUNTRIES[today.idx];
      setGuesses(saved.guesses.map((n) => makeGuess(byName.get(n), t)));
      setStatus(saved.status);
    } else {
      setGuesses([]);
      setStatus(null);
    }
  }

  async function onCopy() {
    const text = buildShareText({ mode, puzzleNum: today.num, guesses, status });
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const rows = [...guesses];
  while (rows.length < MAX_GUESSES) rows.push(null);

  const linkStyle = {
    background: "transparent",
    color: C.faded,
    border: "none",
    fontSize: 13,
    textDecoration: "underline",
    padding: 0,
  };

  return (
    <div style={{ fontFamily: FONT.ui }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 32px" }}>
        <Header
          mode={mode}
          puzzleNum={today.num}
          streak={stats.currentStreak}
          onStats={() => setShowStats(true)}
          onHelp={() => setShowHowTo(true)}
        />

        <p style={{ color: C.faded, fontSize: 14, margin: "14px 0 12px", lineHeight: 1.5 }}>
          Atlas has flown to a new country. Can you find the country? If your guess is incorrect, Atlas
          will give you hints about <span style={{ color: C.ink }}>distance</span> and{" "}
          <span style={{ color: C.ink }}>direction</span> to the country. Try to find it in {MAX_GUESSES} guesses.
        </p>

        {mode === "practice" && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: "0.12em",
              color: C.sand,
              border: `1px solid ${C.sand}`,
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            PRACTICE MODE · DOESN'T AFFECT YOUR STATS
          </div>
        )}

        <div role="list" aria-label="Guesses">
          {rows.map((g, i) => (
            <GuessRow key={i} guess={g} />
          ))}
        </div>

        {!status ? (
          <Autocomplete onGuess={submit} guessedNames={guessedNames} shake={shake} inputRef={inputRef} />
        ) : (
          <ResultCard
            mode={mode}
            target={target}
            status={status}
            guesses={guesses}
            copied={copied}
            onCopy={onCopy}
            onPractice={startPractice}
            onBackToDaily={backToDaily}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
          {mode === "practice" ? (
            <button style={linkStyle} onClick={backToDaily}>← Back to today's puzzle</button>
          ) : !status ? (
            <button style={linkStyle} onClick={startPractice}>Try a practice round</button>
          ) : (
            <span />
          )}
          <a
            href={`https://${SITE}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.faded, fontSize: 12, textDecoration: "none", fontFamily: FONT.mono }}
          >
            {SITE} ↗
          </a>
        </div>
      </div>

      {showStats && (
        <StatsModal
          stats={stats}
          highlightGuess={mode === "daily" && status === "won" ? guesses.length : null}
          onClose={() => setShowStats(false)}
        />
      )}
      {showHowTo && <HowToModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
