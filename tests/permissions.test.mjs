import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function actor(n, fn, role = "authenticated") {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id(n), session_id: id(n + 100) }),
    ]);
    await db.exec(`set local role ${role}`);
    await fn();
  } finally {
    await db.exec("rollback");
  }
}
async function count(table) {
  return (await db.query(`select * from public.${table}`)).rows.length;
}
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create role service_role bypassrls;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,invited_at timestamptz,email_confirmed_at timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);
grant usage on schema auth to supabase_auth_admin;grant select,delete on auth.users to supabase_auth_admin;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema public,auth,storage to authenticated,anon,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,metadata jsonb);
alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const f of [
    "202611240001_foundation.sql",
    "202611240002_private_storage.sql",
    "202611240003_admin_experience.sql",
    "202611250004_module_archive.sql",
    "202611250005_permanent_deletion.sql",
    "202611250006_lesson_deletion.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + f, import.meta.url),
        "utf8",
      ),
    );
  for (const n of [1, 2, 3, 4]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id(n),
      `test${n}@example.test`,
    ]);
    await db.query("insert into auth.sessions values($1,$2)", [
      id(n + 100),
      id(n),
    ]);
    await db.query(
      "insert into public.profiles(id,first_name,last_name,role,active) values($1,'Test','User',$2,$3)",
      [id(n), n === 1 ? "super_admin" : "student", n !== 4],
    );
  }
  for (const n of [10, 11, 12])
    await db.query(
      "insert into public.modules(id,title,status) values($1,'Test module',$2)",
      [id(n), n === 12 ? "draft" : "published"],
    );
  for (const [n, m, status] of [
    [20, 10, "published"],
    [21, 10, "draft"],
    [22, 11, "published"],
    [23, 12, "published"],
  ])
    await db.query(
      "insert into public.lessons(id,module_id,title,status) values($1,$2,'Test lesson',$3)",
      [id(n), id(m), status],
    );
  for (const [s, m] of [
    [2, 10],
    [2, 12],
    [3, 11],
    [4, 10],
  ])
    await db.query(
      "insert into public.module_access(student_id,module_id,granted_by) values($1,$2,$3)",
      [id(s), id(m), id(1)],
    );
  await db.query(
    "insert into public.lesson_attachments(id,lesson_id,storage_path,original_filename,mime_type,file_size_bytes,uploaded_by,ready) values($1,$2,'test/file.pdf','file.pdf','application/pdf',100,$3,true)",
    [id(30), id(20), id(1)],
  );
  await db.exec(
    "insert into storage.objects(bucket_id,name) values('lesson-attachments','test/file.pdf')",
  );
});
after(() => db.close());
test("stale module edits cannot overwrite the version another editor saved", () =>
  actor(1, async () => {
    const version = (await db.query("select updated_at::text as version from public.modules where id=$1", [id(10)])).rows[0].version;
    const current = await db.query("update public.modules set title='Current edit' where id=$1 and updated_at=$2::timestamptz returning id", [id(10), version]);
    assert.equal(current.rows.length, 1);
    const stale = await db.query("update public.modules set title='Stale edit' where id=$1 and updated_at=$2::timestamptz returning id", [id(10), version]);
    assert.equal(stale.rows.length, 0);
    assert.equal((await db.query("select title from public.modules where id=$1", [id(10)])).rows[0].title, "Current edit");
  }));

test("a session belonging to another user cannot satisfy active authorization", () =>
  actor(2, async () => {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub:id(2),session_id:id(101)})]);
    assert.equal((await db.query("select public.is_active_user() as active")).rows[0].active, false);
    assert.equal(await count("modules"), 0);
  }));

