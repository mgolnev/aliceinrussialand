-- AI-предложения для старых SEO-полей хранятся отдельно от опубликованного текста.
CREATE TABLE "AiSeoReview" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "projectId" TEXT,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "inputHash" TEXT NOT NULL DEFAULT '',
    "suggestedTitle" TEXT NOT NULL DEFAULT '',
    "suggestedDescription" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSeoReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSeoReview_postId_key" ON "AiSeoReview"("postId");
CREATE UNIQUE INDEX "AiSeoReview_projectId_key" ON "AiSeoReview"("projectId");
CREATE INDEX "AiSeoReview_status_runAfter_idx" ON "AiSeoReview"("status", "runAfter");
CREATE INDEX "AiSeoReview_priority_status_updatedAt_idx" ON "AiSeoReview"("priority", "status", "updatedAt");

ALTER TABLE "AiSeoReview"
  ADD CONSTRAINT "AiSeoReview_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSeoReview"
  ADD CONSTRAINT "AiSeoReview_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
