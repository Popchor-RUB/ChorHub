CREATE TYPE "SentEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "sent_emails" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "markdown_content" TEXT NOT NULL,
    "signature_markdown" TEXT NOT NULL DEFAULT '',
    "status" "SentEmailStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sent_email_attachments" (
    "id" TEXT NOT NULL,
    "sent_email_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "sent_email_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sent_emails_status_sent_at_idx" ON "sent_emails"("status", "sent_at");
CREATE INDEX "sent_email_attachments_sent_email_id_idx" ON "sent_email_attachments"("sent_email_id");

ALTER TABLE "sent_email_attachments"
ADD CONSTRAINT "sent_email_attachments_sent_email_id_fkey"
FOREIGN KEY ("sent_email_id") REFERENCES "sent_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
