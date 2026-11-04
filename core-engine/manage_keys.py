"""Admin CLI tool for securely creating, listing, and revoking API keys.

Keys are stored strictly hashed (SHA-256) in the database.
Full keys are shown once upon creation and are never logged or stored in plaintext.
"""

import argparse
import asyncio
import hashlib
import secrets
import sys
from agent.db import get_db


def hash_key(key: str) -> str:
    """Return SHA-256 hex digest of the raw API key."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


async def create_key(name: str, rate_limit: int = 60) -> None:
    db = get_db()
    await db.init_db()

    # Generate secure random key with ca_live_ prefix
    raw_token = secrets.token_hex(20)
    api_key = f"ca_live_{raw_token}"
    key_prefix = api_key[:14]  # ca_live_ + 6 chars
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
    print("IMPORTANT: Save this key now. It is hashed in the database and")
    print("cannot be retrieved again!")
    print("=" * 65 + "\n")


async def list_keys() -> None:
    db = get_db()
    await db.init_db()
    keys = await db.list_api_keys()

    print("\n" + "=" * 70)
    print(f"{'ID':<4} | {'Name':<20} | {'Prefix':<16} | {'Rate Limit':<10} | {'Active':<6}")
    print("-" * 70)
    if not keys:
        print("No API keys found. Create one with: python manage_keys.py create --name <name>")
    for k in keys:
        active_str = "Yes" if k.is_active else "No"
        print(f"{k.id:<4} | {k.name:<20} | {k.prefix+'...':<16} | {k.rate_limit_per_minute:<10} | {active_str:<6}")
    print("=" * 70 + "\n")


async def revoke_key(key_id: int) -> None:
    db = get_db()
    await db.init_db()
    success = await db.revoke_api_key(key_id)
    if success:
        print(f"\n[SUCCESS] API key ID {key_id} has been revoked.\n")
    else:
        print(f"\n[ERROR] API key ID {key_id} not found.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Calling Agent API Key Administration")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create
    create_p = subparsers.add_parser("create", help="Create a new API key")
    create_p.add_argument("--name", required=True, help="Descriptive name for the API key")
    create_p.add_argument("--rate-limit", type=int, default=60, help="Per-minute rate limit (default: 60)")

    # list
    subparsers.add_parser("list", help="List all API keys (masked)")

    # revoke
    revoke_p = subparsers.add_parser("revoke", help="Revoke an existing API key")
    revoke_p.add_argument("key_id", type=int, help="Numeric ID of the key to revoke")

    args = parser.parse_args()

    if args.command == "create":
        asyncio.run(create_key(name=args.name, rate_limit=args.rate_limit))
    elif args.command == "list":
        asyncio.run(list_keys())
    elif args.command == "revoke":
        asyncio.run(revoke_key(key_id=args.key_id))


if __name__ == "__main__":
    main()
