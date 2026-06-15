from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reputation_score: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    intelligence_tier: Mapped[str] = mapped_column(String(32), default="free")
    intelligence_subscription_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    intelligence_customer_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    intelligence_subscription_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    intelligence_current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    wallet_address: Mapped[str | None] = mapped_column(String(42), unique=True, nullable=True, index=True)
    wallet_chain: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ens_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    wallet_connected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    wallet_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(32), default="user", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_home_visit_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    profile: Mapped["UserProfile | None"] = relationship(back_populates="user", uselist=False)
    follows: Mapped[list["Follow"]] = relationship(back_populates="follower")
    positions: Mapped[list["Position"]] = relationship(back_populates="user")
    takes: Mapped[list["MarketTake"]] = relationship(back_populates="user")
    feed_interactions: Mapped[list["FeedInteraction"]] = relationship(back_populates="user")
    market_thread_posts: Mapped[list["MarketThreadPost"]] = relationship(back_populates="user")
    market_watches: Mapped[list["MarketWatch"]] = relationship(back_populates="user")
    story_watches: Mapped[list["StoryWatch"]] = relationship(back_populates="user")
    public_status_moments: Mapped[list["PublicStatusMoment"]] = relationship(back_populates="user")
    creator_forecasters: Mapped[list["CreatorForecaster"]] = relationship(back_populates="owner")


class WalletNonce(Base):
    """One-time nonces for signed wallet verification (replay protection)."""

    __tablename__ = "wallet_nonces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wallet_address: Mapped[str] = mapped_column(String(42), index=True)
    chain: Mapped[str] = mapped_column(String(32))
    nonce: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    message: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProcessedStripeEvent(Base):
    """Idempotency guard for Stripe webhook retries."""

    __tablename__ = "processed_stripe_events"

    event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(128))
    processed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    selected_interests: Mapped[list] = mapped_column(JSON, default=list)
    conviction_style: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    starter_position_id: Mapped[int | None] = mapped_column(
        ForeignKey("positions.id"), nullable=True
    )
    featured_milestone_keys: Mapped[list] = mapped_column(JSON, default=list)
    anchor_agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("agents.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="profile")
    anchor_agent: Mapped["Agent | None"] = relationship(foreign_keys=[anchor_agent_id])


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    niche: Mapped[str] = mapped_column(String(255))
    personality: Mapped[str] = mapped_column(String(255))
    tone: Mapped[str] = mapped_column(String(255))
    conviction_style: Mapped[str] = mapped_column(String(255))
    avatar_color: Mapped[str] = mapped_column(String(32))
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)
    is_creator: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    owner_username: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    featured_milestone_keys: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feed_events: Mapped[list["FeedEvent"]] = relationship(back_populates="agent")
    follows: Mapped[list["Follow"]] = relationship(back_populates="agent")
    takes: Mapped[list["MarketTake"]] = relationship(back_populates="agent")
    reputation: Mapped["AgentReputation | None"] = relationship(
        back_populates="agent", uselist=False
    )
    reputation_events: Mapped[list["ReputationEvent"]] = relationship(back_populates="agent")
    reputation_history: Mapped[list["ReputationHistory"]] = relationship(back_populates="agent")
    state: Mapped["AgentState | None"] = relationship(back_populates="agent", uselist=False)


class AgentState(Base):
    """Persistent Scry agent memory — theses, rivals, stances, narrative arcs."""

    __tablename__ = "agent_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), unique=True, index=True)
    state_json: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="state")


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_user_id", "agent_id", name="uq_follower_agent"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follower_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    follower: Mapped["User"] = relationship(back_populates="follows")
    agent: Mapped["Agent"] = relationship(back_populates="follows")


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(64))
    current_yes_probability: Mapped[float] = mapped_column(Float)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_outcome: Mapped[str | None] = mapped_column(String(8), nullable=True)
    resolution_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolution_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_resolution_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    horizon_type: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feed_events: Mapped[list["FeedEvent"]] = relationship(back_populates="market")
    positions: Mapped[list["Position"]] = relationship(back_populates="market")
    takes: Mapped[list["MarketTake"]] = relationship(back_populates="market")
    thread_posts: Mapped[list["MarketThreadPost"]] = relationship(back_populates="market")
    watchers: Mapped[list["MarketWatch"]] = relationship(back_populates="market")


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    side: Mapped[str] = mapped_column(String(8))
    amount: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User | None"] = relationship(back_populates="positions")
    market: Mapped["Market"] = relationship(back_populates="positions")


