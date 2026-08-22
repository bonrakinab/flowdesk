-- CreateTable
CREATE TABLE "FinanceMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "yearMonth" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'personal',
    "grossPay" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "netPay" REAL NOT NULL DEFAULT 0,
    "income" REAL NOT NULL DEFAULT 0,
    "expense" REAL NOT NULL DEFAULT 0,
    "saved" REAL NOT NULL DEFAULT 0,
    "taxCategory" TEXT NOT NULL DEFAULT 'general',
    "note" TEXT,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceMonth_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceMonth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceMonth_householdId_userId_yearMonth_scope_key" ON "FinanceMonth"("householdId", "userId", "yearMonth", "scope");
