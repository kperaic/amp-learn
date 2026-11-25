import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { messages } from "@/lib/i18n";
import type { Locale, Profile } from "@/lib/types";
export function Shell({
  locale,
  profile,
  children,
}: {
  locale: Locale;
  profile: Profile;
  children: React.ReactNode;
}) {
  const t = messages(locale),
    admin = profile.role === "super_admin";
  const links = admin
    ? [
        [t.overview, "admin"],
        [t.modules, "admin/modules"],
        [t.students, "admin/students"],
      ]
    : [[t.myModules, "learn"]];
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link
          className="brand"
          href={`/${locale}/${admin ? "admin" : "learn"}`}
        >
          AMP<span>Learn</span>
        </Link>
        <p className="workspace-label">{t.private}</p>
        <nav>
          {links.map(([label, path]) => (
            <Link key={path} href={`/${locale}/${path}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{profile.first_name.slice(0, 1)}</span>
          <div>
            {profile.first_name}
            <small>{admin ? t.roleAdmin : t.roleStudent}</small>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>{t.app}</span>
          <nav className="header-actions">
            <Link href={`/${locale}/account`}>{t.profile}</Link>
            <Link
              href={`/${locale === "hr" ? "en" : "hr"}/${admin ? "admin" : "learn"}`}
            >
              {locale === "hr" ? "EN" : "HR"}
            </Link>
            <form data-leaves-page action={logout.bind(null, locale)}>
              <button className="text-button">{t.logout}</button>
            </form>
          </nav>
        </header>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
