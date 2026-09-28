#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${FARMQUEST_MIGRATOR_DB_PASSWORD:?FARMQUEST_MIGRATOR_DB_PASSWORD is required}"
: "${FARMQUEST_APP_DB_PASSWORD:?FARMQUEST_APP_DB_PASSWORD is required}"
: "${FARMQUEST_BACKUP_DB_PASSWORD:?FARMQUEST_BACKUP_DB_PASSWORD is required}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

psql -v ON_ERROR_STOP=1 \
  -v db_name="$PGDATABASE" \
  -v migrator_password="$FARMQUEST_MIGRATOR_DB_PASSWORD" \
  -v app_password="$FARMQUEST_APP_DB_PASSWORD" \
  -v backup_password="$FARMQUEST_BACKUP_DB_PASSWORD" \
  <<SQL
\i $SCRIPT_DIR/roles.sql

ALTER ROLE farmquest_migrator PASSWORD :'migrator_password';
ALTER ROLE farmquest_app PASSWORD :'app_password';
ALTER ROLE farmquest_backup PASSWORD :'backup_password';

REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name"
  TO farmquest_migrator, farmquest_app, farmquest_backup;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS farmquest AUTHORIZATION farmquest_owner;
ALTER SCHEMA farmquest OWNER TO farmquest_owner;

GRANT USAGE, CREATE ON SCHEMA farmquest TO farmquest_migrator;

ALTER ROLE farmquest_migrator SET search_path = farmquest, pg_catalog;
ALTER ROLE farmquest_app SET search_path = farmquest, pg_catalog;
ALTER ROLE farmquest_backup SET search_path = farmquest, pg_catalog;
SQL

echo "FarmQuest database roles provisioned."
