-- CreateTable
CREATE TABLE "PostCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostCategory_slug_key" ON "PostCategory"("slug");

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "categoryId" TEXT;

ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

INSERT INTO "PostCategory" ("id", "slug", "name", "sortOrder", "createdAt", "updatedAt")
VALUES ('cseed_cat_keramika', 'keramika', 'Керамика', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