class ConvictionBalance(Base):
    __tablename__ = "conviction_balances"
    __table_args__ = (UniqueConstraint("user_id", name="uq_conviction_balance_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    currency: Mapped[str] = mapped_column(String(16), default="USDC")
    available_balance: Mapped[float] = mapped_column(Float, default=0.0)
    locked_balance: Mapped[float] = mapped_column(Float, default=0.0)
    total_exposure: Mapped[float] = mapped_column(Float, default=0.0)
    user_exposure_cap: Mapped[float] = mapped_column(Float, default=100.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConvictionLedgerEntry(Base):
    __tablename__ = "conviction_ledger_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    balance_id: Mapped[int] = mapped_column(ForeignKey("conviction_balances.id"), index=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True, index=True)
    position_id: Mapped[int | None] = mapped_column(
        ForeignKey("conviction_positions.id"), nullable=True, index=True
    )
    entry_type: Mapped[str] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(16), default="USDC")
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    available_balance_after: Mapped[float] = mapped_column(Float, default=0.0)
    locked_balance_after: Mapped[float] = mapped_column(Float, default=0.0)
    total_exposure_after: Mapped[float] = mapped_column(Float, default=0.0)
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConvictionPosition(Base):
    __tablename__ = "conviction_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), index=True)
    market: Mapped["Market"] = relationship("Market")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    side: Mapped[str] = mapped_column(String(8))
    amount: Mapped[float] = mapped_column(Float)
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payout_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open")


class DepositRequest(Base):
    __tablename__ = "deposit_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(16), default="USDC")
    wallet_address: Mapped[str] = mapped_column(String(128))
    chain: Mapped[str] = mapped_column(String(32), default="base")
    expected_token: Mapped[str] = mapped_column(String(16), default="USDC")
    treasury_address: Mapped[str | None] = mapped_column(String(128), nullable=True)
    wallet_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    log_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(16), default="USDC")
    wallet_address: Mapped[str] = mapped_column(String(128))
    destination_wallet: Mapped[str | None] = mapped_column(String(128), nullable=True)
    chain: Mapped[str] = mapped_column(String(32), default="base")
    wallet_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="pending_review")
    tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FeedEvent(Base):
    __tablename__ = "feed_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(64))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    feed_published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    source_event_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    agent: Mapped["Agent"] = relationship(back_populates="feed_events")
    market: Mapped["Market | None"] = relationship(back_populates="feed_events")
    interactions: Mapped[list["FeedInteraction"]] = relationship(back_populates="feed_event")


class AgentGeneratedActivity(Base):
    """Dev-friendly agent activity layer — bible-voiced posts synced to feed optionally."""

    __tablename__ = "agent_generated_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    activity_type: Mapped[str] = mapped_column(String(64), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    agent_slug: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    body_hash: Mapped[str] = mapped_column(String(64), index=True)
    related_market_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    related_battle_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trigger_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mirrored_feed_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("feed_events.id"), nullable=True
    )
    thread_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    parent_activity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    agent: Mapped["Agent"] = relationship()
    mirrored_feed_event: Mapped["FeedEvent | None"] = relationship()


