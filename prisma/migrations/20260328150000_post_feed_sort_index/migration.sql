-- Лента: WHERE status = PUBLISHED ORDER BY pinned DESC, publishedAt DESC
CREATE INDEX IF NOT EXISTS "Post_status_pinned_publishedAt_idx" ON "Post" ("status", "pinned", "publishedAt" DESC);
