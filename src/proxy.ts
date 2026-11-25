import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig, sessionCookieOptions } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = pathname.split("/")[1] === "en" ? "en" : "hr";
  const { url, key } = publicConfig();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-locale", locale);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (/^\/(hr|en)\/(admin|learn|account)(?:\/|$)/.test(pathname)) {
    const { data: active } = user
      ? await supabase.rpc("is_active_user")
      : { data: false };
    if (!user || active !== true) {
      if (user) await supabase.auth.signOut({ scope: "local" });
      const target = new URL(`/${locale}/login`, request.url);
      if (user) target.searchParams.set("message", "accessDenied");
      const denied = NextResponse.redirect(target);
      response.cookies.getAll().forEach((c) => denied.cookies.set(c));
      denied.headers.set("Cache-Control", "private, no-store");
      return denied;
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/", "/hr/:path*", "/en/:path*", "/auth/:path*"],
};
