-- CreateTable
CREATE TABLE "IsbnMiss" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isbn13" TEXT NOT NULL,

    CONSTRAINT "IsbnMiss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IsbnMiss_isbn13_key" ON "IsbnMiss"("isbn13");

-- CreateIndex
CREATE INDEX "IsbnMiss_updatedAt_idx" ON "IsbnMiss"("updatedAt");

