// lib/rules/cost.ts — money rules (DOMAIN §4.5; D23 money-only pushes; X2). Pure.
import { dateVn } from "@/lib/time";

export const CAP_USD = 50;
export const BURN_FROM_DAY = 5; // X2 (phụ huynh chốt 19/11): the forecast is too jumpy before day 5
const WEEK_MS = 7 * 24 * 3600 * 1000;

const monthUtc = (d: Date) => d.toISOString().slice(0, 7);
export const daysInMonthUtc = (now: Date): number => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

/** §4.5: spent so far ÷ days gone × days in the month (UTC month, like the Console). */
export function burnForecast(costUsd: number, now: Date): number {
  return Math.round((costUsd / now.getUTCDate()) * daysInMonthUtc(now) * 100) / 100;
}

/** The forecast when the "tốc độ chi đang vượt trần" push is due, else null (once a week, from day 5). */
export function burnAlertDue(u: { costUsd: number; burnAlertSentAt: Date | null }, now: Date): number | null {
  if (now.getUTCDate() < BURN_FROM_DAY) return null;
  const forecast = burnForecast(u.costUsd, now);
  if (forecast <= CAP_USD) return null;
  const sent = u.burnAlertSentAt;
  if (sent && monthUtc(sent) === monthUtc(now) && now.getTime() - sent.getTime() < WEEK_MS) return null;
  return forecast;
}

/** §4.5 b: Opus is paused (~45 USD) and the parents were not told yet this month. */
export const economyAlertDue = (u: { mode: "normal" | "economy"; economyAlertSentAt: Date | null }): boolean =>
  u.mode === "economy" && u.economyAlertSentAt === null;

/** §4.5 d: "Console hết tiền" at most once a VN day. */
export const consoleAlertDue = (sentAt: Date | null, now: Date): boolean => !sentAt || dateVn(sentAt) !== dateVn(now);

/**
 * The API refused because a spend limit was reached (platform.claude.com/docs/en/api/errors, read 19/11/2026):
 * 400 invalid_request_error "You have reached your specified (workspace) API usage limits", 400 credit balance too low,
 * or 429 with error_code enforced_spend_limit_reached. A plain rate limit (429 without that code) is not one.
 */
export function isSpendLimitError(e: unknown): boolean {
  const o = e as { status?: unknown; message?: unknown } | null;
  if (!o || (o.status !== 400 && o.status !== 429) || typeof o.message !== "string") return false;
  return /API usage limits|enforced_spend_limit_reached|credit balance is too low|credit_balance_too_low/i.test(o.message);
}
