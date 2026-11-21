import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { adminClient } from "./env";
import { signIn } from "./session";

// Runs on a fake model (lib/tutor/fakeClient.ts): the first turn restates the problem (few-shot 1),
// later turns use few-shot 2; the checker always passes.
const STATEMENT = "Hai người thợ cùng làm một công việc thì 16 giờ xong. Hỏi mỗi người làm một mình mất bao lâu?";
let problemId = "";

const tutor = () => adminClient().schema("tutor");
/** Presses a button and waits for the turn's answer from the server. */
async function pressAndWait(page: Page, name: string) {
  const answered = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/turn") && r.request().method() === "POST");
  await page.getByRole("button", { name, exact: true }).click();
  expect((await answered).status()).toBe(200);
  await expect(page.getByText("Cô đang nghĩ…")).toHaveCount(0);
}

test("signed out → the start page links to the Launcher login", async ({ page }) => {
  await page.goto("/gia-su");
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("child: pick where stuck, type the problem → the tutor restates it", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto("/gia-su");
  await expect(page.getByRole("heading", { name: "Em kẹt bài nào?" })).toBeVisible();
  await page.getByRole("button", { name: "Không biết bắt đầu" }).click();
  await page.getByLabel("Đề bài").fill(STATEMENT);
  await page.getByRole("button", { name: "Gửi" }).click();
  await page.waitForURL(/\/gia-su\/hoi\//);
  await expect(page.getByText("Em kiểm tra giúp cô đúng chưa?")).toBeVisible();
  problemId = page.url().split("/hoi/")[1]!;
  const { data } = await tutor().from("problems").select("status, turn_count, stuck_kind, knowledge_version").eq("id", problemId).single();
  expect(data).toMatchObject({ status: "in_progress", turn_count: 1, stuck_kind: "khong_biet_bat_dau" });
  expect(data?.knowledge_version).toMatch(/^\d{4}-\d{2}-\d{2}\./); // G5: the first turn is classified
  const { data: calls } = await tutor().from("model_calls").select("purpose").eq("problem_id", problemId);
  expect(calls?.map((c) => c.purpose).sort()).toEqual(["classify", "guard", "tutor"]); // every answer is checked
});

test("'Chưa hiểu' pressed 3 times in a row → nản: the turn goes to Opus (route_reason nan)", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto(`/gia-su/hoi/${problemId}`);
  for (let i = 0; i < 3; i++) await pressAndWait(page, "Chưa hiểu");
  const { data: calls } = await tutor().from("model_calls").select("model, route_reason")
    .eq("problem_id", problemId).eq("purpose", "tutor");
  expect(calls).toContainEqual({ model: "claude-opus-5-5", route_reason: "nan" });
  const { data: p } = await tutor().from("problems").select("hint_level, nan_jumps").eq("id", problemId).single();
  expect(p?.nan_jumps).toBe(1);
  expect(p?.hint_level).toBeGreaterThanOrEqual(4);
  const { data: presses } = await tutor().from("messages").select("input_kind").eq("problem_id", problemId).eq("role", "child");
  expect(presses?.filter((m) => m.input_kind === "button")).toHaveLength(3);
});

test("'Để dành hỏi thầy' asks first, then closes the problem as saved_for_later", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto(`/gia-su/hoi/${problemId}`);
  await page.getByRole("button", { name: "Để dành hỏi thầy" }).click();
  await page.getByRole("button", { name: "Thôi, làm tiếp" }).click(); // changing one's mind keeps the problem open
  await page.getByRole("button", { name: "Để dành hỏi thầy" }).click();
  await page.getByRole("button", { name: "Để dành", exact: true }).click();
  await expect(page.getByText("Đã để dành bài này cho thầy xem")).toBeVisible();
  const { data } = await tutor().from("problems").select("status").eq("id", problemId).single();
  expect(data?.status).toBe("saved_for_later");
});

test("child: the first problem ended → one-tap rating card (G7b, P2)", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto(`/gia-su/hoi/${problemId}`);
  await expect(page.getByText("Hôm nay cô dạy em thế nào?")).toBeVisible();
  const rated = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/session/rate"));
  await page.getByRole("button", { name: "Khó hiểu" }).click();
  expect((await rated).status()).toBe(200);
  await page.getByRole("button", { name: "Cô nói dài quá" }).click();
  const again = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/session/rate"));
  await page.getByRole("button", { name: "Xong" }).click();
  expect((await again).status()).toBe(200);
  await expect(page.getByText("Hôm nay cô dạy em thế nào?")).toHaveCount(0);
  const { data: p } = await tutor().from("problems").select("session_id").eq("id", problemId).single();
  const { data: r } = await tutor().from("ratings").select("face, reasons").eq("session_id", p!.session_id);
  expect(r).toEqual([{ face: "hard", reasons: ["too_long"] }]);
});

