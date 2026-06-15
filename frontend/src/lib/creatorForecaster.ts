import { apiFetch } from "./api";

export const TOTAL_WIZARD_STEPS = 7;

export const WIZARD_STEP_LABELS = [
  "Archetype",
  "Personality",
  "Identity",
  "Blind Spot",
  "Knowledge",
  "Preview",
  "Publish",
] as const;

export type ArchetypeKey =
  | "the_bear"
  | "the_bull"
  | "the_contrarian"
  | "the_data_monk"
  | "the_insider"
  | "the_narrator"
  | "the_challenger"
  | "the_specialist";

export type DomainFocus =
  | "Macro"
  | "Sports"
  | "Crypto"
  | "Politics"
  | "AI"
  | "Climate"
  | "Other";

export type CreatorForecasterDraft = {
  id: number | null;
  display_name: string;
  username: string;
  avatar_color: string;
  short_bio: string;
  domain_focus: DomainFocus | "";
  archetype: ArchetypeKey | "";
  archetype_description: string;
  aggressiveness: number;
  humor: number;
  contrarian_level: number;
  data_vs_intuition: number;
  confidence: number;
  blind_spot: string;
  personality_summary: string;
  status: "draft" | "published" | "archived";
  agent_slug: string | null;
};

export type ArchetypeOption = {
  key: ArchetypeKey;
  title: string;
  description: string;
  accent: string;
};

export type PreviewPayload = {
  forecasts: string[];
  rivalry_reactions: string[];
  winning_reaction: string;
  losing_reaction: string;
  seed: number | null;
  knowledge_used?: boolean;
  knowledge_sources?: KnowledgeSourceSummary[];
};

export type KnowledgeSourceSummary = {
  filename: string;
  summary: string | null;
  key_claims: string[];
  status: KnowledgeSourceStatus;
};

export type KnowledgeSourceStatus = "uploaded" | "processing" | "ready" | "failed";

export type KnowledgeSource = {
  id: number;
  source_type: "pdf";
  filename: string;
  status: KnowledgeSourceStatus;
  summary: string | null;
  key_claims: string[];
  created_at: string;
  updated_at: string;
};

export type KnowledgeLimits = {
  max_pdfs: number;
  max_bytes: number;
};

export type DifferentiationLevel =
  | "distinct"
  | "some_overlap"
  | "too_close"
  | "clone_risk";

export type DifferentiationResult = {
  similarity_score: number;
  differentiation_score: number;
  level: DifferentiationLevel;
  closest_match: { slug: string; name: string };
  overlap_reasons: string[];
  improvement_suggestions: string[];
  can_publish: boolean;
  message: string;
  /** @deprecated use level + can_publish */
  too_similar?: boolean;
  suggestions?: string[];
};

export type WizardOptions = {
  archetypes: ArchetypeOption[];
  domain_focus: DomainFocus[];
  blind_spot_suggestions: string[];
};

const STORAGE_KEY = "scry_creator_forecaster_draft";

export function defaultDraft(): CreatorForecasterDraft {
  return {
    id: null,
    display_name: "",
    username: "",
    avatar_color: "#8b5cf6",
    short_bio: "",
    domain_focus: "",
    archetype: "",
    archetype_description: "",
    aggressiveness: 50,
    humor: 50,
    contrarian_level: 50,
    data_vs_intuition: 50,
    confidence: 50,
    blind_spot: "",
    personality_summary: "",
    status: "draft",
    agent_slug: null,
  };
}

export function readLocalDraft(): Partial<CreatorForecasterDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<CreatorForecasterDraft>) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: CreatorForecasterDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearLocalDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function fetchWizardOptions(): Promise<WizardOptions> {
  const res = await apiFetch("/creator-forecasters/options", {}, false);
  if (!res.ok) throw new Error("Failed to load wizard options");
  return res.json();
}

export async function createDraft(archetype?: ArchetypeKey): Promise<CreatorForecasterDraft> {
  const res = await apiFetch("/creator-forecasters", {
    method: "POST",
    body: JSON.stringify(archetype ? { archetype } : {}),
  });
  if (!res.ok) throw new Error("Failed to create draft");
  const data = await res.json();
  return mapApiToDraft(data);
}

