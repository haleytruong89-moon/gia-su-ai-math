import { describe, expect, it } from "vitest";
import { dayLabel, reportDate } from "@/lib/report/labels";

const now = new Date("2026-11-18T16:30:00Z"); // 23:30 VN, 18/11

describe("reportDate", () => {
  it("no or bad param → today in VN time", () => {
    expect(reportDate(undefined, now)).toBe("2026-11-18");
    expect(reportDate("18/11/2026", now)).toBe("2026-11-18");
    expect(reportDate("2026-02-31", now)).toBe("2026-11-18");
  });
  it("a past day is kept; a future day → today", () => {
    expect(reportDate("2026-11-17", now)).toBe("2026-11-17");
    expect(reportDate(["2026-11-10"], now)).toBe("2026-11-10");
    expect(reportDate("2026-11-19", now)).toBe("2026-11-18");
  });
  it("17:00 UTC is already the next VN day (DOMAIN §4.6)", () => expect(reportDate(undefined, new Date("2026-11-18T17:00:00Z"))).toBe("2026-11-19"));
});

describe("dayLabel", () => {
  it("weekday + dd/mm", () => {
    expect(dayLabel("2026-11-18")).toBe("Thứ Tư 18/11");
    expect(dayLabel("2026-11-22")).toBe("Chủ nhật 22/11");
  });
});
