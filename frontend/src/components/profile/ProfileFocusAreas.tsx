"use client";

const FOCUS_TAG_CLASS: Record<string, string> = {
  Macro: "border-violet-500/35 bg-violet-500/12 text-violet-200",
  Crypto: "border-amber-500/35 bg-amber-500/12 text-amber-100",
  AI: "border-sky-500/35 bg-sky-500/12 text-sky-200",
  Sports: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
  Politics: "border-rose-500/30 bg-rose-950/40 text-rose-100",
  Rates: "border-cyan-500/35 bg-cyan-500/12 text-cyan-200",
  Markets: "border-zinc-600/50 bg-zinc-900/70 text-zinc-300",
  Equities: "border-emerald-500/30 bg-emerald-950/40 text-emerald-100",
  Climate: "border-teal-500/30 bg-teal-950/35 text-teal-100",
};

function tagClass(tag: string): string {
  return FOCUS_TAG_CLASS[tag] ?? "border-zinc-600/50 bg-zinc-900/70 text-zinc-300";
}

export function ProfileFocusAreas({
  areas,
  align = "center",
  showTitle = true,
  className = "",
}: {
  areas: string[];
  align?: "left" | "center";
  /** Hide when a parent panel already supplies the section title */
  showTitle?: boolean;
  className?: string;
}) {
  if (areas.length === 0) return null;

  const alignClass = align === "left" ? "text-left" : "text-center";
  const justifyClass = align === "left" ? "justify-start" : "justify-center";

  return (
    <div className={`${alignClass} ${className}`}>
      {showTitle && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Focus areas
        </p>
      )}
      <div className={`flex flex-wrap gap-1.5 ${justifyClass}`}>
        {areas.map((tag) => (
          <span
            key={tag}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tagClass(tag)}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
