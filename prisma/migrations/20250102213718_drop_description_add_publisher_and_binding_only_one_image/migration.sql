/*
  Warnings:

  - You are about to drop the column `description` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the `_BookToImage` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `imageId` to the `Book` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Binding" AS ENUM ('Unknown', 'Paperback', 'Hardcover', 'Ebook', 'Audiobook');

-- DropForeignKey
ALTER TABLE "_BookToImage" DROP CONSTRAINT "_BookToImage_A_fkey";

-- DropForeignKey
ALTER TABLE "_BookToImage" DROP CONSTRAINT "_BookToImage_B_fkey";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "description",
ADD COLUMN     "binding" "Binding" NOT NULL DEFAULT 'Unknown',
ADD COLUMN     "imageId" TEXT NOT NULL,
ADD COLUMN     "publisher" TEXT;

-- DropTable
DROP TABLE "_BookToImage";

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
