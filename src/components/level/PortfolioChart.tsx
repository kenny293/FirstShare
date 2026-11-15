"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";
import { CHART, RING, TREND } from "./types";

export interface ChartPoint {
  t: number;
  value: number;
}

function trendColor(prev: number, next: number): string {
  if (next > prev) return TREND.up;
  if (next < prev) return TREND.down;
  return TREND.flat;
}

/**
 * Hard color stops along the x-axis so each step of the line is green if the
 * portfolio rose over that step and red if it fell. Offsets are fractions of
 * the drawn line's width (objectBoundingBox), which runs from the first to the
 * last point.
 */
function trendStops(data: ChartPoint[]): { offset: number; color: string }[] {
  if (data.length < 2) return [];
  const t0 = data[0].t;
  const span = data[data.length - 1].t - t0;
  if (span <= 0) return [];
  const stops: { offset: number; color: string }[] = [];
  let current = "";
  for (let i = 1; i < data.length; i++) {
    const color = trendColor(data[i - 1].value, data[i].value);
    if (color === current) continue;
    const offset = (data[i - 1].t - t0) / span;
    if (current) stops.push({ offset, color: current });
    stops.push({ offset, color });
    current = color;
  }
  stops.push({ offset: 1, color: current });
  return stops;
}

/**
 * Live portfolio chart for the simulation. The x-axis is fixed to the full
 * length so the line "draws" left to right as time fast-forwards. The line is
 * green on the way up and red on the way down.
 */
export function PortfolioChart({
  data,
  totalSteps,
  yearTicks,
  contributed,
  markers,
  tickFormatter,
}: {
  data: ChartPoint[];
  totalSteps: number;
  /** step offsets where a new year starts (blind-mode axis labels). */
  yearTicks: number[];
  contributed: number;
  markers: { t: number; value: number }[];
  /** Custom x-axis labels (default: "Yr 1", "Yr 2", ...). */
  tickFormatter?: (t: number) => string;
}) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const lastColor = last && prev ? trendColor(prev.value, last.value) : TREND.flat;
  const stops = useMemo(() => trendStops(data), [data]);
  // A gradient on a perfectly flat line (zero-height box) doesn't render, so
  // fall back to a solid color when the whole line is flat.
  const flat = data.every((d) => d.value === data[0]?.value);
  const stroke = stops.length && !flat ? "url(#trend-line)" : lastColor;
  const fill = stops.length && !flat ? "url(#trend-fill)" : "transparent";

  return (
    <div className="h-60 w-full lg:h-[26rem]" aria-label={`Portfolio value chart, currently ${money(last?.value ?? 0)}`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="1" y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.07} />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="4 4" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, totalSteps]}
            ticks={yearTicks}
            tickFormatter={tickFormatter ?? ((t) => `Yr ${yearTicks.indexOf(t) + 1}`)}
            tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={48}
            domain={[(min: number) => Math.max(0, Math.floor((min * 0.85) / 100) * 100), (max: number) => Math.ceil((max * 1.08) / 100) * 100]}
            tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
            tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={contributed} stroke={CHART.guide} strokeDasharray="5 5" />
          <Area
            type="linear"
            dataKey="value"
            stroke={stroke}
            strokeWidth={3}
            strokeLinejoin="round"
            fill={fill}
            isAnimationActive={false}
            dot={false}
          />
          {markers.map((m) => (
            <ReferenceDot key={m.t} x={m.t} y={m.value} r={6} fill={RING.stand} stroke={CHART.dotStroke} strokeWidth={2} />
          ))}
          {last && <ReferenceDot x={last.t} y={last.value} r={6} fill={lastColor} stroke={CHART.dotStroke} strokeWidth={3} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
