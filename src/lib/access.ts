import type { Profile, Locale } from "./types.ts";
export function homeFor(profile: Pick<Profile, "role">, locale: Locale) {
  return `/${locale}/${profile.role === "super_admin" ? "admin" : "learn"}`;
}
export function mayEnter(
  profile: Profile | null,
  area: "admin" | "learn" | "account",
) {
  return (
    !!profile?.active && (area !== "admin" || profile.role === "super_admin")
  );
}

export function trustedOrigin(value: string | undefined) {
 if (!value) throw Error("APP_URL must be configured.");
 const url = new URL(value);
 if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) throw Error("APP_URL must use HTTPS except localhost development.");
 return url.origin;
}
