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

export default function ChartPanel({ symbol, candles, range, loading, onRangeChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: "#b36e00",
        fontFamily: "var(--font-plex), monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#160f00" },
        horzLines: { color: "#160f00" },
      },
      crosshair: {
        vertLine: { color: "#ff9d00", labelBackgroundColor: "#ff9d00" },
        horzLine: { color: "#ff9d00", labelBackgroundColor: "#ff9d00" },
      },
      rightPriceScale: { borderColor: "#3d2a00" },
      timeScale: { borderColor: "#3d2a00", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00d96a",
      downColor: "#ff3b30",
      wickUpColor: "#00d96a",
      wickDownColor: "#ff3b30",
      borderVisible: false,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(255, 157, 0, 0.25)",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;
    candleRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(0, 217, 106, 0.25)" : "rgba(255, 59, 48, 0.25)",
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
