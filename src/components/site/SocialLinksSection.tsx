import type { SocialLink } from "@/lib/site";
import {
  Send,
  Mail,
  ExternalLink,
  Globe,
} from "lucide-react";

function SocialIcon({
  kind,
  className,
}: {
  kind: SocialLink["kind"];
  className?: string;
}) {
  const props = { size: 20, className };
  switch (kind) {
    case "telegram":
      return <Send {...props} />;
    case "instagram":
      return (
        <svg
          {...props}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "email":
      return <Mail {...props} />;
    case "behance":
      return <Globe {...props} />;
    default:
      return <ExternalLink {...props} />;
  }
}

function kindTitle(kind: SocialLink["kind"]): string {
  switch (kind) {
    case "telegram":
      return "Telegram";
    case "instagram":
      return "Instagram";
    case "behance":
      return "Behance";
    case "email":
      return "Почта";
    default:
      return "Ссылка";
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/\/$/, "") || url;
  } catch {
    return url;
  }
}

type Props = {
  social: SocialLink[];
  /** Заголовок секции (SiteSettings.contactsLabel) */
  contactsLabel?: string;
};

export function SocialLinksSection({
  social,
  contactsLabel = "Контакты",
}: Props) {
  return (
    <section
      className="mt-10 border-t border-stone-200 pt-10"
      aria-labelledby="contacts-heading"
    >
      <h2
        id="contacts-heading"
        className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl"
      >
        {contactsLabel.trim() || "Контакты"}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
        Написать или посмотреть работы в соцсетях — все ссылки собраны здесь.
      </p>
      {social.length ? (
        <ul className="mt-6 space-y-3">
          {social.map((s) => (
            <li key={s.id}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl border border-stone-200/90 bg-white px-4 py-3.5 shadow-[0_6px_24px_-12px_rgba(60,44,29,0.18)] transition hover:border-stone-300 hover:bg-stone-50/80 active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 ring-1 ring-stone-200/80">
                  <SocialIcon kind={s.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-stone-900">
                    {s.label?.trim() || kindTitle(s.kind)}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-stone-500">
                    {shortUrl(s.url)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-6 text-center text-sm text-stone-500">
          Ссылки на соцсети и почту можно добавить в админке → Настройки.
        </p>
      )}
    </section>
  );
}
