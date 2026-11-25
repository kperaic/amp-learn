"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig, sessionCookieOptions } from "./config";
export function createClient() {
  const { url, key } = publicConfig();
  return createBrowserClient(url, key, { cookieOptions: sessionCookieOptions });
}
