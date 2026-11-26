// G8-fix (24/11): the chat's photo button has a visible label; when the problem has all its photos, the screen says so
// in words (the old hint lived in a hover tooltip, which an iPad never shows). Server-rendered markup of the chat.
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { Chat } = await import("@/app/hoi/[problemId]/chat");
const { PHOTO_COPY } = await import("@/lib/copy");
type Thread = Parameters<typeof Chat>[0]["initial"];

const msg = (i: number, role: "child" | "tutor", images: string[] = []) =>
  ({ id: `m${i}`, role, text: role === "tutor" ? "Em vẽ hình rồi gửi cô nhé?" : "📷 Em gửi ảnh", buttons: [], images, cardRef: null });
const thread = (photos: number, maxImages: number): Thread => ({
  problemId: "00000000-0000-4000-8000-000000000001", status: "in_progress", turnCount: 2, statementConfirmed: true, hasImages: photos > 0,
  maxImages, planTicks: [],
  messages: [...Array.from({ length: photos }, (_, i) => msg(i, "child", [`https://x.test/${i}.jpg`])), msg(99, "tutor")],
});
const render = (t: Thread) => renderToStaticMarkup(createElement(Chat, { initial: t, rating: null }));
const photoButton = (html: string) => /<button[^>]*aria-label="Gửi ảnh bài làm"[^>]*>([\s\S]*?)<\/button>/.exec(html);

describe("chat photo button (G8-fix)", () => {
  it("shows the word 'Gửi ảnh' on the button, enabled while photos are left", () => {
    const html = render(thread(1, 4));
    const b = photoButton(html);
    expect(b?.[1]).toContain(PHOTO_COPY.workShort);
    expect(b?.[0]).not.toMatch(/disabled=""/);
    expect(html).not.toContain(PHOTO_COPY.tooMany);
    // the file input has no `capture`: the iPad offers the photo library as well as the camera
    expect(html).toMatch(/<input[^>]*type="file"[^>]*aria-label="Gửi ảnh bài làm"/);
    expect(/<input[^>]*type="file"[^>]*aria-label="Gửi ảnh bài làm"[^>]*>/.exec(html)?.[0]).not.toContain("capture");
  });
  it("all photos used → the button is disabled and the reason is written on screen", () => {
    const html = render(thread(4, 4));
    expect(photoButton(html)?.[0]).toMatch(/disabled=""/);
    expect(html).toContain(PHOTO_COPY.tooMany);
  });
  it("a geometry problem (limit 6) still takes a 5th photo", () => {
    const html = render(thread(4, 6));
    expect(photoButton(html)?.[0]).not.toMatch(/disabled=""/);
    expect(html).not.toContain(PHOTO_COPY.tooMany);
  });
});
