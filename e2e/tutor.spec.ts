import { expect, test, type Page } from "@playwright/test";
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
  const { data } = await tutor().from("problems").select("status, turn_count, stuck_kind").eq("id", problemId).single();
  expect(data).toEqual({ status: "in_progress", turn_count: 1, stuck_kind: "khong_biet_bat_dau" });
  const { data: calls } = await tutor().from("model_calls").select("purpose").eq("problem_id", problemId);
  expect(calls?.map((c) => c.purpose).sort()).toEqual(["guard", "tutor"]); // every answer is checked
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

test("parent: the teaching profile page shows the child and the current profile", async ({ page, context }) => {
  await signIn(context, "parent");
  await page.goto("/gia-su/bo-me");
  await expect(page.getByRole("heading", { name: "Con thử · lớp 9" })).toBeVisible();
  await expect(page.getByText(/Đang bật · phiên bản 1/)).toBeVisible();
});
