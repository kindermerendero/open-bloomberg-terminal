"use client";

import { useEffect, useState } from "react";

type Pref = "auto" | "light" | "dark";

const ICON: Record<Pref, string> = { auto: "◐", light: "○", dark: "●" };
const NEXT: Record<Pref, Pref> = { auto: "dark", dark: "light", light: "auto" };

export default function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("auto");
  const [mounted, setMounted] = useState(false);

  // read the stored preference once on the client
  useEffect(() => {
    const s = localStorage.getItem("opnb-theme");
    setPref(s === "light" || s === "dark" ? s : "auto");
    setMounted(true);
  }, []);

  // apply preference → data-theme; on AUTO follow the OS and keep storage clean
  useEffect(() => {
    if (!mounted) return;
    const sys = () => (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", pref === "auto" ? sys() : pref);
    if (pref === "auto") {
      localStorage.removeItem("opnb-theme");
      const mq = matchMedia("(prefers-color-scheme: light)");
      const onChange = () => document.documentElement.setAttribute("data-theme", sys());
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    localStorage.setItem("opnb-theme", pref);
  }, [pref, mounted]);

  return (
    <button
      className="theme-toggle"
      onClick={() => setPref((p) => NEXT[p])}
      title="Theme: AUTO → DARK → LIGHT"
    >
      {mounted ? `${ICON[pref]} ${pref.toUpperCase()}` : "◐"}
    </button>
  );
}
