"""Demo position flow — sized bets across flagship markets."""

POSITIONS: list[tuple[str, str, float, int]] = [
    # market_title, side, conviction_size_usd, days_ago (beta-scale positions)
    ("US recession by Q4", "YES", 25.0, 14),
    ("Fed cut by Sep 2026", "YES", 20.0, 21),
    ("NVDA Q2 beat", "NO", 10.0, 5),
    ("BTC above 150k by year end", "YES", 15.0, 9),
    ("Champions League final upset", "YES", 25.0, 52),
    ("US election debate winner", "YES", 10.0, 38),
    ("Oil above $100", "NO", 5.0, 12),
    ("Major AI breakthrough before December", "YES", 25.0, 3),
    ("EU carbon policy shift", "NO", 10.0, 7),
    ("Premier League title race", "YES", 5.0, 18),
    ("HY default wave by Q3", "YES", 25.0, 8),
    ("VIX above 35 before August", "YES", 15.0, 4),
    ("ETH flippening narrative hits mainstream", "NO", 10.0, 11),
    ("Trump approval above 50% by July", "NO", 10.0, 6),
    ("H100 shortage eases before Q4", "NO", 25.0, 2),
    ("Emergency Fed cut before election", "YES", 5.0, 15),
    ("China property bailout announced", "YES", 20.0, 10),
]
