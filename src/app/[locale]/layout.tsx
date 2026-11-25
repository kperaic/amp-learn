import { LocaleSync } from "@/components/locale-sync";
import { localeOf } from "@/lib/i18n";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  return (
    <>
      <LocaleSync locale={locale} />
      {children}
    </>
  );
}
