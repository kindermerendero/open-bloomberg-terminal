import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

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

// runs before paint to set the theme (stored override, else OS preference) → no flash
const themeInit = `(function(){try{var s=localStorage.getItem('opnb-theme');var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${plexMono.variable} crt`}>{children}</body>
    </html>
  );
}
