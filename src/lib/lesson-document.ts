import { z } from "zod";
export type LessonNode = {
  type: string;
  text?: string;
  attrs?: {
    level?: number;
    start?: number;
    href?: string;
    target?: string | null;
    rel?: string | null;
    class?: string | null;
  };
  marks?: {
    type: string;
    attrs?: {
      href?: string;
      target?: string | null;
      rel?: string | null;
      class?: string | null;
    };
  }[];
  content?: LessonNode[];
};
export const safeLessonLink = (href: string) =>
  /^(https?:\/\/|mailto:)[^\s\x00-\x1f\x7f]+$/i.test(href);
const linkAttrs = z.object({
  href: z.string().max(4000).refine(safeLessonLink),
  target: z.string().nullable().optional(),
  rel: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
});
export const lessonNodeSchema: z.ZodType<LessonNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      "doc",
      "paragraph",
      "heading",
      "text",
      "bulletList",
      "orderedList",
      "listItem",
      "hardBreak",
      "horizontalRule",
    ]),
    text: z.string().max(200000).optional(),
    attrs: z
      .object({
        level: z.union([z.literal(2), z.literal(3)]).optional(),
        start: z.number().int().min(1).max(10000).optional(),
      })
      .optional(),
    marks: z
      .array(
        z.union([
          z.object({ type: z.enum(["bold", "italic"]) }),
          z.object({ type: z.literal("link"), attrs: linkAttrs }),
        ]),
      )
      .max(3)
      .optional(),
    content: z.array(lessonNodeSchema).max(5000).optional(),
  }),
);
export function validateLessonDocument(value: unknown):
  | { data: LessonNode; error?: never }
  | { data?: never; error: "invalidDocument" | "documentTooLarge" | "invalidDocumentLink" } {
  // Bound recursion before invoking the recursive schema.
  function bounded(node: unknown, depth: number): boolean {
    if (depth > 20 || !node || typeof node !== "object") return false;
    const n = node as LessonNode;
    return (
      !n.content ||
      (Array.isArray(n.content) &&
        n.content.every((child) => bounded(child, depth + 1)))
    );
  }
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); }
  catch { return { error: "invalidDocument" }; }
  if (serialized && new TextEncoder().encode(serialized).length > 450000)
    return { error: "documentTooLarge" };
  if (!bounded(value, 0)) return { error: "invalidDocument" };
  const result = lessonNodeSchema.safeParse(value);
  if (!result.success) {
    // Inspect link attributes separately: Zod wraps mark errors inside a union.
    function invalidLink(node: LessonNode): boolean {
      return !!node.marks?.some((mark) => mark.type === "link" && !linkAttrs.safeParse(mark.attrs).success)
        || !!node.content?.some(invalidLink);
    }
    // Only traverse well-shaped arrays; malformed payloads remain format errors.
    try { if (invalidLink(value as LessonNode)) return { error: "invalidDocumentLink" }; }
    catch { /* Invalid structure is handled below. */ }
    if (result.error.issues.some((issue) => issue.code === "too_big" && issue.path.at(-1) === "text"))
      return { error: "documentTooLarge" };
    return { error: "invalidDocument" };
  }
  return result.data.type === "doc" ? { data: result.data } : { error: "invalidDocument" };
}
export function parseLessonDocument(value: unknown): LessonNode | null {
  return validateLessonDocument(value).data ?? null;
}
export const emptyLessonDocument: LessonNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
