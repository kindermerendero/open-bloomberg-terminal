import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import type { NewsItem } from "@/lib/types";

const parser = new Parser({ timeout: 8000 });

const GENERAL_FEEDS = [
  { source: "YAHOO", url: "https://finance.yahoo.com/news/rssindex" },
  {
    source: "CNBC",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
  },
  {
    source: "CNBC MKTS",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
  },
];

const cache = new Map<string, { at: number; items: NewsItem[] }>();
const TTL_MS = 120_000;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ items: cached.items });
  }

  const feeds = symbol
    ? [
        {
          source: symbol,
          url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
            symbol
          )}&region=US&lang=en-US`,
        },
      ]
    : GENERAL_FEEDS;

  const settled = await Promise.allSettled(
    feeds.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items ?? []).map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate ? Date.parse(item.pubDate) : 0,
        source: f.source,
      }));
    })
  );

  const items: NewsItem[] = settled
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((i) => i.title && i.link)
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, 50);

  if (items.length > 0) cache.set(symbol, { at: Date.now(), items });
  return NextResponse.json({ items });
}
