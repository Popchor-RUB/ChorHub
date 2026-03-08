-- AlterTable
ALTER TABLE "members" ADD COLUMN     "loginCode" TEXT,
ADD COLUMN     "loginCodeExpiresAt" TIMESTAMP(3);
