-- FarmQuest PostgreSQL roles. Passwords are never stored in Git.
-- Run as the PostgreSQL administrative user during environment provisioning.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmquest_owner') THEN
    CREATE ROLE farmquest_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmquest_migrator') THEN
    CREATE ROLE farmquest_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmquest_app') THEN
    CREATE ROLE farmquest_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'farmquest_backup') THEN
    CREATE ROLE farmquest_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT farmquest_owner TO farmquest_migrator;

-- Credentials are injected separately by provisioning/EasyPanel secrets.
-- Do not add ALTER ROLE ... PASSWORD statements to this repository.