class AgentNarrativeState(Base):
    """Per-agent narrative arc position — thesis progression memory."""

    __tablename__ = "agent_narrative_states"
    __table_args__ = (
        UniqueConstraint("agent_slug", "narrative_id", name="uq_agent_narrative_state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_slug: Mapped[str] = mapped_column(String(64), index=True)
    narrative_id: Mapped[str] = mapped_column(String(128), index=True)
    stage: Mapped[str] = mapped_column(String(64), default="initial_call")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class NetworkNarrative(Base):
    """Persistent narrative thread the autonomous network reacts to."""

    __tablename__ = "network_narratives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    narrative_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(255))
    heat: Mapped[float] = mapped_column(Float, default=25.0)
    supporters_json: Mapped[list] = mapped_column(JSON, default=list)
    opponents_json: Mapped[list] = mapped_column(JSON, default=list)
    recent_activity_json: Mapped[list] = mapped_column(JSON, default=list)
    keywords_json: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class FeedInteraction(Base):
    """Public conviction read on a feed event — back (support) or challenge (disagree)."""

    __tablename__ = "feed_interactions"
    __table_args__ = (
        UniqueConstraint("user_id", "feed_event_id", name="uq_user_feed_event_interaction"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feed_event_id: Mapped[int] = mapped_column(ForeignKey("feed_events.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    interaction_type: Mapped[str] = mapped_column(String(16))  # back | challenge
    thesis_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    side: Mapped[str | None] = mapped_column(String(8), nullable=True)  # yes | no
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | removed
    reputation_snapshot: Mapped[float | None] = mapped_column(Float, nullable=True)
    wallet_verified_snapshot: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    conviction_exposure_snapshot: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    feed_event: Mapped["FeedEvent"] = relationship(back_populates="interactions")
    user: Mapped["User"] = relationship(back_populates="feed_interactions")


class MarketWatch(Base):
    """User follows a market thread (watchlist for post access + notifications)."""

    __tablename__ = "market_watches"
    __table_args__ = (UniqueConstraint("user_id", "market_id", name="uq_user_market_watch"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="market_watches")
    market: Mapped["Market"] = relationship(back_populates="watchers")


class StoryWatch(Base):
    """User watches an unresolved rivalry arc for resolution notifications."""

    __tablename__ = "story_watches"
    __table_args__ = (UniqueConstraint("user_id", "story_key", name="uq_user_story_watch"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    story_key: Mapped[str] = mapped_column(String(128), index=True)
    story_type: Mapped[str] = mapped_column(String(32))  # rivalry | arc | market
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | resolved | archived
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolution_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="story_watches")


class MarketThreadPost(Base):
    """Single public discussion thread per market — flat high-signal posts."""

    __tablename__ = "market_thread_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    stance: Mapped[str] = mapped_column(String(16), default="neutral")  # yes | no | neutral
    user_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    post_type: Mapped[str] = mapped_column(String(32), default="thesis")
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | removed
    reputation_snapshot: Mapped[float | None] = mapped_column(Float, nullable=True)
    wallet_verified_snapshot: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    conviction_exposure_snapshot: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    market: Mapped["Market"] = relationship(back_populates="thread_posts")
    user: Mapped["User"] = relationship(back_populates="market_thread_posts")


class PublicStatusMoment(Base):
    """Public reputation-as-status moment tied to a stored user action."""

    __tablename__ = "public_status_moments"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "status_type",
            "source_type",
            "source_id",
            name="uq_user_status_source",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status_type: Mapped[str] = mapped_column(String(64), index=True)
    label: Mapped[str] = mapped_column(String(64))
    headline: Mapped[str] = mapped_column(String(512))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(64))
    source_id: Mapped[int] = mapped_column(Integer)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True, index=True)
    feed_event_id: Mapped[int | None] = mapped_column(ForeignKey("feed_events.id"), nullable=True)
    receipt_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    significance_score: Mapped[float] = mapped_column(Float, default=0.5)
    feed_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="public_status_moments")
    market: Mapped["Market | None"] = relationship()
    feed_event: Mapped["FeedEvent | None"] = relationship()


class EventCandidate(Base):
    __tablename__ = "event_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(String(1024), index=True)
    source_name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64), index=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.0)
    suggested_markets: Mapped[list] = mapped_column(JSON, default=list)
    suggested_agents: Mapped[list] = mapped_column(JSON, default=list)
    suggested_arc_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    duration_type: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    expected_resolution_window: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expected_resolution_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    is_high_priority: Mapped[bool] = mapped_column(Boolean, default=False)
    attached_market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_feed_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("feed_events.id"), nullable=True, index=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScheduledEventArc(Base):
    __tablename__ = "scheduled_event_arcs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    start_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    linked_market_ids: Mapped[list] = mapped_column(JSON, default=list)
    primary_agent_ids: Mapped[list] = mapped_column(JSON, default=list)
    watch_keywords: Mapped[list] = mapped_column(JSON, default=list)
    activity_boost: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(32), default="scheduled", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MarketTake(Base):
    __tablename__ = "market_takes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    author_name: Mapped[str] = mapped_column(String(255))
    author_slug: Mapped[str] = mapped_column(String(255))
    side: Mapped[str] = mapped_column(String(8))
    confidence: Mapped[float] = mapped_column(Float)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    market: Mapped["Market"] = relationship(back_populates="takes")
    user: Mapped["User | None"] = relationship(back_populates="takes")
    agent: Mapped["Agent | None"] = relationship(back_populates="takes")


# ---------------------------------------------------------------------------
# Core reputation engine models
# ---------------------------------------------------------------------------


class AgentReputation(Base):
    """Persisted reputation snapshot per forecaster."""

    __tablename__ = "agent_reputations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), unique=True, index=True)
    score: Mapped[float] = mapped_column(Float, default=38.0)
    tier_key: Mapped[str] = mapped_column(String(64), default="emerging")
    tier_label: Mapped[str] = mapped_column(String(64), default="Emerging")
    velocity: Mapped[float] = mapped_column(Float, default=0.0)
    trend: Mapped[str] = mapped_column(String(32), default="stable")
    accuracy_component: Mapped[float] = mapped_column(Float, default=0.0)
    timing_component: Mapped[float] = mapped_column(Float, default=0.0)
    conviction_component: Mapped[float] = mapped_column(Float, default=0.0)
    battle_component: Mapped[float] = mapped_column(Float, default=0.0)
    calibration_component: Mapped[float] = mapped_column(Float, default=0.0)
    consistency_component: Mapped[float] = mapped_column(Float, default=0.0)
    contrarian_component: Mapped[float] = mapped_column(Float, default=0.0)
    narrative_component: Mapped[float] = mapped_column(Float, default=0.0)
    timing_quality: Mapped[float] = mapped_column(Float, default=0.0)
    calibration_score: Mapped[float] = mapped_column(Float, default=0.0)
    battle_win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    battle_streak: Mapped[int] = mapped_column(Integer, default=0)
    verified_calls: Mapped[int] = mapped_column(Integer, default=0)
    consensus_breaks: Mapped[int] = mapped_column(Integer, default=0)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="reputation")


class ReputationEvent(Base):
    """Ledger entry — every reputation-affecting action."""

    __tablename__ = "reputation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    category: Mapped[str] = mapped_column(String(64))
    delta: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(512))
    source_type: Mapped[str] = mapped_column(String(64))
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    components_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    breakdown_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="reputation_events")


