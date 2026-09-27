ALTER TABLE "members"
ADD COLUMN "is_disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "disabled_at" TIMESTAMP(3),
ADD COLUMN "disable_reason" TEXT;

CREATE TABLE "member_disable_notices" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "member_email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "disable_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_disable_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_disable_notices_sent_at_next_attempt_at_idx"
ON "member_disable_notices"("sent_at", "next_attempt_at");

ALTER TABLE "member_disable_notices"
ADD CONSTRAINT "member_disable_notices_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
