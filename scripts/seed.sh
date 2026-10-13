#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to the Supabase PostgreSQL connection string."
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL psql is required."
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed/development.sql
