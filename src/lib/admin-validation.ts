import { z } from "zod";
export const uuid = z.uuid();
export const publication = z.enum(["draft", "published"]);
export const moduleInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000),
  status: publication,
  version: z.string().datetime({ offset: true }).optional(),
});
export const studentInput = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  language: z.enum(["hr", "en"]),
  active: z.boolean(),
});
export const selection = z
  .array(uuid)
  .max(10000)
  .transform((ids) => [...new Set(ids)]);
export const MAX_ATTACHMENT = 50_000_000;
const types: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  mp4: "video/mp4",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export function fileMime(name: string) {
  return types[name.split(".").pop()?.toLowerCase() || ""] || null;
}
export const fileInput = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive().max(MAX_ATTACHMENT),
    type: z.string(),
  })
  .refine((v) => fileMime(v.name) === v.type);
export function parseBunnyVideo(input: string, library: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (uuid.safeParse(value).success) return value.toLowerCase();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("invalidVideo");
  }
  const parts = url.pathname.split("/");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["iframe.mediadelivery.net", "player.mediadelivery.net"].includes(
      url.hostname,
    ) ||
    parts.length !== 4 ||
    parts[1] !== "embed" ||
    parts[2] !== library ||
    !uuid.safeParse(parts[3]).success
  )
    throw Error("invalidVideo");
  return parts[3].toLowerCase();
}
