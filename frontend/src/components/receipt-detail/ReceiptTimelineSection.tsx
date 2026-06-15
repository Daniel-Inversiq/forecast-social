import type { ReceiptTimelineEvent, ReceiptTimelineEventType } from "./types";



const DOT_TONE: Record<ReceiptTimelineEventType, string> = {

  forecast: "bg-violet-500/80 ring-violet-500/30",

  back: "bg-emerald-500/80 ring-emerald-500/30",

  challenge: "bg-rose-500/80 ring-rose-500/30",

  consensus: "bg-cyan-500/80 ring-cyan-500/30",

  resolution: "bg-amber-500/80 ring-amber-500/30",

  receipt: "bg-zinc-300/90 ring-zinc-400/30",

};



export function ReceiptTimelineSection({ events }: { events: ReceiptTimelineEvent[] }) {

  if (events.length === 0) return null;



  return (

    <ol className="mt-2 relative pl-1 space-y-0">

      {events.map((event, i) => (

        <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">

          {i < events.length - 1 && (

            <span

              className="absolute left-[7px] top-3 bottom-0 w-px bg-zinc-800/90"

              aria-hidden

            />

          )}

          <span

            className={`relative z-[1] mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${DOT_TONE[event.type]}`}

            aria-hidden

          />

          <div className="min-w-0 flex-1 pt-0">

            <p className="text-[10px] font-medium text-zinc-500 tabular-nums">{event.dateLabel}</p>

            <p className="text-[12px] font-semibold text-zinc-200 mt-0.5">{event.title}</p>

            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{event.description}</p>

          </div>

        </li>

      ))}

    </ol>

  );

}