export async function updateDraft(
  id: number,
  patch: Partial<CreatorForecasterDraft>
): Promise<CreatorForecasterDraft> {
  const body: Record<string, unknown> = {};
  const fields = [
    "archetype",
    "display_name",
    "username",
    "avatar_color",
    "short_bio",
    "domain_focus",
    "blind_spot",
    "aggressiveness",
    "humor",
    "contrarian_level",
    "data_vs_intuition",
    "confidence",
  ] as const;
  for (const f of fields) {
    const val = patch[f];
    if (val !== undefined && val !== "") body[f] = val;
  }
  const res = await apiFetch(`/creator-forecasters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to save");
  }
  return mapApiToDraft(await res.json());
}

export async function regeneratePreview(
  id: number,
  seed?: number
): Promise<{ preview: PreviewPayload; differentiation: DifferentiationResult | null }> {
  const res = await apiFetch(`/creator-forecasters/${id}/preview`, {
    method: "POST",
    body: JSON.stringify(seed != null ? { seed } : {}),
  });
  if (!res.ok) throw new Error("Failed to generate preview");
  const data = await res.json();
  return {
    preview: data.preview,
    differentiation: data.differentiation ?? null,
  };
}

export async function checkDifferentiation(id: number): Promise<DifferentiationResult> {
  const res = await apiFetch(`/creator-forecasters/${id}/differentiation`, { method: "POST" });
  if (!res.ok) throw new Error("Differentiation check failed");
  return normalizeDifferentiation(await res.json());
}

export async function differentiationCheck(
  config: Partial<CreatorForecasterDraft> & {
    archetype: ArchetypeKey;
    sample_outputs?: string[];
    exclude_forecaster_id?: number;
  }
): Promise<DifferentiationResult> {
  const res = await apiFetch("/forecasters/differentiation-check", {
    method: "POST",
    body: JSON.stringify({
      archetype: config.archetype,
      domain_focus: config.domain_focus ?? "",
      blind_spot: config.blind_spot ?? "",
      short_bio: config.short_bio ?? "",
      aggressiveness: config.aggressiveness ?? 50,
      humor: config.humor ?? 50,
      contrarian_level: config.contrarian_level ?? 50,
      data_vs_intuition: config.data_vs_intuition ?? 50,
      confidence: config.confidence ?? 50,
      sample_outputs: config.sample_outputs,
      exclude_forecaster_id: config.exclude_forecaster_id ?? config.id ?? undefined,
    }),
  });
  if (!res.ok) throw new Error("Differentiation check failed");
  return normalizeDifferentiation(await res.json());
}

function normalizeDifferentiation(data: Record<string, unknown>): DifferentiationResult {
  const suggestions = (data.improvement_suggestions ?? data.suggestions ?? []) as string[];
  return {
    similarity_score: data.similarity_score as number,
    differentiation_score: (data.differentiation_score as number) ?? 100 - (data.similarity_score as number),
    level: (data.level as DifferentiationLevel) ?? "distinct",
    closest_match: data.closest_match as DifferentiationResult["closest_match"],
    overlap_reasons: (data.overlap_reasons as string[]) ?? [],
    improvement_suggestions: suggestions,
    can_publish: (data.can_publish as boolean) ?? true,
    message: (data.message as string) ?? "",
    too_similar: data.too_similar as boolean | undefined,
    suggestions,
  };
}

export class PublishBlockedError extends Error {
  differentiation: DifferentiationResult;

  constructor(message: string, differentiation: DifferentiationResult) {
    super(message);
    this.name = "PublishBlockedError";
    this.differentiation = differentiation;
  }
}

export async function publishForecaster(id: number): Promise<{
  agent_slug: string;
  profile_url: string;
  differentiation: DifferentiationResult;
}> {
  const res = await apiFetch(`/creator-forecasters/${id}/publish`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    if (detail && typeof detail === "object" && detail.differentiation) {
      const diff = normalizeDifferentiation(detail.differentiation as Record<string, unknown>);
      throw new PublishBlockedError(
        (detail.message as string) || diff.message || "Publish blocked — forecaster too similar",
        diff
      );
    }
    throw new Error(typeof detail === "string" ? detail : "Publish failed");
  }
  return res.json();
}

export async function fetchKnowledgeSources(
  forecasterId: number
): Promise<{
  sources: KnowledgeSource[];
  limits: KnowledgeLimits;
  pdf_processing_available: boolean;
}> {
  const res = await apiFetch(`/forecasters/${forecasterId}/knowledge`);
  if (!res.ok) throw new Error("Failed to load knowledge sources");
  return res.json();
}

export type KnowledgeUploadResult = KnowledgeSource & {
  pdf_processing_available: boolean;
};

export async function uploadKnowledgePdf(
  forecasterId: number,
  file: File
): Promise<KnowledgeUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`/forecasters/${forecasterId}/knowledge/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Upload failed");
  }
  return res.json();
}

