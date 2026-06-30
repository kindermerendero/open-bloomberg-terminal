"use client";

import type { NewsItem } from "@/lib/types";
import { fmtAgo } from "@/lib/format";
import { useLang } from "@/lib/i18n";

interface Props {
  items: NewsItem[];
  loading: boolean;
  symbol?: string | null;
  grow?: boolean;
}

export default function NewsPanel({ items, loading, symbol, grow }: Props) {
  const { t, lang } = useLang();
  return (
    <div className="panel" style={grow ? { flex: "1 1 auto" } : { flex: "1 1 55%" }}>
      <div className="panel-title">
        {t("news.title")} {symbol ? `— ${symbol}` : `— ${t("news.top")}`} <span className="sub">N</span>
      </div>
      <div className="panel-body">
        {items.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? t("common.loading") : t("news.empty")}
          </div>
        ) : (
          items.map((item, i) => (
            <a
              key={`${item.link}-${i}`}
              className="news-item"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="meta">
                <span className="src">{item.source}</span>
                {fmtAgo(item.pubDate, lang)}
              </div>
              <div className="headline">{item.title}</div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
