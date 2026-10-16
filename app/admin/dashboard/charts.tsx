import Link from "next/link";
import { areaPath, axis, labelledDays, linePath, sum } from "@/lib/dashboard";
import { dayLabel } from "@/lib/india-time";

// The dashboard's building blocks, in the style of a Grafana dark dashboard. Plain SVG and
// HTML drawn on the server: no chart library. Plot areas stretch to their panel; labels stay
// HTML so they stay readable at any width.

export const COLOR = {
  green: "#73bf69",
  blue: "#5794f2",
  yellow: "#fade2a",
  orange: "#ff9830",
  red: "#f2495c",
  purple: "#b877d9",
  text: "#ccccdc",
  muted: "#8e8e9e",
  grid: "#2c3036",
} as const;

export function Panel({
  title,
  href,
  className = "",
  children,
}: {
  title: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-[3px] border border-[#2c3036] bg-[#181b1f] ${className}`}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 px-3 text-[13px] font-medium text-[#ccccdc]">
        <h2 className="truncate">{title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-xs font-normal text-[#6e9fff] hover:underline"
          >
            Open
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1 px-3 pb-3">{children}</div>
    </section>
  );
}

// A big number with a sparkline under it (Grafana's "Stat" panel).
export function Stat({
  title,
  value,
  unit,
  note,
  color,
  spark,
  href,
}: {
  title: string;
  value: number | string;
  unit?: string;
  note?: string;
  color: string;
  spark?: readonly number[];
  href?: string;
}) {
  const max = Math.max(1, ...(spark ?? [0]));
  return (
    <Panel title={title} href={href}>
      <div className="flex h-full flex-col gap-1">
        <p
          className="text-[32px] leading-none font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
          {unit && <span className="ml-0.5 text-lg">{unit}</span>}
        </p>
        {note && <p className="truncate text-xs text-[#8e8e9e]">{note}</p>}
        {spark && spark.length > 1 && (
          <svg
            aria-hidden
            className="mt-auto h-7 w-full"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
          >
            <path d={areaPath(spark, max)} fill={color} fillOpacity={0.18} />
            <path
              d={linePath(spark, max)}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    </Panel>
  );
}

export type Series = {
  name: string;
  color: string;
  values: readonly number[];
  kind: "line" | "area" | "bars";
};

// Days along the bottom, counts up the side; any mix of bars, lines and areas, with a legend
// (total, max, today) like Grafana's. Hovering a day shows its numbers.
export function TimeSeries({
  days,
  series,
  height = 180,
}: {
  days: readonly string[];
  series: readonly Series[];
  height?: number;
}) {
  const n = Math.max(1, days.length);
  const { max, ticks } = axis(Math.max(0, ...series.flatMap((s) => s.values)));
  const slot = 1000 / n;
  const bars = series.filter((s) => s.kind === "bars");
  const barWidth = (slot * 0.72) / Math.max(1, bars.length);
  const labels = labelledDays(days.length);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div
          aria-hidden
          className="relative w-7 shrink-0 text-right text-[11px] text-[#8e8e9e] tabular-nums"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - (t / max) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <svg
            role="img"
            aria-label={series
              .map((s) => `${s.name}: ${sum(s.values)} in total`)
              .join("; ")}
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={1000}
                y1={100 - (t / max) * 100}
                y2={100 - (t / max) * 100}
                stroke={COLOR.grid}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {bars.map((s, b) =>
              s.values.map((v, i) => (
                <rect
                  key={`${s.name}-${i}`}
                  x={i * slot + slot * 0.14 + b * barWidth}
                  width={barWidth}
                  y={100 - (v / max) * 100}
                  height={(v / max) * 100}
                  fill={s.color}
                  fillOpacity={0.8}
                />
              )),
            )}
            {series
              .filter((s) => s.kind === "area")
              .map((s) => (
                <path
                  key={s.name}
                  d={areaPath(s.values, max)}
                  fill={s.color}
                  fillOpacity={0.15}
                />
              ))}
            {series
              .filter((s) => s.kind !== "bars")
              .map((s) => (
                <path
                  key={s.name}
                  d={linePath(s.values, max)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {days.map((d, i) => (
              <rect
                key={d}
                x={i * slot}
                width={slot}
                y={0}
                height={100}
                className="fill-transparent hover:fill-white/5"
              >
                <title>
                  {`${dayLabel(d)}\n${series.map((s) => `${s.name}: ${s.values[i] ?? 0}`).join("\n")}`}
                </title>
              </rect>
            ))}
          </svg>
        </div>
      </div>
      <div
        aria-hidden
        className="relative ml-9 h-4 text-[11px] text-[#8e8e9e] tabular-nums"
      >
        {labels.map((i) => (
          <span
            key={days[i]}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((i + 0.5) / n) * 100}%` }}
          >
            {days[i].slice(8)}/{days[i].slice(5, 7)}
          </span>
        ))}
      </div>
      <table className="w-full text-xs text-[#ccccdc]">
        <thead className="text-[#8e8e9e]">
          <tr>
            <th className="py-1 text-left font-normal" />
            <th className="py-1 text-right font-normal">Total</th>
            <th className="py-1 text-right font-normal">Max</th>
            <th className="py-1 text-right font-normal">Today</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.name}>
              <td className="py-0.5">
                <span
                  className="mr-2 inline-block h-1 w-4 rounded-sm align-middle"
                  style={{ background: s.color }}
                />
                {s.name}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {sum(s.values)}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {Math.max(0, ...s.values)}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {s.values.at(-1) ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A half-circle gauge for a percentage, coloured by threshold (red, then yellow, then green).
export function Gauge({
  percent,
  label,
}: {
  percent: number | null;
  label: string;
}) {
  const value = percent ?? 0;
  const color =
    percent === null
      ? COLOR.muted
      : value < 40
        ? COLOR.red
        : value < 70
          ? COLOR.yellow
          : COLOR.green;
  const arc = "M20,100 A80,80 0 0 1 180,100";
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <svg
        role="img"
        aria-label={`${label}: ${percent === null ? "no seats offered" : `${value}%`}`}
        viewBox="0 0 200 112"
        className="w-full max-w-[260px]"
      >
        <path d={arc} fill="none" stroke={COLOR.grid} strokeWidth={18} />
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={18}
          pathLength={100}
          strokeDasharray={`${Math.min(100, value)} 100`}
        />
        <text
          x={100}
          y={96}
          textAnchor="middle"
          fill={color}
          fontSize={34}
          fontWeight={600}
        >
          {percent === null ? "–" : `${value}%`}
        </text>
      </svg>
      <p className="text-xs text-[#8e8e9e]">{label}</p>
    </div>
  );
}

// Horizontal bars with a label and a count, longest first (Grafana's "Bar gauge").
export function BarList({
  rows,
  color,
  unit,
  empty,
}: {
  rows: readonly { key: string; label: React.ReactNode; value: number }[];
  color: string;
  unit: (n: number) => string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[#8e8e9e]">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-[#ccccdc]">{r.label}</span>
            <span className="shrink-0 text-[#8e8e9e] tabular-nums">
              {unit(r.value)}
            </span>
          </div>
          <span className="block h-2 rounded-sm bg-[#22252b]">
            <span
              className="block h-2 rounded-sm"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                background: color,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Upright bars for a handful of categories, with counts on top.
export function Histogram({
  bands,
  counts,
  colors,
  height = 140,
}: {
  bands: readonly string[];
  counts: readonly number[];
  colors: readonly string[];
  height?: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <div
      role="img"
      aria-label={bands.map((b, i) => `${b}: ${counts[i]}`).join(", ")}
      className="space-y-1"
    >
      <div className="flex items-end gap-2" style={{ height }}>
        {counts.map((c, i) => (
          <div
            key={bands[i]}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-xs text-[#ccccdc] tabular-nums">{c}</span>
            <span
              className="w-full rounded-t-sm"
              style={{
                height: `${(c / max) * 80}%`,
                minHeight: c ? 4 : 1,
                background: colors[i],
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-[11px] text-[#8e8e9e]">
        {bands.map((b) => (
          <span key={b} className="flex-1 text-center whitespace-nowrap">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

// A dense table, Grafana style.
export function DataTable({
  head,
  rows,
  empty,
}: {
  head: readonly { label: string; align?: "right" }[];
  rows: readonly { key: string; cells: React.ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[#8e8e9e]">{empty}</p>;
  }
  return (
    <div className="-mx-3 overflow-x-auto">
      <table className="w-full text-[13px] text-[#ccccdc]">
        <thead>
          <tr className="border-b border-[#2c3036] text-[#8e8e9e]">
            {head.map((h) => (
              <th
                key={h.label}
                className={`px-3 py-1.5 font-medium whitespace-nowrap ${h.align === "right" ? "text-right" : "text-left"}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-[#22252b] last:border-0 hover:bg-[#1f2228]"
            >
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  className={`px-3 py-1.5 whitespace-nowrap ${head[i]?.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
