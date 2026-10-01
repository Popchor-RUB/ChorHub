CREATE TABLE "mail_templates" (
    "key" TEXT NOT NULL,
    "subject_template" TEXT NOT NULL,
    "html_template" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "sent_emails" ADD COLUMN "rendered_subject" TEXT;
