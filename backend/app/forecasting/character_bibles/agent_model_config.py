"""Per-agent LLM model configuration — separate from character bible personalities."""

from __future__ import annotations

import json
import os
from copy import deepcopy
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.forecasting.agent_status import CORE_AGENT_SLUGS

_CONFIG_PATH = Path(__file__).resolve().parent / "agent_model_config.json"

MODEL_CONFIG_FIELDS = (
    "model_provider",
    "model_name",
    "temperature",
    "top_p",
    "max_tokens",
    "frequency_penalty",
    "presence_penalty",
)

SUPPORTED_PROVIDERS = ("openai", "anthropic", "template")

PROVIDER_MODEL_HINTS: dict[str, list[str]] = {
    "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    "anthropic": ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
    "template": ["template-local"],
}


@dataclass
class AgentModelConfig:
    model_provider: str
    model_name: str
    temperature: float
    top_p: float
    max_tokens: int
    frequency_penalty: float
    presence_penalty: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_public_dict(self) -> dict[str, Any]:
        """Safe for admin API — never includes API keys."""
        return self.to_dict()


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def env_global_default() -> AgentModelConfig:
    """Runtime global default — env overrides file global_default."""
    return AgentModelConfig(
        model_provider=os.getenv("SCRY_LLM_PROVIDER", "openai").strip().lower() or "openai",
        model_name=os.getenv("SCRY_LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        temperature=_env_float("SCRY_LLM_TEMPERATURE", 0.7),
        top_p=_env_float("SCRY_LLM_TOP_P", 1.0),
        max_tokens=_env_int("SCRY_LLM_MAX_TOKENS", 256),
        frequency_penalty=_env_float("SCRY_LLM_FREQUENCY_PENALTY", 0.0),
        presence_penalty=_env_float("SCRY_LLM_PRESENCE_PENALTY", 0.0),
    )


def _coerce_config(raw: dict[str, Any] | None) -> AgentModelConfig | None:
    if not raw:
        return None
    try:
        provider = str(raw.get("model_provider", "openai")).strip().lower()
        if provider not in SUPPORTED_PROVIDERS:
            provider = "openai"
        return AgentModelConfig(
            model_provider=provider,
            model_name=str(raw.get("model_name", "gpt-4o-mini")).strip() or "gpt-4o-mini",
            temperature=float(raw.get("temperature", 0.7)),
            top_p=float(raw.get("top_p", 1.0)),
            max_tokens=int(raw.get("max_tokens", 256)),
            frequency_penalty=float(raw.get("frequency_penalty", 0.0)),
            presence_penalty=float(raw.get("presence_penalty", 0.0)),
        )
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def _load_file_raw() -> dict[str, Any]:
    if not _CONFIG_PATH.exists():
        return {"version": 1, "global_default": {}, "agents": {}, "presets": {}}
    with _CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def clear_model_config_cache() -> None:
    _load_file_raw.cache_clear()


def file_global_default() -> AgentModelConfig | None:
    raw = _load_file_raw().get("global_default")
    if isinstance(raw, dict) and raw:
        return _coerce_config(raw)
    return None


def resolve_model_config(slug: str | None = None) -> AgentModelConfig:
    """Per-agent override merged onto env global default."""
    base = env_global_default()
    file_global = file_global_default()
    if file_global:
        base = _merge_config(base, file_global)
    if slug:
        agents = _load_file_raw().get("agents") or {}
        override = agents.get(slug)
        if isinstance(override, dict) and override:
            merged = _merge_config(base, _coerce_config(override))
            if merged:
                return merged
    return base


def _merge_config(base: AgentModelConfig, override: AgentModelConfig | None) -> AgentModelConfig:
    if override is None:
        return base
    data = base.to_dict()
    for key in MODEL_CONFIG_FIELDS:
        val = getattr(override, key)
        if val is not None and val != "":
            data[key] = val
    return AgentModelConfig(**data)


def agent_override_raw(slug: str) -> dict[str, Any] | None:
    agents = _load_file_raw().get("agents") or {}
    raw = agents.get(slug)
    return dict(raw) if isinstance(raw, dict) and raw else None


def save_agent_override(slug: str, config: dict[str, Any] | None) -> AgentModelConfig:
    """Persist per-agent settings; None clears override."""
    if slug not in CORE_AGENT_SLUGS:
        raise ValueError(f"Not a core agent slug: {slug}")
    data = deepcopy(_load_file_raw())
    agents = dict(data.get("agents") or {})
    if config:
        coerced = _coerce_config(config)
        if not coerced:
            raise ValueError("Invalid model config")
        agents[slug] = coerced.to_dict()
    else:
        agents.pop(slug, None)
    data["agents"] = agents
    _write_file(data)
    return resolve_model_config(slug)


def apply_preset(preset_key: str, slug: str) -> AgentModelConfig:
    presets = list_presets()
    if preset_key not in presets:
        raise ValueError(f"Unknown preset: {preset_key}")
    return save_agent_override(slug, presets[preset_key])


def list_presets() -> dict[str, dict[str, Any]]:
    raw = _load_file_raw().get("presets") or {}
    out: dict[str, dict[str, Any]] = {}
    for key, val in raw.items():
        if isinstance(val, dict):
            entry = {k: v for k, v in val.items() if k in MODEL_CONFIG_FIELDS or k == "label"}
            out[key] = entry
    return out


def admin_model_metadata() -> dict[str, Any]:
    """Providers, hints, env defaults — no secrets."""
    effective = env_global_default()
    return {
        "supported_providers": list(SUPPORTED_PROVIDERS),
        "provider_model_hints": PROVIDER_MODEL_HINTS,
        "global_default": effective.to_public_dict(),
        "env_overrides_active": bool(os.getenv("SCRY_LLM_PROVIDER") or os.getenv("SCRY_LLM_MODEL")),
        "presets": list_presets(),
        "llm_providers_configured": provider_status(),
    }


def provider_status() -> dict[str, bool]:
    return {
        "openai": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
        "template": True,
    }


def agent_model_config_payload(slug: str) -> dict[str, Any]:
    effective = resolve_model_config(slug)
    override = agent_override_raw(slug)
    status = provider_status()
    provider = effective.model_provider
    return {
        "slug": slug,
        "effective": effective.to_public_dict(),
        "override": override,
        "uses_global_default": override is None,
        "provider_configured": status.get(provider, False),
        "generation_modes": {
            "llm": provider != "template" and status.get(provider, False),
            "template": True,
        },
    }


def _write_file(data: dict[str, Any]) -> None:
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _CONFIG_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    clear_model_config_cache()
