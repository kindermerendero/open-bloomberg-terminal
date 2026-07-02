import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "OPNB — Open Bloomberg Terminal",
  description:
    "Open source Bloomberg-style financial terminal powered exclusively by free data sources.",
};

// runs before paint to set the theme (?theme= param → stored override, else OS preference) → no flash
// a valid ?theme= is persisted so ThemeToggle (which re-applies from storage on mount) agrees with it
const themeInit = `(function(){try{var q=new URLSearchParams(location.search).get('theme');if(q==='light'||q==='dark'){localStorage.setItem('opnb-theme',q);}var s=localStorage.getItem('opnb-theme');var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the pre-paint script (theme) and LanguageProvider (lang) rewrite these attributes on the client
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${plexMono.variable} crt`}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
