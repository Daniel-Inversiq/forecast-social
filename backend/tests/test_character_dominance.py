"""Character dominance — blind identification of agent voice without names."""

from __future__ import annotations

import pytest

from app.database import SessionLocal
from app.forecasting.agent_status import CORE_AGENT_SLUGS
from app.forecasting.models import Agent
from app.forecasting.services.agent_activity_engine import generate_agent_activity_batch
from app.forecasting.services.character_fingerprints import (
    blind_identify_correct,
    blind_review_batch,
    fingerprint_passes,
    identify_author,
    score_fingerprint,
)
from app.forecasting.services.voice_engine import (
    generate_counter,
    generate_feed_post,
    generate_rival_reply,
    polish_copy,
)

CORE_SLUGS = tuple(sorted(CORE_AGENT_SLUGS))
DOMINANCE_TARGET = 0.80


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        agents = session.query(Agent).filter(Agent.slug.in_(CORE_SLUGS)).all()
        if len(agents) < 5:
            pytest.skip("Core agents not seeded in database")
        yield session
    finally:
        session.close()


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_fingerprint_passes_on_distinctive_post(slug: str) -> None:
    post, _ = generate_feed_post(slug, seed=hash(slug) % 10_000)
    polished = polish_copy(slug, post, seed=42)
    assert fingerprint_passes(slug, polished), (slug, polished, score_fingerprint(slug, polished))


@pytest.mark.parametrize("slug", CORE_SLUGS)
def test_counter_has_fingerprint(slug: str) -> None:
    target = "bullbot" if slug != "bullbot" else "doombot"
    counter = generate_counter(slug, target, seed=77)
    polished = polish_copy(slug, counter.line, seed=77)
    assert fingerprint_passes(slug, polished), (slug, polished)


@pytest.mark.parametrize(
    ("speaker", "target"),
    [
        ("doombot", "bullbot"),
        ("bullbot", "doombot"),
        ("macro-oracle", "fed-watcher"),
        ("fed-watcher", "macro-oracle"),
        ("sports-chaos", "doombot"),
    ],
)
def test_rival_reply_has_fingerprint(speaker: str, target: str) -> None:
    counter = generate_rival_reply(speaker, target, seed=42)
    polished = polish_copy(speaker, counter.line, seed=42)
    assert fingerprint_passes(speaker, polished), (speaker, polished)


def test_blind_identify_core_posts() -> None:
    hits = 0
    for slug in CORE_SLUGS:
        post, _ = generate_feed_post(slug, seed=101)
        polished = polish_copy(slug, post, seed=101)
        if blind_identify_correct(slug, polished):
            hits += 1
    assert hits >= 4, f"only {hits}/5 core posts identified"


def test_generate_100_activities_blind_review(db) -> None:
    """100-activity batch: hide names, identify author ≥80% of the time."""
    rows = generate_agent_activity_batch(db, count=100, seed=88001, mirror_to_feed=False)
    assert len(rows) >= 80, f"expected ~100 activities, got {len(rows)}"

    report = blind_review_batch(rows)
    assert report["accuracy"] >= DOMINANCE_TARGET, (
        f"blind identification {report['accuracy_pct']}% < {DOMINANCE_TARGET * 100}% — "
        f"by_agent={report['by_agent']}"
    )

    weak = [
        s
        for s in report["samples"]
        if not s["correct"]
    ]
    if weak:
        previews = [f"{s['actual_slug']}→{s['predicted_slug']}: {s['text_preview']}" for s in weak[:5]]
        assert report["accuracy"] >= DOMINANCE_TARGET, "misidentified samples: " + "; ".join(previews)


def test_identify_author_beats_random() -> None:
    correct = 0
    for slug in CORE_SLUGS:
        post, _ = generate_feed_post(slug, seed=202)
        text = polish_copy(slug, post, seed=202)
        result = identify_author(text)
        if result.predicted_slug == slug:
            correct += 1
    assert correct >= 4


def run_blind_review_cli(count: int = 100, seed: int = 88001) -> None:
    """Run from backend/: python -m tests.test_character_dominance --review [count] [seed]"""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        rows = generate_agent_activity_batch(db, count=count, seed=seed, mirror_to_feed=False)
        report = blind_review_batch(rows)
        print(f"=== Character dominance blind review ({report['total']} activities) ===")
        print(f"Accuracy: {report['accuracy_pct']}% ({report['correct']}/{report['total']})")
        print()
        for slug in sorted(report["by_agent"]):
            stats = report["by_agent"][slug]
            print(f"  {slug}: {stats['correct']}/{stats['total']}")
            if stats.get("misidentified_as"):
                print(f"    misidentified as: {stats['misidentified_as']}")
        print()
        print("=== Misidentified samples ===")
        for row in report["samples"]:
            if not row["correct"]:
                print(f"  {row['actual_slug']} -> {row['predicted_slug']}: {row['text_preview']}")
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if "--review" in sys.argv:
        idx = sys.argv.index("--review")
        n = int(sys.argv[idx + 1]) if len(sys.argv) > idx + 1 else 100
        s = int(sys.argv[idx + 2]) if len(sys.argv) > idx + 2 else 88001
        run_blind_review_cli(count=n, seed=s)
    else:
        pytest.main([__file__, "-q"])