test("parent: evening report shows the day's flags; 👎 + note on a tutor turn is saved (G7a)", async ({ page, context }) => {
  // The problem above went to Opus after 3 × "Chưa hiểu" (nản) and was saved for later.
  const { data: lines } = await adminClient().from("learning_attention").select("slot, body, source").eq("local_date", new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  expect(lines).toContainEqual(expect.objectContaining({ slot: 1, source: "tutor:toan", body: expect.stringContaining("nản 1 lần") }));
  await signIn(context, "parent");
  await page.goto("/gia-su/bo-me/bao-cao");
  await expect(page.getByRole("heading", { name: "Con thử · lớp 9" })).toBeVisible();
  await expect(page.getByText(/Nản \/ bỏ dở: .*nản 1 lần/)).toBeVisible();
  await expect(page.getByText(/Để dành hỏi thầy · gợi ý tới H/).first()).toBeVisible();
  await page.goto(`/gia-su/bo-me/bao-cao/${problemId}`);
  await page.getByRole("button", { name: "Cô nên dạy khác" }).first().click();
  await page.getByPlaceholder("Cô nên làm khác thế nào?").fill("Cô giảng ngắn hơn, mỗi lần một ý");
  const saved = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/parent/feedback"));
  await page.getByRole("button", { name: "Gửi" }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText("Đã lưu góp ý").first()).toBeVisible();
  const { data: fb } = await tutor().from("parent_feedback").select("thumb, note").eq("problem_id", problemId);
  expect(fb).toEqual([{ thumb: "down", note: "Cô giảng ngắn hơn, mỗi lần một ý" }]);
});

test("parent: the note became a proposed rule; approving it makes it active (G7b, P3)", async ({ page, context }) => {
  // The rule is drafted after the feedback answer (fake model): wait for it.
  await expect.poll(async () => (await tutor().from("teaching_rules").select("status").eq("source", "parent_feedback")).data?.length ?? 0, { timeout: 15_000 }).toBe(1);
  await signIn(context, "parent");
  await page.goto("/gia-su/bo-me/luat");
  await expect(page.getByText("Chờ duyệt (1)")).toBeVisible();
  await expect(page.getByText("Cô soạn từ góp ý của bố mẹ")).toBeVisible();
  await page.getByRole("button", { name: "Duyệt" }).click();
  await expect(page.getByText("Đang dùng (1/12)")).toBeVisible();
  const { data } = await tutor().from("teaching_rules").select("status, version, text").eq("source", "parent_feedback");
  expect(data).toEqual([{ status: "approved", version: 1, text: "Trả lời ngắn hơn, mỗi lượt một ý." }]);
});

test("parent: the private math checker answers through the server (G4)", async ({ page, context }) => {
  await signIn(context, "parent");
  const r = await page.request.get("/gia-su/api/admin/cas-health");
  expect(await r.json()).toMatchObject({ health: true, sample: { ok: true, result: { is_root: true } } });
});

test("parent: the teaching profile page shows the child and the current profile", async ({ page, context }) => {
  await signIn(context, "parent");
  await page.goto("/gia-su/bo-me");
  await expect(page.getByRole("heading", { name: "Con thử · lớp 9" })).toBeVisible();
  await expect(page.getByText(/Đang bật · phiên bản 1/)).toBeVisible();
});

// G3 — photos. The pictures are drawn here from SVG (made-up problems, no real photo).
const picture = (text: string) => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#fff"/>` +
  `<text x="60" y="200" font-family="DejaVu Sans, sans-serif" font-size="56">${text}</text></svg>`))
  .withExif({ IFD0: { Make: "PhoneMaker" } }).jpeg().toBuffer();
let photoProblem = "";

async function choosePhoto(page: Page, selector: string, text: string) {
  await page.locator(selector).setInputFiles({ name: "de.jpg", mimeType: "image/jpeg", buffer: await picture(text) });
}

