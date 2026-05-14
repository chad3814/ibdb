-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "asin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Edition_asin_key" ON "Edition"("asin");
