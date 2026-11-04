"""Cost Control and Budget Enforcement System."""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
import sqlalchemy as sa

from agent.db import DatabaseManager, APIKeyModel, CampaignModel, UsageRecord
from agent.webhooks.dispatcher import WebhookDispatcher

logger = logging.getLogger("agent.cost_controller")

USD_TO_INR = 83.0


class CostController:
    """Monitors and enforces per-call, per-API-key, and per-campaign financial limits."""

    def __init__(self, db: Optional[DatabaseManager] = None) -> None:
        self.db = db or DatabaseManager()
        self.webhook_dispatcher = WebhookDispatcher()
        self._alerted_keys: set = set()

    async def check_api_key_limits(
        self, api_key_id: int
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Check if the API key has exceeded its daily or monthly limits.
        Returns:
            (allowed: bool, reason_if_blocked: Optional[str], warning_alert: Optional[Dict[str, Any]])
        """
        async with self.db.session_factory() as session:
            key = (
                await session.execute(
                    sa.select(APIKeyModel).where(APIKeyModel.id == api_key_id)
                )
            ).scalar_one_or_none()

            if not key or not key.is_active:
                return True, None, None

            now = datetime.now(timezone.utc)
            today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
            month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

            # Daily stats
            stmt_daily = sa.select(
                sa.func.count(UsageRecord.id),
                sa.func.coalesce(sa.func.sum(UsageRecord.call_duration_sec), 0.0),
                sa.func.coalesce(sa.func.sum(UsageRecord.estimated_cost_usd), 0.0),
            ).where(
                UsageRecord.api_key_id == api_key_id,
                UsageRecord.created_at >= today_start,
            )
            daily_res = (await session.execute(stmt_daily)).one()
            daily_calls = daily_res[0]
            daily_minutes = daily_res[1] / 60.0
            daily_cost = daily_res[2]

            # Monthly stats
            stmt_monthly = sa.select(
                sa.func.count(UsageRecord.id),
                sa.func.coalesce(sa.func.sum(UsageRecord.call_duration_sec), 0.0),
                sa.func.coalesce(sa.func.sum(UsageRecord.estimated_cost_usd), 0.0),
            ).where(
                UsageRecord.api_key_id == api_key_id,
                UsageRecord.created_at >= month_start,
            )
            monthly_res = (await session.execute(stmt_monthly)).one()
            monthly_calls = monthly_res[0]
            monthly_minutes = monthly_res[1] / 60.0
            monthly_cost = monthly_res[2]

            # Hard stop checks (100%)
            if key.daily_max_calls is not None and daily_calls >= key.daily_max_calls:
                return False, f"Daily call limit reached ({daily_calls}/{key.daily_max_calls})", None
            if key.daily_max_minutes is not None and daily_minutes >= key.daily_max_minutes:
                return False, f"Daily duration limit reached ({daily_minutes:.1f}/{key.daily_max_minutes:.1f} mins)", None
            if key.daily_max_cost_usd is not None and daily_cost >= key.daily_max_cost_usd:
                return False, f"Daily cost limit reached (${daily_cost:.2f}/${key.daily_max_cost_usd:.2f})", None

            if key.monthly_max_calls is not None and monthly_calls >= key.monthly_max_calls:
                return False, f"Monthly call limit reached ({monthly_calls}/{key.monthly_max_calls})", None
            if key.monthly_max_minutes is not None and monthly_minutes >= key.monthly_max_minutes:
                return False, f"Monthly duration limit reached ({monthly_minutes:.1f}/{key.monthly_max_minutes:.1f} mins)", None
            if key.monthly_max_cost_usd is not None and monthly_cost >= key.monthly_max_cost_usd:
                return False, f"Monthly cost limit reached (${monthly_cost:.2f}/${key.monthly_max_cost_usd:.2f})", None

            # Warning threshold checks (80%)
            warning_info = None
            checks = [
                ("daily_cost", daily_cost, key.daily_max_cost_usd),
                ("daily_minutes", daily_minutes, key.daily_max_minutes),
                ("daily_calls", daily_calls, key.daily_max_calls),
                ("monthly_cost", monthly_cost, key.monthly_max_cost_usd),
                ("monthly_minutes", monthly_minutes, key.monthly_max_minutes),
                ("monthly_calls", monthly_calls, key.monthly_max_calls),
            ]
            for metric, current, limit in checks:
                if limit and current >= (0.8 * limit):
                    alert_key = f"{api_key_id}:{metric}:{now.date()}"
                    pct = round((current / limit) * 100, 1)
                    warning_info = {
                        "api_key_id": api_key_id,
                        "metric": metric,
                        "current": round(current, 2) if isinstance(current, float) else current,
                        "limit": limit,
                        "percentage": pct,
                    }
                    if alert_key not in self._alerted_keys:
                        self._alerted_keys.add(alert_key)
                        logger.warning(
                            f"[COST_ALERT_80] API Key ID {api_key_id} reached {pct}% of limit '{metric}' ({current}/{limit})"
                        )
                        try:
                            import asyncio
                            asyncio.create_task(
                                self.webhook_dispatcher.dispatch(
                                    event_type="cost.limit_warning",
                                    payload=warning_info,
                                )
                            )
                        except Exception as e:
                            logger.error(f"Error dispatching cost warning webhook: {e}")
                    break

            return True, None, warning_info

    async def check_campaign_budget(
        self, campaign_id: str
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Check if campaign has exceeded its allocated budget.
        Returns:
            (allowed: bool, reason_if_blocked: Optional[str], warning_alert: Optional[Dict[str, Any]])
        """
        async with self.db.session_factory() as session:
            camp = (
                await session.execute(
                    sa.select(CampaignModel).where(CampaignModel.id == campaign_id)
                )
            ).scalar_one_or_none()

            if not camp:
                return True, None, None

            # Get total campaign cost so far from usage_records
            stmt_cost = sa.select(
                sa.func.coalesce(sa.func.sum(UsageRecord.estimated_cost_usd), 0.0)
            ).where(UsageRecord.campaign_id == campaign_id)
            cost_usd = float(
                (await session.execute(stmt_cost)).scalar() or camp.estimated_cost_usd or 0.0
            )

            budget_usd = camp.budget_usd or (camp.budget_inr / USD_TO_INR if camp.budget_inr else None)
            if not budget_usd or budget_usd <= 0:
                return True, None, None

            # Hard stop (100%)
            if cost_usd >= budget_usd:
                return False, f"Campaign budget reached (${cost_usd:.2f} >= ${budget_usd:.2f})", None

            # Warning (80%)
            warning_info = None
            if cost_usd >= (0.8 * budget_usd):
                alert_key = f"camp:{campaign_id}:budget"
                pct = round((cost_usd / budget_usd) * 100, 1)
                warning_info = {
                    "campaign_id": campaign_id,
                    "cost_usd": round(cost_usd, 4),
                    "cost_inr": round(cost_usd * USD_TO_INR, 2),
                    "budget_usd": budget_usd,
                    "budget_inr": round(budget_usd * USD_TO_INR, 2),
                    "percentage": pct,
                }
                if alert_key not in self._alerted_keys:
                    self._alerted_keys.add(alert_key)
                    logger.warning(
                        f"[COST_ALERT_80] Campaign {campaign_id} reached {pct}% of budget (${cost_usd:.2f}/${budget_usd:.2f})"
                    )
                    try:
                        import asyncio
                        asyncio.create_task(
                            self.webhook_dispatcher.dispatch(
                                event_type="campaign.budget_warning",
                                payload=warning_info,
                            )
                        )
                    except Exception as e:
                        logger.error(f"Error dispatching campaign warning webhook: {e}")

            return True, None, warning_info