class ReputationHistory(Base):
    """Time-series reputation snapshots for sparklines and velocity."""

    __tablename__ = "reputation_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    delta: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="reputation_history")


class ForecastResolution(Base):
    """Resolved forecast linked to reputation scoring."""

    __tablename__ = "forecast_resolutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(64))
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    side: Mapped[str] = mapped_column(String(8))
    predicted_probability: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    outcome_yes: Mapped[bool] = mapped_column(Boolean)
    correct: Mapped[bool] = mapped_column(Boolean)
    days_early: Mapped[int] = mapped_column(Integer, default=0)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TimingScore(Base):
    """Timing quality record per resolution."""

    __tablename__ = "timing_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    resolution_id: Mapped[int] = mapped_column(ForeignKey("forecast_resolutions.id"), index=True)
    days_early: Mapped[int] = mapped_column(Integer)
    timing_multiplier: Mapped[float] = mapped_column(Float)
    consensus_formed: Mapped[bool] = mapped_column(Boolean, default=False)
    broke_consensus: Mapped[bool] = mapped_column(Boolean, default=False)
    early_signal_bonus: Mapped[float] = mapped_column(Float, default=0.0)


class CalibrationRecord(Base):
    """Calibration data point — predicted vs actual."""

    __tablename__ = "calibration_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    predicted_probability: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    outcome_yes: Mapped[bool] = mapped_column(Boolean)
    bucket_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BattleOutcome(Base):
    """Battle result for reputation — upset wins, streaks, dominance."""

    __tablename__ = "battle_outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    opponent_agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    won: Mapped[bool] = mapped_column(Boolean)
    reputation_delta: Mapped[float] = mapped_column(Float)
    upset: Mapped[bool] = mapped_column(Boolean, default=False)
    dominance_score: Mapped[float] = mapped_column(Float, default=0.0)
    contested_level: Mapped[int] = mapped_column(Integer, default=1)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NarrativeImpact(Base):
    """Narrative leadership — identified trend before consensus."""

    __tablename__ = "narrative_impacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    narrative_key: Mapped[str] = mapped_column(String(255))
    lead_days: Mapped[int] = mapped_column(Integer, default=0)
    impact_score: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReputationMilestone(Base):
    """Prestige milestones unlocked by an agent."""

    __tablename__ = "reputation_milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    milestone_key: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(64))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship()

    __table_args__ = (UniqueConstraint("agent_id", "milestone_key", name="uq_agent_milestone"),)


# ---------------------------------------------------------------------------
# Narrative seasons — historical forecasting eras
# ---------------------------------------------------------------------------


class NarrativeSeason(Base):
    """A narrative era in the forecasting network — macro cycles, regime shifts, arcs."""

    __tablename__ = "narrative_seasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    dominant_narratives: Mapped[list] = mapped_column(JSON, default=list)
    volatility_score: Mapped[float] = mapped_column(Float, default=0.0)
    consensus_state: Mapped[str] = mapped_column(String(64), default="unified")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    highlights_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent_stats: Mapped[list["AgentSeasonStat"]] = relationship(back_populates="season")
    shifts: Mapped[list["SeasonShift"]] = relationship(back_populates="season")


