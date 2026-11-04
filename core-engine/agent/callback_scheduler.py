"""Callback Scheduler Engine: time-slot compliance, context handoff, concurrency & retries."""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
import sqlalchemy as sa
from agent.compliance import ComplianceEngine, IST_OFFSET, get_compliance_engine
from agent.db import get_db, CallbackRequest, CallModel
from agent.engine import CallingAgentEngine
from agent.logger import setup_logger
from agent.webhooks.dispatcher import get_webhook_dispatcher

logger = setup_logger("callback_scheduler")

MAX_CALLBACK_ATTEMPTS = 3


def adjust_to_next_allowed_slot(
    dt_ist: datetime,
    start_hour: int = 9,
    end_hour: int = 21,
) -> Tuple[datetime, bool]:
    """If requested time is outside calling hours (9 AM - 9 PM IST), advance to next permitted slot."""
    adjusted = False
    target = dt_ist

    # If before start_hour today, move to start_hour today (e.g., 9:30 AM)
    if target.hour < start_hour:
        target = target.replace(hour=start_hour, minute=30, second=0, microsecond=0)
        adjusted = True
    # If after or equal to end_hour, move to start_hour tomorrow
    elif target.hour >= end_hour:
        target = (target + timedelta(days=1)).replace(hour=start_hour, minute=30, second=0, microsecond=0)
        adjusted = True

    return target, adjusted


def parse_callback_time_ist(time_str: str) -> Tuple[datetime, bool]:
    """Parse relative or absolute time strings to an IST datetime, adjusting out-of-hours slots."""
    now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET)
    lower = time_str.lower().strip()

    target_dt = now_ist + timedelta(hours=2)  # Default fallback 2 hours later

    if "kal" in lower or "tomorrow" in lower:
        base_date = now_ist + timedelta(days=1)
        if "night" in lower or "raat" in lower or "pm" in lower:
            target_dt = base_date.replace(hour=23, minute=0, second=0, microsecond=0)
        elif "morning" in lower or "subah" in lower:
            target_dt = base_date.replace(hour=10, minute=0, second=0, microsecond=0)
        elif "afternoon" in lower or "dopahar" in lower:
            target_dt = base_date.replace(hour=14, minute=30, second=0, microsecond=0)
        elif "evening" in lower or "shaam" in lower:
            target_dt = base_date.replace(hour=17, minute=0, second=0, microsecond=0)
        else:
            target_dt = base_date.replace(hour=11, minute=0, second=0, microsecond=0)
    elif "evening" in lower or "shaam" in lower or "after 5" in lower:
        target_dt = now_ist.replace(hour=17, minute=30, second=0, microsecond=0)
        if target_dt <= now_ist:
            target_dt += timedelta(days=1)
    elif "night" in lower or "raat" in lower or "10 pm" in lower or "11 pm" in lower:
        # Intentionally outside allowed hours: will be adjusted!
        target_dt = now_ist.replace(hour=22, minute=0, second=0, microsecond=0)
    elif "1 hour" in lower or "ek ghante" in lower:
        target_dt = now_ist + timedelta(hours=1)
    elif "30 min" in lower or "aadhe ghante" in lower:
        target_dt = now_ist + timedelta(minutes=30)

    # Adjust if outside 09:00 - 21:00 IST
    final_dt, adjusted = adjust_to_next_allowed_slot(target_dt, start_hour=9, end_hour=21)
    return final_dt, adjusted


