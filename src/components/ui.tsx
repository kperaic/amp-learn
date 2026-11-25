import type { Messages } from "@/lib/i18n";
export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Notice({ code, t }: { code?: string; t: Messages }) {
  if (!code || !(code in t)) return null;
  const success = ["recoverySent", "passwordSaved", "invited"].includes(code);
  return (
    <p
      role={success ? "status" : "alert"}
      className={`notice ${success ? "success" : "error"}`}
    >
      {t[code as keyof Messages]}
    </p>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="card empty">
      <span className="empty-mark" aria-hidden="true">
        amp.
      </span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
    </section>
  );
}
