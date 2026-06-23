"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartRange } from "@/lib/types";

const RANGES: ChartRange[] = ["1d", "5d", "1mo", "6mo", "1y", "5y", "max"];
const RANGE_LABELS: Record<ChartRange, string> = {
  "1d": "1D",
  "5d": "5D",
  "1mo": "1M",
  "6mo": "6M",
  "1y": "1Y",
  "5y": "5Y",
  max: "MAX",
};

interface Props {
  symbol: string | null;
  candles: Candle[];
  range: ChartRange;
  loading: boolean;
  onRangeChange: (r: ChartRange) => void;
}

// read the active theme's colors from CSS variables (lightweight-charts paints on
// canvas and does not resolve var(), so we resolve them ourselves and re-apply on
// theme change)
function themeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    text: v("--chart-text", "#b36e00"),
    grid: v("--chart-grid", "#160f00"),
    border: v("--grid", "#3d2a00"),
    accent: v("--amber", "#ff9d00"),
    up: v("--up", "#00d96a"),
    down: v("--down", "#ff3b30"),
    volUp: v("--vol-up", "rgba(0,217,106,0.25)"),
    volDn: v("--vol-dn", "rgba(255,59,48,0.25)"),
  };
}

export default function ChartPanel({ symbol, candles, range, loading, onRangeChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  // apply theme colors to chart chrome + per-bar volume colors
  const applyTheme = () => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const vol = volumeRef.current;
    if (!chart || !candle || !vol) return;
    const c = themeColors();
    chart.applyOptions({
      layout: { textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: {
        vertLine: { color: c.accent, labelBackgroundColor: c.accent },
        horzLine: { color: c.accent, labelBackgroundColor: c.accent },
      },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    candle.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
    vol.setData(
      candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? c.volUp : c.volDn,
      }))
    );
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const c = themeColors();
    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: c.text,
        fontFamily: "var(--font-plex), monospace",
        fontSize: 11,
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: {
        vertLine: { color: c.accent, labelBackgroundColor: c.accent },
        horzLine: { color: c.accent, labelBackgroundColor: c.accent },
      },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: c.up,
      downColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
      borderVisible: false,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    // re-theme the chart when the data-theme attribute flips
    const obs = new MutationObserver(applyTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      obs.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;
    candlesRef.current = candles;
    const c = themeColors();
    candleRef.current.setData(
      candles.map((k) => ({
        time: k.time as UTCTimestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );
    volumeRef.current.setData(
      candles.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? c.volUp : c.volDn,
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="panel chart-panel">
      <div className="panel-title">
        Price Graph {symbol ? `— ${symbol}` : ""}
        <span className="sub">GP</span>
      </div>
      <div className="range-bar">
        {RANGES.map((r) => (
          <button
            key={r}
            className={r === range ? "active" : ""}
            onClick={() => onRangeChange(r)}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="chart-wrap" ref={wrapRef}>
        {loading && (
          <div className="loading" style={{ position: "absolute", zIndex: 10 }}>
            LOADING…
          </div>
        )}
      </div>
    </div>
  );
}
