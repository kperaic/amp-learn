// Run only against `node tests/admin-fixture.mjs --student` (no real services).
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
const base = "http://localhost:4300";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cookies = new Map();
const db = createServerClient("http://127.0.0.1:4301", "fixture-public-key", {
  cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
  },
});
const { error } = await db.auth.signInWithPassword({email:"qa@example.test",password:"FixtureOnly123!"});
assert.ifError(error);
const cookie = [...cookies].map(([name,value])=>`${name}=${value}`).join('; ');
const lesson = `/api/learn/lessons/${id(20)}`;
let checks = 0;
async function api(path, status, options = {}) {
  const r = await fetch(base + path, { headers:{cookie}, ...options });
  assert.equal(r.status,status,path);
  assert.match(r.headers.get('cache-control'),/private.*no-store/);
  const body = await r.json();
  if(status !== 200) assert.equal(body.url,undefined);
  checks++;
  return body;
}
await api(`${lesson}/playback`,401,{method:'POST',headers:{}});
await api(`${lesson}/attachments/${id(30)}/download`,401,{headers:{}});
await api(`${lesson}/playback`,403,{method:'POST',headers:{cookie,origin:'https://untrusted.example'}});
await api(`/api/learn/lessons/${id(21)}/playback`,503,{method:'POST'}); // delivery gate
for(const n of [22,23,99]) {
  await api(`/api/learn/lessons/${id(n)}/playback`,404,{method:'POST',body:JSON.stringify({videoId:id(50)})});
  await api(`/api/learn/lessons/${id(n)}/attachments/${id(30)}/download`,404);
}
for(const n of [31,32,99]) await api(`${lesson}/attachments/${id(n)}/download`,404);
const download = await api(`${lesson}/attachments/${id(30)}/download?path=forged/private.txt`,200);
const target = new URL(download.url);
assert.equal(target.origin,'http://127.0.0.1:4301');
assert.ok(target.pathname.endsWith(`/${id(20)}/${id(30)}/instructions.txt`));
assert.equal(await (await fetch(target)).text(),'Fixture instructions.');
checks++;
for(const path of ['/hr/learn',`/hr/learn/modules/${id(10)}`,`/hr/learn/lessons/${id(20)}`]) {
  const r = await fetch(base+path,{headers:{cookie}}), html = await r.text();
  assert.equal(r.status,200,path);
  assert.ok(!html.includes('SECRET '),'Hidden fixture data in '+path);
  checks++;
}
console.log(`${checks} simulated student HTTP checks passed; no live services used.`);
