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
export function parseLessonDocument(value: unknown): LessonNode | null {
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
  if (
    new TextEncoder().encode(JSON.stringify(value)).length > 450000 ||
    !bounded(value, 0)
  )
    return null;
  const result = lessonNodeSchema.safeParse(value);
  return result.success && result.data.type === "doc" ? result.data : null;
}
export const emptyLessonDocument: LessonNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
