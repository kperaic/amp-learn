"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { completeLesson } from "@/app/[locale]/learn/actions";
export function Completion({
  locale,
  lesson,
  completed,
}: {
  locale: Locale;
  lesson: string;
  completed: boolean;
}) {
  const t = messages(locale),
    router = useRouter();
  const [done, setDone] = useState(completed),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="completion-control">
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await completeLesson(locale, lesson, !done);
            if (r.error) setError(t.learningDenied);
            else {
              setDone(!!r.complete);
              router.refresh();
            }
          } catch {
            setError(t.failed);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t.working : done ? t.undoCompletion : t.markComplete}
      </button>
      <span role="status">{done ? t.lessonCompleted : ""}</span>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function Download({
  locale,
  lesson,
  attachment,
}: {
  locale: Locale;
  lesson: string;
  attachment: string;
}) {
  const t = messages(locale);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(
              `/api/learn/lessons/${lesson}/attachments/${attachment}/download`,
              { cache: "no-store", signal: AbortSignal.timeout(15000) },
            );
            const body = await r.json();
            if (!r.ok) {
              setError(
                [401, 403, 404].includes(r.status)
                  ? t.learningDenied
                  : t.downloadUnavailable,
              );
              return;
            }
            window.location.assign(body.url);
          } catch {
            setError(t.downloadUnavailable);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t.working : t.download}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function VideoPlayer({
  locale,
  lesson,
  title,
}: {
  locale: Locale;
  lesson: string;
  title: string;
}) {
  const t = messages(locale);
  const [playback, setPlayback] = useState<{
      url: string;
      expiresAt: number;
    } | null>(null),
    [busy, setBusy] = useState(true),
    [code, setCode] = useState(""),
    [loaded, setLoaded] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => {
      controller.abort();
      setBusy(false);
      setCode("playbackUnavailable");
    }, 15000);
    void fetch(
      `/api/learn/lessons/${lesson}/playback?locale=${locale}`,
      { method: "POST", cache: "no-store", signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (signal.aborted) return;
        if (!response.ok) {
          setCode(
            body.error === "learningDenied"
              ? "learningDenied"
              : body.error === "playbackProcessing"
                ? "playbackProcessing"
                : "playbackUnavailable",
          );
          return;
        }
        setPlayback(body);
      })
      .catch(() => {
        if (!signal.aborted) setCode("playbackUnavailable");
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!signal.aborted) setBusy(false);
      });
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [lesson, locale, attempt]);
  useEffect(() => {
    if (!playback) return;
    const expire = () => {
      if (Date.now() >= playback.expiresAt) {
        setPlayback(null);
        setCode("playbackExpired");
      }
    };
    const timer = setTimeout(
      expire,
      Math.max(0, playback.expiresAt - Date.now()),
    );
    document.addEventListener("visibilitychange", expire);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [playback]);
  useEffect(() => {
    if (!playback || loaded) return;
    const timer = setTimeout(() => setCode("playbackSlow"), 20000);
    return () => clearTimeout(timer);
  }, [playback, loaded]);
  return (
    <section className="lesson-video" aria-label={t.videoPlayer}>
      {busy && (
        <div className="player-message" role="status">
          {t.loadingVideo}
        </div>
      )}
      {playback && (
        <iframe
          key={playback.url}
          src={playback.url}
          title={`${t.videoPlayer}: ${title}`}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            setLoaded(true);
            setCode("");
          }}
          onError={() => setCode("playbackUnavailable")}
        />
      )}
      {code && <p role="alert">{t[code as keyof typeof t]}</p>}
      {!busy && (
        <div className="player-retry">
          <small>{t.playbackHelp}</small>
          <button
            className="secondary compact"
            onClick={() => {
              setBusy(true);
              setCode("");
              setPlayback(null);
              setLoaded(false);
              setAttempt((v) => v + 1);
            }}
          >
            {t.reloadVideo}
          </button>
        </div>
      )}
    </section>
  );
}
