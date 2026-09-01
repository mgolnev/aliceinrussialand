-- Existing sites keep the experimental entry visible until an administrator turns it off.
ALTER TABLE "SiteSettings"
ADD COLUMN IF NOT EXISTS "showWanderEntry" BOOLEAN NOT NULL DEFAULT true;
