-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';
