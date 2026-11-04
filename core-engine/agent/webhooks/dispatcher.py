"""Result Webhook Dispatcher with HMAC-SHA256 signature, retry & dead-letter queue."""

import asyncio
import hashlib
import hmac
import json
import time
import uuid
from typing import Any, Dict, List, Optional
import httpx
from agent.config import get_settings
from agent.db import (
    get_db,
    WebhookConfigModel,
    WebhookEventModel,
    WebhookDeadLetterModel,
)
from agent.logger import setup_logger

logger = setup_logger("webhooks.dispatcher")


def compute_hmac_signature(*args, **kwargs) -> str:
    """Generate HMAC-SHA256 signature supporting both (payload, secret) and (secret, timestamp, payload_str)."""
    if len(args) == 2:
        payload, secret = args
        p_bytes = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")
        s_bytes = secret if isinstance(secret, bytes) else str(secret).encode("utf-8")
        return hmac.new(s_bytes, p_bytes, hashlib.sha256).hexdigest()
    elif len(args) >= 3:
        secret, timestamp, payload_str = args[0], args[1], args[2]
        signed_data = f"{timestamp}.{payload_str}".encode("utf-8")
        s_bytes = secret if isinstance(secret, bytes) else str(secret).encode("utf-8")
        return hmac.new(s_bytes, signed_data, hashlib.sha256).hexdigest()
    raise TypeError("compute_hmac_signature requires (payload, secret) or (secret, timestamp, payload_str)")


def verify_hmac_signature(*args, **kwargs) -> bool:
    """Verify HMAC signature supporting both (payload, sig, secret) and (secret, timestamp, payload, sig, [tolerance])."""
    if len(args) == 3:
        payload_bytes, signature_header, secret = args
        p_bytes = payload_bytes if isinstance(payload_bytes, bytes) else str(payload_bytes).encode("utf-8")
        clean_sig = str(signature_header)
        if clean_sig.startswith("sha256="):
            clean_sig = clean_sig[7:]
        expected = compute_hmac_signature(p_bytes, secret)
        return hmac.compare_digest(expected, clean_sig)
    elif len(args) >= 4:
        secret, timestamp, payload_str, provided_signature = args[0], args[1], args[2], args[3]
        tolerance_sec = args[4] if len(args) > 4 else kwargs.get("tolerance_sec", 300)
        now = int(time.time())
        if abs(now - timestamp) > tolerance_sec:
            logger.warning(f"Webhook signature rejected: timestamp {timestamp} out of tolerance ({now})")
            return False
        clean_sig = str(provided_signature)
        if clean_sig.startswith("sha256="):
            clean_sig = clean_sig[7:]
        expected_sig = compute_hmac_signature(secret, timestamp, payload_str)
        return hmac.compare_digest(expected_sig, clean_sig)
    raise TypeError("verify_hmac_signature requires 3 or 4+ positional arguments")


