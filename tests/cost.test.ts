import { describe, expect, it } from "vitest";
import { burnAlertDue, burnForecast, consoleAlertDue, economyAlertDue, isSpendLimitError } from "@/lib/rules/cost";

const at = (s: string) => new Date(s);

describe("burnForecast / burnAlertDue (§4.5 b2, D15, X2)", () => {
  it("day 10, 20 USD, 30-day month → 60 USD forecast, alert", () => {
    expect(burnForecast(20, at("2026-11-10T12:00:00Z"))).toBe(60);
    expect(burnAlertDue({ costUsd: 20, burnAlertSentAt: null }, at("2026-11-10T12:00:00Z"))).toBe(60);
  });
  it("forecast ≤ 50 → no alert", () => expect(burnAlertDue({ costUsd: 15, burnAlertSentAt: null }, at("2026-11-10T12:00:00Z"))).toBeNull());
  it("before day 5 → no alert even if the forecast is high (X2)", () =>
    expect(burnAlertDue({ costUsd: 10, burnAlertSentAt: null }, at("2026-11-04T12:00:00Z"))).toBeNull());
  it("at most once a week", () => {
    expect(burnAlertDue({ costUsd: 30, burnAlertSentAt: at("2026-11-10T12:00:00Z") }, at("2026-11-16T12:00:00Z"))).toBeNull();
    expect(burnAlertDue({ costUsd: 30, burnAlertSentAt: at("2026-11-10T12:00:00Z") }, at("2026-11-17T12:00:00Z"))).toBe(52.94); // 30 ÷ 17 × 30
  });
  it("an alert from last month does not count", () =>
    expect(burnAlertDue({ costUsd: 20, burnAlertSentAt: at("2026-10-30T12:00:00Z") }, at("2026-11-05T12:00:00Z"))).toBe(120));
  it("31-day month", () => expect(burnForecast(10, at("2026-12-10T00:00:00Z"))).toBe(31));
});

describe("economyAlertDue (§4.5 b, D29)", () => {
  it("paused and not yet told this month → tell", () => expect(economyAlertDue({ mode: "economy", economyAlertSentAt: null })).toBe(true));
  it("already told → no", () => expect(economyAlertDue({ mode: "economy", economyAlertSentAt: at("2026-11-12T00:00:00Z") })).toBe(false));
  it("not paused → no", () => expect(economyAlertDue({ mode: "normal", economyAlertSentAt: null })).toBe(false));
});

describe("consoleAlertDue (§4.5 d: at most once a VN day)", () => {
  it("never sent → yes; sent today (VN) → no; sent yesterday (VN) → yes", () => {
    expect(consoleAlertDue(null, at("2026-11-18T05:00:00Z"))).toBe(true);
    expect(consoleAlertDue(at("2026-11-18T01:00:00Z"), at("2026-11-18T05:00:00Z"))).toBe(false);
    expect(consoleAlertDue(at("2026-11-17T16:00:00Z"), at("2026-11-18T05:00:00Z"))).toBe(true); // 23:00 VN 17/11
  });
});

describe("isSpendLimitError (docs: 400 at a spend limit you set, 429 enforced_spend_limit_reached)", () => {
  it("spend-limit and credit errors → true", () => {
    expect(isSpendLimitError({ status: 400, message: '400 {"type":"error","error":{"type":"invalid_request_error","message":"You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC."}}' })).toBe(true);
    expect(isSpendLimitError({ status: 400, message: "Your credit balance is too low to access the Anthropic API." })).toBe(true);
    expect(isSpendLimitError({ status: 429, message: '429 {"error":{"type":"rate_limit_error","details":{"error_code":"enforced_spend_limit_reached"}}}' })).toBe(true);
  });
  it("other errors → false", () => {
    expect(isSpendLimitError({ status: 529, message: "Overloaded" })).toBe(false);
    expect(isSpendLimitError({ status: 429, message: "This request would exceed your account's rate limit." })).toBe(false);
    expect(isSpendLimitError({ status: 400, message: "messages: text content blocks must be non-empty" })).toBe(false);
    expect(isSpendLimitError(new Error("timeout"))).toBe(false);
    expect(isSpendLimitError(null)).toBe(false);
  });
});
