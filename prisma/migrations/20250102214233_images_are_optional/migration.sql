-- DropForeignKey
ALTER TABLE "Book" DROP CONSTRAINT "Book_imageId_fkey";

-- AlterTable
ALTER TABLE "Book" ALTER COLUMN "imageId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
