import Link from "next/link";
import type { Locale } from "@/lib/types";
import { messages } from "@/lib/i18n";
export function AuthCard({
  locale,
  title,
  children,
  path,
}: {
  locale: Locale;
  title: string;
  children: React.ReactNode;
  path: string;
}) {
  const t = messages(locale);
  return (
    <main className="auth">
      <section className="auth-story">
        <Link className="brand" href={`/${locale}/login`}>
          AMP<span>Learn</span>
        </Link>
        <div>
          <p className="eyebrow">{t.app}</p>
          <h1>{t.tagline}</h1>
        </div>
        <span className="brand-mark" aria-hidden>
          amp.
        </span>
      </section>
      <section className="auth-panel">
        <nav className="language">
          <Link href={`/hr/${path}`} lang="hr">
            HR
          </Link>
          <Link href={`/en/${path}`} lang="en">
            EN
          </Link>
        </nav>
        <div className="auth-card">
          <p className="eyebrow">AMP Digital</p>
          <h2>{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}
