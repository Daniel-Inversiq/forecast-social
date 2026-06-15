from sqlalchemy import inspect, text

from app.database import engine
from app.forecasting.models import Base


def _migrate_follows_to_user_id(insp) -> None:
    if "follows" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("follows")}
    if "follower_user_id" in cols:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE follows_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    follower_user_id INTEGER,
                    agent_id INTEGER NOT NULL,
                    created_at DATETIME,
                    FOREIGN KEY(follower_user_id) REFERENCES users (id),
                    FOREIGN KEY(agent_id) REFERENCES agents (id),
                    CONSTRAINT uq_follower_agent UNIQUE (follower_user_id, agent_id)
                )
                """
            )
        )
        conn.execute(text("DROP TABLE follows"))
        conn.execute(text("ALTER TABLE follows_new RENAME TO follows"))


def _migrate_follows_username(insp) -> None:
    """Legacy: add follower_username column for older beta DBs."""
    if "follows" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("follows")}
    if "follower_username" in cols or "follower_user_id" in cols:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE follows_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    follower_username VARCHAR(255) NOT NULL DEFAULT 'beta-user',
                    agent_id INTEGER NOT NULL,
                    created_at DATETIME,
                    FOREIGN KEY(agent_id) REFERENCES agents (id),
                    CONSTRAINT uq_follower_agent UNIQUE (follower_username, agent_id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO follows_new (id, follower_username, agent_id, created_at)
                SELECT id, 'beta-user', agent_id, created_at FROM follows
                """
            )
        )
        conn.execute(text("DROP TABLE follows"))
        conn.execute(text("ALTER TABLE follows_new RENAME TO follows"))


def _migrate_user_profiles(insp) -> None:
    if "user_profiles" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("user_profiles")}

    if "starter_position_id" not in cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE user_profiles ADD COLUMN starter_position_id INTEGER")
            )
        cols = {c["name"] for c in inspect(engine).get_columns("user_profiles")}

    if "user_id" in cols:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE user_profiles ADD COLUMN user_id INTEGER"))
        conn.execute(
            text(
                """
                CREATE TABLE user_profiles_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    user_id INTEGER UNIQUE,
                    selected_interests JSON,
                    conviction_style VARCHAR(255),
                    onboarding_completed BOOLEAN,
                    starter_position_id INTEGER,
                    created_at DATETIME,
                    FOREIGN KEY(user_id) REFERENCES users (id),
                    FOREIGN KEY(starter_position_id) REFERENCES positions (id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO user_profiles_new (
                    id, selected_interests, conviction_style, onboarding_completed,
                    starter_position_id, created_at
                )
                SELECT id, selected_interests, conviction_style, onboarding_completed,
                       starter_position_id, created_at
                FROM user_profiles
                """
            )
        )
        conn.execute(text("DROP TABLE user_profiles"))
        conn.execute(text("ALTER TABLE user_profiles_new RENAME TO user_profiles"))


def _migrate_positions_user_id(insp) -> None:
    if "positions" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("positions")}
    if "user_id" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE positions ADD COLUMN user_id INTEGER"))


def _migrate_market_takes_user_id(insp) -> None:
    if "market_takes" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("market_takes")}
    if "user_id" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE market_takes ADD COLUMN user_id INTEGER"))


def _migrate_market_resolution(insp) -> None:
    if "markets" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("markets")}
    alters = [
        ("resolved_at", "DATETIME"),
        ("resolved_outcome", "VARCHAR(8)"),
        ("resolution_source", "VARCHAR(64)"),
        ("resolution_confidence", "FLOAT"),
    ]
    for col, sql_type in alters:
        if col in cols:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE markets ADD COLUMN {col} {sql_type}"))


