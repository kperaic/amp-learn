import "server-only";
import { parseBunnyVideo } from "./admin-validation";
import type { Result, VideoInfo } from "./admin-types";
export async function inspectVideo(
  input: string,
): Promise<Result<VideoInfo | null>> {
  const library = process.env.BUNNY_STREAM_LIBRARY_ID || "820051";
  let id: string | null;
  try {
    id = parseBunnyVideo(input, library);
  } catch {
    return { error: "invalidVideo" };
  }
  if (!id) return { data: null };
  const key = process.env.BUNNY_STREAM_API_KEY;
  if (!key) return { error: "bunnySetup" };
  if (!/^\d+$/.test(library)) return { error: "bunnySetup" };
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${library}/videos/${id}`,
      {
        headers: { AccessKey: key },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      return {
        error: response.status === 404 ? "videoMissing" : "videoUnavailable",
      };
    const v = await response.json();
    if (
      v.guid !== id ||
      String(v.videoLibraryId) !== library ||
      typeof v.title !== "string" ||
      typeof v.status !== "number" ||
      typeof v.length !== "number"
    )
      return { error: "videoUnavailable" };
    return {
      data: { id, title: v.title, status: v.status, duration: v.length },
    };
  } catch {
    return { error: "videoUnavailable" };
  }
}
