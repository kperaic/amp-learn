import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const locale = query.get("locale") === "en" ? "en" : "hr";
  const token_hash = query.get("token_hash"),
    type = query.get("type"),
    code = query.get("code");
  const supabase = await createClient();
  let valid = false;
  if (token_hash && (type === "invite" || type === "recovery")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    valid = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    valid = !error;
  }
  const target = valid
    ? `/${locale}/set-password`
    : `/${locale}/login?message=invalidLink`;
  const response = NextResponse.redirect(new URL(target, appUrl()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