test("security definers fix search paths and anonymous callers cannot execute them", async () => {
  const functions = (await db.query("select p.oid,p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows;
  assert.ok(functions.length > 10);
  for (const fn of functions) {
    assert.ok(fn.proconfig.some(value => value === 'search_path=""'), fn.proname);
    assert.equal((await db.query("select has_function_privilege('anon',$1::oid,'execute') as allowed", [fn.oid])).rows[0].allowed, false, fn.proname);
  }
});
test("all six tables reject anonymous reads", async () => {
  for (const t of [
    "profiles",
    "modules",
    "lessons",
    "module_access",
    "lesson_attachments",
    "lesson_progress",
  ])
    await actor(2, () => assert.rejects(() => count(t)), "anon");
});
test("students see only assigned published modules and lessons", () =>
  actor(2, async () => {
    assert.equal(await count("modules"), 1);
    assert.equal(await count("lessons"), 1);
    assert.equal(await count("module_access"), 0);
    assert.equal(await count("lesson_attachments"), 1);
  }));
test("cross-student profiles and attachments are isolated", () =>
  actor(3, async () => {
    assert.equal(await count("profiles"), 1);
    assert.equal(await count("lesson_attachments"), 0);
  }));
test("student cannot escalate role", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.exec("update public.profiles set role='super_admin'"),
    ),
  ));
test("student cannot reactivate account", () =>
  actor(4, () =>
    assert.rejects(() => db.exec("update public.profiles set active=true")),
  ));
test("student cannot insert access", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.query("insert into public.module_access values($1,$2,now(),$1)", [
        id(2),
        id(11),
      ]),
    ),
  ));
test("student cannot insert content", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.exec("insert into public.modules(title) values('Illegal')"),
    ),
  ));
test("student cannot call admin functions", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.query("select public.admin_update_student($1,'X','Y','hr',true)", [
        id(4),
      ]),
    ),
  ));
test("inactive account cannot read any private rows", () =>
  actor(4, async () => {
    for (const t of [
      "profiles",
      "modules",
      "lessons",
      "module_access",
      "lesson_attachments",
      "lesson_progress",
    ])
      assert.equal(await count(t), 0);
  }));
test("revocation immediately removes lesson access", () =>
  actor(1, async () => {
    await db.query("delete from public.module_access where student_id=$1", [
      id(2),
    ]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id(2), session_id: id(102) }),
    ]);
    assert.equal(await count("lessons"), 0);
  }));
test("admin previews drafts", () =>
  actor(1, async () => {
    assert.equal(await count("modules"), 3);
    assert.equal(await count("lessons"), 4);
  }));
test("completion is own and accessible, unique, and reversible", () =>
  actor(2, async () => {
    await db.query(
      "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
      [id(2), id(20)],
    );
    assert.equal(await count("lesson_progress"), 1);
    await db.exec("delete from public.lesson_progress");
    assert.equal(await count("lesson_progress"), 0);
  }));
test("cannot complete another student lesson", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
        [id(3), id(20)],
      ),
    ),
  ));
test("cannot complete unauthorized lesson", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
        [id(2), id(22)],
      ),
    ),
  ));
test("duplicate completion rejected", () =>
  actor(2, async () => {
    await db.query(
      "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
      [id(2), id(20)],
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
        [id(2), id(20)],
      ),
    );
  }));
test("duplicate grants rejected", () =>
  actor(1, () =>
    assert.rejects(() =>
      db.query(
        "insert into public.module_access(student_id,module_id,granted_by) values($1,$2,$3)",
        [id(2), id(10), id(1)],
      ),
    ),
  ));
test("non-student access target rejected", () =>
  actor(1, () =>
    assert.rejects(() =>
      db.query(
        "insert into public.module_access(student_id,module_id,granted_by) values($1,$2,$1)",
        [id(1), id(10)],
      ),
    ),
  ));
test("invalid title and publication status rejected", async () => {
  await actor(1, () =>
    assert.rejects(() =>
      db.exec("insert into public.modules(title) values(' ')"),
    ),
  );
  await actor(1, () =>
    assert.rejects(() =>
      db.exec(
        "insert into public.modules(title,status) values('A','approved')",
      ),
    ),
  );
});
test("storage private and student object reads denied", () =>
  actor(2, async () => {
    assert.equal(
      (await db.exec("select * from storage.objects"))[0].rows.length,
      0,
    );
  }));
