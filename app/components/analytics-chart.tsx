import { useEffect, useRef, useState } from "react";
import type { AnalyticsTimeframe } from "../database.server";
import type { Language } from "../localization";

type Series = { id: number; name: string; values: number[] };
const colors = ["#b7ff4a", "#55e6a5", "#63c7ff", "#ffc857", "#d78cff", "#ff7f73", "#8ea9ff"];

function labelFor(bucket: string, timeframe: AnalyticsTimeframe, language: Language) {
  const locale = language === "uk" ? "uk-UA" : "ru-RU";
  const date = new Date(`${timeframe === "month" ? `${bucket}-01` : bucket}T00:00:00Z`);
  return date.toLocaleDateString(locale, timeframe === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
}

export function AnalyticsChart({ buckets, series, timeframe, language }: { buckets: string[]; series: Series[]; timeframe: AnalyticsTimeframe; language: Language }) {
  const [active, setActive] = useState<number | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
  const [activePoint, setActivePoint] = useState<{ seriesId: number; index: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const [graphHeight, setGraphHeight] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.scrollLeft = canvas.scrollWidth;
    });
    return () => cancelAnimationFrame(frame);
  }, [timeframe, buckets.join("|")]);
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const update = () => setGraphHeight(graph.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(graph);
    return () => observer.disconnect();
  }, []);
  const width = 852, height = 330, left = 10, right = 20, top = 26, bottom = 52;
  const chartWidth = width - left - right, chartHeight = height - top - bottom;
  const maximum = Math.max(1, ...series.flatMap((item) => item.values));
  const tickIntervals = Math.min(4, maximum);
  const ticks = Array.from({ length: tickIntervals + 1 }, (_, step) => ({
    value: Math.round(maximum - (maximum * step) / tickIntervals),
    position: top + (chartHeight * step) / tickIntervals,
  }));
  const x = (index: number) => left + (index * chartWidth) / Math.max(1, buckets.length - 1);
  const y = (value: number) => top + chartHeight - (value / maximum) * chartHeight;
  const path = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ");
  const visibleSeries = series.filter((item) => item.values.some(Boolean));
  const displayedSeries = active ?? selectedSeries;
  const pointIsActive = (seriesId: number, index: number) => activePoint?.seriesId === seriesId && activePoint.index === index;
  const isTouch = () => window.matchMedia("(hover: none), (pointer: coarse)").matches;

  return <div className="analytics-chart">
    <div className="analytics-chart__canvas" ref={canvasRef}>
      <svg className="analytics-chart__fixed-axis" viewBox={`0 0 48 ${height}`} style={{ height: graphHeight || undefined }} aria-hidden="true">
        {ticks.map((tick) => <text key={tick.value} x="40" y={tick.position + 4} textAnchor="end">{tick.value}</text>)}
      </svg>
      <svg ref={graphRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={language === "uk" ? "Графік переглядів" : "График просмотров"}>
        {ticks.map((tick) => <line key={tick.value} x1={left} y1={tick.position} x2={width - right} y2={tick.position} className="analytics-chart__grid" />)}
        {buckets.map((bucket, index) => (index % (buckets.length > 10 ? 2 : 1) === 0 || index === buckets.length - 1) && <text key={bucket} x={x(index)} y={height - 18} textAnchor="middle">{labelFor(bucket, timeframe, language)}</text>)}
        {series.map((item, index) => <g key={item.id} className={displayedSeries !== null && displayedSeries !== item.id ? "analytics-chart__series analytics-chart__series--muted" : "analytics-chart__series"}>
          <path d={path(item.values)} fill="none" stroke={colors[index % colors.length]} strokeWidth="3" />
          <path className="analytics-chart__line-hit" d={path(item.values)} fill="none" stroke="transparent" strokeWidth="16" onMouseEnter={() => setActive(item.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(item.id)} onBlur={() => setActive(null)} onClick={() => setSelectedSeries((current) => current === item.id ? null : item.id)} tabIndex={0}><title>{item.name}</title></path>
          {item.values.map((value, pointIndex) => <g key={pointIndex} className="analytics-chart__point">
            {pointIsActive(item.id, pointIndex) && <>
              <line x1={x(pointIndex)} y1={y(value)} x2={x(pointIndex)} y2={top + chartHeight} className="analytics-chart__point-guide" />
              <rect x={Math.max(left, Math.min(width - right - 112, x(pointIndex) - 56))} y={Math.max(top, y(value) - 38)} width="112" height="25" rx="6" className="analytics-chart__point-label-bg" />
              <text x={Math.max(left + 56, Math.min(width - right - 56, x(pointIndex)))} y={Math.max(top + 17, y(value) - 21)} textAnchor="middle" className="analytics-chart__point-label">{labelFor(buckets[pointIndex], timeframe, language)}</text>
            </>}
            <circle cx={x(pointIndex)} cy={y(value)} r={pointIsActive(item.id, pointIndex) ? 6 : 4.5} fill={colors[index % colors.length]} className="analytics-chart__point-dot" />
            <circle cx={x(pointIndex)} cy={y(value)} r="15" fill="transparent" className="analytics-chart__point-hit" tabIndex={0}
              onMouseEnter={() => { if (!isTouch()) { setActive(item.id); setActivePoint({ seriesId: item.id, index: pointIndex }); } }}
              onMouseLeave={() => { if (!isTouch()) { setActive(null); setActivePoint(null); } }}
              onFocus={() => { setActive(item.id); setActivePoint({ seriesId: item.id, index: pointIndex }); }}
              onBlur={() => { setActive(null); setActivePoint(null); }}
              onClick={() => { if (isTouch()) { setActive(item.id); setActivePoint(pointIsActive(item.id, pointIndex) ? null : { seriesId: item.id, index: pointIndex }); } }}>
              <title>{labelFor(buckets[pointIndex], timeframe, language)}</title>
            </circle>
          </g>)}
        </g>)}
      </svg>
      {displayedSeries !== null && <div className="analytics-chart__tooltip">{series.find((item) => item.id === displayedSeries)?.name}</div>}
    </div>
    <div className="analytics-chart__legend">
      {(visibleSeries.length ? visibleSeries : series).map((item) => {
        const index = series.indexOf(item);
        return <button className={displayedSeries === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setSelectedSeries((current) => current === item.id ? null : item.id)} onMouseEnter={() => setActive(item.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(item.id)} onBlur={() => setActive(null)}><i style={{ background: colors[index % colors.length] }} />{item.name}</button>;
      })}
      {!series.length && <span>{language === "uk" ? "Опублікованих глав поки немає" : "Опубликованных глав пока нет"}</span>}
    </div>
  </div>;
}
