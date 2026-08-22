-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "passwordHash" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "householdId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "alertEmail" BOOLEAN NOT NULL DEFAULT false,
    "focusTicketIds" TEXT,
    CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("color", "createdAt", "email", "emailVerified", "focusTicketIds", "householdId", "id", "image", "name", "passwordHash", "updatedAt") SELECT "color", "createdAt", "email", "emailVerified", "focusTicketIds", "householdId", "id", "image", "name", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AlertDelivery_createdAt_idx" ON "AlertDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_userId_alertKey_channel_key" ON "AlertDelivery"("userId", "alertKey", "channel");