test("photo: the child sends a photo of the problem → the tutor restates it; the file is private, small and has no EXIF", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto("/gia-su");
  await choosePhoto(page, 'input[type="file"]:not([capture])', "Bài 1. Tính 2 + 3 (đề bịa)");
  await expect(page.getByAltText("Ảnh đề em chọn")).toBeVisible();
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.waitForURL(/\/gia-su\/hoi\//);
  await expect(page.getByText("Em kiểm tra giúp cô đúng chưa?")).toBeVisible();
  await expect(page.getByAltText("Ảnh em gửi")).toBeVisible();
  photoProblem = page.url().split("/hoi/")[1]!;

  const { data: p } = await tutor().from("problems").select("child_id").eq("id", photoProblem).single();
  const { data: att } = await tutor().from("attachments").select("message_id, storage_path, width, height").eq("problem_id", photoProblem);
  expect(att).toHaveLength(1);
  expect(att![0]!.message_id).not.toBeNull();
  expect(att![0]!.storage_path.startsWith(`${p!.child_id}/${photoProblem}/`)).toBe(true);
  expect(Math.max(att![0]!.width, att![0]!.height)).toBeLessThanOrEqual(1568);
  const { data: file } = await adminClient().storage.from("tutor-images").download(att![0]!.storage_path);
  const meta = await sharp(Buffer.from(await file!.arrayBuffer())).metadata();
  expect([meta.format, meta.exif]).toEqual(["jpeg", undefined]);
  // the browser cannot read the bucket directly: only the signed URL works
  const anon = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-images/${att![0]!.storage_path}`);
  expect(anon.ok).toBe(false);
});

test("photo: 'Chụp lại ảnh khác' opens a new problem and drops the unconfirmed one", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto(`/gia-su/hoi/${photoProblem}`);
  await page.getByRole("link", { name: "Chụp lại ảnh khác" }).click();
  await page.waitForURL(/thay=/);
  await choosePhoto(page, 'input[type="file"]:not([capture])', "Bài 1. Tính 2 + 3 (chụp lại)");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.waitForURL((u) => u.pathname.includes("/hoi/") && !u.pathname.endsWith(photoProblem));
  const { data } = await tutor().from("problems").select("status").eq("id", photoProblem).single();
  expect(data?.status).toBe("abandoned");
  photoProblem = page.url().split("/hoi/")[1]!;
});

test("photo: a photo of the work mid-problem goes with the turn", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto(`/gia-su/hoi/${photoProblem}`);
  await choosePhoto(page, 'input[type="file"]', "2 + 3 = 5 (bài làm bịa)");
  await expect(page.getByAltText("Ảnh bài làm em chọn")).toBeVisible();
  const answered = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/turn") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  expect((await answered).status()).toBe(200);
  const { data: att } = await tutor().from("attachments").select("id").eq("problem_id", photoProblem);
  expect(att).toHaveLength(2);
});

test("cards (G6): the tutor names a card → the approved card shows; way 2 and 'Em không hiểu đề' need no model call", async ({ page, context }) => {
  await signIn(context, "child");
  await page.goto("/gia-su");
  await page.getByRole("button", { name: "Không biết bắt đầu" }).click();
  await page.getByLabel("Đề bài").fill("Rút gọn biểu thức có căn bậc hai (đề bịa cho e2e).");
  await page.getByRole("button", { name: "Gửi" }).click();
  await page.waitForURL(/\/gia-su\/hoi\//);
  const id = page.url().split("/hoi/")[1]!;
  await page.getByLabel("Em trả lời").fill("Căn bậc hai là gì ạ");
  const answered = page.waitForResponse((r) => r.url().endsWith("/gia-su/api/turn") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  expect((await answered).status()).toBe(200);
  await expect(page.locator('[data-card="T9.9#1"]')).toBeVisible();
  const tutorCalls = async () => (await tutor().from("model_calls").select("id").eq("problem_id", id).eq("purpose", "tutor")).data?.length ?? 0;
  const before = await tutorCalls();
  await pressAndWait(page, "Giảng lại cách khác");
  await expect(page.locator('[data-card="T9.9#2"]')).toBeVisible();
  await pressAndWait(page, "Em không hiểu đề");
  await expect(page.getByRole("button", { name: "Em không biết bắt đầu đặt ẩn" })).toBeVisible(); // grade 9: 4 ways
  expect(await tutorCalls()).toBe(before);
  const { data: msgs } = await tutor().from("messages").select("card_ref").eq("problem_id", id).eq("role", "tutor").not("card_ref", "is", null);
  expect(msgs?.map((m) => m.card_ref).sort()).toEqual(["T9.9#1", "T9.9#2"]);
});
