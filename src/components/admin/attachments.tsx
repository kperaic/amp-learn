"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, DetailedError } from "tus-js-client";
import {
  reserveAttachment,
  finishAttachment,
  removeAttachment,
  downloadAttachment,
} from "@/app/[locale]/admin/actions";
import { createClient } from "@/lib/supabase/browser";
import { publicConfig } from "@/lib/supabase/config";
import { fileMime, MAX_ATTACHMENT } from "@/lib/admin-validation";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import type { AttachmentRow } from "@/lib/admin-types";
import { Feedback, useUnsaved } from "./common";
export function Attachments({
  locale,
  lesson,
  attachments,
}: {
  locale: Locale;
  lesson: string;
  attachments: AttachmentRow[];
}) {
  const t = messages(locale),
    router = useRouter(),
    upload = useRef<Upload | null>(null);
  const [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [paused, setPaused] = useState(false),
    [filename, setFilename] = useState(""),
    [download, setDownload] = useState<string | null>(null);
  useUnsaved(busy, locale);
  useEffect(
    () => () => {
      void upload.current?.abort();
    },
    [],
  );
  async function uploadFiles(files: File[]) {
    setBusy(true);
    setCode("");
    try {
      setDownload(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw Error();
      for (const file of files) {
        setFilename(file.name);
        const type = fileMime(file.name);
        if (!type || file.size <= 0 || file.size > MAX_ATTACHMENT) {
          setCode("fileLimit");
          return;
        }
        const { url, key } = publicConfig();
        const fingerprint = `amp-learn:${new URL(url).hostname}:${user.id}:${lesson}:${file.name}:${file.size}:${file.lastModified}`;
        let saved: { id: string; path: string } | null = null;
        try {
          saved = JSON.parse(localStorage.getItem(fingerprint) || "null");
        } catch {}
        if (saved && !attachments.some((a) => a.id === saved?.id && !a.ready)) {
          localStorage.removeItem(fingerprint);
          saved = null;
        }
        if (!saved) {
          const r = await reserveAttachment(locale, lesson, {
            name: file.name,
            size: file.size,
            type,
          });
          if (r.error !== undefined) {
            setCode(r.error);
            return;
          }
          saved = r.data;
          localStorage.setItem(fingerprint, JSON.stringify(saved));
        }
        const reservation = saved;
        setProgress(0);
        const endpoint = new URL(url);
        if (endpoint.hostname.endsWith(".supabase.co"))
          endpoint.hostname = endpoint.hostname.replace(
            ".supabase.co",
            ".storage.supabase.co",
          );
        await new Promise<void>((resolve, reject) => {
          const task = new Upload(file, {
            endpoint: `${endpoint.origin}/storage/v1/upload/resumable`,
            chunkSize: 6 * 1024 * 1024,
            retryDelays: [0, 1000, 3000, 5000],
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            fingerprint: async () => `${fingerprint}:${reservation.id}`,
            metadata: {
              bucketName: "lesson-attachments",
              objectName: reservation.path,
              contentType: type,
              cacheControl: "0",
            },
            onBeforeRequest: async (req) => {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session) throw Error();
              req.setHeader("authorization", `Bearer ${session.access_token}`);
              req.setHeader("apikey", key);
            },
            onShouldRetry: (e) =>
              ![401, 403, 413].includes(e.originalResponse?.getStatus() || 0),
            onProgress: (sent, total) =>
              setProgress(Math.round((sent / total) * 100)),
            onError: reject,
            onSuccess: () => resolve(),
          });
          upload.current = task;
          void task
            .findPreviousUploads()
            .then((previous) => {
              if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
              task.start();
            })
            .catch(reject);
        });
        const done = await finishAttachment(locale, reservation.id);
        if (done.error) {
          setCode(done.error);
          router.refresh();
          return;
        }
        localStorage.removeItem(fingerprint);
        router.refresh();
      }
      setCode("saved");
    } catch (error) {
      setCode(
        error instanceof DetailedError &&
          error.originalResponse?.getStatus() === 413
          ? "fileLimit"
          : "uploadFailed",
      );
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
      setPaused(false);
      upload.current = null;
    }
  }
  async function act(id: string, kind: "finish" | "remove" | "download") {
    if (kind === "remove" && !confirm(t.removeConfirm)) return;
    setBusy(true);
    setCode("");
    setDownload(null);
    try {
      if (kind === "download") {
        const r = await downloadAttachment(locale, id);
        if (r.error !== undefined) setCode(r.error);
        else setDownload(r.data);
      } else {
        const r = await (
          kind === "finish" ? finishAttachment : removeAttachment
        )(locale, id);
        setCode(r.error || "saved");
        router.refresh();
      }
    } catch {
      setCode("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>{t.attachments}</h2>
      <p className="muted">{t.uploadHelp}</p>
      <label className="field">
        <span>{t.upload}</span>
        <input
          type="file"
          multiple
          accept=".pdf,.txt,.mp4,.zip,.docx,.xlsx,.jpg,.jpeg,.png,.webp"
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (files.length) void uploadFiles(files);
          }}
        />
      </label>
      {progress !== null && (
        <div className="upload-progress" aria-live="polite">
          <span>
            {filename} · {progress}%
          </span>
          <progress value={progress} max={100} />
          <button
            className="secondary"
            onClick={async () => {
              if (paused) {
                upload.current?.start();
                setPaused(false);
              } else {
                await upload.current?.abort();
                setPaused(true);
              }
            }}
          >
            {paused ? t.resume : t.pause}
          </button>
        </div>
      )}
      <Feedback locale={locale} code={code} />
      {download && (
        <p>
          <a href={download} target="_blank" rel="noopener noreferrer">
            {t.download}
          </a>
        </p>
      )}
      <div className="ordered-list">
        {attachments.map((a) => (
          <div className="list-row" key={a.id}>
            <div>
              <strong>{a.original_filename}</strong>
              <p className="muted">
                {(a.file_size_bytes / 1_000_000).toLocaleString(locale, {
                  maximumFractionDigits: 2,
                })}{" "}
                MB {a.ready ? "" : `· ${t.pendingUpload}`}
              </p>
            </div>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(a.id, a.ready ? "download" : "finish")}
              >
                {a.ready ? t.download : t.finishUpload}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act(a.id, "remove")}
              >
                {t.remove}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!attachments.length && <p className="muted">{t.noAttachments}</p>}
    </section>
  );
}
