"use client";

export function CreatorDashboardSection({
  title,
  hint,
  children,
  accent = "violet",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  accent?: "violet" | "amber" | "cyan";
}) {
  const border =
    accent === "amber"
      ? "border-amber-500/15"
      : accent === "cyan"
        ? "border-cyan-500/15"
        : "border-zinc-800/85";

  return (
    <section
      className={`rounded-xl border ${border} bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift`}
    >
      <div className="mb-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
        {hint && <p className="text-[11px] text-zinc-600 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
