ALTER TYPE "SentEmailStatus" ADD VALUE 'SENDING';
ALTER TYPE "SentEmailStatus" ADD VALUE 'UNKNOWN';

CREATE TYPE "SentEmailKind" AS ENUM ('BULK', 'TEST');

ALTER TABLE "sent_emails"
  ADD COLUMN "kind" "SentEmailKind" NOT NULL DEFAULT 'BULK',
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "payload_hash" TEXT,
  ADD COLUMN "recipients" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "processing_token" TEXT,
  ADD COLUMN "heartbeat_at" TIMESTAMP(3),
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "retry_source_id" TEXT;

UPDATE "sent_emails"
SET "status" = 'UNKNOWN', "failure_code" = 'LEGACY_PENDING_REQUIRES_REVIEW'
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "sent_emails_idempotency_key_key" ON "sent_emails"("idempotency_key");
CREATE UNIQUE INDEX "sent_emails_retry_source_id_key" ON "sent_emails"("retry_source_id");
CREATE INDEX "sent_emails_status_created_at_idx" ON "sent_emails"("status", "created_at");
CREATE INDEX "sent_emails_status_heartbeat_at_idx" ON "sent_emails"("status", "heartbeat_at");
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_retry_source_id_fkey"
  FOREIGN KEY ("retry_source_id") REFERENCES "sent_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;
