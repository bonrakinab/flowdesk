-- CreateTable
CREATE TABLE "Poem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "body" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "mood" TEXT,
    "source" TEXT,
    "doodleData" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Poem_userId_updatedAt_idx" ON "Poem"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Poem" ADD CONSTRAINT "Poem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
