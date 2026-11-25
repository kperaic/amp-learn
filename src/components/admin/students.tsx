"use client";
import { PermanentDelete } from "./deletion";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveStudent, saveAccess } from "@/app/[locale]/admin/actions";
import {
  inviteStudent,
  resendInvitation,
  sendStudentRecovery,
} from "@/app/[locale]/admin/invite-actions";
import { AccessPicker, Feedback, DateValue, useUnsaved } from "./common";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import type { ModuleRow, StudentRow, ModuleAccessRow } from "@/lib/admin-types";
function ActivationDate({
  locale,
  value,
}: {
  locale: Locale;
  value: string | null;
}) {
  return value ? (
    <DateValue locale={locale} value={value} />
  ) : (
    <span>{messages(locale).invitationPending}</span>
  );
}
export function StudentList({
  locale,
  students,
  access,
  modules,
}: {
  locale: Locale;
  students: StudentRow[];
  access: ModuleAccessRow[];
  modules: Pick<ModuleRow, "id" | "title">[];
}) {
  const t = messages(locale);
  const titles = new Map(modules.map((m) => [m.id, m.title]));
  const grants = new Map<string, ModuleAccessRow[]>();
  for (const grant of access) {
    const current = grants.get(grant.student_id) || [];
    current.push(grant);
    grants.set(grant.student_id, current);
  }
  const [query, setQuery] = useState("");
  const rows = students.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.email}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <>
      <label className="field search-field">
        <span>{t.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.firstName}</th>
              <th>{t.email}</th>
              <th>{t.status}</th>
              <th title={t.activeSinceHelp}>{t.activeSince}</th>
              <th>{t.assignedModules}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/${locale}/admin/students/${s.id}`}>
                    {s.first_name} {s.last_name}
                  </Link>
                </td>
                <td>{s.email}</td>
                <td>
                  {!s.active
                    ? t.inactive
                    : s.confirmed_at
                      ? t.active
                      : t.invitationPending}
                </td>
                <td>
                  <ActivationDate locale={locale} value={s.confirmed_at} />
                </td>
                <td>
                  {grants.get(s.id)?.length ? (
                    <ul className="student-grants">
                      {grants.get(s.id)!.map((grant) => (
                        <li key={grant.module_id}>
                          <Link
                            href={`/${locale}/admin/modules/${grant.module_id}`}
                          >
                            {titles.get(grant.module_id) || t.modules}
                          </Link>
                          <small className="grant-date">
                            {t.accessSince}:{" "}
                            <DateValue
                              locale={locale}
                              value={grant.granted_at}
                            />
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="muted">{t.noAssignedModules}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">{t.noStudents}</p>}
    </>
  );
}
export function InvitationForm({
  locale,
  modules,
}: {
  locale: Locale;
  modules: ModuleRow[];
}) {
  const t = messages(locale);
  const [selected, setSelected] = useState<string[]>([]),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [id, setId] = useState("");
  useUnsaved(dirty || busy, locale);
  return (
    <form
      className="foundation-form wide"
      onChange={() => { setDirty(true); setCode(""); }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setCode("");
        try {
          const r = await inviteStudent(locale, f);
          if (r.error !== undefined) setCode(r.error);
          else {
            setCode(r.data.existing ? "existingAccess" : "invited");
            setId(r.data.id);
            setDirty(false);
          }
        } catch {
          setCode("failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label className="field">
          <span>{t.firstName}</span>
          <input name="first_name" required maxLength={100} />
        </label>
        <label className="field">
          <span>{t.lastName}</span>
          <input name="last_name" required maxLength={100} />
        </label>
        <label className="field">
          <span>{t.email}</span>
          <input name="email" type="email" required />
        </label>
        <AccessPicker
          locale={locale}
          modules={modules}
          selected={selected}
          onChange={(value) => { setSelected(value); setDirty(true); }}
        />
        <button>{busy ? t.working : t.invite}</button>
      </fieldset>
      <Feedback locale={locale} code={code} />
      {id && <Link href={`/${locale}/admin/students/${id}`}>{t.edit}</Link>}
    </form>
  );
}
export function StudentEditor({
  locale,
  student,
  modules,
  access,
  grantedAt,
}: {
  locale: Locale;
  student: StudentRow;
  modules: ModuleRow[];
  access: string[];
  grantedAt: Record<string, string>;
}) {
  const t = messages(locale),
    router = useRouter();
  const [selected, setSelected] = useState(access),
    [profileDirty, setProfileDirty] = useState(false),
    [accessDirty, setAccessDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  useUnsaved(profileDirty || accessDirty || busy, locale);
  async function run(fn: () => Promise<{ error?: string }>, success = "saved", saved?: () => void) {
    setBusy(true);
    setCode("");
    try {
      const r = await fn();
      setCode(r.error || success);
      if (!r.error) saved?.();
      router.refresh();
    } catch {
      setCode("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Feedback locale={locale} code={code} />
      <div className="admin-grid">
        <section className="card">
          <form
            className="foundation-form"
            onChange={() => { setProfileDirty(true); setCode(""); }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                saveStudent(locale, student.id, {
                  first_name: f.get("first_name"),
                  last_name: f.get("last_name"),
                  language: f.get("language"),
                  active: f.get("active") === "true",
                }), "saved", () => setProfileDirty(false),
              );
            }}
          >
            <fieldset disabled={busy}>
              <label className="field">
                <span>{t.firstName}</span>
                <input
                  name="first_name"
                  defaultValue={student.first_name}
                  required
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>{t.lastName}</span>
                <input
                  name="last_name"
                  defaultValue={student.last_name}
                  required
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>{t.email}</span>
                <input value={student.email} readOnly />
              </label>
              <small>{t.emailReadonly}</small>
              <label className="field">
                <span>HR / EN</span>
                <select name="language" defaultValue={student.language}>
                  <option value="hr">Hrvatski</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="field">
                <span>{t.status}</span>
                <select name="active" defaultValue={String(student.active)}>
                  <option value="true">{t.active}</option>
                  <option value="false">{t.inactive}</option>
                </select>
              </label>
              <button>{busy ? t.working : t.saveChanges}</button>
            </fieldset>
          </form>
          <hr />
          <p className="muted">
            {student.confirmed_at ? t.confirmed : t.invitationPending}
          </p>
          <p>
            <strong>{t.activeSince}: </strong>
            <ActivationDate locale={locale} value={student.confirmed_at} />
          </p>
          <p className="muted">{t.activeSinceHelp}</p>
          <div className="button-row">
            {!student.confirmed_at && (
              <button
                className="secondary"
                disabled={busy || !student.active}
                onClick={() =>
                  run(() => resendInvitation(locale, student.id), "invited")
                }
              >
                {t.resend}
              </button>
            )}
            <button
              className="secondary"
              disabled={busy || !student.active}
              onClick={() =>
                run(
                  () => sendStudentRecovery(locale, student.id),
                  "recoverySent",
                )
              }
            >
              {t.sendRecovery}
            </button>
          </div>
        </section>
        <section className="card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveAccess(locale, student.id, selected), "saved", () => setAccessDirty(false));
            }}
          >
            <fieldset disabled={busy}>
              <AccessPicker
                locale={locale}
                modules={modules}
                selected={selected}
                onChange={(value) => { setSelected(value); setAccessDirty(true); setCode(""); }}
                grantedAt={grantedAt}
              />
              <p className="muted">{t.accessSinceHelp}</p>
              <button>{busy ? t.working : t.saveChanges}</button>
            </fieldset>
          </form>
        </section>
      </div>
      {!student.active && <PermanentDelete locale={locale} kind="student" id={student.id} label={student.email} disabled={busy || profileDirty || accessDirty} />}
    </>
  );
}
