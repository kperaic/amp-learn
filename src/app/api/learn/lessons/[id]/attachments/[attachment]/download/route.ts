import { deliverySession } from "@/lib/learning-server";
import { authorizedAttachment } from "@/lib/learning";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/admin-validation";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachment: string }> },
) {
  const { id, attachment } = await params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(attachment).success)
    return Response.json({ error: "learningDenied" }, { status: 404, headers });
  try {
    const context = await deliverySession();
    if (!context)
      return Response.json({ error: "learningDenied" }, { status: 401, headers });
    const row = await authorizedAttachment(
      context.supabase,
      context.profile,
      id,
      attachment,
    );
    if (!row)
      return Response.json({ error: "learningDenied" }, { status: 404, headers });
    const admin = createAdminClient();
    if (!admin) throw Error();
    const { data, error } = await admin.storage
      .from("lesson-attachments")
      .createSignedUrl(row.storage_path, 300, {
        download: row.original_filename,
      });
    if (error || !data) throw Error();
    return Response.json({ url: data.signedUrl }, { headers });
  } catch {
    return Response.json(
      { error: "downloadUnavailable" },
      { status: 503, headers },
    );
  }
}
