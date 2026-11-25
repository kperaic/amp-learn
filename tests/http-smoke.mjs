import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:3100";
let checks = 0;
for (const path of [
  "/hr/login",
  "/en/login",
  "/hr/forgot-password",
  "/hr/set-password",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  const html = await r.text();
  assert.ok(html.includes("AMP"), path);
  assert.ok(!html.includes("sb_secret_"));
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  if (path === "/hr/login") {
    const asset = html.match(/src="([^"]*\/_next\/static\/[^"?]+\.js[^"]*)"/)?.[1];
    assert.ok(asset, "Production JS asset exists");
    const js = await fetch(new URL(asset, base));
    assert.equal(js.status, 200);
    assert.match(js.headers.get("cache-control"), /public.*immutable/);
    checks++;
  }
  checks++;
}
for (const path of [
  "/hr/admin",
  "/hr/admin/invite",
  "/hr/admin/modules",
  "/hr/admin/students",
  "/hr/learn",
  "/hr/learn/modules/00000000-0000-4000-8000-000000000010",
  "/hr/learn/lessons/00000000-0000-4000-8000-000000000020",
  "/hr/account",
]) {
  const r = await fetch(base + path, { redirect: "manual" });
  assert.equal(r.status, 307, path);
  assert.equal(new URL(r.headers.get("location"), base).pathname, "/hr/login");
  assert.match(r.headers.get("cache-control"), /no-store/);
  checks++;
}
for (const [path, method] of [
  ["/api/learn/lessons/00000000-0000-4000-8000-000000000020/playback", "POST"],
  ["/api/learn/lessons/00000000-0000-4000-8000-000000000020/attachments/00000000-0000-4000-8000-000000000030/download", "GET"],
]) {
  const r = await fetch(base + path, { method });
  assert.equal(r.status, 401, path);
  assert.match(r.headers.get("cache-control"), /private.*no-store/);
  assert.equal((await r.json()).url, undefined);
  checks++;
}
const bad = await fetch(base + "/auth/confirm?type=signup&token_hash=invalid", {
  redirect: "manual",
});
assert.equal(bad.status, 307);
assert.match(bad.headers.get("location"), /invalidLink/);
assert.equal(bad.headers.get("referrer-policy"), "no-referrer");
checks++;
const invalidLocale = await fetch(base + "/de/login");
assert.equal(invalidLocale.status, 404);
checks++;
console.log(
  `${checks} HTTP auth and route checks passed; no credentials submitted.`,
);
