-- CreateTable
CREATE TABLE "SearchRateLimit" (
    "clientHash" TEXT NOT NULL,
    "tokens" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRateLimit_pkey" PRIMARY KEY ("clientHash")
);

-- CreateIndex
CREATE INDEX "SearchRateLimit_updatedAt_idx" ON "SearchRateLimit"("updatedAt");

