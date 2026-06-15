export type PresetAvatarCategory =
  | "Macro"
  | "Crypto"
  | "Sports"
  | "Politics"
  | "AI"
  | "Anonymous"
  | "Quant"
  | "Contrarian";

export type PresetAvatar = {
  id: string;
  category: PresetAvatarCategory;
  label: string;
  gradient: string;
  icon: "wave" | "grid" | "orbit" | "mask" | "pulse" | "sigma" | "bolt" | "void";
};

export const PRESET_AVATAR_CATEGORIES: PresetAvatarCategory[] = [
  "Macro",
  "Crypto",
  "Sports",
  "Politics",
  "AI",
  "Anonymous",
  "Quant",
  "Contrarian",
];

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "macro-wave", category: "Macro", label: "Rate cycle", gradient: "from-violet-600/90 via-indigo-700/80 to-zinc-900", icon: "wave" },
  { id: "macro-orbit", category: "Macro", label: "Liquidity", gradient: "from-sky-600/80 via-violet-800/70 to-zinc-950", icon: "orbit" },
  { id: "crypto-grid", category: "Crypto", label: "On-chain", gradient: "from-cyan-500/80 via-violet-700/70 to-zinc-950", icon: "grid" },
  { id: "crypto-pulse", category: "Crypto", label: "Funding", gradient: "from-emerald-600/70 via-cyan-800/60 to-zinc-950", icon: "pulse" },
  { id: "sports-bolt", category: "Sports", label: "Upset", gradient: "from-rose-600/80 via-amber-700/60 to-zinc-950", icon: "bolt" },
  { id: "sports-sigma", category: "Sports", label: "Line value", gradient: "from-orange-600/70 via-rose-800/60 to-zinc-950", icon: "sigma" },
  { id: "politics-mask", category: "Politics", label: "Electoral", gradient: "from-rose-700/80 via-violet-900/70 to-zinc-950", icon: "mask" },
  { id: "politics-wave", category: "Politics", label: "Polling", gradient: "from-fuchsia-600/70 via-rose-900/60 to-zinc-950", icon: "wave" },
  { id: "ai-grid", category: "AI", label: "Neural", gradient: "from-violet-500/80 via-fuchsia-800/70 to-zinc-950", icon: "grid" },
  { id: "ai-pulse", category: "AI", label: "Capex", gradient: "from-sky-500/80 via-violet-700/70 to-zinc-950", icon: "pulse" },
  { id: "anon-void", category: "Anonymous", label: "Shadow", gradient: "from-zinc-700/90 via-zinc-900 to-black", icon: "void" },
  { id: "anon-mask", category: "Anonymous", label: "Masked", gradient: "from-zinc-600/80 via-zinc-900 to-black", icon: "mask" },
  { id: "quant-sigma", category: "Quant", label: "Model", gradient: "from-sky-600/80 via-indigo-800/70 to-zinc-950", icon: "sigma" },
  { id: "quant-grid", category: "Quant", label: "Matrix", gradient: "from-cyan-600/70 via-violet-800/60 to-zinc-950", icon: "grid" },
  { id: "contrarian-bolt", category: "Contrarian", label: "Fade", gradient: "from-amber-600/80 via-rose-800/70 to-zinc-950", icon: "bolt" },
  { id: "contrarian-orbit", category: "Contrarian", label: "Diverge", gradient: "from-amber-500/70 via-violet-900/80 to-zinc-950", icon: "orbit" },
];

export function getPresetAvatar(id: string): PresetAvatar | undefined {
  return PRESET_AVATARS.find((a) => a.id === id);
}
