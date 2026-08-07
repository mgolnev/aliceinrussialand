#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const output = process.env.SUPABASE_BACKUP_DIR ?? "backups/supabase-public";

if (!url || !key) {
  throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["SiteSettings", "PostCategory", "Post", "PostImage"];

async function fetchTable(table) {
  const rows = [];
  const pageSize = 1_000;
  for (let start = 0; ; start += pageSize) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${start}-${start + pageSize - 1}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function addStorageUrls(value, out) {
  if (typeof value === "string") {
    if (value.includes("/storage/v1/object/public/")) out.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item) => addStorageUrls(item, out));
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => addStorageUrls(item, out));
  }
}

function parseStoredJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function downloadMedia(mediaUrls) {
  let downloaded = 0;
  for (const mediaUrl of mediaUrls) {
    const parsed = new URL(mediaUrl);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) continue;
    const relativePath = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    const destination = path.join(output, "storage", relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    const res = await fetch(mediaUrl);
    if (!res.ok) throw new Error(`Не удалось скачать ${relativePath}: ${res.status}`);
    await writeFile(destination, Buffer.from(await res.arrayBuffer()));
    downloaded += 1;
  }
  return downloaded;
}

await mkdir(output, { recursive: true });
const backup = Object.fromEntries(
  await Promise.all(tables.map(async (table) => [table, await fetchTable(table)])),
);

for (const [table, rows] of Object.entries(backup)) {
  await writeFile(path.join(output, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`);
}

const mediaUrls = new Set();
for (const image of backup.PostImage) addStorageUrls(parseStoredJson(image.variantsJson), mediaUrls);
for (const settings of backup.SiteSettings) {
  addStorageUrls(parseStoredJson(settings.avatarMediaPath), mediaUrls);
  addStorageUrls(parseStoredJson(settings.aboutPhotoPath), mediaUrls);
}

const mediaFiles = await downloadMedia(mediaUrls);
const manifest = {
  createdAt: new Date().toISOString(),
  source: url,
  records: Object.fromEntries(tables.map((table) => [table, backup[table].length])),
  mediaFiles,
};
await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest));
