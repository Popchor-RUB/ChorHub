-- CreateTable
CREATE TABLE "voice_admin_grants" (
    "memberId" TEXT NOT NULL,
    "choirVoiceId" TEXT NOT NULL,

    CONSTRAINT "voice_admin_grants_pkey" PRIMARY KEY ("memberId", "choirVoiceId")
);

-- AddForeignKey
ALTER TABLE "voice_admin_grants"
ADD CONSTRAINT "voice_admin_grants_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_admin_grants"
ADD CONSTRAINT "voice_admin_grants_choirVoiceId_fkey"
FOREIGN KEY ("choirVoiceId") REFERENCES "choir_voices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
