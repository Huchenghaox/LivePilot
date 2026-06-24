#!/usr/bin/env bash
set -euo pipefail

db_path="${SQLITE_DB_PATH:-api/data/live_assistant.db}"
backup_dir="${BACKUP_DIR:-backups}"

if [[ ! -f "$db_path" ]]; then
  printf 'FAIL database not found: %s\n' "$db_path" >&2
  exit 1
fi

mkdir -p "$backup_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
target="$backup_dir/livepilot-$timestamp.sqlite3"
cp "$db_path" "$target"
printf 'PASS backup created: %s\n' "$target"
