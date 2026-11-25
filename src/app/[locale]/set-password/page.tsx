import Link from "next/link";
import { setPassword } from "@/app/auth/actions";
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
    <AuthCard locale={locale} title={t.setPassword} path="set-password">
      <Notice code={(await searchParams).message} t={t} />
      <form action={setPassword.bind(null, locale)}>
        <Field
          label={t.password}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        <Field
          label={t.confirmPassword}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        <Submit pendingLabel={t.working}>{t.save}</Submit>
      </form>
      <Link href={`/${locale}/login`}>{t.back}</Link>
    </AuthCard>
  );
}
