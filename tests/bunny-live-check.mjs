// Opt-in, read-only AMP Learn check. Never prints URLs, signatures, keys or titles.
import { signedEmbed } from "../src/lib/playback-token.ts";
process.loadEnvFile(".env.local");
if (process.env.BUNNY_STREAM_LIBRARY_ID !== "820051")
  throw Error("Wrong Bunny library");
const headers = { AccessKey: process.env.BUNNY_STREAM_API_KEY };
const get = async (url) =>
  fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
const list = await get(
  "https://video.bunnycdn.com/library/820051/videos?page=1&itemsPerPage=1",
);
if (!list.ok) throw Error(`Video API status ${list.status}`);
const listed = await list.json();
if (!listed.items?.length) {
  console.log("No video available for live verification");
  process.exit(0);
}
const video = listed.items[0];
const detail = await get(
  `https://video.bunnycdn.com/library/820051/videos/${video.guid}`,
);
const data = await detail.json();
if (String(data.videoLibraryId) !== "820051")
  throw Error("Wrong video library");
const signed = signedEmbed(
  "820051",
  data.guid,
  process.env.BUNNY_STREAM_TOKEN_AUTH_KEY,
  "hr",
);
const base = `https://player.mediadelivery.net/embed/820051/${data.guid}`;
const probe = async (url, referer = "http://localhost:3000", read = false) => {
  const r = await fetch(url, {
    headers: { Referer: referer, Range: "bytes=0-65535" },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  let text = "";
  if (read && r.body) {
    const reader = r.body.getReader();
    let size = 0;
    while (size < 65536) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      text += new TextDecoder().decode(chunk.value);
    }
    await reader.cancel();
  } else await r.body?.cancel();
  return { status: r.status, text };
};
const ok = await probe(signed.url, "http://localhost:3000", true);
const unsigned = await probe(base);
const invalid = await probe(
  base + "?token=invalid&expires=" + Math.floor(Date.now() / 1000 + 600),
);
const expired = await probe(
  signedEmbed(
    "820051",
    data.guid,
    process.env.BUNNY_STREAM_TOKEN_AUTH_KEY,
    "hr",
    Date.now() - 5 * 3600000,
  ).url,
);
const legacyUnsigned = await probe(base.replace("player.mediadelivery.net", "iframe.mediadelivery.net"), "http://localhost:3000", true);
const legacyVisible = legacyUnsigned.text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
const directPlay = await probe(base.replace("/embed/", "/play/"));
const hosts = [
  ...new Set(ok.text.match(/https:\/\/[-a-zA-Z0-9.]+\.b-cdn\.net/g) || []),
];
console.log(
  JSON.stringify({
    metadataVerified: detail.status === 200,
    status: data.status,
    signedIframe: ok.status,
    unsignedIframe: unsigned.status,
    invalidIframe: invalid.status,
    expiredIframe: expired.status,
    legacyUnsignedIframe: legacyUnsigned.status,
    legacyExplicitDenial: /403|not authorized|unauthorized|not available|invalid token|forbidden|access denied/i.test(legacyVisible),
    legacyHasMediaSource: /playlist\.m3u8/.test(legacyUnsigned.text),
    directPlay: directPlay.status,
    cdnHostDetected: hosts.length > 0,
    iframeContainsCdnTokens: /bcdn_token=|token_path=|token=/.test(ok.text),
  }),
);
// Derive only the Bunny CDN host observed in the authorized iframe. No arbitrary URLs.
if (hosts.length) {
  const host = hosts[0];
  const manifest = await probe(
    `${host}/${data.guid}/playlist.m3u8`,
    "http://localhost:3000",
    true,
  );
  console.log(
    JSON.stringify({ unsignedHlsWithAllowedReferer: manifest.status }),
  );
  const paths = [
    `/${data.guid}/playlist.m3u8`,
    `/${data.guid}/play_720p.mp4`,
    `/${data.guid}/original`,
  ];
  for (const path of paths) {
    const r = await probe(host + path, "");
    const withReferer = await probe(host + path);
    console.log(
      JSON.stringify({
        resource: path.endsWith("m3u8")
          ? "hls"
          : path.endsWith("mp4")
            ? "mp4"
            : "original",
        unsignedNoReferer: r.status,
        unsignedAllowedReferer: withReferer.status,
      }),
    );
  }
  // Observe the player's own signed source; never invent CDN credentials.
  const sources = ok.text.replaceAll("&amp;", "&").match(/https:\/\/[-a-zA-Z0-9.]+\.b-cdn\.net[^\s"'<>\\]*/g) || [];
  const source = sources.map(s => new URL(s)).find(u =>
    u.origin === host && u.pathname.includes(data.guid) && u.pathname.endsWith("playlist.m3u8") &&
    (u.href.includes("bcdn_token=") || u.searchParams.has("token"))
  );
  console.log(JSON.stringify({signedMediaSourceDetected:!!source}));
  if(source) {
    // Media is requested inside the cross-origin player iframe, not the parent.
    const playerReferer = "https://player.mediadelivery.net/";
    const master = await probe(source.href, playerReferer, true);
    const expiresValue = source.href.match(/[?&]expires=(\d+)/)?.[1];
    const tamperedSource = source.href.replace(/([?&/]bcdn_token=|[?&]token=)[^&/]+/, "$1invalid");
    console.log(JSON.stringify({signedHls:master.status,
      mediaTtlSeconds:expiresValue ? Number(expiresValue)-Math.floor(Date.now()/1000) : null,
      tamperedSignedHls:tamperedSource !== source.href ? (await probe(tamperedSource,playerReferer)).status : null}));
    const childLine = text => text.startsWith("#EXTM3U") ? text.split("\n").find(s=>s.trim()&&!s.startsWith("#")) : undefined;
    const variantLine = childLine(master.text);
    if(variantLine) {
      const variantUrl = new URL(variantLine.trim(), source);
      if(variantUrl.origin === host) {
        const variantResult = await probe(variantUrl.href, playerReferer, true);
        console.log(JSON.stringify({signedVariant:variantResult.status}));
        const segmentLine = childLine(variantResult.text);
        if(segmentLine) {
          const segmentUrl = new URL(segmentLine.trim(),variantUrl);
          const videoPathStart = segmentUrl.pathname.indexOf(`/${data.guid}/`);
          if(segmentUrl.origin === host && videoPathStart >= 0) {
            console.log(JSON.stringify({signedSegment:(await probe(segmentUrl.href, playerReferer)).status,
              unsignedSegmentWithAllowedReferer:(await probe(host+segmentUrl.pathname.slice(videoPathStart))).status,
              unsignedSegmentWithPlayerReferer:(await probe(host+segmentUrl.pathname.slice(videoPathStart),playerReferer)).status}));
          }
        }
      }
    }
  }
  if (manifest.text.startsWith("#EXTM3U")) {
    const variant = manifest.text
      .split("\n")
      .find((s) => s.trim() && !s.startsWith("#"));
    if (variant) {
      const u = new URL(variant.trim(), `${host}/${data.guid}/playlist.m3u8`);
      if (u.origin === host) {
        const r = await probe(u.href, "http://localhost:3000", true);
        console.log(JSON.stringify({ unsignedVariant: r.status }));
        const segment = r.text
          .split("\n")
          .find((s) => s.trim() && !s.startsWith("#"));
        if (segment) {
          const seg = new URL(segment.trim(), u);
          if (seg.origin === host)
            console.log(
              JSON.stringify({
                unsignedSegment: (await probe(seg.href)).status,
              }),
            );
        }
      }
    }
  }
}
