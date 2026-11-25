"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import { useState, useEffect } from "react";
import { saveLesson, checkVideo } from "@/app/[locale]/admin/actions";
import { safeLessonLink } from "@/lib/lesson-document";
import type { Locale } from "@/lib/types";
import type { LessonRow, VideoInfo } from "@/lib/admin-types";
import { messages } from "@/lib/i18n";
import { Feedback, StatusSelect, useUnsaved } from "./common";
export function LessonEditor({
  locale,
  lesson,
}: {
  locale: Locale;
  lesson: LessonRow;
}) {
  const t = messages(locale);
  const [title, setTitle] = useState(lesson.title),
    [status, setStatus] = useState<string>(lesson.status),
    [video, setVideo] = useState(lesson.bunny_video_id || ""),
    [version, setVersion] = useState(lesson.updated_at),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [url, setUrl] = useState(""),
    [linkOpen, setLinkOpen] = useState(false),
    [info, setInfo] = useState<VideoInfo | null>(null),
    [videoBusy, setVideoBusy] = useState(false);
  const [, tick] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: false,
        horizontalRule: false,
      }),
      LinkExtension.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        isAllowedUri: safeLessonLink,
      }),
    ],
    content: lesson.content,
    editorProps: {
      attributes: {
        class: "lesson-prose",
        role: "textbox",
        "aria-label": t.content,
        "aria-multiline": "true",
      },
    },
    onUpdate: () => {
      setDirty(true);
      setCode("");
    },
    onTransaction: () => tick((v) => v + 1),
  });
  useUnsaved(dirty, locale);
  useEffect(() => {
    editor?.setEditable(!busy, false);
  }, [busy, editor]);
  async function save() {
    if (!editor || busy) return;
    setBusy(true);
    setCode("");
    try {
      const r = await saveLesson(locale, lesson.id, {
        title,
        status,
        video,
        content: editor.getJSON(),
        version,
      });
      if (r.error !== undefined) setCode(r.error);
      else {
        setVersion(r.data.updated_at);
        setDirty(false);
        setCode("saved");
      }
    } catch {
      setCode("failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const tool = (
    label: string,
    run: () => void,
    active = false,
    disabled = false,
  ) => (
    <button
      type="button"
      className="secondary compact"
      aria-pressed={active}
      disabled={busy || disabled}
      onClick={run}
    >
      {label}
    </button>
  );
  return (
    <section className="card editor-card">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <div className="admin-grid">
            <label className="field">
              <span>{t.title}</span>
              <input
                value={title}
                maxLength={200}
                required
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <StatusSelect
              locale={locale}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setDirty(true);
              }}
            />
          </div>
          <label className="field">
            <span>{t.video}</span>
            <input
              value={video}
              maxLength={2000}
              onChange={(e) => {
                setVideo(e.target.value);
                setInfo(null);
                setDirty(true);
              }}
            />
          </label>
          <p className="muted">{t.videoHelp}</p>
          <button
            type="button"
            className="secondary"
            disabled={videoBusy || !video.trim()}
            onClick={async () => {
              setVideoBusy(true);
              try {
                const r = await checkVideo(locale, video);
                if (r.error !== undefined) setCode(r.error);
                else {
                  setInfo(r.data);
                  setCode("");
                }
              } catch {
                setCode("videoUnavailable");
              } finally {
                setVideoBusy(false);
              }
            }}
          >
            {videoBusy ? t.loadingVideo : t.checkVideo}
          </button>
          {info && (
            <p role="status">
              <strong>{info.title}</strong> ·{" "}
              {info.status === 4
                ? t.videoReady
                : [5, 6].includes(info.status)
                  ? t.videoFailed
                  : t.videoProcessing}{" "}
              · {t.duration}: {Math.floor(info.duration / 60)}:
              {String(info.duration % 60).padStart(2, "0")}
            </p>
          )}
          <h2>{t.content}</h2>
        </fieldset>
      </form>
      <div className="editor-toolbar" role="toolbar" aria-label={t.content}>
        {editor && (
          <>
            {tool(
              t.paragraph,
              () => editor.chain().focus().setParagraph().run(),
              editor.isActive("paragraph"),
            )}
            {tool(
              "H2",
              () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              editor.isActive("heading", { level: 2 }),
            )}
            {tool(
              "H3",
              () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
              editor.isActive("heading", { level: 3 }),
            )}
            {tool(
              t.bold,
              () => editor.chain().focus().toggleBold().run(),
              editor.isActive("bold"),
            )}
            {tool(
              t.italic,
              () => editor.chain().focus().toggleItalic().run(),
              editor.isActive("italic"),
            )}
            {tool(
              t.bullets,
              () => editor.chain().focus().toggleBulletList().run(),
              editor.isActive("bulletList"),
            )}
            {tool(
              t.numbers,
              () => editor.chain().focus().toggleOrderedList().run(),
              editor.isActive("orderedList"),
            )}
            {tool(
              t.link,
              () => {
                setUrl(editor.getAttributes("link").href || "");
                setLinkOpen(!linkOpen);
              },
              editor.isActive("link"),
            )}
            {tool(
              t.undo,
              () => editor.chain().focus().undo().run(),
              false,
              !editor.can().undo(),
            )}
            {tool(
              t.redo,
              () => editor.chain().focus().redo().run(),
              false,
              !editor.can().redo(),
            )}
          </>
        )}
      </div>
      {linkOpen && editor && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (safeLessonLink(url)) {
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
              setLinkOpen(false);
            }
          }}
        >
          <label className="field">
            <span>{t.link}</span>
            <input disabled={busy} value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button disabled={busy || !safeLessonLink(url)}>
            {t.saveChanges}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setLinkOpen(false);
            }}
          >
            {t.removeLink}
          </button>
        </form>
      )}
      <EditorContent editor={editor} />
      <div className="editor-save">
        <button
          type="button"
          disabled={busy || !editor || !dirty}
          onClick={() => void save()}
        >
          {busy ? t.working : t.saveChanges}
        </button>
        <span role="status">
          {dirty ? t.unsaved : code === "saved" ? t.saved : ""}
        </span>
      </div>
      <Feedback locale={locale} code={code} />
    </section>
  );
}
