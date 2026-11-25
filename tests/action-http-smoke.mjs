// Only against admin-fixture.mjs. Exercise actual Next Server Action dispatch,
// while Supabase remains an in-memory HTTP simulation with no real credentials.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServerClient } from "@supabase/ssr";
const dir = resolve(process.argv[2] || ".");
assert.ok(dir.startsWith(join(tmpdir(), "amp-learn-admin-qa-")), "Requires isolated fixture directory");
const student = process.argv.includes("--student");
const base = "http://localhost:4300";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const cookies = new Map();
const db = createServerClient("http://127.0.0.1:4301", "fixture-public-key", {cookies:{
  getAll:()=>[...cookies].map(([name,value])=>({name,value})),
  setAll:values=>values.forEach(({name,value})=>cookies.set(name,value)),
}});
assert.ifError((await db.auth.signInWithPassword({email:"qa@example.test",password:"FixtureOnly123!"})).error);
const cookie = [...cookies].map(([name,value])=>`${name}=${value}`).join("; ");
for (const path of ["/hr/admin/modules",`/hr/admin/lessons/${id(20)}`,`/hr/admin/students/${id(2)}`,"/hr/admin/invite"]) {
  await (await fetch(base+path,{headers:{cookie}})).text();
}
const manifest=JSON.parse(await readFile(join(dir,".next/dev/server/server-reference-manifest.json"),"utf8"));
const actions=new Map(Object.entries(manifest.node).map(([id,entry])=>[entry.exportedName,id]));
let checks=0;
async function action(name,args,{anonymous=false,origin=base}={}) {
  assert.ok(actions.has(name),`Action compiled: ${name}`);
  const r=await fetch(base+"/hr/admin/modules",{method:"POST",redirect:"manual",headers:{
    "Next-Action":actions.get(name),"Content-Type":"text/plain;charset=UTF-8",origin,
    ...(anonymous?{}:{cookie}),
  },body:JSON.stringify(args)});
  return {r,text:await r.text()};
}
for (const [name,args] of [
  ["saveModule",["hr",null,{title:"Forbidden",description:"",status:"published"}]],
  ["saveAccess",["hr",id(1),[id(11)]]],
  ["saveStudent",["hr",id(1),{role:"super_admin",active:true}]],
  ["checkVideo",["hr",id(50)]],
  ["downloadAttachment",["hr",id(30)]],
  ["reserveAttachment",["hr",id(20),{name:"file.pdf",size:10,type:"application/pdf"}]],
  ["removeAttachment",["hr",id(30)]],
  ["resendInvitation",["hr",id(2)]],
]) {
  const {r}=await action(name,args,{anonymous:!student});
  if(student) {
    // Next may internally render the redirect target in a successful Flight response.
    assert.ok([200,303].includes(r.status),name);
    assert.ok(r.headers.get("x-action-redirect")?.startsWith("/hr/learn;"),name);
  }
  else assert.equal(new URL(r.headers.get("location"),base).pathname,"/hr/login",name);
  checks++;
}
if (!student) {
  const row=(await db.from("modules").select("*").eq("id",id(10)).single()).data;
  const payload={title:"HTTP current version",description:"Preserved content",status:"published",version:row.updated_at};
  assert.match((await action("saveModule",["hr",id(10),payload])).text,/"updated_at"/);
  assert.match((await action("saveModule",["hr",id(10),{...payload,title:"Stale overwrite"}])).text,/saveConflict/);
  assert.equal((await db.from("modules").select("*").eq("id",id(10)).single()).data.title,payload.title);
  checks+=3;
  assert.match((await action("saveModule",["hr",id(10),{title:"Missing version",description:"",status:"draft"}])).text,/invalidFields/);
  assert.match((await action("createLesson",["hr",id(10),{forged:true}])).text,/invalidFields/);
  assert.match((await action("finishCover",["hr",id(10),null])).text,/invalidFields/);
  checks+=3;
  const foreign=await action("saveModule",["hr",null,payload],{origin:"https://untrusted.example"});
  assert.ok(foreign.r.status>=400);
  checks++;
}
console.log(`${checks} ${student?"student":"admin/anonymous"} Server Action HTTP checks passed; simulated providers only.`);
