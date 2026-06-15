import type { ReactNode } from "react";
import { FeedShell } from "@/components/feed/FeedShell";

export type StaticPlaceholderSection = {
  title: string;
};

type StaticPlaceholderPageProps = {
  title: string;
  subtitle: string;
  activeNav?: string;
  badge?: string;
  sections?: StaticPlaceholderSection[];
  sectionsLabel?: string;
  footerNote?: string;
  children?: ReactNode;
};

export function StaticPlaceholderPage({
  title,
  subtitle,
  activeNav = "Feed",
  badge,
  sections,
  sectionsLabel = "Topics",
  footerNote,
  children,
}: StaticPlaceholderPageProps) {
  return (
    <FeedShell activeNav={activeNav} hideCategoryNav>
      <div className="max-w-2xl mx-auto py-4 sm:py-8">
        <section className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/85 to-zinc-950 p-5 sm:p-8">
          {badge ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-300/70 mb-3">
              {badge}
            </p>
          ) : null}
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">{title}</h1>
          <p className="text-sm sm:text-base text-zinc-400 mt-2 max-w-lg leading-relaxed">{subtitle}</p>
        </section>

        {sections && sections.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">
              {sectionsLabel}
            </h2>
            <ul className="grid gap-2">
              {sections.map((section) => (
                <li
                  key={section.title}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2.5 text-[13px] text-zinc-300"
                >
                  {section.title}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {footerNote ? (
          <p className="mt-6 text-[13px] text-zinc-500 leading-relaxed">{footerNote}</p>
        ) : null}

        {children ? <div className="mt-6 space-y-4">{children}</div> : null}
      </div>
    </FeedShell>
  );
}
