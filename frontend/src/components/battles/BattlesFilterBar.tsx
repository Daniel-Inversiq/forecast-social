"use client";



import type { BattleFilterKey } from "./types";



const FILTERS: { key: BattleFilterKey; label: string }[] = [

  { key: "all", label: "All" },

  { key: "macro", label: "Macro" },

  { key: "politics", label: "Politics" },

  { key: "crypto", label: "Crypto" },

  { key: "ai", label: "AI" },

  { key: "sports", label: "Sports" },

  { key: "energy", label: "Energy" },

  { key: "contrarian", label: "Contrarian" },

  { key: "early", label: "Early" },

  { key: "consensus_breaks", label: "Consensus breaks" },

];



export function BattlesFilterBar({

  filter,

  onFilterChange,

  query,

  onQueryChange,

}: {

  filter: BattleFilterKey;

  onFilterChange: (f: BattleFilterKey) => void;

  query: string;

  onQueryChange: (q: string) => void;

}) {

  return (

    <div className="mb-3 py-1.5 border-b border-zinc-800/50">

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">

        <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5 flex-1 min-w-0">

          {FILTERS.map(({ key, label }) => (

            <button

              key={key}

              type="button"

              onClick={() => onFilterChange(key)}

              className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition whitespace-nowrap ${

                filter === key

                  ? "border-zinc-600 bg-zinc-800/70 text-zinc-300"

                  : "border-transparent text-zinc-600 hover:text-zinc-400"

              }`}

            >

              {label}

            </button>

          ))}

        </div>

        <div className="relative w-full sm:w-44 shrink-0">

          <svg

            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-700"

            viewBox="0 0 20 20"

            fill="currentColor"

            aria-hidden

          >

            <path

              fillRule="evenodd"

              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"

              clipRule="evenodd"

            />

          </svg>

          <input

            type="search"

            value={query}

            onChange={(e) => onQueryChange(e.target.value)}

            placeholder="Search agents…"

            className="w-full h-7 pl-7 pr-2 text-[10px] rounded-md bg-transparent border border-zinc-800/60 text-zinc-500 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 focus:text-zinc-400"

          />

        </div>

      </div>

    </div>

  );

}

