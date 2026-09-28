-- Add server-side sessions for Prototype 0.1 remote DEV authentication.

CREATE TABLE "user_session" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "csrf_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_session_token_hash_key"
ON "user_session"("token_hash");

CREATE INDEX "user_session_user_id_expires_at_idx"
ON "user_session"("user_id", "expires_at");

ALTER TABLE "user_session"
ADD CONSTRAINT "user_session_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
