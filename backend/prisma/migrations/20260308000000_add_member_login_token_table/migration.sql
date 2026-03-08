-- CreateTable: member_login_tokens
-- Replaces the single loginToken column on members with a dedicated table,
-- allowing multiple permanent tokens per member.

CREATE TABLE "member_login_tokens" (
    "id"          TEXT NOT NULL,
    "memberId"    TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_login_tokens_pkey" PRIMARY KEY ("id")
);

-- Migrate existing tokens from members.loginToken into the new table
INSERT INTO "member_login_tokens" ("id", "memberId", "hashedToken", "createdAt")
SELECT gen_random_uuid()::text, "id", "loginToken", CURRENT_TIMESTAMP
FROM "members"
WHERE "loginToken" IS NOT NULL;

-- UniqueIndex on hashedToken
CREATE UNIQUE INDEX "member_login_tokens_hashedToken_key" ON "member_login_tokens"("hashedToken");

-- AddForeignKey
ALTER TABLE "member_login_tokens" ADD CONSTRAINT "member_login_tokens_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn loginToken from members
ALTER TABLE "members" DROP COLUMN "loginToken";
