-- Create the Google Health persistence tables that were added to schema.prisma
-- but never shipped as a Prisma migration.

CREATE TABLE IF NOT EXISTS "FitnessConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_health',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FitnessConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FitnessConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "FitnessData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google_health',
    "steps" INTEGER,
    "distance" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "activeMinutes" INTEGER,
    "heartRateAvg" DOUBLE PRECISION,
    "heartRateMin" DOUBLE PRECISION,
    "heartRateMax" DOUBLE PRECISION,
    "sleepMinutes" INTEGER,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FitnessData_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FitnessData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FitnessConnection_userId_provider_key" ON "FitnessConnection"("userId", "provider");
CREATE INDEX IF NOT EXISTS "FitnessConnection_userId_idx" ON "FitnessConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "FitnessData_userId_date_provider_key" ON "FitnessData"("userId", "date", "provider");
CREATE INDEX IF NOT EXISTS "FitnessData_userId_date_idx" ON "FitnessData"("userId", "date");