test("storage upload denied to students", () =>
  actor(2, () =>
    assert.rejects(() =>
      db.exec(
        "insert into storage.objects(bucket_id,name) values('lesson-attachments','bad')",
      ),
    ),
  ));
test("admin arbitrary attachment upload also denied without reservation", () =>
  actor(1, () =>
    assert.rejects(() =>
      db.exec(
        "insert into storage.objects(bucket_id,name) values('lesson-attachments','bad')",
      ),
    ),
  ));
test("revoked session cannot read content", () =>
  actor(2, async () => {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id(2), session_id: id(999) }),
    ]);
    assert.equal(await count("modules"), 0);
  }));

async function asUser(n) {
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id(n), session_id: id(n + 100) }),
  ]);
}
async function rejectsStatement(fn) {
  await db.exec("savepoint expected_failure");
  await assert.rejects(fn);
  await db.exec("rollback to savepoint expected_failure");
}
test("admin creates and edits content; module publication preserves lesson statuses", () =>
  actor(1, async () => {
    const m = (
      await db.query(
        "insert into public.modules(title) values('New') returning *",
      )
    ).rows[0];
    assert.equal(m.status, "draft");
    const l = (
      await db.query(
        "insert into public.lessons(module_id,title) values($1,'Text only') returning *",
        [m.id],
      )
    ).rows[0];
    assert.equal(l.bunny_video_id, null);
    await db.query(
      "update public.modules set title='Renamed',description='Description',status='published' where id=$1",
      [m.id],
    );
    await db.query(
      "update public.lessons set title='Edited',content=$2 where id=$1",
      [
        l.id,
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Homework" }],
            },
          ],
        }),
      ],
    );
    assert.equal(
      (await db.query("select status from public.lessons where id=$1", [l.id]))
        .rows[0].status,
      "draft",
    );
    await db.query("update public.modules set status='draft' where id=$1", [
      id(10),
    ]);
    await asUser(2);
    assert.equal(await count("lessons"), 0);
    await asUser(1);
    assert.deepEqual(
      (
        await db.query(
          "select status from public.lessons where module_id=$1 order by id",
          [id(10)],
        )
      ).rows.map((r) => r.status),
      ["published", "draft"],
    );
    await db.query("update public.modules set status='published' where id=$1", [
      id(10),
    ]);
    await asUser(2);
    assert.equal(await count("lessons"), 1);
  }));
test("admin cannot destructively delete modules or lessons", async () => {
  for (const table of ["modules", "lessons"])
    await actor(1, () =>
      assert.rejects(() => db.exec(`delete from public.${table}`)),
    );
});
test("module and lesson reorder persists exact contiguous positions", () =>
  actor(1, async () => {
    await db.query("select public.admin_reorder('modules',null,$1)", [
      [id(12), id(10), id(11)],
    ]);
    assert.deepEqual(
      (
        await db.query(
          "select id,sort_order from public.modules order by sort_order",
        )
      ).rows,
      [
        { id: id(12), sort_order: 0 },
        { id: id(10), sort_order: 1 },
        { id: id(11), sort_order: 2 },
      ],
    );
    await db.query("select public.admin_reorder('lessons',$1,$2)", [
      id(10),
      [id(21), id(20)],
    ]);
    assert.equal(
      (
        await db.query("select sort_order from public.lessons where id=$1", [
          id(21),
        ])
      ).rows[0].sort_order,
      0,
    );
  }));
test("stale, duplicate and cross-module reorder selections roll back", () =>
  actor(1, async () => {
    const before = (
      await db.query("select id,sort_order from public.modules order by id")
    ).rows;
    for (const ids of [
      [id(10), id(11)],
      [id(10), id(10), id(12)],
      [id(10), id(11), id(99)],
    ]) {
      await rejectsStatement(() =>
        db.query("select public.admin_reorder('modules',null,$1)", [ids]),
      );
    }
    await rejectsStatement(() =>
      db.query("select public.admin_reorder('lessons',$1,$2)", [
        id(10),
        [id(20), id(22)],
      ]),
    );
    assert.deepEqual(
      (await db.query("select id,sort_order from public.modules order by id"))
        .rows,
      before,
    );
  }));
