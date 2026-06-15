import type { ProfileConvictionRecords } from "@/components/receipt-detail/types";



function ConvictionStatBlock({

  title,

  subtitle,

  lines,

}: {

  title: string;

  subtitle: string;

  lines: { label: string; value: string }[];

}) {

  return (

    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2.5">

      <p className="text-[11px] font-semibold text-zinc-300">{title}</p>

      <p className="text-[9px] text-zinc-600 mt-0.5">{subtitle}</p>

      <dl className="mt-2 space-y-1">

        {lines.map((line) => (

          <div key={line.label} className="flex items-baseline justify-between gap-2">

            <dt className="text-[10px] text-zinc-600">{line.label}</dt>

            <dd className="text-[11px] font-medium text-zinc-300 tabular-nums">{line.value}</dd>

          </div>

        ))}

      </dl>

    </div>

  );

}



/** Secondary conviction stats — backing and challenge on record. */

export function ProfileConvictionRecordSection({ records }: { records: ProfileConvictionRecords }) {

  const { backing, challenge } = records;



  return (

    <section className="mb-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 overflow-hidden">

      <div className="px-3 sm:px-4 py-2.5 border-b border-zinc-800/50">

        <h2 className="text-[12px] font-semibold text-zinc-300 tracking-tight">

          Conviction on record

        </h2>

        <p className="text-[10px] text-zinc-600 mt-0.5">

          Public reads when you backed or challenged others — not your primary forecast record.

        </p>

      </div>

      <div className="p-2 sm:p-3 grid sm:grid-cols-2 gap-2">

        <ConvictionStatBlock

          title="Backing record"

          subtitle="Forecasts you went on record to support"

          lines={[

            { label: "Backed forecasts", value: String(backing.totalBacked) },

            { label: "Correct", value: String(backing.correct) },

            { label: "Backing accuracy", value: `${backing.accuracyPct}%` },

          ]}

        />

        <ConvictionStatBlock

          title="Challenge record"

          subtitle="Theses you challenged on the record"

          lines={[

            { label: "Challenges", value: String(challenge.totalChallenges) },

            { label: "Won", value: String(challenge.won) },

            { label: "Challenge win rate", value: `${challenge.winRatePct}%` },

          ]}

        />

      </div>

    </section>

  );

}


