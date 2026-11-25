import { requireProfile } from "@/lib/auth";
import { localeOf, messages } from "@/lib/i18n";
import Link from "next/link";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale);
  const { profile, user } = await requireProfile(locale);
  return (
    <>
      <h1>{t.profile}</h1>
      <section className="card">
        <h2>
          {profile.first_name} {profile.last_name}
        </h2>
        <p>{user.email}</p>
        <p className="muted">
          {profile.role === "super_admin" ? t.roleAdmin : t.roleStudent}
        </p>
        <Link href={`/${locale}/set-password`}>{t.setPassword}</Link>
      </section>
    </>
  );
}
