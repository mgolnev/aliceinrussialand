#!/usr/bin/env node
/**
 * Загружает переменные из .env в Vercel → Production для привязанного проекта (.vercel/project.json).
 * Секреты в stdout не печатаются.
 *
 * Переопределить URL сайта: VERCEL_PRODUCTION_URL=https://... node scripts/sync-vercel-env.cjs
 *
 * Только опциональные ключи (Supabase, аналитика) — без смены SESSION_SECRET и ядра:
 *   node scripts/sync-vercel-env.cjs --optional-only
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const vercelProjectPath = path.join(root, ".vercel", "project.json");

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      const q = val[0];
      val = val.slice(1, -1);
      if (q === '"') {
        val = val.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\$/g, "$");
      }
    }
    env[key] = val;
  }
  return env;
}

function vercelEnvAdd(key, value, scope) {
  const args = [
    "vercel",
    "env",
    "add",
    key,
    "production",
    "--sensitive",
    "--yes",
    "--force",
    "--scope",
    scope,
  ];
  const pubArgs = args.filter((a) => a !== "--sensitive");
  const useArgs = /^(NEXT_PUBLIC_|VERCEL_)/.test(key) ? pubArgs : args;

  const r = spawnSync("npx", useArgs, {
    cwd: root,
    input: value,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(`Ошибка для ${key} (exit ${r.status}):`);
    console.error(r.stderr || r.stdout || "(нет вывода)");
    process.exit(1);
  }
  console.log(`OK: ${key}`);
}

function main() {
  if (!fs.existsSync(vercelProjectPath)) {
    console.error("Нет .vercel/project.json — сначала: npx vercel link");
    process.exit(1);
  }
  if (!fs.existsSync(envPath)) {
    console.error("Нет файла .env");
    process.exit(1);
  }

  const { orgId } = JSON.parse(fs.readFileSync(vercelProjectPath, "utf8"));
  if (!orgId) {
    console.error(".vercel/project.json без orgId");
    process.exit(1);
  }

  const env = parseEnvFile(envPath);
  const optionalOnly = process.argv.includes("--optional-only");

  if (optionalOnly) {
    const optional = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
      "NEXT_PUBLIC_YANDEX_METRIKA_ID",
      "TELEGRAM_OUTBOUND_PROXY",
    ];
    let any = false;
    for (const k of optional) {
      const v = env[k];
      if (v != null && v !== "") {
        vercelEnvAdd(k, v, orgId);
        any = true;
      }
    }
    if (!any) {
      console.error("Нет непустых опциональных переменных в .env");
      process.exit(1);
    }
    console.log(
      "\nГотово (--optional-only). Redeploy: npx vercel deploy --prod",
    );
    return;
  }

  const defaultSite =
    process.env.VERCEL_PRODUCTION_URL || "https://aliceinrussialand.vercel.app";

  const sessionSecret =
    env.SESSION_SECRET && !String(env.SESSION_SECRET).includes("dev-secret")
      ? env.SESSION_SECRET
      : crypto.randomBytes(32).toString("base64url");

  const pairs = [
    ["DATABASE_URL", env.DATABASE_URL],
    ["DIRECT_URL", env.DIRECT_URL],
    ["SESSION_SECRET", sessionSecret],
    ["ADMIN_PASSWORD_HASH", env.ADMIN_PASSWORD_HASH],
    ["NEXT_PUBLIC_SITE_URL", defaultSite],
  ];

  for (const [k, v] of pairs) {
    if (v == null || v === "") {
      console.error(`Пропуск ${k}: пусто в .env`);
      process.exit(1);
    }
  }

  if (String(env.NEXT_PUBLIC_SITE_URL || "").includes("localhost")) {
    console.log(
      "NEXT_PUBLIC_SITE_URL на Vercel → продакшен URL (локальный localhost в .env не используется).",
    );
  }

  if (sessionSecret !== env.SESSION_SECRET) {
    console.log(
      "SESSION_SECRET: на Vercel записан новый случайный (в .env был dev-secret). Обновите .env при желании.",
    );
  }

  for (const [k, v] of pairs) {
    vercelEnvAdd(k, v, orgId);
  }

  const optional = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
    "NEXT_PUBLIC_YANDEX_METRIKA_ID",
    "TELEGRAM_OUTBOUND_PROXY",
  ];
  for (const k of optional) {
    const v = env[k];
    if (v != null && v !== "") {
      vercelEnvAdd(k, v, orgId);
    }
  }

  console.log("\nГотово. Дальше: Vercel → Deployments → Redeploy (или npx vercel --prod).");
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      "Загрузка картинок на проде: добавьте в Vercel SUPABASE_* из Supabase (см. .env.example) и redeploy.",
    );
  }
}

main();
