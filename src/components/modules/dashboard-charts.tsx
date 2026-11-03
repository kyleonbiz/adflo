import { useId } from "react";
import type { UpcomingDay, WorkloadRow } from "@/lib/dashboard/logic";

/** Rounds a chart's top value up to something readable (5, 10, 20, 50, 100 ...). */
function niceMax(n: number): number {
  if (n <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].map((m) => m * pow).find((v) => v >= n)) ?? n;
}

const stop = (v: string, o = 1) => ({ stopColor: `var(${v})`, stopOpacity: o });

/** Two bars per service: open work, and the part of it that needs attention. */
export function WorkloadChart({ rows }: { rows: WorkloadRow[] }) {
  const id = useId();
  const W = 640, H = 260, L = 12, R = 44, T = 16, B = 38;
  const top = niceMax(Math.max(0, ...rows.flatMap((r) => [r.open, r.attention])));
  const plotH = H - T - B, step = (W - L - R) / rows.length, barW = 16;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const empty = rows.every((r) => r.open === 0 && r.attention === 0);
  const summary = rows.map((r) => `${r.label}: ${r.open} open, ${r.attention} needing attention`).join("; ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Open work by service. ${summary}`} className="h-auto w-full">
      <defs>
        <linearGradient id={`${id}-open`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={stop("--brand-sky")} /><stop offset="1" style={stop("--brand-blue")} /></linearGradient>
        <linearGradient id={`${id}-att`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={stop("--brand-purple-deep")} /><stop offset="1" style={stop("--brand-indigo")} /></linearGradient>
      </defs>
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R + 8} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v === 0 ? undefined : "2 4"} />
          <text x={W - R + 16} y={y(v) + 4} className="fill-muted-foreground text-[14px]">{Math.round(v)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const cx = L + step * i + step / 2;
        const bar = (v: number, x: number, fill: string) => v > 0 && (
          <rect x={x} y={y(v)} width={barW} height={y(0) - y(v)} rx={5} fill={`url(#${id}-${fill})`} />
        );
        return (
          <g key={r.label}>
            {bar(r.open, cx - barW - 2, "open")}
            {bar(r.attention, cx + 2, "att")}
            <text x={cx} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[15px]">{r.label}</text>
          </g>
        );
      })}
      {empty && <text x={(W - R) / 2} y={T + plotH / 2} textAnchor="middle" className="fill-muted-foreground text-[14px]">Nothing open yet. Bars appear as you add invoices, tasks and requests.</text>}
    </svg>
  );
}

/** A ring showing `percent` complete, with the figure in the middle. */
export function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const id = useId();
  const r = 78, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: ${pct}%`} className="size-36 shrink-0">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="1" y2="0"><stop offset="0" style={stop("--brand-sky")} /><stop offset="1" style={stop("--brand-purple-deep")} /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r={r} fill="none" strokeWidth="12" className="stroke-border" />
      {pct > 0 && <circle cx="100" cy="100" r={r} fill="none" strokeWidth="12" strokeLinecap="round" stroke={`url(#${id})`} strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 100 100)" />}
      <text x="100" y="112" textAnchor="middle" className="fill-foreground text-[44px] font-semibold tabular-nums">{pct}%</text>
    </svg>
  );
}

/** A smooth line through the counts, with the busiest day marked. */
export function UpcomingChart({ days }: { days: UpcomingDay[] }) {
  const id = useId();
  const W = 520, H = 230, L = 14, R = 14, T = 40, B = 36;
  const top = niceMax(Math.max(0, ...days.map((d) => d.count)));
  const x = (i: number) => L + ((W - L - R) / (days.length - 1)) * i;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const pts = days.map((d, i) => [x(i), y(d.count)] as const);
  // Catmull-Rom to cubic Bezier, so the line is smooth but never dips below the data.
  const line = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const p0 = pts[i - 2] ?? pts[i - 1], p1 = pts[i - 1], p2 = p, p3 = pts[i + 1] ?? p;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C${c1[0]},${Math.min(c1[1], y(0))} ${c2[0]},${Math.min(c2[1], y(0))} ${p2[0]},${p2[1]}`;
  }).join(" ");
  const peak = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);
  const total = days.reduce((n, d) => n + d.count, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Due in the next 7 days: ${days.map((d) => `${d.day} ${d.count}`).join(", ")}`} className="h-auto w-full">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={stop("--brand-sky", 0.35)} /><stop offset="1" style={stop("--brand-sky", 0)} /></linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} className="stroke-border" strokeDasharray={f === 0 ? undefined : "2 4"} />)}
      <path d={`${line} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-muted-foreground/70" />
      {total > 0 && (
        <g>
          <line x1={pts[peak][0]} x2={pts[peak][0]} y1={pts[peak][1]} y2={y(0)} className="stroke-border" />
          <circle cx={pts[peak][0]} cy={pts[peak][1]} r="5" strokeWidth="2" className="fill-card stroke-brand-purple-deep" />
          <rect x={pts[peak][0] - 14} y={pts[peak][1] - 30} width="28" height="20" rx="5" className="fill-brand-purple-deep" />
          <text x={pts[peak][0]} y={pts[peak][1] - 16} textAnchor="middle" className="fill-white text-[13px] font-semibold">{days[peak].count}</text>
        </g>
      )}
      {days.map((d, i) => <text key={d.day} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[15px]">{d.label}</text>)}
      {total === 0 && <text x={W / 2} y={T + 28} textAnchor="middle" className="fill-muted-foreground text-[15px]">Nothing due in the next 7 days.</text>}
    </svg>
  );
}

/** Small bars for a headline card. */
export function MiniBars({ values, label }: { values: number[]; label: string }) {
  const id = useId();
  const top = Math.max(1, ...values), W = 120, H = 56, bw = 9, gap = (W - bw * values.length) / Math.max(1, values.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-14 w-32">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={stop("--brand-purple")} /><stop offset="1" style={stop("--brand-purple-deep")} /></linearGradient></defs>
      {values.map((v, i) => {
        const h = v === 0 ? 3 : Math.max(5, (v / top) * (H - 4));
        return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="2.5" fill={`url(#${id})`} opacity={v === 0 ? 0.35 : 1} />;
      })}
    </svg>
  );
}
