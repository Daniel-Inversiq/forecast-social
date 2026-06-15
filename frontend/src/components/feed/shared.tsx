import Link from "next/link";

export type FeedMarket = {
  slug?: string;
  title: string;
  category: string;
  status: string;
  current_yes_probability: number;
  agent_count: number;
  narrative: string;
  urgency: string;
};

export const urgencyStyle: Record<string, { text: string; ring: string; dot: string }> = {
  hot: { text: "text-rose-300/80", ring: "border-rose-900/50 bg-rose-950/30", dot: "bg-rose-400/70" },
  rising: { text: "text-sky-300/75", ring: "border-sky-900/45 bg-sky-950/25", dot: "bg-sky-400/65" },
  contested: {
    text: "text-amber-300/75",
    ring: "border-amber-900/40 bg-amber-950/25",
    dot: "bg-amber-400/65",
  },
  cooling: { text: "text-zinc-500", ring: "border-zinc-800/80 bg-zinc-900/50", dot: "bg-zinc-600" },
};

export { formatRelativeTime as formatTimeAgo } from "@/lib/relativeTime";

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function syntheticMove(title: string): number {
  const h = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const delta = (h % 13) - 6;
  return delta === 0 ? (h % 2 ? 2 : -2) : delta;
}

export function Avatar({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const colors = [
    "bg-violet-600",
    "bg-sky-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-rose-600",
  ];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const dim =
    size === "xs"
      ? "h-6 w-6 text-[10px]"
      : size === "sm"
        ? "h-7 w-7 text-[10px]"
        : size === "lg"
          ? "h-11 w-11 sm:h-12 sm:w-12 text-sm"
          : "h-9 w-9 text-xs";

  return (
    <div
      className={`${dim} ${color ? "" : colors[idx]} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-1 ring-zinc-900/80`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {initials(name)}
    </div>
  );
}

export function HeatPill({
  children,
  tone = "violet",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: string;
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    violet: "scry-badge--violet",
    rose: "scry-badge--rose",
    amber: "scry-badge--amber",
    sky: "scry-badge--sky",
    emerald: "scry-badge--emerald",
    teal: "scry-badge--teal",
  };
  return (
    <span
      className={`scry-badge ${tones[tone] ?? tones.violet} ${pulse ? "scry-badge--live feed-live-pill" : ""}`}
    >
      {pulse && <span className="scry-badge-dot shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export function MiniProbBar({
  value,
  animated = true,
  size = "sm",
  hoverBoost = false,
}: {
  value: number;
  animated?: boolean;
  size?: "xs" | "sm";
  hoverBoost?: boolean;
}) {
  const rounded = Math.round(value);
  const h = size === "xs" ? "h-1" : "h-1.5";
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${hoverBoost ? "feed-prob-animate" : ""}`}
    >
      <div className={`flex-1 ${h} bg-zinc-800/90 rounded-full overflow-hidden`}>
        <div
          className={`feed-prob-fill ${h} rounded-full bg-gradient-to-r from-zinc-500/80 to-zinc-400/55 ${animated ? "feed-prob-bar" : ""}`}
          style={{ width: `${rounded}%` }}
        />
      </div>
      <span
        className={`tabular-nums font-medium text-zinc-300 shrink-0 ${size === "xs" ? "text-[10px] w-7" : "text-xs w-8"} text-right`}
      >
        {rounded}%
      </span>
    </div>
  );
}

/** Tiny SVG sparkline — no chart library */
export function MiniSparkline({
  seed,
  tone = "violet",
  width = 40,
  height = 14,
}: {
  seed: string;
  tone?: "violet" | "emerald" | "sky" | "amber";
  width?: number;
  height?: number;
}) {
  const colors: Record<string, string> = {
    violet: "rgba(167,139,250,0.85)",
    emerald: "rgba(52,211,153,0.85)",
    sky: "rgba(56,189,248,0.85)",
    amber: "rgba(251,191,36,0.85)",
  };
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    h = (h * 1103515245 + 12345) | 0;
    pts.push(0.15 + ((h >>> 16) % 70) / 100);
  }
  const step = width / (pts.length - 1);
  const d = pts
    .map((y, i) => {
      const x = i * step;
      const py = height - y * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="feed-sparkline shrink-0 opacity-80"
      aria-hidden
    >
      <path d={d} fill="none" stroke={colors[tone] ?? colors.violet} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MomentumIndicator({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat";
  label?: string;
}) {
  if (direction === "flat") {
    return (
      <span className="text-[9px] text-zinc-600 tabular-nums">{label ?? "—"}</span>
    );
  }
  const up = direction === "up";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums ${
        up ? "feed-momentum-up" : "feed-momentum-down"
      }`}
    >
      <span aria-hidden className="text-[8px]">{up ? "▲" : "▼"}</span>
      {label ?? (up ? "Rising" : "Cooling")}
    </span>
  );
}

export function NarrativeStrengthBar({
  strength,
  accelerating = false,
  label,
}: {
  strength: number;
  accelerating?: boolean;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(8, strength));
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-1">
        {label && <span className="text-[9px] text-zinc-600 truncate">{label}</span>}
        {accelerating && (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-sky-400/90 feed-narrative-pulse shrink-0">
            Accelerating
          </span>
        )}
      </div>
      <div className="h-1 rounded-full bg-zinc-800/90 overflow-hidden">
        <div
          className="feed-narrative-bar-fill h-full rounded-full bg-gradient-to-r from-sky-500/70 via-violet-500/60 to-violet-400/50"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RankMotion({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums transition-transform duration-300 ${
        up ? "feed-momentum-up" : "feed-momentum-down"
      }`}
    >
      <span className="text-[8px]" aria-hidden>
        {up ? "↑" : "↓"}
      </span>
      {up ? "+" : ""}
      {delta}
    </span>
  );
}

export function TactileButton({
  children,
  onClick,
  variant = "ghost",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "violet" | "emerald" | "chip";
  className?: string;
  type?: "button" | "submit";
}) {
  const variants: Record<string, string> = {
    ghost: "text-zinc-500 hover:text-white hover:bg-zinc-800/60 border-transparent",
    violet: "text-violet-300/90 hover:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25",
    emerald: "text-emerald-300/90 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25",
    chip: "text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-600",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`feed-chip-active text-[11px] px-2 py-1 rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function MoveBadge({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${
        up ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-zinc-500"
      }`}
    >
      {delta !== 0 && <span aria-hidden>{up ? "▲" : "▼"}</span>}
      {delta > 0 ? "+" : ""}
      {delta}pt
    </span>
  );
}

export function LiveDot({ color = "violet" }: { color?: "violet" | "rose" | "amber" }) {
  const tones = {
    violet: { bg: "bg-violet-400/85", ping: "bg-violet-400/30" },
    rose: { bg: "bg-rose-400/90", ping: "bg-rose-400/30" },
    amber: { bg: "bg-amber-400/85", ping: "bg-amber-400/30" },
  };
  const { bg, ping } = tones[color] ?? tones.violet;
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ping}`} />
      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${bg}`} />
    </span>
  );
}

export function PanelShell({
  title,
  subtitle,
  badge,
  children,
  className = "",
  headerClass = "",
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClass?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-white/5 scry-surface-card overflow-hidden ${className}`}
    >
      <div
        className={`px-4 py-3 border-b border-white/5 scry-surface-section ${headerClass}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <LiveDot />
            <h3 className="text-[13px] font-semibold scry-card-title tracking-tight truncate">{title}</h3>
          </div>
          {badge}
        </div>
        {subtitle && <p className="scry-meta mt-1.5 truncate">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function AgentChip({
  name,
  slug,
  niche,
  score,
  momentum,
  rankDelta,
}: {
  name: string;
  slug: string;
  niche?: string;
  score?: number;
  momentum?: "up" | "down" | "flat";
  rankDelta?: number;
}) {
  return (
    <Link
      href={`/agents/${slug}`}
      className="flex items-center gap-1.5 p-1 -mx-0.5 rounded-lg hover:bg-zinc-900/80 transition group feed-hover-lift cursor-pointer"
    >
      <Avatar name={name} size="xs" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-zinc-200 truncate group-hover:text-white">
          {name}
        </p>
        {niche && <p className="text-[9px] text-zinc-600 truncate">{niche}</p>}
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {score != null && (
          <span className="text-[10px] font-semibold text-violet-300 tabular-nums">{score}</span>
        )}
        {momentum && <MomentumIndicator direction={momentum} />}
        {rankDelta != null && rankDelta !== 0 && <RankMotion delta={rankDelta} />}
      </div>
    </Link>
  );
}
