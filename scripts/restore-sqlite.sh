#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
db_path="${SQLITE_DB_PATH:-api/data/live_assistant.db}"

if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  printf 'Usage: %s <backup-file>\n' "$0" >&2
  exit 1
fi

printf 'This will replace %s with %s\n' "$db_path" "$backup_file"
printf 'Type RESTORE to continue: '
read -r confirmation
if [[ "$confirmation" != "RESTORE" ]]; then
  printf 'Restore cancelled.\n'
  exit 1
fi

mkdir -p "$(dirname "$db_path")"
cp "$backup_file" "$db_path"
printf 'PASS database restored: %s\n' "$db_path"
