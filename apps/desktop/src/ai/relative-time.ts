import { t } from "../i18n/index.ts";

/**
 * Compact relative age for when an assistant answer finished.
 * Pure aside from locale lookup — pass `now` in tests.
 */
export function formatAnswerAge(endedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - endedAt) / 1000));
  if (seconds < 60) return t("ai.answerAge.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("ai.answerAge.minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("ai.answerAge.hours", { n: hours });
  const days = Math.floor(hours / 24);
  return t("ai.answerAge.days", { n: days });
}