class CallbackScheduler:
    """Manages scheduling, periodic dispatch, and context preservation for callback requests."""

    def __init__(self, engine: Optional[CallingAgentEngine] = None) -> None:
        self.engine = engine or CallingAgentEngine()
        self.db = get_db()
        self.compliance = get_compliance_engine()
        self._is_running = False
        self._loop_task: Optional[asyncio.Task] = None

    async def schedule(
        self,
        phone_number: str,
        preferred_time_str: str,
        reason: Optional[str] = None,
        previous_call_id: Optional[str] = None,
        caller_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist callback job and auto-adjust time if outside allowed calling window."""
        await self.db.init_db()
        final_ist_dt, was_adjusted = parse_callback_time_ist(preferred_time_str)
        # Store in UTC in DB
        utc_dt = final_ist_dt.astimezone(timezone.utc).replace(tzinfo=None)

        # Retrieve context summary from previous call if available
        context_summary = None
        if previous_call_id:
            async with self.db.session_factory() as session:
                stmt = sa.select(CallModel).where(CallModel.id == previous_call_id)
                prev_call = (await session.execute(stmt)).scalar_one_or_none()
                if prev_call:
                    context_summary = prev_call.summary or f"Call completed with outcome '{prev_call.outcome}'."

        async with self.db.session_factory() as session:
            cb = CallbackRequest(
                caller_name=caller_name,
                phone_number=phone_number.strip(),
                scheduled_time=utc_dt,
                timezone="Asia/Kolkata",
                reason=reason or "Customer requested callback",
                previous_call_id=previous_call_id,
                context_summary=context_summary,
                status="pending",
                attempts=0,
                max_attempts=MAX_CALLBACK_ATTEMPTS,
            )
            session.add(cb)
            await session.commit()
            cb_id = cb.id

        formatted_time = final_ist_dt.strftime("%A, %d %b at %I:%M %p IST")
        message = (
            f"Note: Your requested time is outside permitted calling hours. We have scheduled your callback for {formatted_time}."
            if was_adjusted
            else f"Callback successfully scheduled for {formatted_time}."
        )

        # Dispatch callback.scheduled webhook
        dispatcher = get_webhook_dispatcher()
        dispatcher.dispatch(
            event_type="callback.scheduled",
            payload={
                "callback_id": cb_id,
                "phone_masked": dispatcher.mask_phone_number(phone_number),
                "scheduled_time": final_ist_dt.isoformat(),
                "timezone": "Asia/Kolkata",
                "reason": reason,
                "context_summary": context_summary,
                "was_adjusted": was_adjusted,
            },
            call_id=previous_call_id,
        )

        return {
            "success": True,
            "callback_id": cb_id,
            "scheduled_time_ist": final_ist_dt.isoformat(),
            "formatted_time": formatted_time,
            "was_adjusted": was_adjusted,
            "message": message,
        }

    async def process_due_callbacks(self) -> int:
        """Scan and execute due callbacks whose scheduled_time <= now."""
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        executed = 0

        async with self.db.session_factory() as session:
            stmt = (
                sa.select(CallbackRequest)
                .where(CallbackRequest.status == "pending")
                .where(CallbackRequest.scheduled_time <= now_utc)
                .where(CallbackRequest.attempts < CallbackRequest.max_attempts)
            )
            due_callbacks = (await session.execute(stmt)).scalars().all()

            for cb in due_callbacks:
                phone = cb.phone_number

                # 1. DND Check
                is_dnd = await self.compliance.check_dnd(phone)
                if is_dnd:
                    logger.warning(f"Callback for {phone} cancelled: phone is in DND registry.")
                    cb.status = "cancelled"
                    continue

                # 2. Calling Window Check
                now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET)
                if not (9 <= now_ist.hour < 21):
                    # Advance to tomorrow 10 AM IST
                    next_slot, _ = adjust_to_next_allowed_slot(now_ist, start_hour=9, end_hour=21)
                    cb.scheduled_time = next_slot.astimezone(timezone.utc).replace(tzinfo=None)
                    logger.info(f"Callback for {phone} deferred to {next_slot} (outside permitted hours).")
                    continue

                # 3. Context-Enriched Outbound Call
                cb.status = "calling"
                cb.attempts += 1
                await session.commit()

                # Build context-aware prompt variables so agent does not start from zero
                prompt_vars = {
                    "is_callback": True,
                    "customer_name": cb.caller_name or "Valued Customer",
                    "callback_reason": cb.reason,
                    "previous_call_summary": cb.context_summary or "No previous call notes.",
                    "callback_context_injection": (
                        f"[SYSTEM CALLBACK NOTE]: You are returning a call to {cb.caller_name or 'the customer'}. "
                        f"Previous interaction summary: {cb.context_summary or 'General inquiry'}. "
                        f"Discuss: {cb.reason or 'Follow up'}."
                    ),
                }

                try:
                    call_sid = await self.engine.start_outbound_call(
                        to_number=phone,
                        variables=prompt_vars,
                    )
                    cb.status = "completed"
                    cb.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    logger.info(f"Callback successfully connected for {phone}: SID={call_sid}")
                    executed += 1
                except Exception as e:
                    logger.error(f"Callback call failed for {phone} (attempt {cb.attempts}/{cb.max_attempts}): {e}")
                    if cb.attempts >= cb.max_attempts:
                        cb.status = "failed"
                    else:
                        # Reschedule 30 minutes later
                        cb.status = "pending"
                        cb.scheduled_time = now_utc + timedelta(minutes=30)
                await session.commit()

        return executed

    def start_background_loop(self, poll_interval_sec: float = 30.0) -> None:
        """Start standing background worker to periodically process due callbacks."""
        if self._is_running:
            return
        self._is_running = True

        async def _loop():
            while self._is_running:
                try:
                    await self.process_due_callbacks()
                except Exception as e:
                    logger.error(f"Error in callback scheduler loop: {e}")
                await asyncio.sleep(poll_interval_sec)

        self._loop_task = asyncio.create_task(_loop())
        logger.info(f"Callback scheduler background loop started (interval={poll_interval_sec}s).")

    def stop_background_loop(self) -> None:
        self._is_running = False
        if self._loop_task:
            self._loop_task.cancel()
            self._loop_task = None
        logger.info("Callback scheduler loop stopped.")


_scheduler_instance: Optional[CallbackScheduler] = None


def get_callback_scheduler() -> CallbackScheduler:
    """Return singleton CallbackScheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = CallbackScheduler()
    return _scheduler_instance
