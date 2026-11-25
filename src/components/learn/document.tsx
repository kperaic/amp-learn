import type { ReactNode } from "react";
import {
  parseLessonDocument,
  safeLessonLink,
  type LessonNode,
} from "@/lib/lesson-document";
function render(node: LessonNode, key: number): ReactNode {
  const children = node.content?.map(render);
  switch (node.type) {
    case "doc":
      return <div key={key}>{children}</div>;
    case "text": {
      let text: ReactNode = node.text || "";
      for (const mark of node.marks || []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (
          mark.type === "link" &&
          mark.attrs?.href &&
          safeLessonLink(mark.attrs.href)
        )
          text = (
            <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
              {text}
            </a>
          );
      }
      return <span key={key}>{text}</span>;
    }
    case "paragraph":
      return <p key={key}>{children || <br />}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={node.attrs?.start || 1}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    default:
      return null;
  }
}
export function LessonDocument({
  content,
  invalidMessage,
  heading,
}: {
  content: unknown;
  invalidMessage: string;
  heading: string;
}) {
  const doc = parseLessonDocument(content);
  const hasText = (node: LessonNode): boolean =>
    !!node.text?.trim() || !!node.content?.some(hasText);
  if (doc && !hasText(doc)) return null;
  return (
    <section className="lesson-description" aria-labelledby="lesson-description-title">
      <h2 id="lesson-description-title">{heading}</h2>
      {doc ? <div className="learning-prose">{render(doc, 0)}</div> : <p role="alert">{invalidMessage}</p>}
    </section>
  );
}
