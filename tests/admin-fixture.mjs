// Isolated browser QA only. All Auth/REST responses are simulated in memory.
// No .env files are copied and no external-service request is made by this fixture.
import { createServer } from "node:http";
import { cp, mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
if (root !== "/Users/kresimirperaic/Documents/amp-learn")
  throw Error("Wrong workspace");
const dir = await mkdtemp(join(tmpdir(), "amp-learn-admin-qa-"));
for (const name of [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next-env.d.ts",
])
  await cp(join(root, name), join(dir, name), { recursive: true }).catch(
    (e) => {
      if (e.code !== "ENOENT") throw e;
    },
  );
await symlink(join(root, "node_modules"), join(dir, "node_modules"), "dir");
const studentMode = process.argv.includes("--student");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = {
  id: id(1),
  email: "admin@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const profile = {
  id: user.id,
  first_name: "QA",
  last_name: "Admin",
  role: "super_admin",
  language: "hr",
  active: true,
};
const student = {
  id: id(2),
  first_name: "Test",
  last_name: "Student",
  email: "student@example.test",
  language: "hr",
  active: true,
  role: "student",
  invited_at: null,
  confirmed_at: new Date().toISOString(),
};
const modules = [
  {
    id: id(10),
    title: "QA module",
    description: "Isolated test content",
    status: "draft",
    sort_order: 0,
    cover_path: null,
    updated_at: new Date().toISOString(),
  },
];
const lessons = [
  {
    id: id(20),
    module_id: id(10),
    title: "QA text lesson",
    status: "draft",
    sort_order: 0,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test instructions." }],
        },
      ],
    },
    bunny_video_id: null,
    updated_at: new Date().toISOString(),
  },
];
const access = [];
const progress = [];
const attachments = [];
if(studentMode) {
  profile.role = 'student'; profile.first_name = 'QA Student';
  modules[0].status = 'published';
  modules.push({...modules[0],id:id(11),title:'SECRET UNASSIGNED MODULE'});
  modules.push({...modules[0],id:id(12),title:'SECRET DRAFT MODULE',status:'draft'});
  lessons[0].status='published';
  lessons.push({...lessons[0],id:id(21),title:'Second lesson',sort_order:1,bunny_video_id:id(50)});
  lessons.push({...lessons[0],id:id(22),title:'SECRET DRAFT LESSON',status:'draft'});
  lessons.push({...lessons[0],id:id(23),module_id:id(11),title:'SECRET UNASSIGNED LESSON'});
  access.push({student_id:user.id,module_id:id(10),granted_at:new Date().toISOString()});
  attachments.push({id:id(30),lesson_id:id(20),ready:true,original_filename:'Lesson instructions.txt',mime_type:'text/plain',file_size_bytes:21,sort_order:0,storage_path:`${id(20)}/${id(30)}/instructions.txt`});
  attachments.push({...attachments[0],id:id(31),ready:false,original_filename:'SECRET PENDING FILE'});
  attachments.push({...attachments[0],id:id(32),lesson_id:id(22),original_filename:'SECRET DRAFT FILE'});
}

