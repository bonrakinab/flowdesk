-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tzOffsetMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN IF NOT EXISTS "remindMinutesBefore" INTEGER NOT NULL DEFAULT 15;
