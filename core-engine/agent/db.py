"""Database models and async repository for agents, calls, transcripts, and API keys."""

import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("db")
Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentModel(Base):
    __tablename__ = "agents"

    id = sa.Column(sa.String(50), primary_key=True)
    name = sa.Column(sa.String(100), nullable=False)
    role = sa.Column(sa.String(255), default="Voice Assistant")
    personality = sa.Column(sa.Text, nullable=True)
    system_prompt = sa.Column(sa.Text, nullable=False)
    greeting = sa.Column(sa.Text, nullable=False)
    default_language = sa.Column(sa.String(10), default="hi")
    voice_provider = sa.Column(sa.String(50), default="cartesia")
    voice_id = sa.Column(sa.String(100), nullable=True)
    llm_model = sa.Column(sa.String(100), default="llama-3.3-70b-versatile")
    tools_enabled = sa.Column(sa.Text, default="[]")  # JSON list
    created_at = sa.Column(sa.DateTime, default=utcnow)
    updated_at = sa.Column(sa.DateTime, default=utcnow, onupdate=utcnow)


class CallModel(Base):
    __tablename__ = "calls"

    id = sa.Column(sa.String(100), primary_key=True)
    agent_id = sa.Column(sa.String(50), nullable=True)
    caller_number = sa.Column(sa.String(30), nullable=False)
    direction = sa.Column(sa.String(20), default="outbound")  # inbound or outbound
    provider = sa.Column(sa.String(30), default="twilio")     # twilio or exotel
    status = sa.Column(sa.String(30), default="initiated")    # initiated, in-progress, completed, failed, busy, no-answer
    duration_sec = sa.Column(sa.Float, default=0.0)
    end_reason = sa.Column(sa.String(50), nullable=True)     # caller_hungup, agent_hungup, silence_timeout, error, transferred
    summary = sa.Column(sa.Text, nullable=True)
    sentiment = sa.Column(sa.String(30), nullable=True)
    outcome = sa.Column(sa.String(50), nullable=True)         # booked, not_interested, callback, transferred, info_provided, failed
    extracted_data = sa.Column(sa.Text, nullable=True)       # JSON string of structured entities
    needs_review = sa.Column(sa.Boolean, default=False, index=True)
    flag_reasons = sa.Column(sa.Text, nullable=True)         # JSON list of flags
    started_at = sa.Column(sa.DateTime, default=utcnow)
    ended_at = sa.Column(sa.DateTime, nullable=True)


class AgentPromptVersion(Base):
    __tablename__ = "agent_prompt_versions"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    agent_id = sa.Column(sa.String(50), nullable=False, index=True)
    version = sa.Column(sa.Integer, nullable=False)
    system_prompt = sa.Column(sa.Text, nullable=False)
    greeting = sa.Column(sa.Text, nullable=False)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class CallTranscriptModel(Base):
    __tablename__ = "transcripts"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    call_id = sa.Column(sa.String(100), nullable=False, index=True)
    turn_index = sa.Column(sa.Integer, default=0)
    speaker = sa.Column(sa.String(20), nullable=False)       # agent or caller
    text = sa.Column(sa.Text, nullable=False)
    interrupted = sa.Column(sa.Boolean, default=False)
    latency_breakdown_json = sa.Column(sa.Text, nullable=True) # JSON
    timestamp = sa.Column(sa.DateTime, default=utcnow)


class APIKeyModel(Base):
    __tablename__ = "api_keys"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    name = sa.Column(sa.String(100), nullable=False)
    key_hash = sa.Column(sa.String(64), nullable=False, unique=True, index=True) # SHA-256
    prefix = sa.Column(sa.String(12), nullable=False)                           # e.g. ca_live_abc
    rate_limit_per_minute = sa.Column(sa.Integer, default=60)
    daily_max_calls = sa.Column(sa.Integer, nullable=True, default=1000)
    daily_max_minutes = sa.Column(sa.Float, nullable=True, default=500.0)
    daily_max_cost_usd = sa.Column(sa.Float, nullable=True, default=50.0)
    monthly_max_calls = sa.Column(sa.Integer, nullable=True, default=20000)
    monthly_max_minutes = sa.Column(sa.Float, nullable=True, default=10000.0)
    monthly_max_cost_usd = sa.Column(sa.Float, nullable=True, default=1000.0)
    is_active = sa.Column(sa.Boolean, default=True)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    caller_name = sa.Column(sa.String(100), nullable=False)
    phone_number = sa.Column(sa.String(30), nullable=False)
    date = sa.Column(sa.String(20), nullable=False)
    time_slot = sa.Column(sa.String(20), nullable=False)
    service = sa.Column(sa.String(100), nullable=False)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class CallbackRequest(Base):
    __tablename__ = "callbacks"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    caller_name = sa.Column(sa.String(100), nullable=True)
    phone_number = sa.Column(sa.String(30), nullable=False, index=True)
    scheduled_time = sa.Column(sa.DateTime, nullable=True)
    timezone = sa.Column(sa.String(50), default="Asia/Kolkata")
    reason = sa.Column(sa.String(255), nullable=True)
    previous_call_id = sa.Column(sa.String(100), nullable=True)
    context_summary = sa.Column(sa.Text, nullable=True)
    status = sa.Column(sa.String(20), default="pending")  # pending, calling, completed, failed, cancelled
    attempts = sa.Column(sa.Integer, default=0)
    max_attempts = sa.Column(sa.Integer, default=3)
    requested_at = sa.Column(sa.DateTime, default=utcnow)
    completed_at = sa.Column(sa.DateTime, nullable=True)


