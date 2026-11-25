import { test } from "node:test";
import assert from "node:assert/strict";
import { homeFor, mayEnter } from "../src/lib/access.ts";
const student = { role: "student", active: true };
test("role destinations preserve locale", () => {
  assert.equal(homeFor(student, "hr"), "/hr/learn");
  assert.equal(homeFor({ role: "super_admin" }, "en"), "/en/admin");
});
test("admin area denies students and inactive administrators", () => {
  assert.equal(mayEnter(student, "admin"), false);
  assert.equal(
    mayEnter({ role: "super_admin", active: false }, "admin"),
    false,
  );
  assert.equal(mayEnter({ role: "super_admin", active: true }, "admin"), true);
});
test("protected areas deny missing and inactive profiles", () => {
  for (const area of ["admin", "learn", "account"]) {
    assert.equal(mayEnter(null, area), false);
    assert.equal(mayEnter({ ...student, active: false }, area), false);
  }
});

import {trustedOrigin} from '../src/lib/access.ts';
test('trusted callback origin permits explicit local builds and HTTPS only',()=>{assert.equal(trustedOrigin('http://localhost:3000'),'http://localhost:3000');assert.equal(trustedOrigin('https://learn.ampdigital.hr'),'https://learn.ampdigital.hr');for(const value of [undefined,'http://evil.example','https://user:password@example.com','javascript:alert(1)']) assert.throws(()=>trustedOrigin(value))});
