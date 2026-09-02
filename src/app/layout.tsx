import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getAuthorName, getSiteSettings } from "@/lib/site";
import { Analytics } from "@/components/site/Analytics";
import { ScrollMetrics } from "@/components/site/ScrollMetrics";
import { GlobalScrollManager } from "@/components/navigation/GlobalScrollManager";
import { resolveSiteOrigin } from "@/lib/site-origin";

// БД подключается в runtime: self-hosted контейнер не требует доступа к ней на build-этапе.
export const dynamic = "force-dynamic";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});

const DEFAULT_SITE_DESCRIPTION =
  "Авторская лента Алисы: иллюстрация, керамика, выставки, наброски и личные заметки.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /** Android Chrome: вёрстка подстраивается под высоту с клавиатурой (меньше «уезжания» полей). */
  interactiveWidget: "resizes-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const base = resolveSiteOrigin(s.siteUrl);
  const seoTitle = s.seoTitle?.trim() || `${getAuthorName(s)} · ${s.displayName}`;
  const seoDescription =
    s.seoDescription?.trim() || DEFAULT_SITE_DESCRIPTION;

  return {
    metadataBase: new URL(base),
    title: {
      default: seoTitle,
      template: "%s",
    },
    description: seoDescription,
    ...(s.yandexVerification?.trim()
      ? { verification: { yandex: s.yandexVerification.trim() } }
      : {}),
    openGraph: {
      type: "website",
      siteName: s.displayName,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await getSiteSettings();
  const plausible =
    s.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    s.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const hasClientMetrics =
    process.env.NODE_ENV === "production" && Boolean(plausible || yandexMetrikaId);
  const lang = s.defaultLocale === "en" ? "en" : "ru";

  return (
    <html lang={lang} className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#faf8f5] font-[family-name:var(--font-body)] text-stone-900">
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try { if (typeof history !== "undefined" && "scrollRestoration" in history) { history.scrollRestoration = "manual"; } } catch {}',
          }}
        />
        {hasClientMetrics ? (
          <>
            <Analytics
              plausibleDomain={plausible}
              yandexMetrikaId={yandexMetrikaId}
            />
            <ScrollMetrics
              plausibleDomain={plausible}
              yandexMetrikaId={yandexMetrikaId}
            />
          </>
        ) : null}
        <GlobalScrollManager />
        {children}
      </body>
    </html>
  );
}
