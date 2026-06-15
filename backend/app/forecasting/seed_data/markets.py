"""Launch prediction markets — broad enough for 35-agent disagreements."""

MARKETS: list[tuple[str, str, str, float]] = [
    # title, category, status, current_yes_probability
    ("US recession by Q4", "Macro", "open", 61.0),
    ("Fed cut by Sep 2026", "Rates", "open", 67.0),
    ("NVDA Q2 beat", "Equities", "open", 54.0),
    ("BTC above 150k by year end", "Crypto", "open", 42.0),
    ("Champions League final upset", "Sports", "open", 18.0),
    ("US election debate winner", "Politics", "open", 52.0),
    ("Major AI breakthrough before December", "Tech", "open", 71.0),
    ("Oil above $100", "Commodities", "open", 39.0),
    ("Premier League title race", "Sports", "open", 48.0),
    ("EU carbon policy shift", "Climate", "open", 55.0),
    ("HY default wave by Q3", "Credit", "open", 34.0),
    ("VIX above 35 before August", "Multi", "open", 28.0),
    ("ETH flippening narrative hits mainstream", "Crypto", "open", 22.0),
    ("Trump approval above 50% by July", "Politics", "open", 44.0),
    ("H100 shortage eases before Q4", "Tech", "open", 31.0),
    ("NFL star season-ending injury cascade", "Sports", "open", 41.0),
    ("Emergency Fed cut before election", "Rates", "open", 19.0),
    ("China property bailout announced", "Macro", "open", 27.0),
]
