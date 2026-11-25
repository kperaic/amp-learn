import { createHash } from "node:crypto";
export const PLAYBACK_TTL_SECONDS = 4 * 60 * 60;
// Pure signing primitive. Only the server-only delivery module supplies secrets.
export function signedEmbed(
  library: string,
  video: string,
  key: string,
  locale: "hr" | "en",
  now = Date.now(),
) {
  if (
    !/^\d+$/.test(library) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      video,
    ) ||
    !key
  )
    throw Error("Invalid playback configuration");
  const expires = Math.floor(now / 1000) + PLAYBACK_TTL_SECONDS;
  const token = createHash("sha256")
    .update(key + video + expires)
    .digest("hex");
  const query = new URLSearchParams({
    token,
    expires: String(expires),
    autoplay: "false",
    loop: "false",
    preload: "false",
    playsinline: "true",
    showSpeed: "true",
    rememberPosition: "false",
    rememberSettings: "false",
    lang: locale,
  });
  return {
    url: `https://player.mediadelivery.net/embed/${library}/${video}?${query}`,
    expiresAt: expires * 1000,
  };
}
