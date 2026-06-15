"""LLM generation for core agents — uses per-agent model config; falls back to templates."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.forecasting.character_bibles import (
    bible_runtime_context,
    character_bible_for,
    relationship_between,
    voice_rules_for,
)
from app.forecasting.character_bibles.agent_model_config import (
    AgentModelConfig,
    resolve_model_config,
    provider_status,
)
from app.forecasting.services.agent_prompt_context import (
    RetrievedContext,
    build_retrieved_context,
    estimate_bible_coverage_pct,
    format_retrieved_for_user_prompt,
)

GenerationTask = str  # post | counter | reaction | win | loss | battle | conviction_update

_DISPLAY = {
    "doombot": "DoomBot",
    "bullbot": "BullBot",
    "fed-watcher": "FedWatcher",
    "macro-oracle": "Macro Oracle",
    "sports-chaos": "SportsChaos",
}


@dataclass
class PromptBundle:
    system_prompt: str
    user_prompt: str
    retrieved: dict[str, Any]
    bible_coverage_pct: float
    task: str
    slug: str

    def debug_payload(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "task": self.task,
            "system_prompt": self.system_prompt,
            "user_prompt": self.user_prompt,
            "retrieved_memories": {
                "memory_guidance": self.retrieved.get("memory_guidance"),
                "agent_continuity": self.retrieved.get("agent_continuity"),
            },
            "retrieved_receipts": self.retrieved.get("receipts"),
            "retrieved_forecasts": self.retrieved.get("resolved_forecasts"),
            "retrieved_rival_context": {
                "relationship_context": self.retrieved.get("relationship_context"),
                "rival_posts": self.retrieved.get("rival_posts"),
            },
            "few_shot_examples": self.retrieved.get("few_shot_examples"),
            "rituals": self.retrieved.get("rituals"),
            "bible_coverage_pct": self.bible_coverage_pct,
        }


def _display_name(slug: str) -> str:
    bible = character_bible_for(slug)
    return str(bible.get("display_name") or _DISPLAY.get(slug, slug))


def llm_enabled_for_config(config: AgentModelConfig) -> bool:
    if config.model_provider == "template":
        return False
    return provider_status().get(config.model_provider, False)


def _join_lines(items: list[Any], *, sep: str = "; ") -> str:
    return sep.join(str(x).strip() for x in items if str(x).strip())


def build_system_prompt(slug: str, task: GenerationTask) -> str:
    bible = character_bible_for(slug)
    rules = voice_rules_for(slug)
    ctx = bible_runtime_context(slug)
    forbidden = _join_lines(list(bible.get("forbidden_phrases") or []), sep=", ")
    sig = _join_lines(list(bible.get("signature_phrases") or []), sep=", ")
    beliefs = _join_lines(list(ctx.get("core_beliefs") or []) or [bible.get("core_belief", "")])
    non_neg = str(ctx.get("non_negotiable") or "")
    wrong = str(ctx.get("being_wrong_behavior") or bible.get("loss_behavior", ""))
    receipt = ctx.get("receipt_behavior") if isinstance(ctx.get("receipt_behavior"), dict) else {}
    receipt_on_miss = str(receipt.get("on_miss") or "")
    receipt_ref = str(receipt.get("reference_receipts") or "")[:600]
    writing_rules = _join_lines(list(ctx.get("writing_style_rules") or []), sep="\n- ")
    hated = _join_lines(list(bible.get("hated_narratives") or []), sep=", ")
    favored = _join_lines(list(bible.get("favorite_narratives") or []), sep=", ")
    rivalry = bible.get("rivalry_behavior") if isinstance(bible.get("rivalry_behavior"), dict) else {}
    rivalry_lines = [
        f"{rival}: {behavior[:200]}"
        for rival, behavior in rivalry.items()
        if rival and behavior
    ]
    bad_examples = list(bible.get("example_bad_posts") or [])[:3]

    lines = [
        f"You are {_display_name(slug)}, a Scry forecasting agent. Write ONLY in this character's voice.",
        f"Tagline: {ctx.get('tagline') or bible.get('tagline', '')}",
        f"Category: {ctx.get('category') or ''}",
        f"Persona: {ctx.get('persona_summary') or bible.get('persona_summary', '')}",
        f"Worldview: {bible.get('worldview', '')}",
        f"Core beliefs: {beliefs}",
        f"Speech: max {rules.get('max_sentences', 3)} sentences; opening style {rules.get('opening_style', '')}.",
        f"Win style: {rules.get('win_style', bible.get('win_behavior', ''))}",
        f"Loss / being wrong: {wrong}",
        f"Signature phrases (use naturally): {sig}",
        f"NEVER use: {forbidden}",
    ]
    if non_neg:
        lines.append(f"Non-negotiable: {non_neg}")
    if receipt_on_miss:
        lines.append(f"On missed calls: {receipt_on_miss}")
    if receipt_ref:
        lines.append(f"Receipt reference style: {receipt_ref}")
    forbidden_behavior = ctx.get("forbidden_behavior") or []
    if forbidden_behavior:
        lines.append("Forbidden behavior: " + _join_lines(forbidden_behavior[:8]))
    if writing_rules:
        lines.append("Writing style rules:\n- " + writing_rules)
    if hated:
        lines.append(f"Hated narratives: {hated}")
    if favored:
        lines.append(f"Favorite narratives: {favored}")
    if rivalry_lines:
        lines.append("Rivalry behavior:\n" + "\n".join(rivalry_lines))
    if bad_examples:
        lines.append("Anti-examples (never write like this):\n" + "\n---\n".join(bad_examples))
    lines.append(
        "NEVER sound like a generic AI summary. No 'market participants', 'it is important to note'."
    )
    lines.append(
        "Headlines must be opinion-driven (observation, warning, challenge, or prediction) — "
        "never market names, forecast titles, event labels, YES/NO, or conviction percentages."
    )
    if task == "conviction_update":
        lines.append(
            "Task: conviction_update. State an updated probability or conviction level on the market. "
            "Reference your prior view if continuity posts are provided. Stay in voice."
        )
    else:
        lines.append(f"Task: {task}. Output only the post body text, no quotes or labels.")
    return "\n".join(lines) + "\n"


def build_user_prompt(
    slug: str,
    task: GenerationTask,
    context: dict[str, Any],
    retrieved: RetrievedContext | None = None,
) -> str:
    parts = [f"Generate a {task} for {_display_name(slug)}."]
    for key in (
        "market_title",
        "headline",
        "role",
        "opponent_slug",
        "target_slug",
        "spread",
        "side",
        "direction",
        "event_type",
        "event_kind",
        "trigger_id",
        "term",
        "prob",
        "scar",
        "callback",
    ):
        if context.get(key) is not None:
            parts.append(f"{key}: {context[key]}")
    opp = context.get("opponent_slug") or context.get("target_slug")
    if opp:
        rel = relationship_between(slug, opp) or {}
        if rel.get("note"):
            parts.append(f"Relationship note: {rel['note']}")
    if task == "counter" and opp:
        parts.append(
            f'Format: one short in-character counter line toward {_display_name(opp)}. '
            "Do not include Confidence line — backend adds it."
        )
        if context.get("source_post_title") or context.get("source_post_body"):
            src_name = _display_name(str(context.get("source_agent_slug") or opp))
            title = context.get("source_post_title") or ""
            body = str(context.get("source_post_body") or "")[:280]
            parts.append(f"Respond directly to {src_name}'s post — do NOT agree or validate it.")
            if title:
                parts.append(f"Their headline: {title}")
            if body:
                parts.append(f"Their post: {body}")
        beliefs = context.get("core_beliefs")
        if beliefs and isinstance(beliefs, list):
            parts.append("Your core beliefs to defend: " + "; ".join(str(b) for b in beliefs[:4]))
        if context.get("relationship_dynamic"):
            parts.append(f"Relationship dynamic with {_display_name(opp)}: {context['relationship_dynamic']}")
        if context.get("relationship_type"):
            parts.append(f"Relationship type: {context['relationship_type']}")
        if context.get("rivalry_behavior"):
            parts.append(f"Rivalry behavior toward {_display_name(opp)}: {context['rivalry_behavior']}")
        if context.get("response_style"):
            parts.append(f"Response style toward {_display_name(opp)}: {context['response_style']}")
        if context.get("typical_response"):
            parts.append(
                f"Typical counter toward {_display_name(opp)} (adapt voice, do not copy verbatim): "
                f"{context['typical_response']}"
            )
        parts.append(
            f"Sound like you know {_display_name(opp)} — reference their recurring framing when relevant. "
            "Be opinionated, adversarial when appropriate, and agent-specific. "
            "Never write generic agreement, both-sides framing, or neutral summaries."
        )
    if task == "battle":
        parts.append("Include one sharp counter line plus one sentence on the battle spread.")
    if task == "conviction_update":
        prob = context.get("prob")
        prob_hint = f" Target conviction: {prob}%." if prob is not None else ""
        parts.append(
            f"Format: in-character conviction update on the market.{prob_hint} "
            "Include specific probability or level. Do not use generic templates."
        )
    if retrieved:
        formatted = format_retrieved_for_user_prompt(retrieved)
        if formatted:
            parts.append(formatted)
    return "\n".join(parts)


def build_prompt_bundle(
    slug: str,
    task: GenerationTask,
    context: dict[str, Any] | None = None,
    *,
    db: Session | None = None,
) -> PromptBundle:
    ctx = context or {}
    opponent = ctx.get("opponent_slug") or ctx.get("target_slug")
    retrieved = build_retrieved_context(
        db,
        slug,
        opponent_slug=str(opponent) if opponent else None,
        event_type=str(ctx.get("event_type")) if ctx.get("event_type") else None,
        event_kind=str(ctx.get("event_kind")) if ctx.get("event_kind") else None,
        trigger_id=str(ctx.get("trigger_id")) if ctx.get("trigger_id") else None,
    )
    system = build_system_prompt(slug, task)
    user = build_user_prompt(slug, task, ctx, retrieved)
    coverage = estimate_bible_coverage_pct(slug, system, user)
    return PromptBundle(
        system_prompt=system,
        user_prompt=user,
        retrieved=retrieved.as_dict(),
        bible_coverage_pct=coverage,
        task=task,
        slug=slug,
    )


def generate_text(
    slug: str,
    task: GenerationTask,
    context: dict[str, Any] | None = None,
    *,
    config: AgentModelConfig | None = None,
    db: Session | None = None,
) -> tuple[str | None, dict[str, Any]]:
    """
    Try LLM using resolved model config. Returns (text, meta).
    text is None if provider unavailable or request failed.
    """
    cfg = config or resolve_model_config(slug)
    bundle = build_prompt_bundle(slug, task, context, db=db)
    meta: dict[str, Any] = {
        "generation_mode": "template",
        "model_provider": cfg.model_provider,
        "model_name": cfg.model_name,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
        "bible_coverage_pct": bundle.bible_coverage_pct,
        "prompt_debug": bundle.debug_payload(),
    }
    if not llm_enabled_for_config(cfg):
        meta["llm_skip_reason"] = "provider_not_configured_or_template"
        return None, meta

    try:
        if cfg.model_provider == "openai":
            text = _openai_chat(cfg, bundle.system_prompt, bundle.user_prompt)
        elif cfg.model_provider == "anthropic":
            text = _anthropic_message(cfg, bundle.system_prompt, bundle.user_prompt)
        else:
            return None, meta
    except Exception as exc:  # noqa: BLE001 — surface reason in meta, fall back to templates
        meta["llm_error"] = str(exc)[:200]
        return None, meta

    if not text or not text.strip():
        meta["llm_skip_reason"] = "empty_response"
        return None, meta

    from app.forecasting.services.voice_engine import polish_copy

    cleaned = polish_copy(slug, text.strip())
    meta["generation_mode"] = "llm"
    return cleaned, meta


def _openai_chat(config: AgentModelConfig, system: str, user: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": config.model_name,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": config.temperature,
        "top_p": config.top_p,
        "max_tokens": config.max_tokens,
        "frequency_penalty": config.frequency_penalty,
        "presence_penalty": config.presence_penalty,
    }
    data = _http_json(
        f"{base}/chat/completions",
        payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    return str(message.get("content") or "").strip()


def _anthropic_message(config: AgentModelConfig, system: str, user: str) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    payload = {
        "model": config.model_name,
        "max_tokens": config.max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "temperature": config.temperature,
        "top_p": config.top_p,
    }
    data = _http_json(
        "https://api.anthropic.com/v1/messages",
        payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    )
    content = data.get("content") or []
    parts = [b.get("text", "") for b in content if b.get("type") == "text"]
    return "".join(parts).strip()


def _http_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e
    return json.loads(raw)
