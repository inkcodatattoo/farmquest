#!/bin/sh
set -eu

: "${DATABASE_MIGRATION_URL:?DATABASE_MIGRATION_URL is required}"
: "${PGHOST:?PGHOST is required}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

pnpm --filter @farmquest/database exec prisma migrate deploy \
  --config prisma7.config.ts

psql -v ON_ERROR_STOP=1 \
  -f infra/postgres/bootstrap/grants.sql

echo "FarmQuest migrations and runtime grants applied."
