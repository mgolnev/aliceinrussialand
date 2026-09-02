-- New categories participate in «не выбирай» until an editor opts them out.
ALTER TABLE "PostCategory"
ADD COLUMN IF NOT EXISTS "includeInWander" BOOLEAN NOT NULL DEFAULT true;
