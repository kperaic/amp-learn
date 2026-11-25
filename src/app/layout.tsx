import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "AMP Learn",
  description: "Privatna platforma za učenje AMP Digital",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-app-locale") === "en" ? "en" : "hr";
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
