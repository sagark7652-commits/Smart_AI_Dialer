"""CLI tool for bulk importing and managing Do-Not-Disturb (DND) phone numbers.

Usage:
  python scripts/import_dnd.py import <csv_file> [--reason <reason>]
  python scripts/import_dnd.py list
  python scripts/import_dnd.py check <phone_number>
"""

import argparse
import asyncio
import csv
from pathlib import Path
import re
import sys
from typing import Optional

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.db import get_db

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def normalize_phone(raw: str) -> Optional[str]:
    """Clean and normalize phone number to E.164-like standard (+91...)."""
    digits = re.sub(r"[^\d+]", "", raw.strip())
    if not digits:
        return None
    if digits.startswith("+"):
        return digits
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return digits


async def import_csv(file_path: str, default_reason: str = "CSV DND Import") -> None:
    path = Path(file_path)
    if not path.is_file():
        print(f"[ERROR] File not found: {file_path}")
        sys.exit(1)

    db = get_db()
    await db.init_db()

    total = 0
    added = 0
    skipped = 0
    invalid = 0

    print(f"[*] Reading DND records from {file_path}...")
    with open(path, mode="r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        
        # Check if header has column names
        phone_idx = 0
        reason_idx = -1
        if header:
            lower_headers = [h.strip().lower() for h in header]
            for idx, col in enumerate(lower_headers):
                if col in ("phone", "phone_number", "number", "mobile", "contact"):
                    phone_idx = idx
                elif col in ("reason", "remarks", "note"):
                    reason_idx = idx

            # If first row was actually data (e.g. numeric), process it
            first_col_clean = re.sub(r"[^\d+]", "", header[0])
            if len(first_col_clean) >= 10:
                total += 1
                norm = normalize_phone(header[0])
                if norm:
                    reason = header[reason_idx] if reason_idx != -1 and len(header) > reason_idx else default_reason
                    is_existing = await db.is_dnd(norm)
                    if is_existing:
                        skipped += 1
                    else:
                        await db.add_dnd(norm, reason)
                        added += 1
                else:
                    invalid += 1

        for row in reader:
            if not row or not any(row):
                continue
            total += 1
            raw_phone = row[phone_idx] if len(row) > phone_idx else row[0]
            norm = normalize_phone(raw_phone)
            if not norm or len(norm) < 10:
                invalid += 1
                continue

            reason = row[reason_idx].strip() if reason_idx != -1 and len(row) > reason_idx and row[reason_idx].strip() else default_reason

            is_existing = await db.is_dnd(norm)
            if is_existing:
                skipped += 1
            else:
                await db.add_dnd(norm, reason)
                added += 1

    print("\n" + "=" * 55)
    print("            DND CSV IMPORT COMPLETED             ")
    print("=" * 55)
    print(f"Total Rows Scanned : {total}")
    print(f"Added to DND       : {added}")
    print(f"Already Registered : {skipped}")
    print(f"Invalid Rows       : {invalid}")
    print("=" * 55)


async def check_phone(phone: str) -> None:
    db = get_db()
    await db.init_db()
    norm = normalize_phone(phone)
    if not norm:
        print("[ERROR] Invalid phone number provided.")
        return

    is_blocked = await db.is_dnd(norm)
    status_label = "[BLOCKED / DND ACTIVE]" if is_blocked else "[ALLOWED / NOT ON DND]"
    print(f"Phone   : {norm}")
    print(f"Status  : {status_label}")


async def main():
    parser = argparse.ArgumentParser(description="DND Registry CSV Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # import
    import_p = subparsers.add_parser("import", help="Import DND numbers from CSV")
    import_p.add_argument("file", help="Path to CSV file")
    import_p.add_argument("--reason", default="CSV DND Bulk Import", help="Default reason for DND entry")

    # check
    check_p = subparsers.add_parser("check", help="Check if a phone number is on DND")
    check_p.add_argument("phone", help="Phone number to check")

    args = parser.parse_args()

    if args.command == "import":
        await import_csv(args.file, args.reason)
    elif args.command == "check":
        await check_phone(args.phone)


if __name__ == "__main__":
    asyncio.run(main())