def _migrate_featured_milestone_keys(insp) -> None:
    for table in ("agents", "user_profiles"):
        if table not in insp.get_table_names():
            continue
        cols = {c["name"] for c in insp.get_columns(table)}
        if "featured_milestone_keys" in cols:
            continue
        with engine.begin() as conn:
            conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN featured_milestone_keys JSON DEFAULT '[]'")
            )


def _migrate_intelligence_access(insp) -> None:
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    alters = [
        ("intelligence_tier", "VARCHAR(32) DEFAULT 'free'"),
        ("intelligence_subscription_status", "VARCHAR(32)"),
        ("intelligence_customer_ref", "VARCHAR(128)"),
        ("intelligence_subscription_ref", "VARCHAR(128)"),
        ("intelligence_current_period_end", "DATETIME"),
    ]
    with engine.begin() as conn:
        for col, sql_type in alters:
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {sql_type}"))


def _migrate_wallet_fields(insp) -> None:
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    alters = [
        ("wallet_address", "VARCHAR(42)"),
        ("wallet_chain", "VARCHAR(32)"),
        ("ens_name", "VARCHAR(255)"),
        ("wallet_connected_at", "DATETIME"),
        ("wallet_verified", "BOOLEAN DEFAULT 0"),
    ]
    with engine.begin() as conn:
        for col, sql_type in alters:
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {sql_type}"))


def _migrate_deposit_withdrawal_fields(insp) -> None:
    if "deposit_requests" in insp.get_table_names():
        deposit_cols = {c["name"] for c in insp.get_columns("deposit_requests")}
        deposit_alters = [
            ("expected_token", "VARCHAR(16) DEFAULT 'USDC'"),
            ("treasury_address", "VARCHAR(128)"),
            ("tx_hash", "VARCHAR(128)"),
            ("log_index", "INTEGER"),
            ("detected_at", "DATETIME"),
            ("confirmed_at", "DATETIME"),
        ]
        with engine.begin() as conn:
            for col, sql_type in deposit_alters:
                if col in deposit_cols:
                    continue
                conn.execute(text(f"ALTER TABLE deposit_requests ADD COLUMN {col} {sql_type}"))

    if "withdrawal_requests" in insp.get_table_names():
        withdrawal_cols = {c["name"] for c in insp.get_columns("withdrawal_requests")}
        withdrawal_alters = [
            ("destination_wallet", "VARCHAR(128)"),
            ("tx_hash", "VARCHAR(128)"),
            ("requested_at", "DATETIME"),
            ("reviewed_at", "DATETIME"),
            ("completed_at", "DATETIME"),
        ]
        with engine.begin() as conn:
            for col, sql_type in withdrawal_alters:
                if col in withdrawal_cols:
                    continue
                conn.execute(
                    text(f"ALTER TABLE withdrawal_requests ADD COLUMN {col} {sql_type}")
                )


