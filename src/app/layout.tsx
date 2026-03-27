import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/site";
import { Analytics } from "@/components/site/Analytics";
import { ScrollMetrics } from "@/components/site/ScrollMetrics";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const base =
    s.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  return {
    metadataBase: new URL(base),
    title: {
      default: s.displayName,
      template: `%s · ${s.displayName}`,
    },
    description: s.tagline || s.bio || "Лента работ",
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
  const lang = s.defaultLocale === "en" ? "en" : "ru";

  return (
    <html lang={lang} className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#faf8f5] font-[family-name:var(--font-body)] text-stone-900">
        <Analytics
          plausibleDomain={plausible}
          yandexMetrikaId={yandexMetrikaId}
        />
        <ScrollMetrics
          plausibleDomain={plausible}
          yandexMetrikaId={yandexMetrikaId}
        />
        {children}
      </body>
    </html>
  );
}
