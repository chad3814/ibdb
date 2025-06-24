/*
  Warnings:

  - You are about to drop the column `openLibraryIdd` on the `Author` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[openLibraryId]` on the table `Author` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Author_openLibraryIdd_key";

-- AlterTable
ALTER TABLE "Author" DROP COLUMN "openLibraryIdd",
ADD COLUMN     "openLibraryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Author_openLibraryId_key" ON "Author"("openLibraryId");
