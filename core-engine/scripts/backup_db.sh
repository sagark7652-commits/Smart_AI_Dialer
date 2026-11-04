#!/usr/bin/env bash
# ==============================================================================
# Database Backup Script for Calling Agent Engine
# Supports SQLite (.db) and PostgreSQL dumps with gzip compression & 14-day retention.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/calling-agent}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

# 1. SQLite Backup (if database file exists)
if [ -f "calling_agent.db" ]; then
    echo "[INFO] Starting SQLite backup for calling_agent.db..."
    SQLITE_DEST="${BACKUP_DIR}/sqlite_backup_${TIMESTAMP}.db"
    sqlite3 calling_agent.db ".backup '${SQLITE_DEST}'"
    gzip "${SQLITE_DEST}"
    echo "[SUCCESS] SQLite backup saved: ${SQLITE_DEST}.gz"
fi

# 2. PostgreSQL Backup (if DATABASE_URL is configured)
if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" == postgresql* ]]; then
    echo "[INFO] Starting PostgreSQL pg_dump..."
    PG_DEST="${BACKUP_DIR}/pg_dump_${TIMESTAMP}.sql.gz"
    pg_dump "${DATABASE_URL}" | gzip > "${PG_DEST}"
    echo "[SUCCESS] PostgreSQL dump saved: ${PG_DEST}"
fi

# 3. Clean backups older than 14 days
echo "[INFO] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "*_backup_*.gz" -mtime +"${RETENTION_DAYS}" -delete || true
find "${BACKUP_DIR}" -type f -name "*_dump_*.gz" -mtime +"${RETENTION_DAYS}" -delete || true

echo "[SUCCESS] Database backup rotation completed successfully."
