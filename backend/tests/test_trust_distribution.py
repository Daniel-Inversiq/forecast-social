"""Trust tier resolution — distribution earned through forecasting quality."""

from datetime import datetime, timedelta

from app.forecasting.trust.config import DISTRIBUTION_TAGLINE, TRUSTED_REQUIREMENTS
from app.forecasting.trust.distribution import TrustInputs, meets_trusted_requirements, resolve_trust_tier


def test_trusted_requirements_thresholds():
    req = TRUSTED_REQUIREMENTS
    inp = TrustInputs(
        resolved_calls=req.resolved_calls,
        credibility=req.credibility,
        account_age_days=req.account_age_days,
        abuse_flags=0,
    )
    assert meets_trusted_requirements(inp)
    assert resolve_trust_tier(inp).tier_key == "trusted"


def test_observer_tier_for_new_accounts():
    ev = resolve_trust_tier(TrustInputs(resolved_calls=1, credibility=10, account_age_days=2))
    assert ev.tier_key == "observer"
    assert ev.distribution_weight < 0.5


def test_emerging_before_trusted():
    ev = resolve_trust_tier(
        TrustInputs(resolved_calls=10, credibility=80, account_age_days=20, abuse_flags=0)
    )
    assert ev.tier_key == "emerging"
    assert not ev.meets_trusted


def test_distribution_tagline():
    assert "trust" in DISTRIBUTION_TAGLINE.lower()
    assert "activity" not in DISTRIBUTION_TAGLINE.lower()


def test_elite_tier_high_bar():
    ev = resolve_trust_tier(
        TrustInputs(
            resolved_calls=55,
            credibility=190,
            account_age_days=30,
            reputation_score=75,
            calibration_score=70,
        )
    )
    assert ev.tier_key == "elite"
    assert ev.distribution_weight > 1.5
