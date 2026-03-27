import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function isSupabaseMediaEnabled() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      process.env.SUPABASE_STORAGE_BUCKET?.trim(),
  );
}

function getBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET!.trim();
}

function getClient() {
  if (!isSupabaseMediaEnabled()) return null;
  if (!admin) {
    admin = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return admin;
}

/** Публичный базовый URL для объектов в bucket (без завершающего /). */
export function supabasePublicMediaBase(): string {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const bucket = getBucket();
  return `${base}/storage/v1/object/public/${bucket}`;
}

export async function uploadSupabaseFile(
  objectPath: string,
  body: Buffer,
  contentType: string,
) {
  const sb = getClient();
  if (!sb) throw new Error("Supabase не настроен");
  const { error } = await sb.storage.from(getBucket()).upload(objectPath, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseImageFolder(postId: string, imageId: string) {
  const sb = getClient();
  if (!sb) return;
  const folder = `${postId}/${imageId}`;
  const { data: list, error: listError } = await sb
    .storage
    .from(getBucket())
    .list(folder);
  if (listError || !list?.length) return;
  const paths = list.map((f) => `${folder}/${f.name}`);
  await sb.storage.from(getBucket()).remove(paths);
}
