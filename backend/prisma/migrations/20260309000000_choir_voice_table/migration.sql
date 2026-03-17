-- CreateTable
CREATE TABLE "choir_voices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "choir_voices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "choir_voices_name_key" ON "choir_voices"("name");

-- Seed default voices
INSERT INTO "choir_voices" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Sopran', 1),
  (gen_random_uuid()::text, 'Mezzosopran', 2),
  (gen_random_uuid()::text, 'Alt', 3),
  (gen_random_uuid()::text, 'Tenor', 4),
  (gen_random_uuid()::text, 'Bariton', 5),
  (gen_random_uuid()::text, 'Bass', 6);

-- AddColumn choir_voice_id to members (nullable)
ALTER TABLE "members" ADD COLUMN "choir_voice_id" TEXT;

-- Data migration: map old enum values to new IDs
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Sopran') WHERE "choirVoice" = 'SOPRAN';
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Mezzosopran') WHERE "choirVoice" = 'MEZZOSOPRAN';
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Alt') WHERE "choirVoice" = 'ALT';
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Tenor') WHERE "choirVoice" = 'TENOR';
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Bariton') WHERE "choirVoice" = 'BARITON';
UPDATE "members" SET "choir_voice_id" = (SELECT "id" FROM "choir_voices" WHERE "name" = 'Bass') WHERE "choirVoice" = 'BASS';

-- Drop old choir_voice column
ALTER TABLE "members" DROP COLUMN "choirVoice";

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_choir_voice_id_fkey" FOREIGN KEY ("choir_voice_id") REFERENCES "choir_voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old enum type
DROP TYPE IF EXISTS "ChoirVoice";
