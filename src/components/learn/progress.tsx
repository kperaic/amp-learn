import type { Locale } from "@/lib/types";
import { messages } from "@/lib/i18n";
export function LearningProgress({
  locale,
  total,
  completed,
  percent,
}: {
  locale: Locale;
  total: number;
  completed: number;
  percent: number;
}) {
  const t = messages(locale);
  return (
    <div className="learning-progress">
      <div>
        <span>
          {t.progressCount
            .replace("{completed}", String(completed))
            .replace("{total}", String(total))}
        </span>
        <strong>{percent}%</strong>
      </div>
      <progress aria-label={t.learningProgress} value={percent} max={100} />
    </div>
  );
}
