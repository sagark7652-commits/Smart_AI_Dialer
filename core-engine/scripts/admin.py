"""Admin CLI tool for Calling Agent Engine.

Commands:
  python scripts/admin.py create-key --name <name> [--rate-limit <limit>]
  python scripts/admin.py list-keys
  python scripts/admin.py revoke-key <id>
"""

import argparse
import asyncio
import hashlib
from pathlib import Path
import secrets
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.db import get_db

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def hash_key(key: str) -> str:
    """Return SHA-256 hex digest of the raw API key."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


async def create_key(name: str, rate_limit: int = 60) -> None:
    db = get_db()
    await db.init_db()

    raw_token = secrets.token_hex(20)
    api_key = f"ca_live_{raw_token}"
    key_prefix = api_key[:14]
    digest = hash_key(api_key)

    key_record = await db.create_api_key(
        name=name,
        key_hash=digest,
        prefix=key_prefix,
        rate_limit=rate_limit,
    )

    print("\n" + "=" * 65)
    print("           NEW API KEY GENERATED SUCCESSFULLY           ")
    print("=" * 65)
    print(f"ID         : {key_record.id}")
    print(f"Name       : {name}")
    print(f"Prefix     : {key_prefix}...")
    print(f"Rate Limit : {rate_limit} requests/minute")
    print(f"API Key    : {api_key}")
    print("-" * 65)
    print("IMPORTANT: Store this key securely. It is hashed (SHA-256) in the DB")
    print("and cannot be recovered again!")
    print("=" * 65 + "\n")


async def list_keys() -> None:
    db = get_db()
    await db.init_db()
    keys = await db.list_api_keys()

    print("\n" + "=" * 70)
    print(f"{'ID':<4} | {'Name':<22} | {'Prefix':<16} | {'Rate Limit':<10} | {'Active':<6}")
    print("-" * 70)
    if not keys:
        print("No API keys found. Create one with: python scripts/admin.py create-key --name <name>")
    for k in keys:
        active_str = "Yes" if k.is_active else "No"
        print(f"{k.id:<4} | {k.name:<22} | {k.prefix+'...':<16} | {k.rate_limit_per_minute:<10} | {active_str:<6}")
    print("=" * 70 + "\n")


async def revoke_key(key_id: int) -> None:
    db = get_db()
    await db.init_db()
    success = await db.revoke_api_key(key_id)
    if success:
        print(f"\n[+] API Key with ID {key_id} has been revoked successfully.\n")
    else:
        print(f"\n[!] API Key with ID {key_id} not found.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Calling Agent Admin CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-key
    p_create = subparsers.add_parser("create-key", aliases=["create"], help="Generate a new API key")
    p_create.add_argument("--name", required=True, help="Friendly client name or identifier")
    p_create.add_argument("--rate-limit", type=int, default=60, help="Max requests per minute (default 60)")

    # list-keys
    subparsers.add_parser("list-keys", aliases=["list"], help="List existing API keys")

    # revoke-key
    p_revoke = subparsers.add_parser("revoke-key", aliases=["revoke"], help="Revoke an existing API key")
    p_revoke.add_argument("key_id", type=int, help="Numeric ID of the API key to revoke")

    args = parser.parse_args()

    if args.command in ("create-key", "create"):
        asyncio.run(create_key(args.name, args.rate_limit))
    elif args.command in ("list-keys", "list"):
        asyncio.run(list_keys())
    elif args.command in ("revoke-key", "revoke"):
        asyncio.run(revoke_key(args.key_id))


if __name__ == "__main__":
    main()