class WebhookDispatcher:
    """Asynchronous, resilient Webhook Dispatcher for call and campaign lifecycle events."""

    MAX_RETRIES = 5
    BACKOFF_DELAYS = [0.2, 0.5, 1.0, 2.0, 4.0]  # Exponential backoff in seconds

    def __init__(self) -> None:
        self.settings = get_settings()

    def generate_signature(self, secret: str, timestamp: int, payload_str: str) -> str:
        """Generate HMAC-SHA256 signature formatted as v1 hex."""
        return compute_hmac_signature(secret, timestamp, payload_str)

    def verify_signature(
        self,
        secret: str,
        timestamp: int,
        payload_str: str,
        provided_signature: str,
        tolerance_sec: int = 300,
    ) -> bool:
        """Verify incoming webhook HMAC signature and enforce timestamp freshness."""
        return verify_hmac_signature(
            secret, timestamp, payload_str, provided_signature, tolerance_sec
        )

    def mask_phone_number(self, phone: Optional[str]) -> str:
        """Mask phone number preserving only the last 4 digits per compliance rules."""
        if not phone:
            return "XXXX"
        clean = str(phone).strip()
        if len(clean) <= 4:
            return clean
        return f"{'*' * (len(clean) - 4)}{clean[-4:]}"

    async def get_configs_for_event(
        self, agent_id: Optional[str] = None, api_key_id: Optional[int] = None
    ) -> List[Dict[str, str]]:
        """Retrieve active webhook targets for given agent or API key."""
        db = get_db()
        targets = []
        try:
            async with db.session_factory() as session:
                import sqlalchemy as sa
                stmt = sa.select(WebhookConfigModel).where(WebhookConfigModel.is_active == True)
                if agent_id:
                    stmt = stmt.where(
                        (WebhookConfigModel.agent_id == agent_id) | (WebhookConfigModel.agent_id.is_(None))
                    )
                configs = (await session.execute(stmt)).scalars().all()
                for c in configs:
                    targets.append({
                        "url": c.url,
                        "signing_secret": c.signing_secret,
                        "events": json.loads(c.events) if c.events else [],
                    })
        except Exception as e:
            logger.warning(f"Could not load webhook configs from DB: {e}")

        # Fallback to system default webhook if configured in environment
        default_url = getattr(self.settings, "result_webhook_url", None)
        default_secret = getattr(self.settings, "webhook_secret", "calling-agent-hmac-secret-key")
        if default_url and not any(t["url"] == default_url for t in targets):
            targets.append({
                "url": default_url,
                "signing_secret": default_secret,
                "events": ["call.started", "call.ended", "lead.captured", "callback.scheduled", "campaign.completed"],
            })

        return targets

    def dispatch(
        self,
        event_type: str,
        payload: Dict[str, Any],
        agent_id: Optional[str] = None,
        call_id: Optional[str] = None,
        api_key_id: Optional[int] = None,
        idempotency_key: Optional[str] = None,
    ) -> None:
        """Fire-and-forget dispatch ensuring webhook processing NEVER affects an active call."""
        try:
            asyncio.create_task(
                self._dispatch_async(
                    event_type=event_type,
                    payload=payload,
                    agent_id=agent_id,
                    call_id=call_id,
                    api_key_id=api_key_id,
                    idempotency_key=idempotency_key or str(uuid.uuid4()),
                )
            )
        except Exception as e:
            logger.error(f"Failed to schedule webhook dispatch task: {e}")

    async def _dispatch_async(
        self,
        event_type: str,
        payload: Dict[str, Any],
        agent_id: Optional[str],
        call_id: Optional[str],
        api_key_id: Optional[int],
        idempotency_key: str,
    ) -> None:
        """Internal asynchronous handler sending webhooks with signature and 5 retries."""
        targets = await self.get_configs_for_event(agent_id=agent_id, api_key_id=api_key_id)
        if not targets:
            logger.debug(f"No active webhook targets configured for event '{event_type}'.")
            return

        # Build standardized event envelope
        timestamp = int(time.time())
        envelope = {
            "id": idempotency_key,
            "event": event_type,
            "timestamp": timestamp,
            "agent_id": agent_id,
            "call_id": call_id,
            "data": payload,
        }
        payload_str = json.dumps(envelope, ensure_ascii=False)

        for target in targets:
            allowed_events = target.get("events", [])
            if allowed_events and event_type not in allowed_events:
                continue

            url = target["url"]
            secret = target["signing_secret"]
            sig = self.generate_signature(secret, timestamp, payload_str)

            headers = {
                "Content-Type": "application/json",
                "X-Webhook-Signature": f"t={timestamp},v1={sig}",
                "X-Webhook-Timestamp": str(timestamp),
                "X-Idempotency-Key": idempotency_key,
                "User-Agent": "CoreCallingAgent-Webhook/1.0",
            }

            # Record event in DB
            db = get_db()
            event_id = None
            try:
                async with db.session_factory() as session:
                    ev = WebhookEventModel(
                        event_type=event_type,
                        idempotency_key=f"{idempotency_key}_{hashlib.md5(url.encode()).hexdigest()[:8]}",
                        agent_id=agent_id,
                        call_id=call_id,
                        url=url,
                        payload_json=payload_str,
                        status="pending",
                        attempts=0,
                    )
                    session.add(ev)
                    await session.commit()
                    event_id = ev.id
            except Exception as dbe:
                logger.debug(f"Note recording initial webhook event: {dbe}")

            # Execute up to 5 attempts with exponential backoff
            delivered = False
            last_err = ""
            for attempt in range(1, self.MAX_RETRIES + 1):
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        resp = await client.post(url, content=payload_str, headers=headers)
                        if 200 <= resp.status_code < 300:
                            delivered = True
                            logger.info(
                                f"Webhook {event_type} delivered to {url} (attempt {attempt}, HTTP {resp.status_code})"
                            )
                            break
                        else:
                            last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                            logger.warning(
                                f"Webhook attempt {attempt} failed for {url}: {last_err}"
                            )
                except Exception as e:
                    last_err = str(e)
                    logger.warning(f"Webhook attempt {attempt} exception for {url}: {last_err}")

                if attempt < self.MAX_RETRIES:
                    delay = self.BACKOFF_DELAYS[attempt - 1]
                    await asyncio.sleep(delay)

            # Update status or record in Dead Letter table
            try:
                async with db.session_factory() as session:
                    import sqlalchemy as sa
                    if event_id:
                        stmt = sa.select(WebhookEventModel).where(WebhookEventModel.id == event_id)
                        ev = (await session.execute(stmt)).scalar_one_or_none()
                        if ev:
                            ev.attempts = attempt
                            ev.status = "delivered" if delivered else "failed"
                            ev.last_error = None if delivered else last_err
                            if delivered:
                                ev.delivered_at = sa.func.now()

                    if not delivered:
                        dl = WebhookDeadLetterModel(
                            event_id=event_id,
                            event_type=event_type,
                            idempotency_key=idempotency_key,
                            url=url,
                            payload_json=payload_str,
                            attempts=attempt,
                            last_error=last_err,
                        )
                        session.add(dl)
                        logger.error(f"Webhook {event_type} exhausted 5 attempts. Stored in dead-letter table: {url}")

                    await session.commit()
            except Exception as dbe:
                logger.error(f"Error updating webhook completion status in DB: {dbe}")


_dispatcher_instance: Optional[WebhookDispatcher] = None


def get_webhook_dispatcher() -> WebhookDispatcher:
    """Return singleton WebhookDispatcher instance."""
    global _dispatcher_instance
    if _dispatcher_instance is None:
        _dispatcher_instance = WebhookDispatcher()
    return _dispatcher_instance
