"use client";
import { useEffect, useRef } from "react";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
export function DateValue({
  locale,
  value,
}: {
  locale: Locale;
  value: string;
}) {
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale === "hr" ? "hr-HR" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Europe/Zagreb",
      }).format(new Date(value))}
    </time>
  );
}
export function Feedback({ locale, code }: { locale: Locale; code: string }) {
  const t = messages(locale);
  return code ? (
    <p
      className="notice"
      role={
        ["saved", "invited", "existingAccess", "recoverySent"].includes(code)
          ? "status"
          : "alert"
      }
    >
      {t[code as keyof typeof t] || t.failed}
    </p>
  ) : null;
}
// One guard per document, shared by the editor and attachment uploader.
const guards = new Map<symbol, () => string | null>();
let installed = false;
let guardedUrl: string | null = null;
let leaving = false;
let guardId = "";
const warning = () => [...guards.values()].map((read) => read()).find(Boolean);
function installGuards() {
  if (installed) return;
  installed = true;
  window.addEventListener("beforeunload", (e) => {
    if (warning() && !leaving) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element)?.closest?.("a[href]");
      if (
        !a ||
        a.hasAttribute("download") ||
        a.getAttribute("target") === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;
      const message = warning();
      if (message && !window.confirm(message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => {
      if (!(e.target as HTMLFormElement)?.hasAttribute("data-leaves-page"))
        return;
      const message = warning();
      if (message && !window.confirm(message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener(
    "popstate",
    (e) => {
      // The extra entry has the same Next router state, so declining Back never
      // unmounts the editor. Only one entry is added, even after repeated saves.
      if (
        !guardedUrl ||
        location.href !== guardedUrl ||
        e.state?.ampUnsavedGuard === guardId
      )
        return;
      e.stopImmediatePropagation();
      const message = warning();
      if (!message || window.confirm(message)) {
        guardedUrl = null;
        leaving = true;
        history.back();
      } else {
        history.pushState(
          { ...history.state, ampUnsavedGuard: guardId },
          "",
          guardedUrl,
        );
      }
    },
    true,
  );
}
export function useUnsaved(dirty: boolean, locale: Locale) {
  const state = useRef<string | null>(null);
  useEffect(() => {
    state.current = dirty ? messages(locale).leaveConfirm : null;
    if (
      dirty &&
      (guardedUrl !== location.href ||
        history.state?.ampUnsavedGuard !== guardId)
    ) {
      guardedUrl = location.href;
      guardId = crypto.randomUUID();
      leaving = false;
      history.pushState(
        { ...history.state, ampUnsavedGuard: guardId },
        "",
        guardedUrl,
      );
    }
  }, [dirty, locale]);
  useEffect(() => {
    const id = Symbol();
    installGuards();
    guards.set(id, () => state.current);
    return () => {
      guards.delete(id);
    };
  }, []);
}
export function StatusSelect({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = messages(locale);
  return (
    <label className="field">
      <span>{t.status}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="draft">{t.draft}</option>
        <option value="published">{t.published}</option>
      </select>
    </label>
  );
}
export function AccessPicker({
  locale,
  modules,
  selected,
  onChange,
  grantedAt,
}: {
  locale: Locale;
  modules: { id: string; title: string; status: string; archived_at?: string | null }[];
  selected: string[];
  onChange: (v: string[]) => void;
  grantedAt?: Record<string, string>;
}) {
  const t = messages(locale);
  return (
    <fieldset className="access-picker">
      <legend>{t.moduleAccess}</legend>
      <p className="muted">{t.accessHelp}</p>
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(modules.map((m) => m.id))}
        >
          {t.selectAll}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => onChange([])}
        >
          {t.selectNone}
        </button>
      </div>
      {modules.map((m) => (
        <label className="check-row" key={m.id}>
          <input
            type="checkbox"
            name="modules"
            value={m.id}
            checked={selected.includes(m.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, m.id]
                  : selected.filter((id) => id !== m.id),
              )
            }
          />
          <span>
            {m.title}
            {grantedAt?.[m.id] && (
              <small className="grant-date">
                {t.accessSince}:{" "}
                <DateValue locale={locale} value={grantedAt[m.id]} />
              </small>
            )}
          </span>
          <small>{m.archived_at ? t.archive : m.status === "published" ? t.published : t.draft}</small>
        </label>
      ))}
    </fieldset>
  );
}
