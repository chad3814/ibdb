/*
  Warnings:

  - A unique constraint covering the columns `[query]` on the table `BookQuery` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BookQuery_query_idx";

-- CreateIndex
CREATE UNIQUE INDEX "BookQuery_query_key" ON "BookQuery"("query");
