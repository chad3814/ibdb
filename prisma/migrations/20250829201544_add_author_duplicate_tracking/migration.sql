-- CreateTable
CREATE TABLE "AuthorSimilarity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "author1Id" TEXT NOT NULL,
    "author1Name" TEXT NOT NULL,
    "author2Id" TEXT NOT NULL,
    "author2Name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "matchReasons" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "mergeId" TEXT,

    CONSTRAINT "AuthorSimilarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorMerge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedAuthorIds" TEXT[],
    "mergedAuthorNames" TEXT[],
    "targetAuthorId" TEXT NOT NULL,
    "targetAuthorName" TEXT NOT NULL,
    "mergedBy" TEXT NOT NULL,
    "mergeReason" TEXT,
    "booksReassigned" INTEGER NOT NULL,

    CONSTRAINT "AuthorMerge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateScanRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "minScore" INTEGER NOT NULL DEFAULT 70,
    "scanType" TEXT NOT NULL,
    "totalAuthors" INTEGER,
    "totalComparisons" INTEGER,
    "duplicatesFound" INTEGER,
    "processingTimeMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,

    CONSTRAINT "DuplicateScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthorSimilarity_status_idx" ON "AuthorSimilarity"("status");

-- CreateIndex
CREATE INDEX "AuthorSimilarity_score_idx" ON "AuthorSimilarity"("score");

-- CreateIndex
CREATE INDEX "AuthorSimilarity_confidence_idx" ON "AuthorSimilarity"("confidence");

-- CreateIndex
CREATE INDEX "AuthorSimilarity_author1Id_idx" ON "AuthorSimilarity"("author1Id");

-- CreateIndex
CREATE INDEX "AuthorSimilarity_author2Id_idx" ON "AuthorSimilarity"("author2Id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorSimilarity_author1Id_author2Id_key" ON "AuthorSimilarity"("author1Id", "author2Id");

-- CreateIndex
CREATE INDEX "AuthorMerge_targetAuthorId_idx" ON "AuthorMerge"("targetAuthorId");

-- CreateIndex
CREATE INDEX "AuthorMerge_createdAt_idx" ON "AuthorMerge"("createdAt");

-- CreateIndex
CREATE INDEX "DuplicateScanRun_status_idx" ON "DuplicateScanRun"("status");

-- CreateIndex
CREATE INDEX "DuplicateScanRun_createdAt_idx" ON "DuplicateScanRun"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthorSimilarity" ADD CONSTRAINT "AuthorSimilarity_mergeId_fkey" FOREIGN KEY ("mergeId") REFERENCES "AuthorMerge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