const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400, session_id: id(101) })}.fixture`;
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "http://localhost:4300");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader(
    "access-control-allow-methods",
    "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url, "http://localhost:4301");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {}
  const send = (value) => res.end(JSON.stringify(value));
  const page = (rows) => {
    const from = Number(url.searchParams.get("offset") || 0);
    return rows.slice(
      from,
      from + Number(url.searchParams.get("limit") || rows.length),
    );
  };
  if (url.pathname === "/auth/v1/token")
    return send({
      access_token: token,
      refresh_token: "fixture-refresh",
      expires_in: 86400,
      token_type: "bearer",
      user,
    });
  if (url.pathname === "/auth/v1/user") return send(user);
  if (url.pathname === "/auth/v1/logout") return send({});
  const signedPath = `/storage/v1/object/sign/lesson-attachments/${id(20)}/${id(30)}/instructions.txt`;
  if(url.pathname === signedPath) {
    if(req.method === 'POST' && req.headers.apikey === 'fixture-secret-key' && body.expiresIn === 300)
      return send({signedURL:`/object/sign/lesson-attachments/${id(20)}/${id(30)}/instructions.txt?token=fixture-download`});
    if(req.method === 'GET' && url.searchParams.get('token') === 'fixture-download') {
      res.setHeader('content-type','text/plain');
      res.setHeader('content-disposition','attachment; filename="Lesson instructions.txt"');
      return res.end('Fixture instructions.');
    }
    res.statusCode=403; return send({message:'Denied'});
  }
  if (url.pathname === "/auth/v1/recover") return send({});
  if (url.pathname === "/auth/v1/invite") {
    res.statusCode = 400;
    return send({ msg: "Fixture does not send email" });
  }
  if (url.pathname === "/rest/v1/rpc/is_active_user") return send(true);
  if (url.pathname === "/rest/v1/rpc/current_profile") return send([profile]);
  if (url.pathname === "/rest/v1/rpc/admin_student_directory")
    return send(
      page(
        url.searchParams.has("id") &&
          url.searchParams.get("id") !== `eq.${student.id}`
          ? []
          : [student],
      ),
    );
  if (url.pathname === "/rest/v1/rpc/admin_find_account")
    return send(
      body.target_email === student.email
        ? [{ id: student.id, role: "student" }]
        : [],
    );
  if (url.pathname === "/rest/v1/rpc/admin_update_student") {
    Object.assign(student, {
      first_name: body.given_name,
      last_name: body.family_name,
      language: body.target_language,
      active: body.target_active,
    });
    return send(null);
  }
  if (
    url.pathname === "/rest/v1/rpc/admin_set_access" ||
    url.pathname === "/rest/v1/rpc/admin_provision_student"
  ) {
    if (url.pathname.endsWith("admin_set_access"))
      access.splice(0, access.length);
    for (const m of body.selected)
      if (!access.some((a) => a.module_id === m))
        access.push({ student_id: student.id, module_id: m, granted_at: new Date().toISOString() });
    return send(null);
  }
  if (url.pathname === "/rest/v1/rpc/admin_reorder") {
    for (const [i, key] of body.ordered_ids.entries())
      (body.kind === "modules" ? modules : lessons).find(
        (r) => r.id === key,
      ).sort_order = i;
    return send(null);
  }
  if (url.pathname === "/rest/v1/rpc/admin_upload_limit")
    return send(50_000_000);
  const table = url.pathname.split("/").pop(),
    tables = {
      profiles: [profile, student],
      modules,
      lessons,
      module_access: access,
      lesson_attachments: attachments,
      lesson_progress: progress,
    };
  if (url.pathname.startsWith("/rest/v1/") && tables[table]) {
    let rows = tables[table].filter((row) =>
      [...url.searchParams].every(
        ([k, v]) => !v.startsWith("eq.") || String(row[k]) === v.slice(3),
      ),
    );
    if(studentMode) {
      if(table==='modules') rows=rows.filter(r=>r.id===id(10)&&r.status==='published');
      if(table==='lessons') rows=rows.filter(r=>r.module_id===id(10)&&r.status==='published');
      if(table==='lesson_progress') rows=rows.filter(r=>r.student_id===user.id);
      if(table==='lesson_attachments') rows=rows.filter(r=>r.ready&&r.lesson_id===id(20));
    }
    if (req.method === 'DELETE' && table==='lesson_progress') {
      for(const row of rows) progress.splice(progress.indexOf(row),1);
      return send(null);
    }
    if (req.method === "POST") {
      const row = {
        id: randomUUID(),
        status: "draft",
        sort_order: 0,
        description: "",
        cover_path: null,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        bunny_video_id: null,
        updated_at: new Date().toISOString(),
        ...body,
      };
      if(table!=='lesson_progress' || !progress.some(p=>p.student_id===row.student_id&&p.lesson_id===row.lesson_id)) tables[table].push(row);
      rows = [row];
    }
    if (req.method === "PATCH")
      rows.forEach((row) =>
        Object.assign(row, body, { updated_at: new Date().toISOString() }),
      );
    rows = [...rows].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    if (
      table === "modules" &&
      url.searchParams.get("select")?.includes("count")
    )
      rows = rows.map((m) => ({
        ...m,
        lessons: [
          { count: lessons.filter((l) => l.module_id === m.id).length },
        ],
        module_access: [
          { count: access.filter((a) => a.module_id === m.id).length },
        ],
      }));
    res.setHeader(
      "content-range",
      `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
    );
    rows = page(rows);
    return send(
      req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows,
    );
  }
  console.error("Unimplemented fixture route", req.method, url.pathname);
  res.statusCode = 404;
  send({ message: "fixture endpoint not implemented" });
});
server.listen(4301, "127.0.0.1", () =>
  console.log("Simulated Supabase: localhost:4301"),
);
const child = spawn(
  process.execPath,
  [
    join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "-p",
    "4300",
  ],
  {
    cwd: dir,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4301",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
      SUPABASE_SECRET_KEY: "fixture-secret-key",
      BUNNY_STREAM_API_KEY: "",
      BUNNY_STREAM_DELIVERY_VERIFIED: "false",
      BUNNY_STREAM_TOKEN_AUTH_KEY: "",
      BUNNY_STREAM_LIBRARY_ID: "820051",
      APP_URL: "http://localhost:4300",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
function stop() {
  child.kill("SIGTERM");
  server.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", () => server.close());
console.log(
  `Browser QA: http://localhost:4300/hr/login (any fixture email/password); temporary copy ${dir}`,
);
