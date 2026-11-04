"""Data Retention Policies, Automatic Purging, and Subject Data Export/Deletion."""

from dataclasses import dataclass
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
from agent.logger import setup_logger
from agent.governance.consent import get_consent_manager
from agent.governance.access_control import get_access_controller

logger = setup_logger("governance.retention")


@dataclass
class RetentionPolicy:
    """Retention configuration for organization assets."""
    org_id: str = "default_org"
    recordings_retention_days: int = 30
    transcripts_retention_days: int = 90
    metrics_retention_days: int = 180


class DataGovernanceManager:
    """Orchestrates asset lifecycle, time-based purging, and GDPR/DPDP Right to Erasure."""

    def __init__(
        self,
        recordings_dir: str = "recordings",
        transcripts_dir: str = "transcripts",
        metrics_dir: str = "metrics",
    ) -> None:
        self.recordings_dir = Path(recordings_dir)
        self.transcripts_dir = Path(transcripts_dir)
        self.metrics_dir = Path(metrics_dir)

    def purge_expired_assets(self, policy: Optional[RetentionPolicy] = None) -> Dict[str, int]:
        """Scan disk storage and delete files exceeding retention policy thresholds."""
        pol = policy or RetentionPolicy()
        now = time.time()
        counts = {"recordings_deleted": 0, "transcripts_deleted": 0, "metrics_deleted": 0}

        # 1. Purge recordings
        rec_cutoff = now - (pol.recordings_retention_days * 86400)
        if self.recordings_dir.is_dir():
            for f in self.recordings_dir.glob("*.wav"):
                try:
                    if f.stat().st_mtime < rec_cutoff:
                        f.unlink()
                        counts["recordings_deleted"] += 1
                except Exception as e:
                    logger.warning(f"Error purging recording file {f}: {e}")

        # 2. Purge transcripts
        trx_cutoff = now - (pol.transcripts_retention_days * 86400)
        if self.transcripts_dir.is_dir():
            for f in self.transcripts_dir.glob("session_*.json"):
                try:
                    if f.stat().st_mtime < trx_cutoff:
                        f.unlink()
                        counts["transcripts_deleted"] += 1
                except Exception as e:
                    logger.warning(f"Error purging transcript file {f}: {e}")

        # 3. Purge metrics
        met_cutoff = now - (pol.metrics_retention_days * 86400)
        if self.metrics_dir.is_dir():
            for f in self.metrics_dir.glob("metrics_*.json"):
                try:
                    if f.stat().st_mtime < met_cutoff:
                        f.unlink()
                        counts["metrics_deleted"] += 1
                except Exception as e:
                    logger.warning(f"Error purging metrics file {f}: {e}")

        logger.info(f"Retention purge completed: {counts}")
        return counts

    async def export_data_for_phone(self, phone: str, db: Optional[Any] = None) -> Dict[str, Any]:
        """Export all data stored regarding a specific phone number (Right to Portability/Access)."""
        clean_phone = phone.strip()
        last4 = clean_phone[-4:] if len(clean_phone) >= 4 else clean_phone
        access_ctrl = get_access_controller()
        access_ctrl.log_access("system_admin", "export_data", f"phone_****{last4}")

        consent_mgr = get_consent_manager()
        consents = consent_mgr.get_consents_for_phone(clean_phone)

        calls_data = []
        if db:
            # Look up calls by matching caller_number ending in 10 digits
            from agent.db import CallModel
            import sqlalchemy as sa
            async with db.session_factory() as session:
                stmt = sa.select(CallModel).where(CallModel.caller_number.like(f"%{clean_phone[-10:]}%"))
                calls = (await session.execute(stmt)).scalars().all()
                for c in calls:
                    trx = await db.get_transcripts(c.id)
                    calls_data.append({
                        "call_id": c.id,
                        "created_at": str(c.started_at),
                        "direction": c.direction,
                        "status": c.status,
                        "duration_sec": c.duration_sec,
                        "outcome": c.outcome,
                        "summary": c.summary,
                        "transcripts": [
                            {"speaker": getattr(t, "speaker", getattr(t, "role", "unknown")), "text": t.text, "timestamp": str(getattr(t, "timestamp", ""))}
                            for t in trx
                        ],
                    })

        return {
            "query_phone": f"*********_{last4}",
            "exported_at": time.time(),
            "total_calls_found": len(calls_data),
            "calls": calls_data,
            "consent_records": consents,
        }

    async def delete_data_for_phone(self, phone: str, db: Optional[Any] = None) -> Dict[str, Any]:
        """Delete all stored records, audio files, and transcripts for a phone number (Right to Erasure)."""
        clean_phone = phone.strip()
        last4 = clean_phone[-4:] if len(clean_phone) >= 4 else clean_phone
        access_ctrl = get_access_controller()
        access_ctrl.log_access("system_admin", "delete_data", f"phone_****{last4}")

        deleted_calls_count = 0
        call_ids = []

        if db:
            from agent.db import CallModel, CallTranscriptModel
            import sqlalchemy as sa
            async with db.session_factory() as session:
                stmt = sa.select(CallModel).where(CallModel.caller_number.like(f"%{clean_phone[-10:]}%"))
                calls = (await session.execute(stmt)).scalars().all()
                for c in calls:
                    call_ids.append(c.id)
                    # Delete transcripts & usage for call
                    await session.execute(sa.delete(CallTranscriptModel).where(CallTranscriptModel.call_id == c.id))
                    await session.delete(c)
                    deleted_calls_count += 1
                await session.commit()

        # Delete corresponding physical recordings and transcripts
        deleted_files_count = 0
        for cid in call_ids:
            for p in self.recordings_dir.glob(f"{cid}*"):
                try:
                    p.unlink()
                    deleted_files_count += 1
                except Exception:
                    pass
            for p in self.transcripts_dir.glob(f"*{cid}*"):
                try:
                    p.unlink()
                    deleted_files_count += 1
                except Exception:
                    pass
            for p in self.metrics_dir.glob(f"*{cid}*"):
                try:
                    p.unlink()
                    deleted_files_count += 1
                except Exception:
                    pass

        logger.info(
            f"Subject deletion completed for *********_{last4}: {deleted_calls_count} DB records, {deleted_files_count} files removed."
        )

        return {
            "status": "success",
            "phone_masked": f"*********_{last4}",
            "deleted_calls_count": deleted_calls_count,
            "deleted_files_count": deleted_files_count,
            "call_ids_purged": call_ids,
        }


_governance_manager: Optional[DataGovernanceManager] = None


def get_governance_manager() -> DataGovernanceManager:
    global _governance_manager
    if _governance_manager is None:
        _governance_manager = DataGovernanceManager()
    return _governance_manager
