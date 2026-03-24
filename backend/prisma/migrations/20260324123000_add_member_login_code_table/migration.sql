-- Replace single loginCode columns on members with one-time, expiring login codes table.
-- This allows multiple concurrent valid codes per member.

CREATE TABLE "member_login_codes" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "hashedCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "member_login_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_login_codes_memberId_hashedCode_idx" ON "member_login_codes"("memberId", "hashedCode");
CREATE INDEX "member_login_codes_expiresAt_idx" ON "member_login_codes"("expiresAt");

ALTER TABLE "member_login_codes"
ADD CONSTRAINT "member_login_codes_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "members"
DROP COLUMN "loginCode",
DROP COLUMN "loginCodeExpiresAt";
