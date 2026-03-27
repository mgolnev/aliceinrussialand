export function absoluteUrl(siteUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = siteUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
