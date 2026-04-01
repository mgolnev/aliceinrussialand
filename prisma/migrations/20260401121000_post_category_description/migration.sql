-- Add optional SEO description for category landing pages.
ALTER TABLE "PostCategory"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

