"use client";
import { useFormStatus } from "react-dom";
export function Submit({
  children,
  pendingLabel,
  secondary = false,
  approval = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  secondary?: boolean;
  approval?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={
        approval ? "approval-button" : secondary ? "secondary" : undefined
      }
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
