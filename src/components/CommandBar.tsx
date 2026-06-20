"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";

interface Props {
  onCommand: (cmd: string) => void;
  message: string;
  isError: boolean;
}

const KNOWN_COMMANDS =
  /^(HELP|FX|CRY|SEC|N|W|CAPM|OV|EQV|DDM|MNA|RGT|IPO|OPA|BOND|YC|GOVT|MKWZ|PORT|RIGHTS|BUYBACK|TENDER|1D|5D|1M|6M|1Y|5Y|MAX|ADD\s|DEL\s)/i;

export default function CommandBar({ onCommand, message, isError }: Props) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep focus on the command line, Bloomberg style
  useEffect(() => {
    const refocus = () => {
      const sel = window.getSelection();
      if (sel && sel.toString()) return;
      inputRef.current?.focus();
    };
    refocus();
    document.addEventListener("click", refocus);
    return () => document.removeEventListener("click", refocus);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2 || KNOWN_COMMANDS.test(q)) {
      setSuggestions([]);
      setActiveIdx(-1);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions(json.results ?? []);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const submit = (cmd: string) => {
    setValue("");
    setSuggestions([]);
    setActiveIdx(-1);
    onCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIdx(-1);
      setValue("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        submit(suggestions[activeIdx].symbol);
      } else if (value.trim()) {
        submit(value.trim());
      }
    }
  };

  return (
    <div className="cmdbar">
      <span className="prompt">&gt;</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter ticker or command — HELP for the full list"
        spellCheck={false}
        autoComplete="off"
      />
      {message && <span className={`msg${isError ? " err" : ""}`}>{message}</span>}
      <span className="go">GO ⏎</span>
      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s, i) => (
            <div
              key={s.symbol}
              className={`row${i === activeIdx ? " active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(s.symbol);
              }}
            >
              <span className="sym">{s.symbol}</span>
              <span>{s.name}</span>
              <span className="meta">{s.exchange}</span>
              <span className="meta">{s.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
