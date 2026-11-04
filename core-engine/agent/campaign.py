"""Outbound Calling Campaign Manager with CSV ingestion, E.164 validation, DND & calling hours compliance, concurrency & crash-recovery."""

import asyncio
import csv
import io
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
from agent.compliance import ComplianceEngine, IST_OFFSET, get_compliance_engine
from agent.db import (
    get_db,
    CampaignModel,
    CampaignContactModel,
    CallModel,
)
from agent.engine import CallingAgentEngine
from agent.logger import setup_logger
from agent.webhooks.dispatcher import get_webhook_dispatcher
from agent.cost_controller import CostController

logger = setup_logger("campaign")

GLOBAL_CONCURRENCY_LIMIT = 20


def mask_phone(phone: Optional[str]) -> str:
    """Mask phone number leaving only the last 4 digits."""
    if not phone:
        return "XXXX"
    s = str(phone).strip()
    if len(s) <= 4:
        return s
    return f"{'*' * (len(s) - 4)}{s[-4:]}"


def validate_e164_phone(raw_phone: str) -> Tuple[bool, str, str]:
    """Validate and normalize phone number to E.164 format (+[1-9][0-9]{7,14})."""
    if not raw_phone:
        return False, "", "Empty phone number"

    cleaned = re.sub(r"[\s\-\(\)\.]", "", str(raw_phone).strip())

    # If 10 digits starting with 6-9 (standard Indian mobile), prepend +91
    if re.match(r"^[6-9]\d{9}$", cleaned):
        cleaned = f"+91{cleaned}"
    elif re.match(r"^0[6-9]\d{9}$", cleaned):
        cleaned = f"+91{cleaned[1:]}"
    elif re.match(r"^91[6-9]\d{9}$", cleaned):
        cleaned = f"+{cleaned}"
    elif not cleaned.startswith("+") and cleaned.isdigit():
        cleaned = f"+{cleaned}"

    # Strict E.164 regex: + followed by 7 to 15 digits
    if not re.match(r"^\+[1-9]\d{6,14}$", cleaned):
        return False, raw_phone, "Does not match standard E.164 specification (+[country][national_number])"

    return True, cleaned, ""


def parse_and_validate_campaign_csv(csv_text: str) -> Dict[str, Any]:
    """Parse CSV text, extract phone numbers and custom variables, deduplicate and report invalid rows."""
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        raise ValueError("CSV has no header row.")

    # Detect phone column
    phone_col = None
    for col in reader.fieldnames:
        clean_col = col.strip().lower()
        if clean_col in ["phone", "phone_number", "mobile", "contact", "number", "telephone"]:
            phone_col = col
            break

    if not phone_col:
        # Fallback to the first column
        phone_col = reader.fieldnames[0]

    valid_contacts: List[Dict[str, Any]] = []
    invalid_rows: List[Dict[str, Any]] = []
    seen_phones = set()
    total_rows = 0
    duplicates_count = 0

    for idx, row in enumerate(reader, start=1):
        total_rows += 1
        raw_val = (row.get(phone_col) or "").strip()
        is_valid, normalized, err = validate_e164_phone(raw_val)

        if not is_valid:
            invalid_rows.append({"row": idx, "data": row, "reason": err})
            continue

        if normalized in seen_phones:
            duplicates_count += 1
            continue

        seen_phones.add(normalized)

        # Variables are all other columns in the row
        variables = {k: v.strip() for k, v in row.items() if k != phone_col}

        valid_contacts.append({
            "phone_number": normalized,
            "variables": variables,
        })

    return {
        "total_rows": total_rows,
        "valid_count": len(valid_contacts),
        "duplicates_count": duplicates_count,
        "invalid_count": len(invalid_rows),
        "valid_contacts": valid_contacts,
        "invalid_rows": invalid_rows,
    }


