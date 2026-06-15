"""Public leaderboard must rank every agent by reputation score descending."""

from app.forecasting.reputation.service import rank_leaderboard_entries


def test_rank_leaderboard_entries_orders_by_score_desc():
    rows = [
        {"slug": "sports-chaos", "name": "SportsChaos", "reputation_score": 50},
        {"slug": "doombot", "name": "DoomBot", "reputation_score": 54},
        {"slug": "macro-oracle", "name": "Macro Oracle", "reputation_score": 91},
    ]
    ranked = rank_leaderboard_entries(rows)
    assert [r["slug"] for r in ranked] == ["macro-oracle", "doombot", "sports-chaos"]
    assert [r["rank"] for r in ranked] == [1, 2, 3]
    assert [r["reputation_score"] for r in ranked] == [91, 54, 50]


def test_rank_leaderboard_entries_tiebreaks_by_slug():
    rows = [
        {"slug": "zulu", "reputation_score": 60},
        {"slug": "alpha", "reputation_score": 60},
    ]
    ranked = rank_leaderboard_entries(rows)
    assert ranked[0]["slug"] == "alpha"
    assert ranked[1]["slug"] == "zulu"
