ALTER TABLE "app_user" ADD COLUMN "password_hash" TEXT;

CREATE TABLE "auth_session" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_session_token_hash_key" ON "auth_session"("token_hash");
CREATE INDEX "auth_session_user_id_idx" ON "auth_session"("user_id");
CREATE INDEX "auth_session_expires_at_idx" ON "auth_session"("expires_at");
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