class CallRecording(Base):
    __tablename__ = "call_recordings"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    call_id = sa.Column(sa.String(100), nullable=False)
    file_path = sa.Column(sa.String(255), nullable=False)
    consent_granted = sa.Column(sa.Boolean, default=True)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    call_id = sa.Column(sa.String(100), nullable=False, index=True)
    api_key_id = sa.Column(sa.Integer, nullable=True, index=True)
    campaign_id = sa.Column(sa.String(50), nullable=True, index=True)
    provider = sa.Column(sa.String(30), default="twilio")
    agent_mode = sa.Column(sa.String(50), default="telecaller")
    call_duration_sec = sa.Column(sa.Float, default=0.0)
    stt_seconds = sa.Column(sa.Float, default=0.0)
    llm_prompt_tokens = sa.Column(sa.Integer, default=0)
    llm_completion_tokens = sa.Column(sa.Integer, default=0)
    tts_characters = sa.Column(sa.Integer, default=0)
    estimated_cost_usd = sa.Column(sa.Float, default=0.0)
    estimated_cost_inr = sa.Column(sa.Float, default=0.0)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class DNDEntry(Base):
    __tablename__ = "dnd_registry"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    phone_number = sa.Column(sa.String(30), nullable=False, unique=True, index=True)
    reason = sa.Column(sa.String(255), default="Caller requested DND")
    added_at = sa.Column(sa.DateTime, default=utcnow)


class CampaignModel(Base):
    __tablename__ = "campaigns"

    id = sa.Column(sa.String(50), primary_key=True)
    name = sa.Column(sa.String(100), nullable=False)
    agent_id = sa.Column(sa.String(50), nullable=False)
    provider = sa.Column(sa.String(30), default="twilio")
    status = sa.Column(sa.String(20), default="pending")  # pending, running, paused, completed, cancelled
    total_contacts = sa.Column(sa.Integer, default=0)
    completed_contacts = sa.Column(sa.Integer, default=0)
    failed_contacts = sa.Column(sa.Integer, default=0)
    blocked_contacts = sa.Column(sa.Integer, default=0)
    max_concurrency = sa.Column(sa.Integer, default=5)
    allowed_hours_start = sa.Column(sa.String(10), default="09:00")
    allowed_hours_end = sa.Column(sa.String(10), default="21:00")
    timezone = sa.Column(sa.String(50), default="Asia/Kolkata")
    retry_max_attempts = sa.Column(sa.Integer, default=3)
    retry_gap_minutes = sa.Column(sa.Integer, default=15)
    max_calls_per_day = sa.Column(sa.Integer, default=500)
    calls_made_today = sa.Column(sa.Integer, default=0)
    budget_usd = sa.Column(sa.Float, default=100.0)
    budget_inr = sa.Column(sa.Float, default=8300.0)
    estimated_cost_usd = sa.Column(sa.Float, default=0.0)
    created_at = sa.Column(sa.DateTime, default=utcnow)
    updated_at = sa.Column(sa.DateTime, default=utcnow, onupdate=utcnow)


class CampaignContactModel(Base):
    __tablename__ = "campaign_contacts"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    campaign_id = sa.Column(sa.String(50), nullable=False, index=True)
    phone_number = sa.Column(sa.String(30), nullable=False, index=True)
    variables_json = sa.Column(sa.Text, nullable=True) # Mapped CSV column data
    call_id = sa.Column(sa.String(100), nullable=True)
    status = sa.Column(sa.String(20), default="pending")  # pending, dialing, answered, completed, failed, blocked
    attempts = sa.Column(sa.Integer, default=0)
    max_attempts = sa.Column(sa.Integer, default=3)
    next_attempt_at = sa.Column(sa.DateTime, nullable=True)
    outcome = sa.Column(sa.String(50), nullable=True)
    summary = sa.Column(sa.Text, nullable=True)
    collected_fields_json = sa.Column(sa.Text, nullable=True)
    blocked_reason = sa.Column(sa.String(100), nullable=True) # dnd, outside_hours, invalid_number
    created_at = sa.Column(sa.DateTime, default=utcnow)
    updated_at = sa.Column(sa.DateTime, default=utcnow, onupdate=utcnow)


class WebhookConfigModel(Base):
    __tablename__ = "webhook_configs"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    agent_id = sa.Column(sa.String(50), nullable=True, index=True)
    api_key_id = sa.Column(sa.Integer, nullable=True, index=True)
    url = sa.Column(sa.String(255), nullable=False)
    signing_secret = sa.Column(sa.String(100), nullable=False)
    is_active = sa.Column(sa.Boolean, default=True)
    events = sa.Column(
        sa.Text,
        default='["call.started","call.ended","lead.captured","callback.scheduled","campaign.completed"]'
    )
    created_at = sa.Column(sa.DateTime, default=utcnow)


class WebhookEventModel(Base):
    __tablename__ = "webhook_events"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    event_type = sa.Column(sa.String(50), nullable=False, index=True)
    idempotency_key = sa.Column(sa.String(100), nullable=False, unique=True, index=True)
    agent_id = sa.Column(sa.String(50), nullable=True)
    call_id = sa.Column(sa.String(100), nullable=True, index=True)
    url = sa.Column(sa.String(255), nullable=False)
    payload_json = sa.Column(sa.Text, nullable=False)
    status = sa.Column(sa.String(20), default="pending")  # pending, delivered, failed
    attempts = sa.Column(sa.Integer, default=0)
    last_error = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime, default=utcnow)
    delivered_at = sa.Column(sa.DateTime, nullable=True)


