"""Thread label copy classification and feed mirror metadata."""

from datetime import datetime

import pytest

from app.database import SessionLocal
from app.forecasting.models import Agent, FeedEvent
from app.forecasting.services.agent_activity_engine import _mirror_feed_event
from app.forecasting.services.feed_intelligence import build_personalized_feed
from app.forecasting.services.feed_thread_display_stats import resolve_thread_block_label
from app.forecasting.services.thread_label_copy import (
    classify_rival_thread_tone,
    is_explicitly_adversarial_rival_copy,
    mirror_activity_meta_fields,
)


def test_momentum_copy_is_not_public_clash():
    assert not is_explicitly_adversarial_rival_copy(
        "momentum persists. the long side wins",
        "timing is the job.",
    )
    label = resolve_thread_block_label(
        [
            {"activity_type": "agent_post", "parent_activity_id": None},
            {
                "activity_type": "rival_reply",
                "parent_activity_id": "root",
                "title": "momentum persists. the long side wins",
                "body": "timing is the job.",
                "thread_tone": "calm",
            },
        ]
    )
    assert label == "Desk Note"


def test_repriced_copy_is_not_public_clash():
    assert not is_explicitly_adversarial_rival_copy(
        "September modal repriced. path first.",
        "narrative second.",
    )
    label = resolve_thread_block_label(
        [
            {
                "activity_type": "rival_reply",
                "title": "September modal repriced. path first.",
                "body": "narrative second.",
                "thread_tone": "calm",
            }
        ]
    )
    assert label == "Desk Note"


def test_named_wrong_copy_is_public_clash():
    assert is_explicitly_adversarial_rival_copy(
        "FedWatcher is wrong; the curve lags",
        "",
        opponent_name="FedWatcher",
    )
    label = resolve_thread_block_label(
        [
            {
                "activity_type": "rival_reply",
                "title": "FedWatcher is wrong; the curve lags",
                "opponent_name": "FedWatcher",
                "thread_tone": "heated",
            }
        ]
    )
    assert label == "Public Clash"


def test_narrative_stage_payload_becomes_narrative_shift():
    label = resolve_thread_block_label(
        [
            {
                "activity_type": "rival_reply",
                "title": "momentum persists.",
                "narrative_stage": "consensus_shift",
                "thread_tone": "calm",
            }
        ]
    )
    assert label == "Narrative Shift"


def test_mirror_activity_meta_fields():
    meta = mirror_activity_meta_fields(
        {
            "narrative_stage": "early_confirmation",
            "narrative_stage_label": "Early confirmation",
            "thread_tone": "calm",
            "continuation_kind": "thread_continuation",
            "idea_bucket": "curve_signal",
            "thread_lifecycle": "active",
            "ignored": "x",
        }
    )
    assert meta["narrative_stage"] == "early_confirmation"
    assert meta["thread_tone"] == "calm"
    assert meta["idea_bucket"] == "curve_signal"
    assert "ignored" not in meta


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_mirror_feed_event_preserves_narrative_stage_and_thread_tone(db):
    agent = db.query(Agent).first()
    if not agent:
        pytest.skip("No agents seeded")

    meta = {
        "generated_activity_id": "mirror-meta-probe",
        "thread_id": "mirror-meta-probe",
        "parent_activity_id": None,
        "narrative_stage": "early_confirmation",
        "narrative_stage_label": "Early confirmation",
        "thread_tone": "calm",
        "continuation_kind": "thread_continuation",
        "idea_bucket": "curve_signal",
        "thread_lifecycle": "active",
    }
    feed_ev = _mirror_feed_event(
        db,
        agent=agent,
        market=None,
        activity_type="rival_reply",
        title="Curve is the signal.",
        body="Front-end leads.",
        meta=meta,
    )
    assert feed_ev is not None
    stored = feed_ev.metadata_json or {}
    assert stored.get("narrative_stage") == "early_confirmation"
    assert stored.get("thread_tone") == "calm"
    assert stored.get("idea_bucket") == "curve_signal"
    assert stored.get("continuation_kind") == "thread_continuation"

    feed_ev.feed_published_at = datetime.utcnow()
    db.add(feed_ev)
    db.commit()

    result = build_personalized_feed(db, None, chip="latest", limit=50)
    payload = next(
        (item for item in result["events"] if item.get("generated_activity_id") == "mirror-meta-probe"),
        None,
    )
    assert payload is not None
    assert payload.get("narrative_stage") == "early_confirmation"
    assert payload.get("thread_tone") == "calm"

    db.delete(feed_ev)
    db.commit()


def test_classify_rival_thread_tone():
    assert classify_rival_thread_tone(
        "FedWatcher is wrong; the curve lags",
        "",
        opponent_name="FedWatcher",
    ) == "heated"
    assert (
        classify_rival_thread_tone(
            "momentum persists. the long side wins.",
            "",
        )
        == "calm"
    )