def _migrate_event_candidates(insp) -> None:
    if "event_candidates" in insp.get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE event_candidates (
                    id INTEGER NOT NULL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    summary TEXT NOT NULL,
                    source_url VARCHAR(1024) NOT NULL,
                    source_name VARCHAR(128) NOT NULL,
                    category VARCHAR(64) NOT NULL,
                    detected_at DATETIME,
                    relevance_score FLOAT,
                    urgency_score FLOAT,
                    suggested_markets JSON,
                    suggested_agents JSON,
                    suggested_arc_type VARCHAR(64),
                    status VARCHAR(32),
                    is_high_priority BOOLEAN DEFAULT 0,
                    attached_market_id INTEGER,
                    approved_at DATETIME,
                    published_at DATETIME,
                    published_feed_event_id INTEGER,
                    metadata_json JSON,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY(attached_market_id) REFERENCES markets (id),
                    FOREIGN KEY(published_feed_event_id) REFERENCES feed_events (id)
                )
                """
            )
        )
        conn.execute(text("CREATE INDEX ix_event_candidates_source_url ON event_candidates (source_url)"))
        conn.execute(text("CREATE INDEX ix_event_candidates_status ON event_candidates (status)"))
        conn.execute(text("CREATE INDEX ix_event_candidates_category ON event_candidates (category)"))
        conn.execute(text("CREATE INDEX ix_event_candidates_detected_at ON event_candidates (detected_at)"))


def _migrate_feed_timing_fields(insp) -> None:
    if "feed_events" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("feed_events")}
    alters = [
        ("feed_published_at", "DATETIME"),
        ("source_event_time", "DATETIME"),
    ]
    with engine.begin() as conn:
        for col, sql_type in alters:
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE feed_events ADD COLUMN {col} {sql_type}"))
        conn.execute(
            text(
                """
                UPDATE feed_events
                SET feed_published_at = created_at
                WHERE feed_published_at IS NULL AND created_at IS NOT NULL
                """
            )
        )
        if "event_candidates" in insp.get_table_names():
            conn.execute(
                text(
                    """
                    UPDATE feed_events
                    SET feed_published_at = (
                        SELECT ec.published_at
                        FROM event_candidates ec
                        WHERE ec.published_feed_event_id = feed_events.id
                          AND ec.published_at IS NOT NULL
                        LIMIT 1
                    )
                    WHERE feed_published_at IS NULL
                      AND EXISTS (
                        SELECT 1 FROM event_candidates ec
                        WHERE ec.published_feed_event_id = feed_events.id
                          AND ec.published_at IS NOT NULL
                      )
                    """
                )
            )


def _migrate_event_candidate_duration(insp) -> None:
    if "event_candidates" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("event_candidates")}
    alters = [
        ("duration_type", "VARCHAR(16)"),
        ("expected_resolution_window", "VARCHAR(128)"),
        ("expected_resolution_date", "DATETIME"),
    ]
    with engine.begin() as conn:
        for col, sql_type in alters:
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE event_candidates ADD COLUMN {col} {sql_type}"))
        if "duration_type" not in cols:
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_event_candidates_duration_type ON event_candidates (duration_type)")
            )


def _migrate_market_horizon_fields(insp) -> None:
    if "markets" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("markets")}
    alters = [
        ("expected_resolution_at", "DATETIME"),
        ("horizon_type", "VARCHAR(16)"),
    ]
    with engine.begin() as conn:
        for col, sql_type in alters:
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE markets ADD COLUMN {col} {sql_type}"))
        if "horizon_type" not in cols:
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_markets_horizon_type ON markets (horizon_type)")
            )
        if "expected_resolution_at" not in cols:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_markets_expected_resolution_at "
                    "ON markets (expected_resolution_at)"
                )
            )


def _migrate_scheduled_event_arcs(insp) -> None:
    if "scheduled_event_arcs" in insp.get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE scheduled_event_arcs (
                    id INTEGER NOT NULL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    start_date DATETIME NOT NULL,
                    end_date DATETIME NOT NULL,
                    category VARCHAR(64) NOT NULL,
                    linked_market_ids JSON,
                    primary_agent_ids JSON,
                    watch_keywords JSON,
                    activity_boost FLOAT,
                    status VARCHAR(32),
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        conn.execute(text("CREATE INDEX ix_scheduled_event_arcs_start_date ON scheduled_event_arcs (start_date)"))
        conn.execute(text("CREATE INDEX ix_scheduled_event_arcs_end_date ON scheduled_event_arcs (end_date)"))
        conn.execute(text("CREATE INDEX ix_scheduled_event_arcs_status ON scheduled_event_arcs (status)"))
        conn.execute(text("CREATE INDEX ix_scheduled_event_arcs_category ON scheduled_event_arcs (category)"))


def _migrate_last_home_visit_at(insp) -> None:
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "last_home_visit_at" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN last_home_visit_at DATETIME"))


def _migrate_anchor_agent_id(insp) -> None:
    if "user_profiles" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("user_profiles")}
    if "anchor_agent_id" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE user_profiles ADD COLUMN anchor_agent_id INTEGER"))


def _migrate_agent_status(insp) -> None:
    """Season 1 core cast: five active agents, remainder dormant."""
    if "agents" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("agents")}
    if "status" not in cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE agents ADD COLUMN status VARCHAR(32) DEFAULT 'active'")
            )
    from app.forecasting.agent_status import (
        AGENT_STATUS_ACTIVE,
        AGENT_STATUS_DORMANT,
        CORE_AGENT_SLUGS,
    )

    core_list = ", ".join(f"'{s}'" for s in sorted(CORE_AGENT_SLUGS))
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE agents SET status = :dormant WHERE slug NOT IN ({core_list})"),
            {"dormant": AGENT_STATUS_DORMANT},
        )
        conn.execute(
            text(f"UPDATE agents SET status = :active WHERE slug IN ({core_list})"),
            {"active": AGENT_STATUS_ACTIVE},
        )


def _migrate_creator_forecasters(insp) -> None:
    """Creator Forecaster Studio — agent ownership + creator_forecasters table."""
    if "agents" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("agents")}
        with engine.begin() as conn:
            if "is_creator" not in cols:
                conn.execute(
                    text("ALTER TABLE agents ADD COLUMN is_creator BOOLEAN DEFAULT 0")
                )
            if "owner_user_id" not in cols:
                conn.execute(
                    text("ALTER TABLE agents ADD COLUMN owner_user_id INTEGER")
                )
            if "owner_username" not in cols:
                conn.execute(
                    text("ALTER TABLE agents ADD COLUMN owner_username VARCHAR(255)")
                )


def _migrate_user_access_control_fields(insp) -> None:
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    with engine.begin() as conn:
        if "role" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user'"))
        if "is_active" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))


def _migrate_agent_generated_activity_threads(insp) -> None:
    if "agent_generated_activities" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("agent_generated_activities")}
    with engine.begin() as conn:
        if "thread_id" not in cols:
            conn.execute(
                text("ALTER TABLE agent_generated_activities ADD COLUMN thread_id VARCHAR(64)")
            )
        if "parent_activity_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE agent_generated_activities "
                    "ADD COLUMN parent_activity_id VARCHAR(64)"
                )
            )


def migrate_schema() -> None:
    """Lightweight SQLite migrations for schema changes."""
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    _migrate_featured_milestone_keys(insp)
    insp = inspect(engine)
    _migrate_follows_username(insp)
    insp = inspect(engine)
    _migrate_user_profiles(insp)
    insp = inspect(engine)
    _migrate_positions_user_id(insp)
    insp = inspect(engine)
    _migrate_market_takes_user_id(insp)
    insp = inspect(engine)
    _migrate_follows_to_user_id(insp)
    insp = inspect(engine)
    _migrate_market_resolution(insp)
    insp = inspect(engine)
    _migrate_intelligence_access(insp)
    insp = inspect(engine)
    _migrate_wallet_fields(insp)
    insp = inspect(engine)
    _migrate_deposit_withdrawal_fields(insp)
    insp = inspect(engine)
    _migrate_event_candidates(insp)
    insp = inspect(engine)
    _migrate_event_candidate_duration(insp)
    insp = inspect(engine)
    _migrate_market_horizon_fields(insp)
    insp = inspect(engine)
    _migrate_feed_timing_fields(insp)
    insp = inspect(engine)
    _migrate_scheduled_event_arcs(insp)
    insp = inspect(engine)
    _migrate_last_home_visit_at(insp)
    insp = inspect(engine)
    _migrate_anchor_agent_id(insp)
    insp = inspect(engine)
    _migrate_agent_status(insp)
    insp = inspect(engine)
    _migrate_creator_forecasters(insp)
    insp = inspect(engine)
    _migrate_user_access_control_fields(insp)
    insp = inspect(engine)
    _migrate_agent_generated_activity_threads(insp)
