import { requireProfile } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const locale = localeOf((await params).locale);
  const { profile } = await requireProfile(locale);
  return (
    <Shell locale={locale} profile={profile}>
      {children}
    </Shell>
  );
}
