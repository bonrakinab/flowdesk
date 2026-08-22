-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alertSms" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "householdId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reminder_householdId_remindAt_idx" ON "Reminder"("householdId", "remindAt");
CREATE INDEX IF NOT EXISTS "Reminder_userId_remindAt_idx" ON "Reminder"("userId", "remindAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
