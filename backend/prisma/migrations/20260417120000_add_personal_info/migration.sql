-- CreateTable
CREATE TABLE "personal_info_config" (
  "id" TEXT NOT NULL,
  "markdownTemplate" TEXT NOT NULL,
  "emailSubject" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "personal_info_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_info_entries" (
  "id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "markdownContent" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "personal_info_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_info_entries_member_id_key" ON "personal_info_entries"("member_id");

-- AddForeignKey
ALTER TABLE "personal_info_entries"
ADD CONSTRAINT "personal_info_entries_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
