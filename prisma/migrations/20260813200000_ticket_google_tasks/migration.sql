-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "externalSource" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ticket_householdId_dueAt_idx" ON "Ticket"("householdId", "dueAt");

-- CreateIndex (unique when both external fields present; Prisma @@unique allows nulls)
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_householdId_externalSource_externalId_key"
  ON "Ticket"("householdId", "externalSource", "externalId");
