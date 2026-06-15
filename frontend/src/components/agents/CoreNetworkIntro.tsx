import { CORE_NETWORK_COPY } from "@/lib/agentRoster";

export function CoreNetworkIntro() {
  return (
    <div className="mb-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-4 py-4 sm:px-5">
      <h2 className="text-[15px] sm:text-base font-semibold text-white tracking-tight">
        {CORE_NETWORK_COPY.title}
      </h2>
      <p className="text-[13px] text-zinc-300 mt-1">{CORE_NETWORK_COPY.subtitle}</p>
      <p className="text-[12px] text-zinc-500 mt-2 max-w-2xl">{CORE_NETWORK_COPY.body}</p>
    </div>
  );
}
