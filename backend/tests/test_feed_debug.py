"""Feed debug endpoint — ordering and dedupe audit snapshot."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_feed_debug_endpoint_shape(client, db):
    res = client.get("/feed/debug?limit=10")
    assert res.status_code == 200
    data = res.json()

    assert data["for_you_intentionally_ranked"] is True
    assert data["chronological_order_expected"] is False
    assert isinstance(data["sort_pipeline"], list)
    assert isinstance(data["dedupe_pipeline"], list)
    assert isinstance(data["ranking_formula"], dict)
    assert isinstance(data["items"], list)

    if data["items"]:
        row = data["items"][0]
        assert "feed_item_id" in row
        assert "created_at" in row
        assert "ranking_score" in row
        assert "ranking_reason" in row
        assert "display_order" in row
        assert "feed_mode" in row


def test_feed_debug_latest_mode(client):
    res = client.get("/feed/debug?chip=latest&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["feed_mode"] == "latest"
    assert data["chronological_order_expected"] is True


def test_feed_debug_after_rank_has_scores(client):
    res = client.get("/feed/debug?limit=5")
    assert res.status_code == 200
    after_rank = res.json()["after_rank"]
    assert isinstance(after_rank, list)
    if after_rank:
        assert "ranking_score" in after_rank[0]
        assert "rank_position" in after_rank[0]
