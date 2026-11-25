import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  moduleProgress,
  authorizedLesson,
  authorizedAttachment,
  setLessonCompletion,
} from "../src/lib/learning.ts";
import {
  signedEmbed,
  PLAYBACK_TTL_SECONDS,
} from "../src/lib/playback-token.ts";
const student = { id: "student-one", role: "student", active: true };
const lessons = [
  {
    id: "a",
    module_id: "module-one",
    title: "One",
    sort_order: 0,
    status: "published",
  },
  {
    id: "draft",
    module_id: "module-one",
    title: "Draft",
    sort_order: 1,
    status: "draft",
  },
  {
    id: "b",
    module_id: "module-one",
    title: "Two",
    sort_order: 2,
    status: "published",
  },
];
test("progress and continue action count only published lessons in supplied module order", () => {
  assert.deepEqual(moduleProgress(lessons, []), {
    total: 2,
    completed: 0,
    percent: 0,
    next: "a",
  });
  assert.deepEqual(moduleProgress(lessons, ["a", "draft", "other-module"]), {
    total: 2,
    completed: 1,
    percent: 50,
    next: "b",
  });
  assert.deepEqual(moduleProgress(lessons, ["a", "b", "a"]), {
    total: 2,
    completed: 2,
    percent: 100,
    next: null,
  });
  assert.deepEqual(moduleProgress([], ["a"]), {
    total: 0,
    completed: 0,
    percent: 0,
    next: null,
  });
  assert.equal(
    moduleProgress([...lessons, { id: "new", status: "published" }], ["a", "b"])
      .percent,
    67,
  );
});
test("embed uses SHA256 hex of key + resolved video + unix expiry, bounded to four hours", () => {
  const video = "11111111-1111-4111-8111-111111111111",
    key = "fixture-key",
    now = 1700000000000;
  const signed = signedEmbed("820051", video, key, "hr", now),
    url = new URL(signed.url),
    expiry = 1700000000 + PLAYBACK_TTL_SECONDS;
  assert.equal(url.origin, "https://player.mediadelivery.net");
  assert.equal(url.pathname, `/embed/820051/${video}`);
  assert.equal(url.searchParams.get("expires"), String(expiry));
  assert.equal(signed.expiresAt, expiry * 1000);
  assert.equal(
    url.searchParams.get("token"),
    createHash("sha256")
      .update(key + video + expiry)
      .digest("hex"),
  );
  assert.equal(url.searchParams.get("autoplay"), "false");
  assert.equal(url.searchParams.get("rememberPosition"), "false");
  assert.equal(url.searchParams.get("showSpeed"), "true");
  assert.ok(!signed.url.includes(key));
  assert.throws(() => signedEmbed("other/host", video, key, "hr", now));
  assert.throws(() => signedEmbed("820051", "arbitrary", key, "hr", now));
  assert.throws(() => signedEmbed("820051", video, "", "hr", now));
  assert.notEqual(
    signedEmbed("820051", video, key, "en", now + 1000).url,
    signed.url,
  );
});
// Models the session/RLS boundary with visible rows, not a privileged repository.
function sessionDb({
  lessonVisible = true,
  moduleVisible = true,
  status = "published",
  moduleStatus = "published",
  ready = true,
} = {}) {
  const rows = {
    lessons: lessonVisible
      ? [
          {
            id: "a",
            module_id: "module-one",
            status,
            bunny_video_id: "server-resolved-video",
          },
        ]
      : [],
    modules: moduleVisible ? [{ id: "module-one", status: moduleStatus }] : [],
    lesson_attachments: [
      {
        id: "attachment",
        lesson_id: "a",
        ready,
        storage_path: "server/path.pdf",
        original_filename: "safe.pdf",
      },
    ],
    lesson_progress: [],
  };
  const writes = [];
  return {
    rows,
    writes,
    from(table) {
      let selected = rows[table],
        op = null;
      return {
        select() {
          return this;
        },
        eq(key, value) {
          selected = selected.filter((r) => r[key] === value);
          return this;
        },
        maybeSingle: async () => ({ data: selected[0] || null, error: null }),
        upsert(value, options) {
          writes.push({ table, value, options });
          if (
            !rows[table].some(
              (r) =>
                r.student_id === value.student_id &&
                r.lesson_id === value.lesson_id,
            )
          )
            rows[table].push(value);
          return Promise.resolve({ error: null });
        },
        delete() {
          op = "delete";
          return this;
        },
        then(resolve) {
          if (op === "delete") {
            writes.push({ table, deleted: selected });
            rows[table] = rows[table].filter((r) => !selected.includes(r));
          }
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
    },
  };
}
test("missing session visibility, hidden module and inactive profiles deny lesson resolution", async () => {
  for (const options of [
    { lessonVisible: false },
    { moduleVisible: false },
    { status: "draft" },
    { moduleStatus: "draft" },
  ])
    assert.equal(
      await authorizedLesson(sessionDb(options), student, "a"),
      null,
    );
  assert.equal(
    await authorizedLesson(sessionDb(), { ...student, active: false }, "a"),
    null,
  );
  assert.equal(
    await authorizedLesson(sessionDb(), student, "arbitrary-video-id"),
    null,
  );
});
test("active admin can preview drafts; student cannot inherit preview rights", async () => {
  const db = sessionDb({ status: "draft", moduleStatus: "draft" });
  assert.equal(await authorizedLesson(db, student, "a"), null);
  assert.ok(
    await authorizedLesson(db, { ...student, role: "super_admin" }, "a"),
  );
  assert.equal(
    await authorizedLesson(
      db,
      { ...student, role: "super_admin", active: false },
      "a",
    ),
    null,
  );
});
test("attachments resolve only ready records belonging to authorized lesson, never browser paths", async () => {
  assert.deepEqual(
    await authorizedAttachment(sessionDb(), student, "a", "attachment"),
    {
      id: "attachment",
      lesson_id: "a",
      ready: true,
      storage_path: "server/path.pdf",
      original_filename: "safe.pdf",
    },
  );
  for (const options of [
    { lessonVisible: false },
    { moduleVisible: false },
    { status: "draft" },
    { ready: false },
  ])
    assert.equal(
      await authorizedAttachment(
        sessionDb(options),
        student,
        "a",
        "attachment",
      ),
      null,
    );
  assert.equal(
    await authorizedAttachment(
      sessionDb(),
      student,
      "different-lesson",
      "attachment",
    ),
    null,
  );
  assert.equal(
    await authorizedAttachment(sessionDb(), student, "a", "server/path.pdf"),
    null,
  );
});
test("completion is idempotent, own-account only, reversible and denied after revocation", async () => {
  const db = sessionDb();
  assert.equal(await setLessonCompletion(db, student, "a", true), true);
  assert.equal(await setLessonCompletion(db, student, "a", true), true);
  assert.equal(db.rows.lesson_progress.length, 1);
  assert.equal(db.rows.lesson_progress[0].student_id, student.id);
  assert.equal(db.writes[0].options.ignoreDuplicates, true);
  db.rows.lesson_progress.push({ student_id: "another", lesson_id: "a" });
  assert.equal(await setLessonCompletion(db, student, "a", false), true);
  assert.deepEqual(db.rows.lesson_progress, [
    { student_id: "another", lesson_id: "a" },
  ]);
  for (const options of [
    { lessonVisible: false },
    { status: "draft" },
    { moduleStatus: "draft" },
  ]) {
    const denied = sessionDb(options);
    assert.equal(await setLessonCompletion(denied, student, "a", true), false);
    assert.equal(denied.writes.length, 0);
  }
  assert.equal(
    await setLessonCompletion(
      db,
      { ...student, role: "super_admin" },
      "a",
      true,
    ),
    false,
  );
});

import { issueLessonPlayback } from "../src/lib/learning.ts";
test("playback resolves only the lesson video and never calls signer when denied or unverified", async () => {
  let inspected = [],
    signed = [];
  const delivery = {
    enabled: true,
    inspect: async (id) => {
      inspected.push(id);
      return { data: { id, status: 4, title: "Fixture", duration: 10 } };
    },
    sign: (id) => {
      signed.push(id);
      return { url: "fixture-signed-url", expiresAt: 123 };
    },
  };
  assert.deepEqual(
    await issueLessonPlayback(sessionDb(), student, "a", delivery),
    { data: { url: "fixture-signed-url", expiresAt: 123 } },
  );
  assert.deepEqual(signed, ["server-resolved-video"]);
  for (const [db, profile, request, enabled] of [
    [sessionDb(), student, "arbitrary-video", true],
    [sessionDb({ status: "draft" }), student, "a", true],
    [sessionDb({ lessonVisible: false }), student, "a", true],
    [sessionDb(), { ...student, active: false }, "a", true],
    [sessionDb(), student, "a", false],
  ]) {
    inspected = [];
    signed = [];
    const result = await issueLessonPlayback(db, profile, request, {
      ...delivery,
      enabled,
    });
    assert.ok(result.error);
    assert.equal(inspected.length, 0);
    assert.equal(signed.length, 0);
  }
});
test("playback retry checks metadata again and handles processing, missing and mismatched identity", async () => {
  for (const result of [
    { error: "videoMissing" },
    { data: null },
    { data: { id: "wrong-id", status: 4 } },
    { data: { id: "server-resolved-video", status: 2 } },
    { data: { id: "server-resolved-video", status: 5 } },
  ]) {
    const output = await issueLessonPlayback(sessionDb(), student, "a", {
      enabled: true,
      inspect: async () => result,
      sign: () => assert.fail("Must not issue token"),
    });
    assert.ok(output.error);
  }
  const output = await issueLessonPlayback(
    sessionDb({ status: "draft" }),
    { ...student, role: "super_admin" },
    "a",
    {
      enabled: false,
      inspect: async (id) => ({ data: { id, status: 4 } }),
      sign: () => ({ url: "admin-preview", expiresAt: 1 }),
    },
  );
  assert.equal(output.data.url, "admin-preview");
});