class AgentSeasonStat(Base):
    """Per-agent performance within a narrative season."""

    __tablename__ = "agent_season_stats"
    __table_args__ = (UniqueConstraint("season_id", "agent_id", name="uq_season_agent"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("narrative_seasons.id"), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    reputation_delta: Mapped[float] = mapped_column(Float, default=0.0)
    calibration_score: Mapped[float] = mapped_column(Float, default=0.0)
    accuracy_score: Mapped[float] = mapped_column(Float, default=0.0)
    narrative_participation: Mapped[int] = mapped_column(Integer, default=0)
    battle_wins: Mapped[int] = mapped_column(Integer, default=0)
    verified_calls: Mapped[int] = mapped_column(Integer, default=0)
    consensus_breaks: Mapped[int] = mapped_column(Integer, default=0)
    timing_edge_score: Mapped[float] = mapped_column(Float, default=0.0)
    season_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    badges_json: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    season: Mapped["NarrativeSeason"] = relationship(back_populates="agent_stats")
    agent: Mapped["Agent"] = relationship()


class SeasonShift(Base):
    """Major regime or narrative shift within a season timeline."""

    __tablename__ = "season_shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("narrative_seasons.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    shift_type: Mapped[str] = mapped_column(String(64))
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    season: Mapped["NarrativeSeason"] = relationship(back_populates="shifts")


# ---------------------------------------------------------------------------
# Daily intelligence brief — network conviction ritual
# ---------------------------------------------------------------------------


class DailyBrief(Base):
    """Global morning intelligence brief — collective conviction pulse."""

    __tablename__ = "daily_briefs"
    __table_args__ = (UniqueConstraint("brief_date", name="uq_daily_brief_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brief_date: Mapped[str] = mapped_column(String(10), index=True)
    active_season: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dominant_narratives: Mapped[list] = mapped_column(JSON, default=list)
    biggest_consensus_shift: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    top_reputation_move: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    strongest_contrarian: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    verified_calls_count: Mapped[int] = mapped_column(Integer, default=0)
    volatility_state: Mapped[str] = mapped_column(String(64), default="stable")
    summary: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    delivery_channels_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user_briefs: Mapped[list["UserDailyBrief"]] = relationship(back_populates="daily_brief")


class UserDailyBrief(Base):
    """Personalized forecasting brief for a single user on a given day."""

    __tablename__ = "user_daily_briefs"
    __table_args__ = (UniqueConstraint("user_id", "brief_date", name="uq_user_daily_brief"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    daily_brief_id: Mapped[int] = mapped_column(ForeignKey("daily_briefs.id"), index=True)
    brief_date: Mapped[str] = mapped_column(String(10), index=True)
    reputation_delta: Mapped[float] = mapped_column(Float, default=0.0)
    strongest_position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    worst_position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    milestone_unlocks: Mapped[list] = mapped_column(JSON, default=list)
    followed_narratives: Mapped[list] = mapped_column(JSON, default=list)
    calibration_change: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank_change: Mapped[int | None] = mapped_column(Integer, nullable=True)
    personalized_summary: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship()
    daily_brief: Mapped["DailyBrief"] = relationship(back_populates="user_briefs")


class CreatorForecaster(Base):
    """User-created forecasting identity — wizard state and published agent link."""

    __tablename__ = "creator_forecasters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    username: Mapped[str] = mapped_column(String(255), default="", index=True)
    avatar_color: Mapped[str] = mapped_column(String(32), default="#8b5cf6")
    short_bio: Mapped[str] = mapped_column(Text, default="")
    domain_focus: Mapped[str] = mapped_column(String(64), default="")
    archetype: Mapped[str] = mapped_column(String(64), default="")
    archetype_description: Mapped[str] = mapped_column(Text, default="")
    aggressiveness: Mapped[int] = mapped_column(Integer, default=50)
    humor: Mapped[int] = mapped_column(Integer, default=50)
    contrarian_level: Mapped[int] = mapped_column(Integer, default=50)
    data_vs_intuition: Mapped[int] = mapped_column(Integer, default=50)
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    blind_spot: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    preview_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship(back_populates="creator_forecasters")
    agent: Mapped["Agent | None"] = relationship(foreign_keys=[agent_id])
    knowledge_sources: Mapped[list["ForecasterKnowledgeSource"]] = relationship(
        back_populates="forecaster", cascade="all, delete-orphan"
    )


class ForecasterKnowledgeSource(Base):
    """Creator-uploaded source material (PDF v1) for forecaster reasoning context."""

    __tablename__ = "forecaster_knowledge_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    forecaster_id: Mapped[int] = mapped_column(
        ForeignKey("creator_forecasters.id"), index=True
    )
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(16), default="pdf")
    filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_claims_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    forecaster: Mapped["CreatorForecaster"] = relationship(back_populates="knowledge_sources")
    owner: Mapped["User"] = relationship()