class CampaignRunner:
    """Enterprise Campaign Orchestrator with idempotency, crash-safe resume, DND, and rate limits."""

    def __init__(self, engine: Optional[CallingAgentEngine] = None) -> None:
        self.engine = engine or CallingAgentEngine()
        self.db = get_db()
        self.compliance = get_compliance_engine()
        self.cost_controller = CostController(db=self.db)
        self._paused_campaigns: set[str] = set()
        self._cancelled_campaigns: set[str] = set()
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self.dnd_hook: Optional[Callable[[str], Any]] = None

    def pause_campaign(self, campaign_id: str) -> None:
        self._paused_campaigns.add(campaign_id)
        logger.info(f"Campaign '{campaign_id}' paused.")

    def resume_campaign(self, campaign_id: str) -> None:
        self._paused_campaigns.discard(campaign_id)
        logger.info(f"Campaign '{campaign_id}' resumed.")

    def cancel_campaign(self, campaign_id: str) -> None:
        self._cancelled_campaigns.add(campaign_id)
        self._paused_campaigns.discard(campaign_id)
        if campaign_id in self._running_tasks:
            self._running_tasks[campaign_id].cancel()
        logger.info(f"Campaign '{campaign_id}' cancelled.")

    async def crash_safe_resume(self, campaign_id: Optional[str] = None) -> int:
        """Inspect stale 'dialing' jobs on startup. If call completed, mark completed; else reset to pending."""
        recovered = 0
        async with self.db.session_factory() as session:
            import sqlalchemy as sa
            stmt = sa.select(CampaignContactModel).where(CampaignContactModel.status == "dialing")
            if campaign_id:
                stmt = stmt.where(CampaignContactModel.campaign_id == campaign_id)
            stale_contacts = (await session.execute(stmt)).scalars().all()

            for c in stale_contacts:
                if c.call_id:
                    # Check call status in calls table
                    call_stmt = sa.select(CallModel).where(CallModel.id == c.call_id)
                    call = (await session.execute(call_stmt)).scalar_one_or_none()
                    if call and call.status == "completed":
                        c.status = "completed"
                        c.outcome = call.outcome or "completed"
                        c.summary = call.summary
                    else:
                        # Reset to pending for safe retry without blind double-dialing
                        c.status = "pending"
                else:
                    c.status = "pending"
                c.updated_at = datetime.now(timezone.utc)
                recovered += 1

            if recovered > 0:
                await session.commit()
                logger.info(f"Crash-safe recovery: safely processed {recovered} stale 'dialing' campaign job(s).")
        return recovered

    def is_current_time_allowed_ist(self, start_time_str: str = "09:00", end_time_str: str = "21:00") -> bool:
        """Check if current IST wall-clock time is strictly within allowed calling window."""
        now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET)
        cur_min = now_ist.hour * 60 + now_ist.minute

        try:
            sh, sm = map(int, start_time_str.split(":"))
            eh, em = map(int, end_time_str.split(":"))
        except Exception:
            sh, sm = 9, 0
            eh, em = 21, 0

        allowed_start = sh * 60 + sm
        allowed_end = eh * 60 + em
        return allowed_start <= cur_min < allowed_end

    async def run_campaign(self, campaign_id: str) -> None:
        """Execute campaign jobs concurrently with idempotency, retries, and rate limits."""
        await self.crash_safe_resume(campaign_id)
        campaign = await self.db.get_campaign(campaign_id)
        if not campaign:
            logger.error(f"Cannot run campaign '{campaign_id}': Not found.")
            return

        await self.db.update_campaign_status(campaign_id, "running")
        concurrency = min(campaign.max_concurrency or 5, GLOBAL_CONCURRENCY_LIMIT)
        semaphore = asyncio.Semaphore(concurrency)
        logger.info(f"Starting campaign '{campaign_id}' with concurrency limit={concurrency}.")

        async def _process_contact(contact_id: int):
            if campaign_id in self._cancelled_campaigns:
                return

            # Wait while campaign is paused
            while campaign_id in self._paused_campaigns:
                await asyncio.sleep(1.0)
                if campaign_id in self._cancelled_campaigns:
                    return

            async with semaphore:
                # 1. Fetch contact atomically
                async with self.db.session_factory() as session:
                    import sqlalchemy as sa
                    stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                    contact = (await session.execute(stmt)).scalar_one_or_none()
                    if not contact or contact.status not in ["pending", "queued"]:
                        return

                    phone = contact.phone_number
                    contact.status = "dialing"
                    contact.attempts += 1
                    contact.updated_at = datetime.now(timezone.utc)
                    await session.commit()

                masked = mask_phone(phone)

                # 1b. Campaign budget guard check (stops new calls; active calls finish)
                allowed_budget, budget_reason, _ = await self.cost_controller.check_campaign_budget(campaign_id)
                if not allowed_budget:
                    logger.warning(f"Campaign '{campaign_id}' reached allocated budget: {budget_reason}. Stopping new dials; active calls finish.")
                    self.pause_campaign(campaign_id)
                    await self.db.update_campaign_status(campaign_id, "budget_exceeded")
                    async with self.db.session_factory() as session:
                        stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                        c = (await session.execute(stmt)).scalar_one_or_none()
                        if c:
                            c.status = "pending"
                            await session.commit()
                    return

                # 2. Daily call cap check
                if campaign.calls_made_today >= campaign.max_calls_per_day:
                    logger.warning(f"Campaign '{campaign_id}' reached daily cap ({campaign.max_calls_per_day}). Pausing.")
                    self.pause_campaign(campaign_id)
                    async with self.db.session_factory() as session:
                        stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                        c = (await session.execute(stmt)).scalar_one_or_none()
                        if c:
                            c.status = "pending"
                            await session.commit()
                    return

                # 3. Calling Hours Check (IST)
                allowed_hours = self.is_current_time_allowed_ist(
                    campaign.allowed_hours_start, campaign.allowed_hours_end
                )
                if not allowed_hours:
                    logger.warning(f"Blocked call to {masked}: outside allowed hours ({campaign.allowed_hours_start}-{campaign.allowed_hours_end} IST)")
                    async with self.db.session_factory() as session:
                        stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                        c = (await session.execute(stmt)).scalar_one_or_none()
                        if c:
                            c.status = "blocked"
                            c.blocked_reason = "outside_allowed_hours"
                            await session.commit()
                    return

                # 4. DND Check (Internal table + external hook)
                is_dnd = await self.compliance.check_dnd(phone)
                if not is_dnd and self.dnd_hook:
                    try:
                        res = self.dnd_hook(phone)
                        if asyncio.iscoroutine(res):
                            is_dnd = await res
                        else:
                            is_dnd = bool(res)
                    except Exception as e:
                        logger.error(f"Custom DND hook error for {masked}: {e}")

                if is_dnd:
                    logger.warning(f"Blocked call to {masked}: registered on DND/Do-Not-Call registry")
                    async with self.db.session_factory() as session:
                        stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                        c = (await session.execute(stmt)).scalar_one_or_none()
                        if c:
                            c.status = "blocked"
                            c.blocked_reason = "dnd_registered"
                            await session.commit()
                    return

                # 5. Place Outbound Call
                call_succeeded = False
                call_sid = None
                call_outcome = "failed"
                variables = json.loads(contact.variables_json) if contact.variables_json else {}

                try:
                    call_sid = await self.engine.start_outbound_call(
                        to_number=phone,
                        agent_id=campaign.agent_id,
                        variables=variables,
                    )
                    call_succeeded = True
                    call_outcome = "completed"
                    logger.info(f"Campaign call connected for {masked}: SID={call_sid}")
                except Exception as e:
                    logger.error(f"Campaign call failed for {masked}: {e}")
                    call_outcome = "failed"

                # 6. Update Contact & Retry Handling
                async with self.db.session_factory() as session:
                    stmt = sa.select(CampaignContactModel).where(CampaignContactModel.id == contact_id)
                    c = (await session.execute(stmt)).scalar_one_or_none()
                    if c:
                        c.call_id = call_sid
                        if call_succeeded:
                            c.status = "completed"
                            c.outcome = call_outcome
                        else:
                            # Evaluate Retry Policy
                            if c.attempts < (campaign.retry_max_attempts or 3):
                                c.status = "pending"
                                c.next_attempt_at = datetime.now(timezone.utc) + timedelta(minutes=campaign.retry_gap_minutes or 15)
                                logger.info(f"Scheduled retry {c.attempts}/{campaign.retry_max_attempts} for {masked} in {campaign.retry_gap_minutes}m")
                            else:
                                c.status = "failed"
                                c.outcome = "exhausted_retries"
                                logger.warning(f"Exhausted retries ({c.attempts}) for {masked}. Marked failed.")
                        c.updated_at = datetime.now(timezone.utc)
                    await session.commit()

        # Fetch contacts and loop
        contacts = await self.db.get_campaign_contacts(campaign_id, status=None)
        pending_ids = [c.id for c in contacts if c.status in ["pending", "queued"]]

        tasks = [asyncio.create_task(_process_contact(cid)) for cid in pending_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # Check final status
        final_status = "cancelled" if campaign_id in self._cancelled_campaigns else "completed"
        await self.db.update_campaign_status(campaign_id, final_status)

        # Update metrics and trigger campaign.completed webhook
        all_c = await self.db.get_campaign_contacts(campaign_id)
        completed_count = sum(1 for c in all_c if c.status == "completed")
        failed_count = sum(1 for c in all_c if c.status == "failed")
        blocked_count = sum(1 for c in all_c if c.status == "blocked")

        dispatcher = get_webhook_dispatcher()
        dispatcher.dispatch(
            event_type="campaign.completed",
            payload={
                "campaign_id": campaign_id,
                "name": campaign.name,
                "total_contacts": len(all_c),
                "completed": completed_count,
                "failed": failed_count,
                "blocked": blocked_count,
                "final_status": final_status,
            },
            agent_id=campaign.agent_id,
        )
        logger.info(f"Campaign '{campaign_id}' finished: {completed_count} completed, {failed_count} failed, {blocked_count} blocked.")


_campaign_runner: Optional[CampaignRunner] = None


def get_campaign_runner() -> CampaignRunner:
    """Return singleton CampaignRunner instance."""
    global _campaign_runner
    if _campaign_runner is None:
        _campaign_runner = CampaignRunner()
    return _campaign_runner
