import { deliverySession, playbackForLesson } from "@/lib/learning-server";
import { uuid } from "@/lib/admin-validation";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
};
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "learningDenied" }, { status: 403, headers });
  const { id } = await params;
  if (!uuid.safeParse(id).success)
    return Response.json({ error: "learningDenied" }, { status: 404, headers });
  try {
    const context = await deliverySession();
    if (!context)
      return Response.json({ error: "learningDenied" }, { status: 401, headers });
    const result = await playbackForLesson(
      context,
      id,
      new URL(request.url).searchParams.get("locale") === "en" ? "en" : "hr",
    );
    return Response.json(
      result.error !== undefined ? { error: result.error } : result.data,
      {
        status:
          result.error === "learningDenied" ? 404 : result.error ? 503 : 200,
        headers,
      },
    );
  } catch {
    return Response.json(
      { error: "playbackUnavailable" },
      { status: 503, headers },
    );
  }
}
