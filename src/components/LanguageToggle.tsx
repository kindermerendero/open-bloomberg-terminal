"use client";

import { useLang } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      className="theme-toggle"
      onClick={() => setLang(lang === "it" ? "en" : "it")}
      title="Language / Lingua: EN ↔ IT"
    >
      ⌘ {lang.toUpperCase()}
    </button>
  );
}