test("access replacement deduplicates and select-all excludes future modules", () =>
  actor(1, async () => {
    const all = (await db.query("select id from public.modules")).rows.map(
      (m) => m.id,
    );
    await db.query("select public.admin_set_access($1,$2,false)", [
      id(2),
      [...all, all[0]],
    ]);
    await db.query("insert into public.modules(id,title) values($1,'Future')", [
      id(13),
    ]);
    const rows = (
      await db.query(
        "select module_id from public.module_access where student_id=$1",
        [id(2)],
      )
    ).rows;
    assert.equal(rows.length, 3);
    assert.equal(
      rows.some((r) => r.module_id === id(13)),
      false,
    );
    await asUser(2);
    assert.equal(await count("modules"), 2); // Assigned draft still hidden.
  }));
test("invalid access replacement leaves previous grants untouched", () =>
  actor(1, async () => {
    await rejectsStatement(() =>
      db.query("select public.admin_set_access($1,$2,false)", [
        id(2),
        [id(11), id(99)],
      ]),
    );
    assert.deepEqual(
      (
        await db.query(
          "select module_id from public.module_access where student_id=$1 order by module_id",
          [id(2)],
        )
      ).rows.map((r) => r.module_id),
      [id(10), id(12)],
    );
  }));
test("revocation and deactivation preserve completion history and assignments", () =>
  actor(2, async () => {
    await db.query(
      "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
      [id(2), id(20)],
    );
    await asUser(1);
    await db.query("select public.admin_set_access($1,$2,false)", [id(2), []]);
    assert.equal(await count("lesson_progress"), 1);
    await asUser(2);
    assert.equal(await count("lessons"), 0);
    await asUser(1);
    await db.query("select public.admin_set_access($1,$2,false)", [
      id(2),
      [id(10)],
    ]);
    await db.query(
      "select public.admin_update_student($1,'Test','User','hr',false)",
      [id(2)],
    );
    await asUser(2);
    assert.equal(await count("lessons"), 0);
    assert.equal(await count("lesson_progress"), 0);
    await asUser(1);
    assert.equal(
      (
        await db.query(
          "select * from public.module_access where student_id=$1",
          [id(2)],
        )
      ).rows.length,
      1,
    );
    assert.equal(await count("lesson_progress"), 1);
    await db.query(
      "select public.admin_update_student($1,'Test','User','en',true)",
      [id(2)],
    );
    await asUser(2);
    assert.equal(await count("lesson_progress"), 1);
    assert.equal(await count("lessons"), 1);
  }));
test("student provisioning retries are additive and do not reactivate an existing account", () =>
  actor(1, async () => {
    for (let i = 0; i < 2; i++)
      await db.query(
        "select public.admin_provision_student($1,'Changed','Name','en',$2)",
        [id(4), [id(11)]],
      );
    assert.equal(
      (
        await db.query(
          "select * from public.module_access where student_id=$1",
          [id(4)],
        )
      ).rows.length,
      2,
    );
    const p = (
      await db.query("select * from public.profiles where id=$1", [id(4)])
    ).rows[0];
    assert.equal(p.active, false);
    assert.equal(p.first_name, "Test");
  }));
test("profile and access provisioning is atomic for orphaned Auth account", () =>
  actor(1, async () => {
    await db.exec("reset role");
    await db.query(
      "insert into auth.users(id,email) values($1,'orphan@example.test')",
      [id(5)],
    );
    await db.exec("set local role authenticated");
    await rejectsStatement(() =>
      db.query(
        "select public.admin_provision_student($1,'New','Student','hr',$2)",
        [id(5), [id(999)]],
      ),
    );
    assert.equal(
      (await db.query("select id from public.profiles where id=$1", [id(5)]))
        .rows.length,
      0,
    );
    await db.query(
      "select public.admin_provision_student($1,'New','Student','hr',$2)",
      [id(5), [id(12)]],
    );
    assert.equal(
      (await db.query("select role from public.profiles where id=$1", [id(5)]))
        .rows[0].role,
      "student",
    );
    assert.equal(
      (
        await db.query(
          "select * from public.admin_find_account(' ORPHAN@example.test ')",
        )
      ).rows[0].id,
      id(5),
    );
  }));
