-- FarmQuest runtime/backup grants. Run after every migration deploy.
-- Must be executed by the schema owner or an administrative provisioning role.

REVOKE ALL ON SCHEMA farmquest FROM PUBLIC;
GRANT USAGE ON SCHEMA farmquest TO farmquest_app, farmquest_backup;

-- Runtime starts from explicit read/write access, then append-only tables are hardened below.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA farmquest TO farmquest_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA farmquest TO farmquest_app;

-- Deletion is exceptional and only allowed for records whose lifecycle requires cleanup.
GRANT DELETE ON TABLE
  farmquest.inventory_item,
  farmquest.idempotency_record,
  farmquest.outbox_message
TO farmquest_app;

-- Economic/audit history is append-only for the runtime role.
REVOKE UPDATE, DELETE ON TABLE
  farmquest.coin_ledger,
  farmquest.item_ledger,
  farmquest.progress_ledger,
  farmquest.community_membership_history
FROM farmquest_app;

-- Backup user is read-only.
GRANT SELECT ON ALL TABLES IN SCHEMA farmquest TO farmquest_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA farmquest TO farmquest_backup;

-- Schema/object creation remains unavailable to runtime and backup roles.
REVOKE CREATE ON SCHEMA farmquest FROM farmquest_app, farmquest_backup;
