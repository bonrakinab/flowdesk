-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "externalId" TEXT,
    "externalSource" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "householdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "calendarId" TEXT;

-- CreateIndex
CREATE INDEX "Calendar_householdId_idx" ON "Calendar"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_householdId_externalSource_externalId_key" ON "Calendar"("householdId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarId_externalId_idx" ON "CalendarEvent"("calendarId", "externalId");

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
