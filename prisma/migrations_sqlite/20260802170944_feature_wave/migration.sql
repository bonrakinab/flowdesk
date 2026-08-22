-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "externalId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "externalSource" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "parentTicketId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "recurEveryDays" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "recurUntil" DATETIME;

-- CreateTable
CREATE TABLE "TicketAssignee" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "userId"),
    CONSTRAINT "TicketAssignee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "limitAmount" REAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'personal',
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceBudget_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "note" TEXT,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudget_householdId_userId_category_scope_key" ON "FinanceBudget"("householdId", "userId", "category", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "CalendarEvent_householdId_externalId_idx" ON "CalendarEvent"("householdId", "externalId");
