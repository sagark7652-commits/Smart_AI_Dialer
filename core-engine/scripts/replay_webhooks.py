#!/usr/bin/env python3
"""Replay failed webhooks from dead-letter table.

Usage:
    python scripts/replay_webhooks.py [--limit 50] [--dry-run]
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import time
import httpx
import sqlalchemy as sa
from agent.db import get_db, WebhookDeadLetterModel, WebhookConfigModel
from agent.config import get_settings


async def replay_dead_letter_webhooks(limit: int = 50, dry_run: bool = False):
    db = get_db()
    await db.init_db()
    settings = get_settings()

    async with db.session_factory() as session:
        stmt = sa.select(WebhookDeadLetterModel).order_by(WebhookDeadLetterModel.created_at.desc()).limit(limit)
        failed_items = (await session.execute(stmt)).scalars().all()

        if not failed_items:
            print("[INFO] No failed webhooks found in dead-letter table.")
            return

        print(f"[INFO] Found {len(failed_items)} dead-letter webhook(s) to process. Dry-run: {dry_run}")
        replayed_success = 0
        replayed_failed = 0

        for item in failed_items:
            url = item.url
            payload_str = item.payload_json
            event_type = item.event_type

            # Find signing secret for URL
            stmt_cfg = sa.select(WebhookConfigModel).where(WebhookConfigModel.url == url)
            cfg = (await session.execute(stmt_cfg)).scalar_one_or_none()
            secret = cfg.signing_secret if cfg else settings.webhook_secret

            timestamp = int(time.time())
            sig = hmac.new(
                secret.encode("utf-8"),
                f"{timestamp}.{payload_str}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            headers = {
                "Content-Type": "application/json",
                "X-Webhook-Signature": f"t={timestamp},v1={sig}",
                "X-Webhook-Timestamp": str(timestamp),
                "X-Idempotency-Key": f"replay_{item.idempotency_key}_{int(time.time())}",
                "User-Agent": "CoreCallingAgent-WebhookReplayer/1.0",
            }

            if dry_run:
                print(f"  [DRY-RUN] Would re-send event {event_type} (ID: {item.id}) to {url}")
                continue

            success = False
            last_err = ""
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, content=payload_str, headers=headers)
                    if 200 <= resp.status_code < 300:
                        success = True
                    else:
                        last_err = f"HTTP {resp.status_code}: {resp.text[:120]}"
            except Exception as e:
                last_err = str(e)

            if success:
                print(f"  [SUCCESS] Replayed event {event_type} (ID: {item.id}) to {url}")
                await session.delete(item)
                replayed_success += 1
            else:
                print(f"  [STILL FAILED] Event {event_type} (ID: {item.id}) to {url}: {last_err}")
                item.last_error = f"Replay failed: {last_err}"
                item.attempts += 1
                replayed_failed += 1

        if not dry_run:
            await session.commit()
            print(f"\n[SUMMARY] Replay complete: {replayed_success} succeeded (removed from DLQ), {replayed_failed} failed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Replay dead-letter webhooks")
    parser.add_argument("--limit", type=int, default=50, help="Max entries to replay")
    parser.add_argument("--dry-run", action="store_true", help="Simulate replay without sending HTTP requests")
    args = parser.parse_args()

    asyncio.run(replay_dead_letter_webhooks(limit=args.limit, dry_run=args.dry_run))