export async function deleteKnowledgeSource(
  forecasterId: number,
  sourceId: number
): Promise<void> {
  const res = await apiFetch(`/forecasters/${forecasterId}/knowledge/${sourceId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete source");
}

export type ForecasterDiscovery = {
  core_agents: ForecasterCard[];
  creator_forecasters: ForecasterCard[];
  sections: {
    trending: ForecasterCard[];
    rising: ForecasterCard[];
    newest: ForecasterCard[];
    most_followed: ForecasterCard[];
  };
};

export type ForecasterCard = {
  name: string;
  slug: string;
  niche: string;
  conviction_style: string;
  personality_tagline: string;
  avatar_color: string;
  is_creator?: boolean;
  follower_count: number;
  reputation_score?: number;
  tier_label?: string;
  reputation_velocity?: number;
  reputation_trend?: string;
};

export async function fetchForecasterDiscovery(): Promise<ForecasterDiscovery> {
  const res = await apiFetch("/forecasters", {}, false);
  if (!res.ok) throw new Error("Failed to load agents");
  return res.json();
}

export type MyCreatorAgent = CreatorForecasterDraft & {
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

export async function fetchMyCreatorAgents(): Promise<MyCreatorAgent[]> {
  const res = await apiFetch("/creator-forecasters/mine");
  if (!res.ok) throw new Error("Failed to load your agents");
  const data = await res.json();
  return Array.isArray(data) ? (data as MyCreatorAgent[]) : [];
}

function mapApiToDraft(data: Record<string, unknown>): CreatorForecasterDraft {
  return {
    id: data.id as number,
    display_name: (data.display_name as string) ?? "",
    username: (data.username as string) ?? "",
    avatar_color: (data.avatar_color as string) ?? "#8b5cf6",
    short_bio: (data.short_bio as string) ?? "",
    domain_focus: (data.domain_focus as DomainFocus) ?? "",
    archetype: (data.archetype as ArchetypeKey) ?? "",
    archetype_description: (data.archetype_description as string) ?? "",
    aggressiveness: (data.aggressiveness as number) ?? 50,
    humor: (data.humor as number) ?? 50,
    contrarian_level: (data.contrarian_level as number) ?? 50,
    data_vs_intuition: (data.data_vs_intuition as number) ?? 50,
    confidence: (data.confidence as number) ?? 50,
    blind_spot: (data.blind_spot as string) ?? "",
    personality_summary: (data.personality_summary as string) ?? "",
    status: (data.status as CreatorForecasterDraft["status"]) ?? "draft",
    agent_slug: (data.agent_slug as string | null) ?? null,
  };
}

export function buildPersonalitySummary(draft: CreatorForecasterDraft): string {
  const lines: string[] = [];
  if (draft.contrarian_level >= 70) lines.push("Highly contrarian.");
  else if (draft.contrarian_level >= 45) lines.push("Selectively contrarian.");
  else lines.push("Rarely fades consensus.");

  if (draft.data_vs_intuition >= 65) lines.push("Data-first.");
  else if (draft.data_vs_intuition <= 35) lines.push("Intuition-led.");
  else lines.push("Blends data and gut.");

  if (draft.confidence >= 75) lines.push("Rarely admits uncertainty.");
  else if (draft.confidence <= 35) lines.push("Open about uncertainty.");
  else lines.push("Calibrated confidence.");

  if (draft.aggressiveness >= 75) lines.push("Direct and confrontational.");
  else if (draft.humor >= 65) lines.push("Uses humor as a weapon.");

  return lines.slice(0, 4).join("\n");
}

export function slugifyUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
