/*
  Warnings:

  - A unique constraint covering the columns `[openLibraryIdd]` on the table `Author` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[goodReadsId]` on the table `Author` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hardcoverId]` on the table `Author` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[openLibraryId]` on the table `Book` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[goodReadsId]` on the table `Book` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hardcoverId]` on the table `Book` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Author" ADD COLUMN     "editionId" TEXT,
ADD COLUMN     "goodReadsId" TEXT,
ADD COLUMN     "hardcoverId" INTEGER,
ADD COLUMN     "openLibraryIdd" TEXT;

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "goodReadsId" TEXT,
ADD COLUMN     "hardcoverId" INTEGER,
ADD COLUMN     "openLibraryId" TEXT;

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isbn13" TEXT NOT NULL,
    "longTitle" TEXT,
    "synopsis" TEXT,
    "publicationDate" TEXT,
    "publisher" TEXT,
    "binding" "Binding" NOT NULL DEFAULT 'Unknown',
    "imageId" TEXT,
    "openLibraryId" TEXT,
    "goodReadsId" TEXT,
    "hardcoverId" INTEGER,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Edition_openLibraryId_key" ON "Edition"("openLibraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_goodReadsId_key" ON "Edition"("goodReadsId");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_hardcoverId_key" ON "Edition"("hardcoverId");

-- CreateIndex
CREATE INDEX "Edition_title_idx" ON "Edition"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Author_openLibraryIdd_key" ON "Author"("openLibraryIdd");

-- CreateIndex
CREATE UNIQUE INDEX "Author_goodReadsId_key" ON "Author"("goodReadsId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_hardcoverId_key" ON "Author"("hardcoverId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_openLibraryId_key" ON "Book"("openLibraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_goodReadsId_key" ON "Book"("goodReadsId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_hardcoverId_key" ON "Book"("hardcoverId");

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Edition" ("id", "bookId", "createdAt", "updatedAt", "title", "isbn13", "longTitle", "synopsis", "publicationDate", "publisher", "binding", "imageId") SELECT gen_random_uuid() AS "id", "id" AS "bookId", "createdAt", "updatedAt", "title", "isbn13", "longTitle", "synopsis", "publicationDate", "publisher", "binding", "imageId" FROM "Book";
