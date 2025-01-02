-- CreateTable
CREATE TABLE "BookQuery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "query" TEXT NOT NULL,

    CONSTRAINT "BookQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookToBookQuery" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookToBookQuery_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "BookQuery_query_idx" ON "BookQuery"("query");

-- CreateIndex
CREATE INDEX "_BookToBookQuery_B_index" ON "_BookToBookQuery"("B");

-- AddForeignKey
ALTER TABLE "_BookToBookQuery" ADD CONSTRAINT "_BookToBookQuery_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToBookQuery" ADD CONSTRAINT "_BookToBookQuery_B_fkey" FOREIGN KEY ("B") REFERENCES "BookQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