test("directory contains students with Auth email, excluding administrators", () =>
  actor(1, async () => {
    const rows = (
      await db.query("select * from public.admin_student_directory()")
    ).rows;
    assert.equal(rows.length, 3);
    assert.equal(rows[0].email, "test2@example.test");
    assert.equal(
      rows.some((r) => r.id === id(1)),
      false,
    );
  }));
test("every Phase 2 RPC rejects students, inactive admins and revoked sessions", async () => {
  const calls = [
    [
      "select public.admin_reorder('modules',null,$1)",
      [[id(10), id(11), id(12)]],
    ],
    ["select public.admin_set_access($1,$2,false)", [id(2), [id(11)]]],
    ["select public.admin_student_directory()", []],
    ["select public.admin_find_account('test1@example.test')", []],
    ["select public.admin_provision_student($1,'A','B','hr',$2)", [id(2), []]],
    ["select public.admin_upload_limit('lesson-attachments')", []],
    ["select public.admin_finish_attachment($1)", [id(30)]],
    ["select public.admin_set_cover($1,$2)", [id(10), `${id(10)}/test.jpg`]],
  ];
  for (const mode of ["student", "inactive-admin", "revoked-admin"])
    await actor(mode === "student" ? 2 : 1, async () => {
      if (mode === "inactive-admin") {
        await db.exec("reset role");
        await db.query("update public.profiles set active=false where id=$1", [
          id(1),
        ]);
        await db.exec("set local role authenticated");
      }
      if (mode === "revoked-admin")
        await db.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: id(1), session_id: id(999) }),
        ]);
      for (const [sql, params] of calls)
        await rejectsStatement(() => db.query(sql, params));
    });
});
test("student cannot change content publication or attachment state", () =>
  actor(2, async () => {
    for (const table of ["modules", "lessons"])
      assert.equal(
        (
          await db.query(
            `update public.${table} set status='published' returning id`,
          )
        ).rows.length,
        0,
      );
    assert.equal(
      (
        await db.query(
          "update public.lesson_attachments set ready=true returning id",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from public.lesson_attachments returning id"))
        .rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from storage.objects returning id")).rows.length,
      0,
    );
  }));
async function attachment(n, size = 100) {
  const path = `${id(20)}/${id(n)}/file.pdf`;
  await db.query(
    "insert into public.lesson_attachments(id,lesson_id,storage_path,original_filename,mime_type,file_size_bytes,uploaded_by) values($1,$2,$3,'file.pdf','application/pdf',$4,$5)",
    [id(n), id(20), path, size, id(1)],
  );
  return path;
}
test("attachment finalize verifies persisted object size and MIME before ready", () =>
  actor(1, async () => {
    for (const [n, meta, valid] of [
      [31, { size: 100, mimetype: "application/pdf" }, true],
      [32, { size: 99, mimetype: "application/pdf" }, false],
      [33, { size: 100, mimetype: "text/html" }, false],
      [34, null, false],
    ]) {
      const path = await attachment(n);
      if (meta)
        await db.query(
          "insert into storage.objects(bucket_id,name,metadata) values('lesson-attachments',$1,$2)",
          [path, JSON.stringify(meta)],
        );
      if (valid)
        await db.query("select public.admin_finish_attachment($1)", [id(n)]);
      else
        await rejectsStatement(() =>
          db.query("select public.admin_finish_attachment($1)", [id(n)]),
        );
      assert.equal(
        (
          await db.query(
            "select ready from public.lesson_attachments where id=$1",
            [id(n)],
          )
        ).rows[0].ready,
        valid,
      );
    }
  }));
test("new attachments honor 50 MB and lower bucket limits", () =>
  actor(1, async () => {
    assert.equal(
      Number(
        (
          await db.query(
            "select public.admin_upload_limit('lesson-attachments') as lim",
          )
        ).rows[0].lim,
      ),
      50_000_000,
    );
    await attachment(35, 50_000_000);
    await rejectsStatement(() => attachment(36, 50_000_001));
    await db.exec(
      "reset role;update storage.buckets set file_size_limit=10 where id='lesson-attachments';set local role authenticated",
    );
    assert.equal(
      Number(
        (
          await db.query(
            "select public.admin_upload_limit('lesson-attachments') as lim",
          )
        ).rows[0].lim,
      ),
      10,
    );
    await rejectsStatement(() => attachment(37, 11));
  }));
test("cover finalization validates module path, object MIME and size", () =>
  actor(1, async () => {
    const path = `${id(10)}/cover.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('module-covers',$1,$2)",
      [path, JSON.stringify({ size: 100, mimetype: "image/jpeg" })],
    );
    await rejectsStatement(() =>
      db.query("select public.admin_set_cover($1,$2)", [id(11), path]),
    );
    await db.query("select public.admin_set_cover($1,$2)", [id(10), path]);
    assert.equal(
      (
        await db.query("select cover_path from public.modules where id=$1", [
          id(10),
        ])
      ).rows[0].cover_path,
      path,
    );
  }));

test("student completion insert-on-conflict is idempotent without UPDATE privileges", () =>
  actor(2, async () => {
    for (let i = 0; i < 2; i++)
      await db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2) on conflict(student_id,lesson_id) do nothing",
        [id(2), id(20)],
      );
    assert.equal(await count("lesson_progress"), 1);
    await rejectsStatement(() =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2) on conflict do nothing",
        [id(3), id(20)],
      ),
    );
    await rejectsStatement(() =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id) values($1,$2) on conflict do nothing",
        [id(2), id(21)],
      ),
    );
  }));
test("ready attachments in draft or unassigned lessons remain invisible to students", () =>
  actor(1, async () => {
    for (const n of [21, 22])
      await db.query(
        "insert into public.lesson_attachments(lesson_id,storage_path,original_filename,mime_type,file_size_bytes,uploaded_by,ready) values($1,$2,'hidden.pdf','application/pdf',100,$3,true)",
        [id(n), `hidden/${n}.pdf`, id(1)],
      );
    await asUser(2);
    assert.equal(await count("lesson_attachments"), 1);
  }));

test("archive denies student module, lesson and attachment reads and restores preserved progress", async () => {
 await actor(2, async () => {
  await db.query("insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",[id(2),id(20)]);
  await asUser(1);
  await db.query("update public.modules set archived_at=now() where id=$1",[id(10)]);
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(2),session_id:id(102)})]);
  assert.equal((await db.query("select * from public.modules where id=$1",[id(10)])).rows.length,0);
  assert.equal((await db.query("select * from public.lessons where id=$1",[id(20)])).rows.length,0);
  assert.equal((await db.query("select * from public.lesson_attachments where lesson_id=$1",[id(20)])).rows.length,0);
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(1),session_id:id(101)})]);
  assert.equal((await db.query("select * from public.lesson_progress where student_id=$1",[id(2)])).rows.length,1);
  await db.query("select public.admin_reorder('modules',null,$1::uuid[])",[[id(11),id(12)]]);
  await db.query("update public.modules set archived_at=null where id=$1",[id(10)]);
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(2),session_id:id(102)})]);
  assert.equal((await db.query("select status from public.modules where id=$1",[id(10)])).rows[0].status,'published');
  assert.equal((await db.query("select * from public.lesson_progress where lesson_id=$1",[id(20)])).rows.length,1);
 });
});

test("students cannot archive or restore modules; restoring a draft does not publish it", () =>
  actor(2, async () => {
    assert.equal((await db.query("update public.modules set archived_at=now() where id=$1 returning id", [id(10)])).rows.length, 0);
    await asUser(1);
    await db.query("update public.modules set archived_at=now() where id in ($1,$2)", [id(10),id(12)]);
    await asUser(2);
    assert.equal((await db.query("update public.modules set archived_at=null where id=$1 returning id", [id(10)])).rows.length, 0);
    await asUser(1);
    await db.query("update public.modules set archived_at=null where id=$1", [id(12)]);
    assert.equal((await db.query("select status from public.modules where id=$1", [id(12)])).rows[0].status, "draft");
    await asUser(2);
    assert.equal(await count("modules"), 0);
    assert.equal(await count("lessons"), 0);
  }));

test("permanent module deletion requires archive, exact confirmation and active administrator", async () => {
  await actor(1, async () => {
    await rejectsStatement(() => db.query("select public.admin_delete_archived_module($1,'Test module')", [id(10)]));
    await db.query("update public.modules set archived_at=now() where id=$1", [id(10)]);
    await rejectsStatement(() => db.query("select public.admin_delete_archived_module($1,'wrong title')", [id(10)]));
    for (const n of [2,4]) {
      await asUser(n);
      await rejectsStatement(() => db.query("select public.admin_delete_archived_module($1,'Test module')", [id(10)]));
    }
    await asUser(1);
    assert.equal(await count("modules"), 3);
    assert.equal(await count("file_deletion_queue"), 0);
  });
});

test("module deletion removes its descendants only and durably queues associated files", () =>
  actor(2, async () => {
    await db.query("insert into public.lesson_progress(student_id,lesson_id) values($1,$2)", [id(2),id(20)]);
    await asUser(1);
    await db.query("update public.modules set archived_at=now(),cover_path='test/cover.png' where id=$1", [id(10)]);
    await db.query("select public.admin_delete_archived_module($1,'Test module')", [id(10)]);
    assert.equal(await count("modules"), 2);
    assert.equal(await count("lessons"), 2);
    assert.equal(await count("lesson_attachments"), 0);
    assert.equal(await count("lesson_progress"), 0);
    assert.equal(await count("module_access"), 2);
    assert.equal(await count("profiles"), 4);
    const queue = (await db.query("select * from public.file_deletion_queue order by bucket")).rows;
    assert.deepEqual(queue, [{bucket:"lesson-attachments",path:"test/file.pdf"},{bucket:"module-covers",path:"test/cover.png"}]);
    // DB metadata deletion must not pretend to remove actual Storage bytes.
    assert.equal((await db.query("select * from storage.objects")).rows.length,1);
    await asUser(2);
    assert.equal(await count("file_deletion_queue"),0);
    await rejectsStatement(() => db.query("insert into public.file_deletion_queue values('module-covers','arbitrary')"));
    await db.query("delete from public.file_deletion_queue");
    await asUser(1);
    assert.equal(await count("file_deletion_queue"),2);
    await db.query("delete from public.file_deletion_queue where bucket='module-covers'");
    assert.equal(await count("file_deletion_queue"),1);
  }));

test("Auth deletion atomically removes only an inactive student's profile, access, progress and sessions", () =>
  actor(2, async () => {
    await db.query("insert into public.lesson_progress(student_id,lesson_id) values($1,$2)", [id(2),id(20)]);
    await asUser(1);
    await db.query("select public.admin_update_student($1,'Test','User','hr',false)", [id(2)]);
    await db.exec("set local role supabase_auth_admin");
    await db.query("delete from auth.users where id=$1", [id(2)]);
    await db.exec("set local role authenticated");
    assert.equal(await count("profiles"),3);
    assert.equal(await count("lesson_progress"),0);
    assert.equal(await count("module_access"),2);
    assert.equal(await count("modules"),3);
    await asUser(2);
    assert.equal((await db.query("select public.is_active_user() as active")).rows[0].active,false);
  }));

test("Auth deletion guard rejects active students and all administrators without partial deletion", () =>
  actor(1, async () => {
    await db.exec("set local role supabase_auth_admin");
    for (const n of [1,2]) {
      await rejectsStatement(() => db.query("delete from auth.users where id=$1", [id(n)]));
      assert.equal((await db.query("select id from auth.users where id=$1", [id(n)])).rows.length,1);
    }
    await db.exec("set local role authenticated");
    assert.equal(await count("profiles"),4);
    await rejectsStatement(() => db.query("delete from public.profiles where id=$1", [id(4)]));
  }));

test("inactive and revoked administrators cannot permanently delete modules", () =>
  actor(1, async () => {
    await db.query("update public.modules set archived_at=now() where id=$1", [id(10)]);
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1", [id(1)]);
    await db.exec("set local role authenticated");
    await rejectsStatement(() => db.query("select public.admin_delete_archived_module($1,'Test module')", [id(10)]));
    await db.exec("reset role");
    await db.query("update public.profiles set active=true where id=$1", [id(1)]);
    await db.query("delete from auth.sessions where user_id=$1", [id(1)]);
    await db.exec("set local role authenticated");
    await rejectsStatement(() => db.query("select public.admin_delete_archived_module($1,'Test module')", [id(10)]));
  }));

test("delete published lesson preserves its module, assignments, other lessons and their progress", () =>
  actor(2, async () => {
    await db.query("insert into public.lesson_progress(student_id,lesson_id) values($1,$2)", [id(2),id(20)]);
    await asUser(3);
    await db.query("insert into public.lesson_progress(student_id,lesson_id) values($1,$2)", [id(3),id(22)]);
    await asUser(1);
    await db.query("select public.admin_delete_lesson($1,'Test lesson')", [id(20)]);
    assert.equal(await count("modules"),3);
    assert.equal(await count("module_access"),4);
    assert.equal(await count("lessons"),3);
    assert.equal(await count("lesson_attachments"),0);
    assert.deepEqual((await db.query("select lesson_id from public.lesson_progress")).rows,[{lesson_id:id(22)}]);
    assert.deepEqual((await db.query("select * from public.file_deletion_queue")).rows,[{bucket:"lesson-attachments",path:"test/file.pdf"}]);
    await asUser(2);
    assert.equal((await db.query("select public.can_read_lesson($1) as allowed",[id(20)])).rows[0].allowed,false);
  }));

test("draft lesson can be deleted without archiving; missing and mismatched confirmations fail atomically", () =>
  actor(1, async () => {
    for (const confirmation of ["wrong", null, ""]) {
      await rejectsStatement(() => db.query("select public.admin_delete_lesson($1,$2)", [id(20),confirmation]));
    }
    await rejectsStatement(() => db.query("select public.admin_delete_lesson($1,'Test lesson')", [id(999)]));
    assert.equal(await count("lesson_attachments"),1);
    assert.equal(await count("file_deletion_queue"),0);
    await db.query("select public.admin_delete_lesson($1,'Test lesson')", [id(21)]);
    assert.equal(await count("lessons"),3);
    assert.equal(await count("lesson_attachments"),1);
    assert.equal(await count("file_deletion_queue"),0);
    await rejectsStatement(() => db.query("select public.admin_delete_lesson($1,'Test lesson')", [id(21)]));
  }));

test("lesson deletion rejects students, inactive admins, revoked sessions and anonymous callers", async () => {
  for (const n of [2,4]) await actor(n, () => assert.rejects(() => db.query("select public.admin_delete_lesson($1,'Test lesson')",[id(20)])));
  await actor(1, () => assert.rejects(() => db.query("select public.admin_delete_lesson($1,'Test lesson')",[id(20)])), "anon");
  await actor(1, async () => {
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1",[id(1)]);
    await db.exec("set local role authenticated");
    await rejectsStatement(() => db.query("select public.admin_delete_lesson($1,'Test lesson')",[id(20)]));
    await db.exec("reset role");
    await db.query("update public.profiles set active=true where id=$1",[id(1)]);
    await db.query("delete from auth.sessions where user_id=$1",[id(1)]);
    await db.exec("set local role authenticated");
    await rejectsStatement(() => db.query("select public.admin_delete_lesson($1,'Test lesson')",[id(20)]));
  });
});
