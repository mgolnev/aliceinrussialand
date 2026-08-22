-- Admin linking searches arbitrary substrings in Russian title/slug/body.
-- Trigram GIN indexes keep ILIKE '%query%' from scanning every post.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Post_title_trgm_idx"
  ON "Post" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Post_slug_trgm_idx"
  ON "Post" USING GIN ("slug" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Post_body_trgm_idx"
  ON "Post" USING GIN ("body" gin_trgm_ops);
