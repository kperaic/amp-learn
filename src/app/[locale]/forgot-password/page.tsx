import Link from "next/link";
import { forgotPassword } from "@/app/auth/actions";
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
    <AuthCard locale={locale} title={t.forgotPassword} path="forgot-password">
      <Notice code={(await searchParams).message} t={t} />
      <form action={forgotPassword.bind(null, locale)}>
        <Field
          label={t.email}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Submit pendingLabel={t.working}>{t.send}</Submit>
      </form>
      <Link href={`/${locale}/login`}>{t.back}</Link>
    </AuthCard>
  );
}
