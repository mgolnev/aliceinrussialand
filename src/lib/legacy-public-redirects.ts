/**
 * Исторические адреса, которые уже успели попасть в поиск. Они обрабатываются
 * в proxy до рендера, чтобы ответ был именно HTTP 301, а не streaming-redirect.
 */
export const LEGACY_PUBLIC_REDIRECTS: Readonly<Record<string, string>> = {
  "/category/illyustraciya": "/category/grafika",
  "/category/vystavki": "/category/uvidela",
  "/p/novaya-publikaciya": "/p/keramika-serii-ritual",
  "/p/novaya-publikaciya-1": "/p/dinamo-mural-so-sportsmenami",
  "/p/novaya-publikaciya-2": "/p/plenernaya-grafika-holmistyj-lug",
  "/p/novaya-publikaciya-3": "/p/derevenskij-pejzazh-pod-grozovym-nebom",
  "/p/novaya-publikaciya-4": "/p/keramicheskie-raboty-i-skulptura",
  "/p/novaya-publikaciya-5": "/p/kolokolnya-v-kolomne",
  "/p/novaya-publikaciya-6": "/p/grafika-s-plenera-pejzazh-u-vody",
};

export function getLegacyPublicRedirect(pathname: string): string | null {
  return LEGACY_PUBLIC_REDIRECTS[pathname] ?? null;
}
