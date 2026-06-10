"use client";

import type { NewsItem } from "@/lib/types";
import { fmtAgo } from "@/lib/format";

interface Props {
  items: NewsItem[];
  loading: boolean;
  symbol?: string | null;
  grow?: boolean;
}

export default function NewsPanel({ items, loading, symbol, grow }: Props) {
  return (
    <div className="panel" style={grow ? { flex: "1 1 auto" } : { flex: "1 1 55%" }}>
      <div className="panel-title">
        News {symbol ? `— ${symbol}` : "— Top Stories"} <span className="sub">N</span>
      </div>
      <div className="panel-body">
        {items.length === 0 ? (
          <div className={loading ? "loading" : "empty"}>
            {loading ? "LOADING…" : "No headlines available"}
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
                {fmtAgo(item.pubDate)}
              </div>
              <div className="headline">{item.title}</div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
