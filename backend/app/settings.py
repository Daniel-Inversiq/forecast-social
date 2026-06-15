"""Central environment and deployment settings."""

from __future__ import annotations

import os
import sys

# Import-time guard — see app/_import_bootstrap.py (must match).
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - optional dependency fallback
    load_dotenv = None

DEV_JWT_SECRET = "forecast-social-dev-secret-change-in-production"
_PRODUCTION_ENVS = frozenset({"production", "prod"})


def _load_env_files() -> None:
    """Load .env values for local development and CLI runs."""
    if load_dotenv is None:
        return
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    candidates = (
        os.path.join(base_dir, ".env"),
        os.path.join(base_dir, "..", ".env"),
    )
    for env_path in candidates:
        if os.path.exists(env_path):
            load_dotenv(env_path, override=False)


_load_env_files()


def app_env() -> str:
    return os.getenv(
        "APP_ENV",
        os.getenv("ENV", os.getenv("ENVIRONMENT", "development")),
    ).lower()


def is_production() -> bool:
    return app_env() in _PRODUCTION_ENVS


def is_dev_environment() -> bool:
    return not is_production()


def _env_flag(name: str) -> bool | None:
    raw = os.getenv(name, "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return None


def sentry_dsn() -> str:
    return os.getenv("SENTRY_DSN", "").strip()


def sentry_enabled() -> bool:
    """Sentry is off in local development unless explicitly enabled."""
    if not sentry_dsn():
        return False
    override = _env_flag("SENTRY_ENABLED")
    if override is True:
        return True
    if override is False:
        return False
    return not is_dev_environment()


def sentry_traces_sample_rate() -> float:
    raw = os.getenv("SENTRY_TRACES_SAMPLE_RATE", "").strip()
    if not raw:
        return 0.1 if is_production() else 0.0
    try:
        return max(0.0, min(1.0, float(raw)))
    except ValueError:
        return 0.1


def jwt_secret() -> str:
    return os.getenv("JWT_SECRET", DEV_JWT_SECRET)


def base_rpc_url() -> str:
    return os.getenv("BASE_RPC_URL", "").strip()


def polygon_rpc_url() -> str:
    return os.getenv("POLYGON_RPC_URL", "").strip()


def usdc_base_contract() -> str:
    return os.getenv(
        "USDC_BASE_CONTRACT",
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ).strip().lower()


def usdc_polygon_contract() -> str:
    return os.getenv(
        "USDC_POLYGON_CONTRACT",
        "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ).strip().lower()


def treasury_wallet_address() -> str:
    return os.getenv("TREASURY_WALLET_ADDRESS", "").strip().lower()


def min_deposit_usdc() -> float:
    return float(os.getenv("MIN_DEPOSIT_USDC", "5"))


def max_user_exposure_usdc() -> float:
    return float(os.getenv("MAX_USER_EXPOSURE_USDC", "100"))


def max_market_exposure_usdc() -> float:
    return float(os.getenv("MAX_MARKET_EXPOSURE_USDC", "25"))


def deposit_confirmations_required() -> int:
    return max(1, int(os.getenv("DEPOSIT_CONFIRMATIONS_REQUIRED", "3")))


def cors_allowed_origins() -> list[str]:
    origins: list[str] = []
    frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend:
        origins.append(frontend)
    extra = os.getenv("CORS_EXTRA_ORIGINS", "")
    for part in extra.split(","):
        part = part.strip().rstrip("/")
        if part:
            origins.append(part)
    if is_dev_environment():
        for local in ("http://localhost:3000", "http://127.0.0.1:3000"):
            if local not in origins:
                origins.append(local)
    return origins or ["http://localhost:3000"]


def validate_settings_on_startup() -> None:
    """Fail fast when production is misconfigured."""
    if not is_production():
        return

    secret = jwt_secret()
    if not secret or secret == DEV_JWT_SECRET or len(secret) < 32:
        print(
            "FATAL: Production requires JWT_SECRET (32+ chars, not the dev default).",
            file=sys.stderr,
        )
        sys.exit(1)

    if os.getenv("STRIPE_SECRET_KEY", "").startswith("sk_test"):
        print(
            "WARNING: STRIPE_SECRET_KEY looks like a test key in production.",
            file=sys.stderr,
        )


def _split_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def event_sources_custom_csv() -> str:
    """
    Comma-separated custom source records:
    EVENT_SOURCES_CUSTOM="Name|category|https://feed.url/rss,Another|crypto|https://..."
    """
    return os.getenv("EVENT_SOURCES_CUSTOM", "").strip()


def knowledge_pdf_max_bytes() -> int:
    """Max upload size for creator forecaster PDF knowledge sources."""
    return int(os.getenv("KNOWLEDGE_PDF_MAX_BYTES", str(5 * 1024 * 1024)))


def knowledge_max_pdfs_per_forecaster() -> int:
    """Max PDF knowledge sources per creator forecaster draft."""
    return max(1, int(os.getenv("KNOWLEDGE_MAX_PDFS_PER_FORECASTER", "3")))


def knowledge_extract_max_chars() -> int:
    """Truncate extracted PDF text before summarization."""
    return max(1000, int(os.getenv("KNOWLEDGE_EXTRACT_MAX_CHARS", "50000")))


def knowledge_storage_dir() -> str:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "knowledge"))
    os.makedirs(base, exist_ok=True)
    return base


def event_sources_by_category_env() -> dict[str, list[str]]:
    """
    Per-category comma-separated feed URLs.
    Example:
      EVENT_SOURCES_MACRO="https://a/rss,https://b/rss"
      EVENT_SOURCES_CRYPTO="https://c/rss"
    """
    categories = ("macro", "geopolitics", "politics", "crypto", "ai", "sports", "climate")
    out: dict[str, list[str]] = {}
    for category in categories:
        raw = os.getenv(f"EVENT_SOURCES_{category.upper()}", "").strip()
        out[category] = _split_csv(raw) if raw else []
    return out
