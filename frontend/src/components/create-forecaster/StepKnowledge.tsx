"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type KnowledgeLimits,
  type KnowledgeSource,
  deleteKnowledgeSource,
  fetchKnowledgeSources,
  uploadKnowledgePdf,
} from "@/lib/creatorForecaster";
import { StepPanel, StudioPrimaryButton } from "./CreateForecasterShell";

function StatusBadge({ status }: { status: KnowledgeSource["status"] }) {
  const styles: Record<KnowledgeSource["status"], string> = {
    uploaded: "border-zinc-700 text-zinc-500 bg-zinc-900/40",
    processing: "border-amber-500/40 text-amber-200 bg-amber-950/20",
    ready: "border-emerald-500/40 text-emerald-200 bg-emerald-950/20",
    failed: "border-rose-500/40 text-rose-200 bg-rose-950/20",
  };
  const labels: Record<KnowledgeSource["status"], string> = {
    uploaded: "Uploaded",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function SourceCard({
  source,
  onDelete,
  deleting,
}: {
  source: KnowledgeSource;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-200 truncate">{source.filename}</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">PDF source material</p>
        </div>
        <StatusBadge status={source.status} />
      </div>

      {source.status === "ready" && source.summary && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Summary</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{source.summary}</p>
        </div>
      )}

      {source.status === "ready" && source.key_claims.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Key claims</p>
          <ul className="space-y-1.5">
            {source.key_claims.slice(0, 6).map((claim, i) => (
              <li key={i} className="text-[12px] text-zinc-400 leading-relaxed pl-3 border-l border-zinc-800">
                {claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {source.status === "failed" && source.summary && (
        <p className="text-[12px] text-rose-300/90">{source.summary}</p>
      )}

      <div className="flex justify-end">
        <StudioPrimaryButton variant="ghost" onClick={onDelete} disabled={deleting}>
          {deleting ? "Removing..." : "Remove"}
        </StudioPrimaryButton>
      </div>
    </div>
  );
}

export function StepKnowledge({
  forecasterId,
  onContinue,
}: {
  forecasterId: number;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [limits, setLimits] = useState<KnowledgeLimits | null>(null);
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchKnowledgeSources(forecasterId);
      setSources(data.sources);
      setLimits(data.limits);
      setPdfAvailable(data.pdf_processing_available);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, [forecasterId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const atLimit = limits ? sources.length >= limits.max_pdfs : false;
  const maxMb = limits ? (limits.max_bytes / (1024 * 1024)).toFixed(0) : "5";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("PDF files only");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const created = await uploadKnowledgePdf(forecasterId, file);
      setPdfAvailable(created.pdf_processing_available);
      setSources((prev) => [...prev, created]);
      if (created.status === "failed" && created.summary) {
        setError(created.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(sourceId: number) {
    setDeletingId(sourceId);
    setError(null);
    try {
      await deleteKnowledgeSource(forecasterId, sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <StepPanel
      title="Knowledge"
      subtitle="Upload source material your forecaster should reason from."
    >
      <p className="text-[12px] text-zinc-500 leading-relaxed -mt-2">
        Your forecaster will use this as context. It will not quote private docs publicly unless
        you publish outputs.
      </p>

      {pdfAvailable === false && (
        <p className="text-[13px] text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-lg px-4 py-2">
          PDF processing dependency not installed on the server. Install pypdf in the backend
          environment and restart the API.
        </p>
      )}

      {error && (
        <p className="text-[13px] text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 p-6 text-center space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || atLimit || pdfAvailable === false}
        />
        <p className="text-[13px] text-zinc-400">
          PDF only · up to {maxMb}MB · max {limits?.max_pdfs ?? 3} files
        </p>
        <StudioPrimaryButton
          onClick={() => inputRef.current?.click()}
          disabled={uploading || atLimit || pdfAvailable === false}
        >
          {uploading ? "Uploading..." : atLimit ? "Limit reached" : "Upload PDF"}
        </StudioPrimaryButton>
        <p className="text-[11px] text-zinc-600">Optional — skip if you have no source material.</p>
      </div>

      {loading && <p className="text-[13px] text-zinc-500 animate-pulse">Loading sources...</p>}

      {!loading && sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onDelete={() => handleDelete(source.id)}
              deleting={deletingId === source.id}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <StudioPrimaryButton onClick={onContinue} disabled={uploading}>
          {sources.some((s) => s.status === "ready") ? "Generate preview" : "Continue"}
        </StudioPrimaryButton>
      </div>
    </StepPanel>
  );
}
