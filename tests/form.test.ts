import { describe, expect, it } from "vitest";
import { readBody, TOO_BIG } from "@/lib/tutor/form";

describe("readBody", () => {
  it("multipart: fields as strings, the photo as bytes", async () => {
    const fd = new FormData();
    fd.set("clientMsgId", "00000000-0000-4000-8000-000000000001");
    fd.set("stuckKind", "khong_biet_bat_dau");
    fd.set("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "a.jpg");
    const body = (await readBody(new Request("http://x/api", { method: "POST", body: fd }))) as Record<string, unknown>;
    expect(body.clientMsgId).toBe("00000000-0000-4000-8000-000000000001");
    expect(body.stuckKind).toBe("khong_biet_bat_dau");
    expect(body.image).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("JSON still works; bad JSON is null; a photo over 4 MB is refused before it is read", async () => {
    const json = (body: string) => new Request("http://x", { method: "POST", body, headers: { "content-type": "application/json" } });
    expect(await readBody(json(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
    expect(await readBody(json("{"))).toBeNull();
    const fd = new FormData();
    fd.set("image", new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]), "big.jpg");
    expect(await readBody(new Request("http://x", { method: "POST", body: fd }))).toEqual(TOO_BIG);
  });
});