class WebhookDeadLetterModel(Base):
    __tablename__ = "webhook_dead_letter"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    event_id = sa.Column(sa.Integer, nullable=True)
    event_type = sa.Column(sa.String(50), nullable=False)
    idempotency_key = sa.Column(sa.String(100), nullable=False)
    url = sa.Column(sa.String(255), nullable=False)
    payload_json = sa.Column(sa.Text, nullable=False)
    attempts = sa.Column(sa.Integer, default=5)
    last_error = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime, default=utcnow)


class DatabaseManager:
    """Async Database Manager with auto-initialization for SQLite/PostgreSQL."""

    def __init__(self, db_url: Optional[str] = None) -> None:
        settings = get_settings()
        core_db_url = getattr(settings, "core_engine_database_url", None)
        raw_url = db_url or core_db_url or settings.database_url
        if not raw_url or raw_url.startswith("mysql://") or raw_url.startswith("mysql:"):
            raw_url = "sqlite:///./calling_agent.db"

        if raw_url.startswith("sqlite:///"):
            async_url = raw_url.replace("sqlite:///", "sqlite+aiosqlite:///")
        elif raw_url.startswith("postgresql://"):
            async_url = raw_url.replace("postgresql://", "postgresql+asyncpg://")
        else:
            async_url = raw_url

        connect_args = {'timeout': 30.0} if 'sqlite' in async_url else {}
        self.engine = create_async_engine(async_url, echo=False, connect_args=connect_args)
        self.session_factory = sessionmaker(
            self.engine, expire_on_commit=False, class_=AsyncSession
        )

    async def init_db(self) -> None:
        """Create all tables asynchronously and ensure backward-compatible schema."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # SQLite backward compatibility check for new columns on 'calls' table
            def _check_and_add_columns(connection):
                try:
                    cursor = connection.connection.cursor()
                    cursor.execute("PRAGMA journal_mode=WAL;")
                    cursor.execute("PRAGMA busy_timeout=30000;")
                    cursor.execute("PRAGMA table_info(calls);")
                    columns = [row[1] for row in cursor.fetchall()]
                    if columns:
                        if "outcome" not in columns:
                            cursor.execute("ALTER TABLE calls ADD COLUMN outcome VARCHAR(50);")
                        if "extracted_data" not in columns:
                            cursor.execute("ALTER TABLE calls ADD COLUMN extracted_data TEXT;")
                        if "needs_review" not in columns:
                            cursor.execute("ALTER TABLE calls ADD COLUMN needs_review BOOLEAN DEFAULT 0;")
                        if "flag_reasons" not in columns:
                            cursor.execute("ALTER TABLE calls ADD COLUMN flag_reasons TEXT;")

                    cursor.execute("PRAGMA table_info(campaign_contacts);")
                    cc_cols = [row[1] for row in cursor.fetchall()]
                    if cc_cols:
                        if "variables_json" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN variables_json TEXT;")
                        if "max_attempts" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN max_attempts INTEGER DEFAULT 3;")
                        if "next_attempt_at" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN next_attempt_at DATETIME;")
                        if "outcome" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN outcome VARCHAR(50);")
                        if "summary" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN summary TEXT;")
                        if "collected_fields_json" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN collected_fields_json TEXT;")
                        if "blocked_reason" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN blocked_reason VARCHAR(100);")
                        if "created_at" not in cc_cols:
                            cursor.execute("ALTER TABLE campaign_contacts ADD COLUMN created_at DATETIME;")

                    cursor.execute("PRAGMA table_info(campaigns);")
                    camp_cols = [row[1] for row in cursor.fetchall()]
                    if camp_cols:
                        if "provider" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN provider VARCHAR(30) DEFAULT 'twilio';")
                        if "blocked_contacts" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN blocked_contacts INTEGER DEFAULT 0;")
                        if "calls_made_today" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN calls_made_today INTEGER DEFAULT 0;")
                        if "estimated_cost_usd" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN estimated_cost_usd FLOAT DEFAULT 0.0;")
                        if "retry_max_attempts" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN retry_max_attempts INTEGER DEFAULT 3;")
                        if "retry_gap_minutes" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN retry_gap_minutes INTEGER DEFAULT 15;")
                        if "max_calls_per_day" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN max_calls_per_day INTEGER DEFAULT 500;")
                        if "timezone" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';")
                        if "budget_usd" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN budget_usd FLOAT DEFAULT 100.0;")
                        if "budget_inr" not in camp_cols:
                            cursor.execute("ALTER TABLE campaigns ADD COLUMN budget_inr FLOAT DEFAULT 8300.0;")

                    cursor.execute("PRAGMA table_info(callbacks);")
                    cb_cols = [row[1] for row in cursor.fetchall()]
                    if cb_cols:
                        if "scheduled_time" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN scheduled_time DATETIME;")
                        if "timezone" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';")
                        if "previous_call_id" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN previous_call_id VARCHAR(100);")
                        if "context_summary" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN context_summary TEXT;")
                        if "attempts" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN attempts INTEGER DEFAULT 0;")
                        if "max_attempts" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN max_attempts INTEGER DEFAULT 3;")
                        if "completed_at" not in cb_cols:
                            cursor.execute("ALTER TABLE callbacks ADD COLUMN completed_at DATETIME;")

                    cursor.execute("PRAGMA table_info(usage_records);")
                    ur_cols = [row[1] for row in cursor.fetchall()]
                    if ur_cols:
                        if "provider" not in ur_cols:
                            cursor.execute("ALTER TABLE usage_records ADD COLUMN provider VARCHAR(30) DEFAULT 'twilio';")
                        if "agent_mode" not in ur_cols:
                            cursor.execute("ALTER TABLE usage_records ADD COLUMN agent_mode VARCHAR(50) DEFAULT 'telecaller';")
                        if "campaign_id" not in ur_cols:
                            cursor.execute("ALTER TABLE usage_records ADD COLUMN campaign_id VARCHAR(50);")
                        if "estimated_cost_inr" not in ur_cols:
                            cursor.execute("ALTER TABLE usage_records ADD COLUMN estimated_cost_inr FLOAT DEFAULT 0.0;")

                    cursor.execute("PRAGMA table_info(api_keys);")
                    ak_cols = [row[1] for row in cursor.fetchall()]
                    if ak_cols:
                        if "daily_max_calls" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN daily_max_calls INTEGER DEFAULT 1000;")
                        if "daily_max_minutes" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN daily_max_minutes FLOAT DEFAULT 500.0;")
                        if "daily_max_cost_usd" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN daily_max_cost_usd FLOAT DEFAULT 50.0;")
                        if "monthly_max_calls" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN monthly_max_calls INTEGER DEFAULT 20000;")
                        if "monthly_max_minutes" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN monthly_max_minutes FLOAT DEFAULT 10000.0;")
                        if "monthly_max_cost_usd" not in ak_cols:
                            cursor.execute("ALTER TABLE api_keys ADD COLUMN monthly_max_cost_usd FLOAT DEFAULT 1000.0;")
                except Exception as e:
                    logger.debug(f"Column migration note: {e}")

            try:
                await conn.run_sync(_check_and_add_columns)
            except Exception:
                pass

        logger.info("Database tables initialized.")

    async def cleanup_stale_calls(self) -> int:
        """Mark any lingering 'initiated', 'ringing', or 'in-progress' calls as abandoned on server boot."""
        async with self.session_factory() as session:
            stmt = (
                sa.update(CallModel)
                .where(CallModel.status.in_(["initiated", "in-progress", "ringing"]))
                .values(
                    status="failed",
                    end_reason="server_crash_recovery",
                    ended_at=utcnow(),
                )
            )
            res = await session.execute(stmt)
            await session.commit()
            count = res.rowcount
            if count > 0:
                logger.info(
                    f"Server crash recovery: marked {count} stale call(s) as 'failed' (reason: server_crash_recovery)."
                )
            return count

    async def create_call(
        self,
        call_id: str,
        caller_number: str,
        agent_id: Optional[str] = None,
        direction: str = "outbound",
        provider: str = "twilio",
        status: str = "initiated",
    ) -> CallModel:
        async with self.session_factory() as session:
            call = CallModel(
                id=call_id,
                caller_number=caller_number,
                agent_id=agent_id,
                direction=direction,
                provider=provider,
                status=status,
            )
            session.add(call)
            await session.commit()
            return call

    async def update_call(
        self,
        call_id: str,
        status: Optional[str] = None,
        duration_sec: Optional[float] = None,
        end_reason: Optional[str] = None,
        summary: Optional[str] = None,
        sentiment: Optional[str] = None,
        outcome: Optional[str] = None,
        extracted_data: Optional[Dict[str, Any]] = None,
        needs_review: Optional[bool] = None,
        flag_reasons: Optional[List[str]] = None,
    ) -> Optional[CallModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CallModel).where(CallModel.id == call_id)
            res = await session.execute(stmt)
            call = res.scalar_one_or_none()
            if call:
                if status:
                    call.status = status
                if duration_sec is not None:
                    call.duration_sec = duration_sec
                if end_reason:
                    call.end_reason = end_reason
                if summary:
                    call.summary = summary
                if sentiment:
                    call.sentiment = sentiment
                if outcome:
                    call.outcome = outcome
                if extracted_data is not None:
                    call.extracted_data = json.dumps(extracted_data, ensure_ascii=False)
                if needs_review is not None:
                    call.needs_review = needs_review
                if flag_reasons is not None:
                    call.flag_reasons = (
                        json.dumps(flag_reasons, ensure_ascii=False)
                        if isinstance(flag_reasons, list)
                        else str(flag_reasons)
                    )
                if status in ("completed", "failed", "busy", "no-answer"):
                    call.ended_at = utcnow()
                await session.commit()
            return call

    async def save_post_call_analysis(
        self,
        call_id: str,
        summary: str,
        outcome: str,
        sentiment: str,
        extracted_data: Optional[Dict[str, Any]] = None,
        needs_review: Optional[bool] = None,
        flag_reasons: Optional[List[str]] = None,
    ) -> Optional[CallModel]:
        """Save LLM-derived post-call analytics and review flags."""
        return await self.update_call(
            call_id=call_id,
            summary=summary,
            outcome=outcome,
            sentiment=sentiment,
            extracted_data=extracted_data,
            needs_review=needs_review,
            flag_reasons=flag_reasons,
        )

    async def get_call(self, call_id: str) -> Optional[CallModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CallModel).where(CallModel.id == call_id)
            res = await session.execute(stmt)
            return res.scalar_one_or_none()

    async def list_calls(
        self,
        status: Optional[str] = None,
        provider: Optional[str] = None,
        direction: Optional[str] = None,
        needs_review: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[CallModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CallModel)
            if status:
                stmt = stmt.where(CallModel.status == status)
            if provider:
                stmt = stmt.where(CallModel.provider == provider)
            if direction:
                stmt = stmt.where(CallModel.direction == direction)
            if needs_review is not None:
                stmt = stmt.where(CallModel.needs_review == needs_review)
            stmt = stmt.order_by(CallModel.started_at.desc()).limit(limit).offset(offset)
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def add_transcript_turn(
        self,
        call_id: str,
        speaker: str,
        text: str,
        turn_index: int = 0,
        interrupted: bool = False,
        latency: Optional[dict] = None,
    ) -> CallTranscriptModel:
        async with self.session_factory() as session:
            t = CallTranscriptModel(
                call_id=call_id,
                speaker=speaker,
                text=text,
                turn_index=turn_index,
                interrupted=interrupted,
                latency_breakdown_json=json.dumps(latency) if latency else None,
            )
            session.add(t)
            await session.commit()
            return t

    async def get_transcripts(self, call_id: str) -> List[CallTranscriptModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CallTranscriptModel).where(CallTranscriptModel.call_id == call_id).order_by(CallTranscriptModel.id.asc())
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def create_agent(self, agent_data: Dict[str, Any]) -> AgentModel:
        async with self.session_factory() as session:
            tools_json = json.dumps(agent_data.get("tools_enabled", [])) if isinstance(agent_data.get("tools_enabled"), list) else agent_data.get("tools_enabled", "[]")
            agent = AgentModel(
                id=agent_data["id"],
                name=agent_data["name"],
                role=agent_data.get("role", "Voice Assistant"),
                personality=agent_data.get("personality", "Helpful"),
                system_prompt=agent_data["system_prompt"],
                greeting=agent_data["greeting"],
                default_language=agent_data.get("default_language", "hi"),
                voice_provider=agent_data.get("voice_provider", "cartesia"),
                voice_id=agent_data.get("voice_id"),
                llm_model=agent_data.get("llm_model", "llama-3.3-70b-versatile"),
                tools_enabled=tools_json,
            )
            session.add(agent)

            # Record initial prompt version 1
            version_entry = AgentPromptVersion(
                agent_id=agent_data["id"],
                version=1,
                system_prompt=agent_data["system_prompt"],
                greeting=agent_data["greeting"],
            )
            session.add(version_entry)

            await session.commit()
            return agent

    async def get_agent(self, agent_id: str) -> Optional[AgentModel]:
        async with self.session_factory() as session:
            stmt = sa.select(AgentModel).where(AgentModel.id == agent_id)
            res = await session.execute(stmt)
            return res.scalar_one_or_none()

    async def list_agents(self) -> List[AgentModel]:
        async with self.session_factory() as session:
            stmt = sa.select(AgentModel).order_by(AgentModel.created_at.desc())
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def update_agent(self, agent_id: str, updates: Dict[str, Any]) -> Optional[AgentModel]:
        async with self.session_factory() as session:
            stmt = sa.select(AgentModel).where(AgentModel.id == agent_id)
            res = await session.execute(stmt)
            agent = res.scalar_one_or_none()
            if agent:
                prompt_changed = False
                for k, v in updates.items():
                    if hasattr(agent, k):
                        if k in ("system_prompt", "greeting") and getattr(agent, k) != v:
                            prompt_changed = True
                        if k == "tools_enabled" and isinstance(v, list):
                            v = json.dumps(v)
                        setattr(agent, k, v)
                agent.updated_at = utcnow()

                if prompt_changed:
                    # Query current latest version
                    v_stmt = sa.select(sa.func.max(AgentPromptVersion.version)).where(
                        AgentPromptVersion.agent_id == agent_id
                    )
                    max_ver = (await session.execute(v_stmt)).scalar() or 0
                    next_ver = max_ver + 1
                    session.add(
                        AgentPromptVersion(
                            agent_id=agent_id,
                            version=next_ver,
                            system_prompt=agent.system_prompt,
                            greeting=agent.greeting,
                        )
                    )

                await session.commit()
            return agent

    async def get_agent_versions(self, agent_id: str) -> List[AgentPromptVersion]:
        """List all prompt versions for an agent ordered by version descending."""
        async with self.session_factory() as session:
            stmt = (
                sa.select(AgentPromptVersion)
                .where(AgentPromptVersion.agent_id == agent_id)
                .order_by(AgentPromptVersion.version.desc())
            )
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def rollback_agent_prompt(
        self, agent_id: str, target_version: int
    ) -> Optional[AgentModel]:
        """Roll back an agent's prompt and greeting to a specific version."""
        async with self.session_factory() as session:
            stmt = sa.select(AgentModel).where(AgentModel.id == agent_id)
            agent = (await session.execute(stmt)).scalar_one_or_none()
            if not agent:
                return None

            ver_stmt = sa.select(AgentPromptVersion).where(
                AgentPromptVersion.agent_id == agent_id,
                AgentPromptVersion.version == target_version,
            )
            target = (await session.execute(ver_stmt)).scalar_one_or_none()
            if not target:
                return None

            agent.system_prompt = target.system_prompt
            agent.greeting = target.greeting
            agent.updated_at = utcnow()

            # Record this rollback as a new version
            v_stmt = sa.select(sa.func.max(AgentPromptVersion.version)).where(
                AgentPromptVersion.agent_id == agent_id
            )
            max_ver = (await session.execute(v_stmt)).scalar() or 0
            session.add(
                AgentPromptVersion(
                    agent_id=agent_id,
                    version=max_ver + 1,
                    system_prompt=agent.system_prompt,
                    greeting=agent.greeting,
                )
            )

            await session.commit()
            return agent

    async def create_api_key(self, name: str, key_hash: str, prefix: str, rate_limit: int = 60) -> APIKeyModel:
        async with self.session_factory() as session:
            k = APIKeyModel(name=name, key_hash=key_hash, prefix=prefix, rate_limit_per_minute=rate_limit)
            session.add(k)
            await session.commit()
            return k

    async def get_api_key_by_hash(self, key_hash: str) -> Optional[APIKeyModel]:
        async with self.session_factory() as session:
            stmt = sa.select(APIKeyModel).where(APIKeyModel.key_hash == key_hash, APIKeyModel.is_active == True)
            res = await session.execute(stmt)
            return res.scalar_one_or_none()

    async def list_api_keys(self) -> List[APIKeyModel]:
        async with self.session_factory() as session:
            stmt = sa.select(APIKeyModel).order_by(APIKeyModel.created_at.desc())
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def revoke_api_key(self, key_id: int) -> bool:
        async with self.session_factory() as session:
            stmt = sa.select(APIKeyModel).where(APIKeyModel.id == key_id)
            res = await session.execute(stmt)
            k = res.scalar_one_or_none()
            if k:
                k.is_active = False
                await session.commit()
                return True
            return False

    async def create_appointment(
        self, caller_name: str, phone_number: str, date: str, time_slot: str, service: str
    ) -> int:
        async with self.session_factory() as session:
            appointment = Appointment(
                caller_name=caller_name,
                phone_number=phone_number,
                date=date,
                time_slot=time_slot,
                service=service,
            )
            session.add(appointment)
            await session.commit()
            return appointment.id

    async def get_appointments_for_date(self, date: str) -> List[Appointment]:
        """Retrieve all booked appointments for a given calendar date."""
        async with self.session_factory() as session:
            stmt = sa.select(Appointment).where(Appointment.date == date)
            res = await session.execute(stmt)
            return list(res.scalars().all())

    async def check_appointment_conflict(self, date: str, time_slot: str) -> bool:
        """Return True if an appointment already exists on date at time_slot."""
        async with self.session_factory() as session:
            stmt = sa.select(Appointment).where(
                Appointment.date == date,
                Appointment.time_slot == time_slot,
            )
            res = await session.execute(stmt)
            return res.scalar_one_or_none() is not None

    async def create_callback(
        self, phone_number: str, caller_name: Optional[str] = None, reason: Optional[str] = None
    ) -> int:
        async with self.session_factory() as session:
            cb = CallbackRequest(
                phone_number=phone_number, caller_name=caller_name, reason=reason
            )
            session.add(cb)
            await session.commit()
            return cb.id

    async def record_call_audio(
        self, call_id: str, file_path: str, consent_granted: bool = True
    ) -> int:
        async with self.session_factory() as session:
            rec = CallRecording(
                call_id=call_id, file_path=file_path, consent_granted=consent_granted
            )
            session.add(rec)
            await session.commit()
            return rec.id

    # =========================================================================
    # USAGE TRACKING & BILLING
    # =========================================================================

    async def record_usage(
        self,
        call_id: str,
        call_duration_sec: float,
        stt_seconds: float,
        llm_prompt_tokens: int,
        llm_completion_tokens: int,
        tts_characters: int,
        estimated_cost_usd: float,
        api_key_id: Optional[int] = None,
        campaign_id: Optional[str] = None,
        provider: str = "twilio",
        agent_mode: str = "telecaller",
        estimated_cost_inr: Optional[float] = None,
    ) -> UsageRecord:
        """Record component usage metrics and calculated cost for a finished call."""
        if estimated_cost_inr is None:
            estimated_cost_inr = round(estimated_cost_usd * 83.0, 4)

        async with self.session_factory() as session:
            record = UsageRecord(
                call_id=call_id,
                api_key_id=api_key_id,
                campaign_id=campaign_id,
                provider=provider or "twilio",
                agent_mode=agent_mode or "telecaller",
                call_duration_sec=call_duration_sec,
                stt_seconds=stt_seconds,
                llm_prompt_tokens=llm_prompt_tokens,
                llm_completion_tokens=llm_completion_tokens,
                tts_characters=tts_characters,
                estimated_cost_usd=estimated_cost_usd,
                estimated_cost_inr=estimated_cost_inr,
            )
            session.add(record)
            await session.commit()
            return record

    async def get_usage_for_call(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve component usage and cost breakdown for a specific call."""
        async with self.session_factory() as session:
            stmt = sa.select(UsageRecord).where(UsageRecord.call_id == call_id)
            rec = (await session.execute(stmt)).scalar_one_or_none()
            if not rec:
                return None
            return {
                "call_id": rec.call_id,
                "provider": rec.provider,
                "agent_mode": rec.agent_mode,
                "campaign_id": rec.campaign_id,
                "call_duration_sec": rec.call_duration_sec,
                "stt_seconds": rec.stt_seconds,
                "llm_prompt_tokens": rec.llm_prompt_tokens,
                "llm_completion_tokens": rec.llm_completion_tokens,
                "tts_characters": rec.tts_characters,
                "estimated_cost_usd": rec.estimated_cost_usd,
                "estimated_cost_inr": rec.estimated_cost_inr or round(rec.estimated_cost_usd * 83.0, 4),
            }

    async def get_detailed_usage(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        api_key_id: Optional[int] = None,
        campaign_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Aggregate usage metrics with breakdowns by provider, agent mode, and day."""
        async with self.session_factory() as session:
            stmt = sa.select(UsageRecord)
            if from_date:
                stmt = stmt.where(UsageRecord.created_at >= from_date)
            if to_date:
                stmt = stmt.where(UsageRecord.created_at <= to_date)
            if api_key_id is not None:
                stmt = stmt.where(UsageRecord.api_key_id == api_key_id)
            if campaign_id is not None:
                stmt = stmt.where(UsageRecord.campaign_id == campaign_id)

            rows = (await session.execute(stmt)).scalars().all()

            total_calls = len(rows)
            total_duration_sec = sum(r.call_duration_sec or 0.0 for r in rows)
            total_stt_sec = sum(r.stt_seconds or 0.0 for r in rows)
            total_prompt_tokens = sum(r.llm_prompt_tokens or 0 for r in rows)
            total_completion_tokens = sum(r.llm_completion_tokens or 0 for r in rows)
            total_tts_characters = sum(r.tts_characters or 0 for r in rows)
            total_cost_usd = sum(r.estimated_cost_usd or 0.0 for r in rows)
            total_cost_inr = sum(r.estimated_cost_inr or (r.estimated_cost_usd or 0.0) * 83.0 for r in rows)

            breakdown_by_provider: Dict[str, Dict[str, Any]] = {}
            breakdown_by_mode: Dict[str, Dict[str, Any]] = {}
            breakdown_by_day: Dict[str, Dict[str, Any]] = {}

            for r in rows:
                p = r.provider or "unknown"
                m = r.agent_mode or "unknown"
                day_str = r.created_at.strftime("%Y-%m-%d") if r.created_at else "unknown"
                dur_m = round((r.call_duration_sec or 0.0) / 60.0, 2)
                c_usd = r.estimated_cost_usd or 0.0
                c_inr = r.estimated_cost_inr or (c_usd * 83.0)

                # Provider
                if p not in breakdown_by_provider:
                    breakdown_by_provider[p] = {"calls": 0, "minutes": 0.0, "cost_usd": 0.0, "cost_inr": 0.0}
                breakdown_by_provider[p]["calls"] += 1
                breakdown_by_provider[p]["minutes"] = round(breakdown_by_provider[p]["minutes"] + dur_m, 2)
                breakdown_by_provider[p]["cost_usd"] = round(breakdown_by_provider[p]["cost_usd"] + c_usd, 4)
                breakdown_by_provider[p]["cost_inr"] = round(breakdown_by_provider[p]["cost_inr"] + c_inr, 2)

                # Mode
                if m not in breakdown_by_mode:
                    breakdown_by_mode[m] = {"calls": 0, "minutes": 0.0, "cost_usd": 0.0, "cost_inr": 0.0}
                breakdown_by_mode[m]["calls"] += 1
                breakdown_by_mode[m]["minutes"] = round(breakdown_by_mode[m]["minutes"] + dur_m, 2)
                breakdown_by_mode[m]["cost_usd"] = round(breakdown_by_mode[m]["cost_usd"] + c_usd, 4)
                breakdown_by_mode[m]["cost_inr"] = round(breakdown_by_mode[m]["cost_inr"] + c_inr, 2)

                # Day
                if day_str not in breakdown_by_day:
                    breakdown_by_day[day_str] = {"calls": 0, "minutes": 0.0, "cost_usd": 0.0, "cost_inr": 0.0}
                breakdown_by_day[day_str]["calls"] += 1
                breakdown_by_day[day_str]["minutes"] = round(breakdown_by_day[day_str]["minutes"] + dur_m, 2)
                breakdown_by_day[day_str]["cost_usd"] = round(breakdown_by_day[day_str]["cost_usd"] + c_usd, 4)
                breakdown_by_day[day_str]["cost_inr"] = round(breakdown_by_day[day_str]["cost_inr"] + c_inr, 2)

            return {
                "summary": {
                    "total_calls": total_calls,
                    "total_duration_minutes": round(total_duration_sec / 60.0, 2),
                    "total_stt_minutes": round(total_stt_sec / 60.0, 2),
                    "total_prompt_tokens": total_prompt_tokens,
                    "total_completion_tokens": total_completion_tokens,
                    "total_tts_characters": total_tts_characters,
                    "total_estimated_cost_usd": round(total_cost_usd, 4),
                    "total_estimated_cost_inr": round(total_cost_inr, 2),
                },
                "breakdown_by_provider": breakdown_by_provider,
                "breakdown_by_mode": breakdown_by_mode,
                "breakdown_by_day": breakdown_by_day,
            }

    async def get_usage_summary(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        api_key_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Aggregate usage metrics across calls within a date range."""
        async with self.session_factory() as session:
            stmt = sa.select(
                sa.func.count(UsageRecord.id),
                sa.func.coalesce(sa.func.sum(UsageRecord.call_duration_sec), 0.0),
                sa.func.coalesce(sa.func.sum(UsageRecord.stt_seconds), 0.0),
                sa.func.coalesce(sa.func.sum(UsageRecord.llm_prompt_tokens), 0),
                sa.func.coalesce(sa.func.sum(UsageRecord.llm_completion_tokens), 0),
                sa.func.coalesce(sa.func.sum(UsageRecord.tts_characters), 0),
                sa.func.coalesce(sa.func.sum(UsageRecord.estimated_cost_usd), 0.0),
            )
            if from_date:
                stmt = stmt.where(UsageRecord.created_at >= from_date)
            if to_date:
                stmt = stmt.where(UsageRecord.created_at <= to_date)
            if api_key_id is not None:
                stmt = stmt.where(UsageRecord.api_key_id == api_key_id)

            res = (await session.execute(stmt)).one()
            return {
                "total_calls": res[0],
                "total_duration_minutes": round(res[1] / 60.0, 2),
                "total_stt_minutes": round(res[2] / 60.0, 2),
                "total_prompt_tokens": res[3],
                "total_completion_tokens": res[4],
                "total_tts_characters": res[5],
                "total_estimated_cost_usd": round(res[6], 4),
            }

    # =========================================================================
    # DND REGISTRY
    # =========================================================================

    async def add_dnd(self, phone_number: str, reason: str = "Requested by user") -> DNDEntry:
        async with self.session_factory() as session:
            stmt = sa.select(DNDEntry).where(DNDEntry.phone_number == phone_number)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                existing.reason = reason
                await session.commit()
                return existing

            entry = DNDEntry(phone_number=phone_number, reason=reason)
            session.add(entry)
            await session.commit()
            return entry

    async def remove_dnd(self, phone_number: str) -> bool:
        async with self.session_factory() as session:
            stmt = sa.select(DNDEntry).where(DNDEntry.phone_number == phone_number)
            entry = (await session.execute(stmt)).scalar_one_or_none()
            if entry:
                await session.delete(entry)
                await session.commit()
                return True
            return False

    async def is_dnd(self, phone_number: str) -> bool:
        async with self.session_factory() as session:
            stmt = sa.select(DNDEntry).where(DNDEntry.phone_number == phone_number)
            entry = (await session.execute(stmt)).scalar_one_or_none()
            return entry is not None

    # =========================================================================
    # CAMPAIGN MANAGEMENT
    # =========================================================================

    async def create_campaign(
        self,
        campaign_id: str,
        name: str,
        agent_id: str,
        contacts: List[Any],
        provider: str = "twilio",
        max_concurrency: int = 5,
        allowed_hours_start: str = "09:00",
        allowed_hours_end: str = "21:00",
        retry_max_attempts: int = 3,
        retry_gap_minutes: int = 15,
        max_calls_per_day: int = 500,
        budget_usd: Optional[float] = 100.0,
        budget_inr: Optional[float] = 8300.0,
    ) -> CampaignModel:
        async with self.session_factory() as session:
            campaign = CampaignModel(
                id=campaign_id,
                name=name,
                agent_id=agent_id,
                provider=provider,
                status="pending",
                total_contacts=len(contacts),
                max_concurrency=max_concurrency,
                allowed_hours_start=allowed_hours_start,
                allowed_hours_end=allowed_hours_end,
                retry_max_attempts=retry_max_attempts,
                retry_gap_minutes=retry_gap_minutes,
                max_calls_per_day=max_calls_per_day,
                budget_usd=budget_usd or 100.0,
                budget_inr=budget_inr or 8300.0,
            )
            session.add(campaign)
            for item in contacts:
                if isinstance(item, str):
                    p_num = item.strip()
                    vars_json = None
                elif isinstance(item, dict):
                    p_num = (item.get("phone_number") or item.get("phone", "")).strip()
                    vars_data = item.get("variables", {})
                    vars_json = json.dumps(vars_data) if vars_data else None
                else:
                    p_num = str(item)
                    vars_json = None

                contact = CampaignContactModel(
                    campaign_id=campaign_id,
                    phone_number=p_num,
                    variables_json=vars_json,
                    status="pending",
                    max_attempts=retry_max_attempts,
                )
                session.add(contact)
            await session.commit()
            return campaign

    async def get_campaign(self, campaign_id: str) -> Optional[CampaignModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CampaignModel).where(CampaignModel.id == campaign_id)
            return (await session.execute(stmt)).scalar_one_or_none()

    async def update_campaign_status(self, campaign_id: str, status: str) -> Optional[CampaignModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CampaignModel).where(CampaignModel.id == campaign_id)
            camp = (await session.execute(stmt)).scalar_one_or_none()
            if camp:
                camp.status = status
                camp.updated_at = utcnow()
                await session.commit()
            return camp

    async def get_campaign_contacts(
        self, campaign_id: str, status: Optional[str] = None
    ) -> List[CampaignContactModel]:
        async with self.session_factory() as session:
            stmt = sa.select(CampaignContactModel).where(
                CampaignContactModel.campaign_id == campaign_id
            )
            if status:
                stmt = stmt.where(CampaignContactModel.status == status)
            return list((await session.execute(stmt)).scalars().all())

    async def update_campaign_contact(
        self,
        contact_id: int,
        status: str,
        call_id: Optional[str] = None,
    ) -> None:
        async with self.session_factory() as session:
            stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
            contact = (await session.execute(stmt)).scalar_one_or_none()
            if contact:
                contact.status = status
                if call_id:
                    contact.call_id = call_id
                contact.updated_at = utcnow()
                await session.commit()


_db_manager: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    """Return singleton DatabaseManager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager
