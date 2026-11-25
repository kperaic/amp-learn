import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLessonDocument,
  safeLessonLink,
  emptyLessonDocument,
} from "../src/lib/lesson-document.ts";
import {
  moduleInput,
  studentInput,
  selection,
  fileInput,
  fileMime,
  parseBunnyVideo,
  MAX_ATTACHMENT,
} from "../src/lib/admin-validation.ts";
import { provisionInvitation } from "../src/lib/invitation.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("module/student validation bounds fields, trims titles, and permits only real statuses", () => {
  assert.equal(
    moduleInput.parse({ title: " Test ", description: "", status: "draft" })
      .title,
    "Test",
  );
  for (const status of ["archived", "deleted", ""])
    assert.equal(
      moduleInput.safeParse({ title: "Test", description: "", status }).success,
      false,
    );
  assert.equal(
    moduleInput.safeParse({ title: " ", description: "", status: "published" })
      .success,
    false,
  );
  assert.equal(
    studentInput.safeParse({
      first_name: "A",
      last_name: "B",
      language: "hr",
      active: false,
    }).success,
    true,
  );
  assert.equal(
    studentInput.safeParse({
      first_name: "A",
      last_name: "B",
      language: "de",
      active: "true",
    }).success,
    false,
  );
  assert.deepEqual(selection.parse([id, id]), [id]);
  assert.equal(moduleInput.safeParse({ title: "T", description: "", status: "draft", version: "invalid" }).success, false);
  assert.equal(moduleInput.parse({ title: "T", description: "", status: "draft", version: "2026-11-25T12:00:00.123456+00:00" }).version, "2026-11-25T12:00:00.123456+00:00");
});
test("Tiptap document round-trips supported headings, formatting, lists and safe links", () => {
  const text = {
    type: "text",
    text: "Practical exercise",
    marks: [
      { type: "bold" },
      { type: "italic" },
      { type: "link", attrs: { href: "https://example.test/exercise" } },
    ],
  };
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [text] },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Instructions" }],
      },
      { type: "paragraph", content: [text] },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [text] }],
          },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 1 },
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [text] }],
          },
        ],
      },
    ],
  };
  assert.deepEqual(parseLessonDocument(doc), doc);
  assert.deepEqual(
    parseLessonDocument(emptyLessonDocument),
    emptyLessonDocument,
  );
});
test("rich content rejects unsafe links, scripts, oversized and deeply nested documents", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.test",
    " javaScript:alert(1)",
    "https://exa\nmple.test",
  ]) {
    assert.equal(safeLessonLink(href), false);
    assert.equal(
      parseLessonDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "X",
                marks: [{ type: "link", attrs: { href } }],
              },
            ],
          },
        ],
      }),
      null,
    );
  }
  for (const type of ["script", "iframe", "image", "video"])
    assert.equal(
      parseLessonDocument({ type: "doc", content: [{ type }] }),
      null,
    );
  assert.equal(
    parseLessonDocument({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 } }],
    }),
    null,
  );
  assert.equal(
    parseLessonDocument({
      type: "doc",
      content: [{ type: "text", text: "a".repeat(500001) }],
    }),
    null,
  );
  let nested = { type: "paragraph" };
  for (let i = 0; i < 25; i++) nested = { type: "doc", content: [nested] };
  assert.equal(parseLessonDocument(nested), null);
});
test("Bunny input normalizes UUID and supported embeds but rejects arbitrary fetch targets and HTML", () => {
  assert.equal(parseBunnyVideo("", "820051"), null);
  assert.equal(parseBunnyVideo(id.toUpperCase(), "820051"), id);
  for (const host of ["iframe.mediadelivery.net", "player.mediadelivery.net"])
    assert.equal(
      parseBunnyVideo(
        `https://${host}/embed/820051/${id}?autoplay=true`,
        "820051",
      ),
      id,
    );
  for (const input of [
    `https://evil.test/embed/820051/${id}`,
    `https://iframe.mediadelivery.net/embed/1/${id}`,
    `http://iframe.mediadelivery.net/embed/820051/${id}`,
    `https://u:p@iframe.mediadelivery.net/embed/820051/${id}`,
    `https://iframe.mediadelivery.net:444/embed/820051/${id}`,
    `<iframe src="https://iframe.mediadelivery.net/embed/820051/${id}"></iframe>`,
    "javascript:alert(1)",
    "random",
  ])
    assert.throws(() => parseBunnyVideo(input, "820051"));
});
test("attachment validation matches supported extensions and enforces 50 MB", () => {
  for (const name of [
    "A.PDF",
    "b.txt",
    "c.mp4",
    "d.zip",
    "e.docx",
    "f.xlsx",
    "g.jpg",
    "h.jpeg",
    "i.png",
    "j.webp",
  ])
    assert.equal(
      fileInput.safeParse({ name, size: MAX_ATTACHMENT, type: fileMime(name) })
        .success,
      true,
    );
  for (const value of [
    { name: "a.pdf", size: MAX_ATTACHMENT + 1, type: "application/pdf" },
    { name: "a.pdf", size: 0, type: "application/pdf" },
    { name: "a.pdf", size: 10, type: "text/html" },
    { name: "a.svg", size: 10, type: "image/svg+xml" },
  ])
    assert.equal(fileInput.safeParse(value).success, false);
});
test("new invitation provisions exactly the returned Auth identity", async () => {
  const events = [];
  const r = await provisionInvitation({
    lookup: async () => {
      events.push("lookup");
      return { data: null };
    },
    invite: async () => {
      events.push("invite");
      return { data: id };
    },
    provision: async (target) => {
      events.push(target);
      return { data: undefined };
    },
  });
  assert.deepEqual(events, ["lookup", "invite", id]);
  assert.deepEqual(r, { data: { id, existing: false } });
});
test("retry after profile failure reuses Auth account and never sends another invite", async () => {
  let account = null,
    invites = 0,
    attempts = 0;
  const steps = {
    lookup: async () => ({ data: account }),
    invite: async () => {
      invites++;
      account = { id, role: null };
      return { data: id };
    },
    provision: async () =>
      ++attempts === 1 ? { error: "database error" } : { data: undefined },
  };
  assert.deepEqual(await provisionInvitation(steps), {
    error: "provisionFailed",
  });
  assert.deepEqual(await provisionInvitation(steps), {
    data: { id, existing: true },
  });
  assert.equal(invites, 1);
  assert.equal(attempts, 2);
});
test("existing student gets provisioning without email; admin identity is rejected", async () => {
  let provisioned = 0;
  const invite = async () => {
    assert.fail("Must not invite existing account");
  };
  assert.deepEqual(
    await provisionInvitation({
      lookup: async () => ({ data: { id, role: "student" } }),
      invite,
      provision: async () => {
        provisioned++;
        return { data: undefined };
      },
    }),
    { data: { id, existing: true } },
  );
  assert.deepEqual(
    await provisionInvitation({
      lookup: async () => ({ data: { id, role: "super_admin" } }),
      invite,
      provision: async () => {
        assert.fail("Must not provision admin");
      },
    }),
    { error: "invalidAccount" },
  );
  assert.equal(provisioned, 1);
});
test("lookup and delivery failures stop before provisioning", async () => {
  assert.deepEqual(
    await provisionInvitation({
      lookup: async () => ({ error: "setupNeeded" }),
      invite: async () => assert.fail(),
      provision: async () => assert.fail(),
    }),
    { error: "setupNeeded" },
  );
  assert.deepEqual(
    await provisionInvitation({
      lookup: async () => ({ data: null }),
      invite: async () => ({ error: "inviteFailed" }),
      provision: async () => assert.fail(),
    }),
    { error: "inviteFailed" },
  );
});

import { readAll } from "../src/lib/read-all.ts";
test("management lists read past server row caps for complete select-all", async () => {
  const source = Array.from({ length: 1207 }, (_, id) => ({ id }));
  let calls = 0;
  const result = await readAll(async (from) => {
    calls++;
    return { data: source.slice(from, from + 200), error: null };
  });
  assert.deepEqual(result.data, source);
  assert.equal(calls, 8);
  assert.equal(result.error, null);
});
test("management lists do not return partial selections after a page failure", async () => {
  let calls = 0;
  const result = await readAll(async () =>
    ++calls === 1
      ? { data: [{ id }], error: null }
      : { data: null, error: "unavailable" },
  );
  assert.deepEqual(result, { data: [], error: "unavailable" });
});
