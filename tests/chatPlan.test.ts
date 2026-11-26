// D38: "Bài của em" under the newest tutor message: the child ticks jobs; "Kẹt ở đây" beside the jobs not done yet.
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { Chat } = await import("@/app/hoi/[problemId]/chat");
const { formatPlan } = await import("@/lib/rules/plan");
type Thread = Parameters<typeof Chat>[0]["initial"];

const JOBS = ["Phân tích 84 ra thừa số nguyên tố", "Phân tích 120 ra thừa số nguyên tố", "Lấy thừa số chung, mũ nhỏ nhất"];
const thread = (ticks: number[], older = false): Thread => ({
  problemId: "00000000-0000-4000-8000-000000000001", status: "in_progress", turnCount: 3, statementConfirmed: true, hasImages: false,
  maxImages: 4, planTicks: ticks,
  messages: [
    ...(older ? [{ id: "m0", role: "tutor" as const, text: `Cũ.\n\n${formatPlan(["Việc cũ một", "Việc cũ hai"])}`, buttons: [], images: [], cardRef: null }] : []),
    { id: "m1", role: "tutor" as const, text: `Giờ em làm theo danh sách nhé.\n\n${formatPlan(JOBS)}`, buttons: [], images: [], cardRef: null },
  ],
});
const render = (t: Thread) => renderToStaticMarkup(createElement(Chat, { initial: t, rating: null }));

describe("D38: the list of jobs in the chat", () => {
  it("shows the tutor's words, then the jobs; ticked ones are marked; 'Kẹt ở đây' only beside the others", () => {
    const html = render(thread([1]));
    expect(html).toContain("Giờ em làm theo danh sách nhé.");
    expect(html).not.toContain("☐ 1."); // the raw block is not printed as text
    expect(html).toContain("Bài của em");
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(html.match(/Kẹt ở đây/g)?.length).toBe(2);
  });
  it("all jobs ticked → the screen asks for the final answer", () => {
    expect(render(thread([1, 2, 3]))).toContain("Em làm xong hết các việc rồi!");
    expect(render(thread([1, 2]))).not.toContain("Em làm xong hết các việc rồi!");
  });
  it("an older list is shown read-only (no ticks, no buttons to press)", () => {
    const html = render(thread([], true));
    expect(html).toContain("Việc cũ một");
    expect(html.match(/Kẹt ở đây/g)?.length).toBe(3); // only the newest list's jobs
  });
});
