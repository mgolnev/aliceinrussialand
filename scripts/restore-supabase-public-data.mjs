#!/usr/bin/env node

import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const source = process.env.SUPABASE_BACKUP_DIR ?? "backups/supabase-public";
const mediaSource = path.join(source, "storage", "media");
const mediaTarget = "public/media";
const tables = ["SiteSettings", "PostCategory", "Post", "PostImage"];

async function readBackup(table) {
  return JSON.parse(await readFile(path.join(source, `${table}.json`), "utf8"));
}

function toLocalMediaPath(value) {
  if (typeof value === "string") {
    return value.replace(/https:\/\/[^/]+\/storage\/v1\/object\/public\/media\//g, "/media/");
  }
  if (Array.isArray(value)) return value.map(toLocalMediaPath);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toLocalMediaPath(item)]));
  }
  return value;
}

function rewriteStoredJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.stringify(toLocalMediaPath(JSON.parse(value)));
  } catch {
    return toLocalMediaPath(value);
  }
}

function normalizeDates(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (key.endsWith("At") && typeof value === "string" && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
      return [key, `${value}Z`];
    }
    return [key, value];
  }));
}

const backup = Object.fromEntries(
  await Promise.all(tables.map(async (table) => [table, await readBackup(table)])),
);

const prisma = new PrismaClient();
try {
  await prisma.$transaction([
    prisma.postImage.deleteMany(),
    prisma.post.deleteMany(),
    prisma.postCategory.deleteMany(),
    prisma.siteSettings.deleteMany(),
  ]);

  for (const row of backup.SiteSettings) {
    await prisma.siteSettings.create({
      data: {
        ...normalizeDates(row),
        avatarMediaPath: rewriteStoredJson(row.avatarMediaPath),
        aboutPhotoPath: rewriteStoredJson(row.aboutPhotoPath),
      },
    });
  }
  await prisma.postCategory.createMany({ data: backup.PostCategory.map(normalizeDates) });
  await prisma.post.createMany({ data: backup.Post.map(normalizeDates) });
  await prisma.postImage.createMany({
    data: backup.PostImage.map((row) => ({
      ...normalizeDates(row),
      variantsJson: rewriteStoredJson(row.variantsJson),
    })),
  });

  await cp(mediaSource, mediaTarget, { recursive: true, force: true });

  console.log(JSON.stringify({
    SiteSettings: await prisma.siteSettings.count(),
    PostCategory: await prisma.postCategory.count(),
    Post: await prisma.post.count(),
    PostImage: await prisma.postImage.count(),
  }));
} finally {
  await prisma.$disconnect();
}
