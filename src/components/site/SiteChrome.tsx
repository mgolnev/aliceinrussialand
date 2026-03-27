import Link from "next/link";
import type { SocialLink } from "@/lib/site";
import { 
  Send, 
  Mail, 
  ExternalLink, 
  User, 
  Globe 
} from "lucide-react";

type Props = {
  displayName: string;
  tagline: string;
  social: SocialLink[];
  /** Публичный URL превью аватарки (WebP), иначе — инициалы из displayName */
  avatarUrl?: string | null;
};

function SocialIcon({ kind, className }: { kind: SocialLink["kind"]; className?: string }) {
  const props = { size: 18, className };
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

export function SiteChrome({
  displayName,
  tagline,
  social,
  avatarUrl,
}: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#fbfaf7]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3 transition-transform active:scale-95">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- внешний Supabase / произвольный origin
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-stone-200/80 group-hover:ring-stone-300"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm group-hover:bg-stone-800">
              <span className="text-sm font-bold uppercase tracking-tighter">
                {displayName.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
              {displayName}
            </h1>
            {tagline ? (
              <p className="truncate text-xs text-stone-500 sm:text-sm">
                {tagline}
              </p>
            ) : null}
          </div>
        </Link>

        <nav className="flex items-center gap-1.5">
          {social.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.label || s.kind}
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200"
            >
              <SocialIcon kind={s.kind} />
            </a>
          ))}
          <div className="mx-1 h-4 w-px bg-stone-200" />
          <Link
            href="/about"
            title="Обо мне"
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200"
          >
            <User size={18} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-stone-200/70 bg-white/65 py-10 text-center text-sm text-stone-500 backdrop-blur-sm">
      <p>© {new Date().getFullYear()} · авторская лента</p>
    </footer>
  );
}
