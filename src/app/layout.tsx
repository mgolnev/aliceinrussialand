import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/site";
import { Analytics } from "@/components/site/Analytics";
import { ScrollMetrics } from "@/components/site/ScrollMetrics";
import { resolveSiteOrigin } from "@/lib/site-origin";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /** Android Chrome: вёрстка подстраивается под высоту с клавиатурой (меньше «уезжания» полей). */
  interactiveWidget: "resizes-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const base = resolveSiteOrigin(s.siteUrl);

  return {
    metadataBase: new URL(base),
    title: {
      default: s.displayName,
      template: `%s · ${s.displayName}`,
    },
    description: s.tagline || s.bio || "Лента работ",
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
  const hasClientMetrics = Boolean(plausible || yandexMetrikaId);
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
        {children}
      </body>
    </html>
  );
}
