import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth-card";
import { Field, Notice } from "@/components/ui";
import { Submit } from "@/components/forms";
import { localeOf, messages } from "@/lib/i18n";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const locale = localeOf((await params).locale),
    t = messages(locale);
  return (
    <AuthCard locale={locale} title={t.login} path="login">
      <Notice code={(await searchParams).message} t={t} />
      <form action={login.bind(null, locale)}>
        <Field
          label={t.email}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label={t.password}
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={1}
          maxLength={128}
          required
        />
        <Submit pendingLabel={t.working}>{t.login}</Submit>
      </form>
      <Link href={`/${locale}/forgot-password`}>{t.forgot}</Link>
    </AuthCard>
  );
}
