"""Cross-platform database backup utility for SQLite and PostgreSQL.

Usage:
  python scripts/backup.py [--dest <backup_dir>] [--retention-days <days>]
"""

import argparse
from datetime import datetime, timezone
import gzip
import os
from pathlib import Path
import shutil
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings


def backup_database(dest_dir: str = "backups", retention_days: int = 14) -> None:
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    settings = get_settings()
    db_url = settings.database_url

    print(f"[*] Starting database backup for: {db_url}")

    # SQLite
    if "sqlite" in db_url:
        db_path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        source_file = Path(db_path)
        if not source_file.is_file():
            print(f"[!] Warning: SQLite database file not found at {source_file}")
            return

        target_file = dest / f"sqlite_backup_{timestamp}.db.gz"
        with open(source_file, "rb") as f_in:
            with gzip.open(target_file, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
        print(f"[+] SQLite compressed backup saved to: {target_file}")

    # PostgreSQL
    elif "postgres" in db_url:
        pg_dest = dest / f"pg_dump_{timestamp}.sql.gz"
        print(f"[*] Running pg_dump to {pg_dest}...")
        res = os.system(f"pg_dump \"{db_url}\" | gzip > \"{pg_dest}\"")
        if res == 0:
            print(f"[+] PostgreSQL dump saved to: {pg_dest}")
        else:
            print(f"[!] pg_dump failed with exit code: {res}")

    # Clean old backups
    print(f"[*] Enforcing {retention_days}-day backup retention...")
    now = datetime.now(timezone.utc).timestamp()
    cutoff_sec = retention_days * 86400

    for item in dest.glob("*.*.gz"):
        file_age = now - item.stat().st_mtime
        if file_age > cutoff_sec:
            item.unlink()
            print(f"  - Purged expired backup: {item.name}")

    print("[+] Database backup and rotation finished successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calling Agent DB Backup Utility")
    parser.add_argument("--dest", default="backups", help="Destination folder for backups")
    parser.add_argument("--retention-days", type=int, default=14, help="Retention period in days")
    args = parser.parse_args()
    backup_database(dest_dir=args.dest, retention_days=args.retention_days)
