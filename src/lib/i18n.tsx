"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DICT, type Lang } from "./dict";

export type { Lang };

const LANG_KEY = "opnb-lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tRaw: <T = unknown>(key: string) => T;
}

const LangContext = createContext<Ctx | null>(null);

function resolve(lang: Lang, key: string): unknown {
  const parts = key.split(".");
  const walk = (root: unknown) => {
    let cur = root;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  };
  const got = walk(DICT[lang]);
  return got !== undefined ? got : walk(DICT.en);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // resolve the real language on the client: URL param, else stored override, else browser language
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "it" || fromUrl === "en") {
      setLangState(fromUrl);
      return;
    }
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "it" || stored === "en") {
      setLangState(stored);
      return;
    }
    const nav = (navigator.language || "").toLowerCase();
    setLangState(nav.startsWith("it") ? "it" : "en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const v = resolve(lang, key);
    let s = typeof v === "string" ? v : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
    return s;
  };

  const tRaw = <T = unknown,>(key: string) => resolve(lang, key) as T;

  return <LangContext.Provider value={{ lang, setLang, t, tRaw }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
