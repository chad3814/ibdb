/*
  Warnings:

  - You are about to drop the column `editionId` on the `Author` table. All the data in the column will be lost.
  - You are about to drop the column `binding` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `isbn13` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `publicationDate` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `publisher` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `longTitle` on the `Edition` table. All the data in the column will be lost.
  - You are about to drop the column `synopsis` on the `Edition` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Edition` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[isbn13]` on the table `Edition` will be added. If there are existing duplicate values, this will fail.

*/
DELETE FROM "Edition" WHERE "id" in (SELECT e1.id FROM "Edition" as e1 LEFT JOIN "Edition" as e2 USING ("isbn13") WHERE e1.id != e2.id);

-- DropForeignKey
ALTER TABLE "Author" DROP CONSTRAINT "Author_editionId_fkey";

-- DropIndex
DROP INDEX "Edition_title_idx";

-- AlterTable
ALTER TABLE "Author" DROP COLUMN "editionId";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "binding",
DROP COLUMN "isbn13",
DROP COLUMN "publicationDate",
DROP COLUMN "publisher";

-- AlterTable
ALTER TABLE "Edition" DROP COLUMN "longTitle",
DROP COLUMN "synopsis",
DROP COLUMN "title",
ADD COLUMN     "editionName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Edition_isbn13_key" ON "Edition"("isbn13");

-- CreateIndex
CREATE INDEX "Edition_bookId_idx" ON "Edition"("bookId");
