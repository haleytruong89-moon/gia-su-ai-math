# G1 Walking skeleton + L-1 cửa vào Launcher — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Con bấm "Cô gia sư Toán" trong Góc học tập của Study Launcher → không đăng nhập lại → gõ đề → thấy lượt "xác nhận đề" của cô; mọi thứ ghi vào schema `tutor`; bố mẹ nhập được hồ sơ dạy học cho từng con.

**Architecture:** Hai PR độc lập. **G1** (repo `gia-su-ai-math`): app Next.js 16 `basePath: "/gia-su"`, đọc phiên Supabase của Launcher (cùng tên miền nhờ rewrite), route máy chủ `handleTurn` thuần + `TutorRepo` (bộ nhớ cho test, Supabase service role cho thật), gọi Claude 1 lần/lượt (chưa guard, chưa công cụ — G2/G4). **L-1** (repo `study-launcher`): rewrite `/gia-su/:path*` → app gia sư (chỉ khi có biến `TUTOR_APP_ORIGIN`), bỏ `/gia-su` khỏi proxy của Launcher, 2 cửa vào trong Góc học tập. Không có SQL mới ở cả hai PR.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript ~5.9 strict, Tailwind 4.3, `@supabase/ssr` ^0.12.7, `@supabase/supabase-js` ^2.117.3, zod ^4.6, `@anthropic-ai/sdk` ^1.8, Vitest ^5.0.4.

**Spec:** `docs/DOMAIN.md` (= hub `DOMAIN_v0.4.md`), `docs/SPEC.md`, `docs/DESIGN.md`, hub `PLAN_CODE_v0.1.md` (Task 2–9), `SYSTEM_PROMPT_v0.2.md`, `TICH_HOP_LAUNCHER_v0.2.md`. Vị trí cửa vào: phụ huynh duyệt 14/11/2026 ("ok cách này") — ① thẻ "Cô gia sư Toán" ở đầu Góc học tập (luôn hiện), ② nút "Em kẹt bài này? Hỏi cô" trong Khung làm bài khi việc đang làm là môn Toán.

## Global Constraints
- Repo `gia-su-ai-math` **công khai**: không tên thật, trường, lớp cụ thể, điểm, nhận xét thầy cô, email, URL/khóa thật trong code/test/prompt/docs/commit. Hồ sơ dạy học thật chỉ nằm trong DB (bố mẹ dán qua form).
- `child_id` chỉ lấy từ phiên (`auth.uid()`); kiểm `problem_id` thuộc con đó.
- Mọi ghi qua route máy chủ (service role); con chỉ SELECT qua RLS.
- Khóa bí mật không có tiền tố `NEXT_PUBLIC_`; file dùng chúng có `import "server-only"`. Không log nội dung tin nhắn của con.
- Tối đa 20 lượt/bài (`turn_count` 0–20). Model qua `TUTOR_MODEL_MAIN` (mặc định `claude-sonnet-5-5`).
- Structured output: `output_config: { format: { type: "json_schema", schema } }`.
- Link giữa 2 app (2 "zone" khác nhau) là `<a href>` thường, không dùng `next/link`.
- Launcher: không đổi khóa/mở, không đổi quyền ghi của con, không SQL. Thiếu `TUTOR_APP_ORIGIN` → Launcher như cũ (không thẻ, không nút, không rewrite).
- Chữ giao diện tiếng Việt có dấu; nút ≥ 44px; font Be Vietnam Pro.

## Bản đồ file

| Repo | File | Trách nhiệm |
|---|---|---|
| gia-su | `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `public/fonts/*` | Khung Next + basePath + header + font |
| gia-su | `lib/env.ts` | Biến môi trường; CAS/notify/cron tùy chọn tới G4/G7 |
| gia-su | `lib/supabase/{server,admin}.ts`, `proxy.ts` | Client theo phiên + service role; làm mới cookie phiên |
| gia-su | `lib/auth.ts` | `getActor()` (đọc phiên + `profiles` + `teaching_profiles`) |
| gia-su | `prompts/{role,rules,method}.md`, `prompts/PROMPT_VERSION`, `lib/tutor/layers.ts` | Lớp ①②③ + đọc file |
| gia-su | `lib/anthropic.ts` (`realClient`) | SDK + thử lại 1 lần |
| gia-su | `lib/tutor/repo.ts`, `lib/tutor/handlers.ts`, `tests/helpers/memoryRepo.ts` | Giao diện kho + 3 xử lý máy chủ thuần |
| gia-su | `lib/db/supabaseRepo.ts`, `app/api/{session/start,problem/new,turn}/route.ts` | Kho thật + route |
| gia-su | `lib/profileForm.ts`, `app/bo-me/*`, `app/api/admin/profile/route.ts` | Bố mẹ nhập hồ sơ dạy học (bản tối giản) |
| gia-su | `app/page.tsx`, `app/start-form.tsx`, `app/hoi/[problemId]/{page,chat}.tsx`, `lib/copy.ts` | Màn con |
| gia-su | `vercel.json`, `.github/workflows/ci.yml`, `docs/PROGRESS.md` | Deploy + CI |
| launcher | `lib/tutor/entry.ts`, `tests/tutorEntry.test.ts` | Luật thuần: có bật gia sư không, môn Toán, link |
| launcher | `next.config.ts`, `proxy.ts`, `.env.example` | Rewrite + bỏ `/gia-su` khỏi proxy |
| launcher | `app/today/page.tsx`, `app/today/today-screen.tsx`, `app/today/study-corner.tsx` | Thẻ + nút |
| launcher | `CLAUDE.md`, `docs/PROGRESS.md` | Ghi T1, D20, biến mới |

---

### Task 1: Khung Next.js + env (gia-su)

**Files:** Create `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts` (Next tự sinh), `app/layout.tsx`, `app/globals.css`, `public/fonts/` (chép woff2 Be Vietnam Pro 400/500/600/700 từ Launcher, SIL OFL). Modify `package.json`, `tsconfig.json`, `lib/env.ts`, `tests/env.test.ts`, `.env.example`.

**Interfaces:** Produces `serverEnv(): ServerEnv` — `CAS_URL`, `CAS_SECRET`, `LAUNCHER_URL`, `TUTOR_NOTIFY_SECRET`, `CRON_SECRET` thành `optional()` (cần từ G4/G7).

- [ ] **Step 1: failing test** — thêm vào `tests/env.test.ts`:
```ts
it("G1 runs without the CAS / notify / cron secrets (needed from G4, G7)", () => {
  const { CAS_URL: _a, CAS_SECRET: _b, LAUNCHER_URL: _c, TUTOR_NOTIFY_SECRET: _d, CRON_SECRET: _e, ...g1 } = base;
  expect(parseServerEnv(g1).ANTHROPIC_API_KEY).toBe("sk-ant-x");
});
```
- [ ] **Step 2:** `npx vitest run tests/env.test.ts` → FAIL (`CAS_URL` required).
- [ ] **Step 3:** trong `lib/env.ts` đổi 5 biến sang `.optional()` (giữ `.url()` cho URL), comment `// required from G4 (cas) / G7 (notify, cron)`.
- [ ] **Step 4:** cài `next@16.4.6 react@^19.3.0 react-dom@^19.3.0 @supabase/ssr@^0.12.7 @supabase/supabase-js@^2.117.3 server-only @anthropic-ai/sdk` và dev `tailwindcss@^4.3.3 @tailwindcss/postcss eslint@^9.39.5 eslint-config-next@16.4.6 @types/react @types/react-dom` (`--legacy-peer-deps`). Scripts: `dev` `next dev`, `build` `next build`, `start`, `lint` `eslint .`, `typecheck`, `test`. tsconfig theo Launcher (`jsx: react-jsx`, plugin next, `noUncheckedIndexedAccess`).
```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  basePath: "/gia-su",
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/**": ["./prompts/**"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
```
- [ ] **Step 5:** `npm test && npm run typecheck && npm run lint && npm run build` → xanh. Commit `chore: scaffold next app under /gia-su`.

### Task 2: Phiên đăng nhập + `getActor` (gia-su)

**Files:** Create `lib/supabase/server.ts` (chép Launcher), `lib/supabase/admin.ts`, `proxy.ts`, `lib/auth.ts`; test `tests/auth.test.ts` (đã có cho `resolveActor`) + `tests/entry.test.ts`.

**Interfaces:**
- Consumes `resolveActor` (`lib/actor.ts`, có sẵn).
- Produces `getActor(): Promise<Actor | null>`, `getEntry(): Promise<Entry>` với
```ts
export type Entry = { kind: "signed_out" } | { kind: "parent"; actor: ParentActor }
  | { kind: "child"; actor: ChildActor } | { kind: "child_not_ready"; reason: "no_teaching_profile" | "grade_not_supported" | "no_profile" };
export function entryFrom(signedIn: boolean, r: ReturnType<typeof resolveActor>): Entry; // pure
```
- [ ] **Step 1: failing test** `tests/entry.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { entryFrom } from "@/lib/entry";
import { resolveActor } from "@/lib/actor";
const child = { id: "c1", family_id: "f1", role: "child" as const, grade: 9 };
describe("entryFrom", () => {
  it("no session → signed_out", () => expect(entryFrom(false, { error: "no_profile" })).toEqual({ kind: "signed_out" }));
  it("child without teaching profile → child_not_ready", () =>
    expect(entryFrom(true, resolveActor(child, null))).toEqual({ kind: "child_not_ready", reason: "no_teaching_profile" }));
  it("parent", () => expect(entryFrom(true, resolveActor({ ...child, role: "parent", grade: null }, null)).kind).toBe("parent"));
});
```
- [ ] **Step 2:** FAIL. **Step 3:** `lib/entry.ts` (thuần) + `lib/auth.ts` (`getUser()` → đọc `profiles` + `tutor.teaching_profiles` `is_current` bằng service role → `entryFrom`). `proxy.ts` gọi `refreshSession` (chép `lib/supabase/session.ts` của Launcher), matcher `["/((?!api/|_next/static|_next/image|fonts/).*)"]`.
- [ ] **Step 4:** PASS. Commit `feat: read the launcher session`.

### Task 3: Prompt ①②③ (gia-su)

**Files:** Create `prompts/role.md`, `prompts/rules.md`, `prompts/method.md` (chép nguyên mục ①, ②, ③ của hub `SYSTEM_PROMPT_v0.2.md`, gồm "Ví dụ mẫu"), `prompts/PROMPT_VERSION` (`v0.2`), `lib/tutor/layers.ts`; test `tests/layers.test.ts`.

**Interfaces:** Produces `loadLayers(): { role: string; rules: string; method: string }`, `PROMPT_VERSION: string`.
- [ ] **Step 1: failing test**
```ts
import { describe, expect, it } from "vitest";
import { loadLayers, promptVersion } from "@/lib/tutor/layers";
describe("prompt layers", () => {
  it("loads ① ② ③ from prompts/", () => {
    const l = loadLayers();
    expect(l.role).toMatch(/^## ① Vai trò/);
    expect(l.rules).toMatch(/^## ② Luật cứng/);
    expect(l.method).toMatch(/^## ③ Phương pháp/);
  });
  it("has a version", () => expect(promptVersion()).toMatch(/^v\d+\.\d+$/));
});
```
- [ ] **Step 2:** FAIL. **Step 3:** `readFileSync(join(process.cwd(), "prompts", f), "utf8").trim()`, đọc 1 lần (cache trong module).
- [ ] **Step 4:** PASS. Commit `feat: prompt layers 1-3 (v0.2)`.

### Task 4: Client Claude thật (gia-su)

**Files:** Modify `lib/anthropic.ts` (thêm `withRetry`, `realClient`); test `tests/anthropic.test.ts`.

**Interfaces:** Produces `withRetry(c: ModelClient): ModelClient` (thử lại đúng 1 lần khi lỗi có `status` ≥ 500 hoặc 529), `realClient(apiKey: string): ModelClient`.
- [ ] **Step 1: failing test**
```ts
import { describe, expect, it } from "vitest";
import { withRetry } from "@/lib/anthropic";
const ok = { content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } };
const err = (status: number) => Object.assign(new Error("x"), { status });
describe("withRetry", () => {
  it("retries once on 529", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; if (n === 1) throw err(529); return ok; } });
    expect(await c.create({})).toBe(ok); expect(n).toBe(2);
  });
  it("does not retry a 400", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; throw err(400); } });
    await expect(c.create({})).rejects.toThrow(); expect(n).toBe(1);
  });
  it("gives up after the second failure", async () => {
    let n = 0;
    const c = withRetry({ create: async () => { n++; throw err(500); } });
    await expect(c.create({})).rejects.toThrow(); expect(n).toBe(2);
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** `realClient` = `new Anthropic({ apiKey, maxRetries: 0 })`, `create: (req) => sdk.messages.create(req as never)`; bọc `withRetry`.
- [ ] **Step 4:** PASS. Commit `feat: anthropic client with one retry`.

### Task 5: Xử lý máy chủ thuần + kho bộ nhớ (gia-su)

**Files:** Create `lib/tutor/repo.ts` (types), `lib/tutor/handlers.ts`, `tests/helpers/memoryRepo.ts`, `tests/handlers.test.ts`.

**Interfaces:**
```ts
// lib/tutor/repo.ts
export interface ProblemRow { id: string; childId: string; status: string; turnCount: number; hintLevel: number;
  wrongCount: number; stuckKind: StuckKind | null; model: string; history: Msg[] }
export interface StoredReply { message: string; buttons: string[]; hintLevel: number; status: string; turnCount: number }
export type Claim = { kind: "new"; messageId: string } | { kind: "answered"; reply: StoredReply } | { kind: "pending"; messageId: string; ageMs: number };
export interface TutorRepo {
  openSession(a: { childId: string; familyId: string; device: Device; dateVn: string; promptVersion: string; modelMain: string; profileVersion: number }): Promise<{ id: string; reused: boolean }>;
  createProblem(a: { childId: string; familyId: string; sessionId: string; stuckKind: StuckKind | null }): Promise<{ id: string }>;
  getProblemForChild(problemId: string, childId: string): Promise<ProblemRow | null>;
  claimMessage(a: { childId: string; familyId: string; problemId: string; clientMsgId: string; text: string }, now: Date): Promise<Claim>;
  releaseClaim(messageId: string): Promise<void>;
  saveReply(a: SaveReplyInput): Promise<StoredReply>; // tutor message, model_call, problem counters, usage_monthly
}
// lib/tutor/handlers.ts
export const MAX_TURNS = 20;
export const STUCK_KINDS = ["chua_hieu_de", "khong_biet_bat_dau", "lam_do_thi_tac", "ra_ket_qua_sai", "khong_hieu_buoc"] as const;
export interface Deps { repo: TutorRepo; client: ModelClient; actor: Actor | null; now: Date; layers: Layers; promptVersion: string; modelMain: string }
export function startSession(d: Deps, body: unknown): Promise<{ status: number; json: unknown }>;
export function newProblem(d: Deps, body: unknown): Promise<{ status: number; json: unknown }>;   // tạo bài + lượt đầu
export function handleTurn(d: Deps, body: unknown): Promise<{ status: number; json: unknown }>;
```
- [ ] **Step 1: failing tests** (`tests/handlers.test.ts`): 401 không phải con; 400 body sai; 404 bài của con khác; cùng `clientMsgId` 2 lần → 1 lần gọi model, cùng trả lời; tin đang chờ (< 90 s) → 409 `pending`; tin chờ quá 90 s → chạy lại; lượt 20 → `timed_out` và lượt 21 → 409 `problem_closed`; model lỗi → 503 kèm câu an toàn, tin của con được nhả (gửi lại được); output không parse được → vẫn 200 với câu an toàn, `raw` được lưu; `startSession` dùng lại buổi `active`, `date_vn` theo giờ VN (23:30 UTC 14/11 → `2026-11-15`); `newProblem` tạo bài với `stuckKind` + chạy lượt đầu với chữ đề.
- [ ] **Step 2:** FAIL. **Step 3:** cài `handlers.ts` (code ở commit), `memoryRepo` bằng `Map`.
- [ ] **Step 4:** PASS. Commit `feat: server turn handlers (walking skeleton)`.

### Task 6: Kho Supabase + route (gia-su)

**Files:** Create `lib/db/supabaseRepo.ts`, `lib/tutor/deps.ts` (`liveDeps()`), `app/api/session/start/route.ts`, `app/api/problem/new/route.ts`, `app/api/turn/route.ts`.

- `claimMessage`: insert `tutor.messages` (role `child`, `client_msg_id`); lỗi `23505` (trùng `client_msg_id`) → đọc tin con + tin cô ngay sau → `answered` / `pending`.
- `saveReply`: insert tin cô → insert `model_calls` (purpose `tutor`, `message_id` = tin cô) → update `problems` (`turn_count`, `status`, `closed_at`, `statement_confirmed` khi model báo `de_da_xac_nhan`) → upsert `usage_monthly` (tháng UTC, cộng `cost_usd`; đọc rồi ghi — G7 chuyển sang hàm SQL nếu cần chính xác tuyệt đối).
- Route chỉ: `const d = await liveDeps(); const r = await handleTurn(d, await req.json().catch(() => null)); return Response.json(r.json, { status: r.status })`. Lỗi bất ngờ → 500 `{ error: "server" }`, log chỉ `e.message` (không log nội dung).
- [ ] **Step 1:** `npm run typecheck && npm test` xanh (kho thật kiểm trên preview, Task 9). Commit `feat: supabase repo and api routes`.

### Task 7: Bố mẹ nhập hồ sơ dạy học (gia-su, bản tối giản)

**Files:** Create `lib/profileForm.ts`, `tests/profileForm.test.ts`, `app/bo-me/page.tsx`, `app/bo-me/profile-form.tsx`, `app/api/admin/profile/route.ts`.

**Interfaces:** `parseProfileForm(raw: unknown, grade: number): { ok: true; value: { childId: string; childCode: string; maxLines: number; answerMode: "buttons_first" | "mixed"; profileText: string } } | { ok: false; error: string }`.
- [ ] **Step 1: failing test** — mã `HS-9A` hợp lệ, `Tran Van A` bị từ chối ("Chỉ dùng mã dạng HS-9A, không dùng tên thật"); `maxLines` mặc định theo lớp (9 → 6, 6 → 4, DOMAIN §1); `maxLines` 11 bị từ chối; `profileText` rỗng bị từ chối; > 4000 ký tự bị từ chối.
- [ ] **Step 2:** FAIL. **Step 3:** route: chỉ phụ huynh (`getActor().role === "parent"`), kiểm `childId` thuộc `family_id` của phụ huynh (đọc `profiles`), version = max + 1; tắt `is_current` bản cũ rồi chèn bản mới. Trang `/gia-su/bo-me`: mỗi con lớp 6/9 một khung: mã, số dòng tối đa, kiểu trả lời, ô hồ sơ (gợi ý: "dán hồ sơ đã duyệt từ hub, chỉ dùng mã con"), bản hiện tại (version, ngày).
- [ ] **Step 4:** PASS. Commit `feat: parent sets the teaching profile`.

### Task 8: Màn của con (gia-su)

**Files:** Create `lib/copy.ts`, `app/page.tsx`, `app/start-form.tsx`, `app/hoi/[problemId]/page.tsx`, `app/hoi/[problemId]/chat.tsx`, `app/not-ready.tsx`.

- `/gia-su`: theo `getEntry()` — `signed_out` → "Em mở cô gia sư từ Study Launcher nhé" + `<a href="/login?next=/gia-su">Đăng nhập</a>`; `parent` → link "Hồ sơ dạy học" (`/gia-su/bo-me`); `child_not_ready` → "Bố mẹ chưa nhập hồ sơ dạy học cho em…"; `child` → nút "Em đang kẹt" → 5 nút chỗ kẹt → ô `<label>Đề bài</label>` → "Gửi" (gọi `/gia-su/api/session/start` rồi `/gia-su/api/problem/new`, chuyển `/gia-su/hoi/<id>`). Nếu URL có `?task=<tiêu đề>` (từ nút ②) thì hiện "Bài đang làm: <tiêu đề>" (chỉ hiển thị, không gửi AI, không lưu — liên kết với việc của Launcher để G7).
- `/gia-su/hoi/[id]`: server đọc bài + tin nhắn (service role, `child_id` từ phiên) → `chat.tsx`: bong bóng, nút của cô (≤ 4, bấm = gửi chữ của nút), ô trả lời, "Gửi"; mỗi lần bấm sinh `clientMsgId` 1 lần, gửi lại khi lỗi mạng/409 `pending` dùng **đúng id cũ** (thử lại sau 3 s, tối đa 5 lần).
- Đầu mọi màn: `<a href="/today?tab=hoc-tap">← Về Góc học tập</a>` (nút ≥ 44px).
- [ ] **Step 1:** `npm run build && npm run lint` xanh; chạy `next start` local không có env → trang báo lỗi cấu hình rõ, không lộ khóa. Commit `feat: minimal child screens`.
- *(Nợ cổng: e2e Playwright cần Supabase local có schema Launcher — chuyển sang G2, ghi PROGRESS.)*

### Task 9: Deploy + CI + PR G1 (gia-su)

**Files:** Create `vercel.json` (`{ "regions": ["sin1"] }` — chưa khai báo service `cas` ở G1 vì chưa gọi; G4 làm theo D24), modify `.github/workflows/ci.yml` (thêm `npm run lint`, `npm run build` với env giả), `docs/PROGRESS.md`.
- [ ] **Step 1:** CI xanh trên PR.
- [ ] **Step 2:** PR (tiếng Việt): làm gì · **không SQL** · hướng dẫn phụ huynh tạo project Vercel `gia-su-ai-math` (Root `./`, Framework Next.js, region sin1), nhập biến **chỉ** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (cùng giá trị project thật của Launcher), `ANTHROPIC_API_KEY` (key `gs-ai-math`, dán thẳng vào Vercel, không dán vào chat) · địa chỉ production ghi lại để làm `TUTOR_APP_ORIGIN` · cách thử.

### Task 10: Luật cửa vào (launcher)

**Files:** Create `lib/tutor/entry.ts`, `tests/tutorEntry.test.ts`.

**Interfaces:**
```ts
export function tutorOrigin(raw: string | undefined): string | null; // https origin only, no path
export function tutorEnabled(origin: string | null, grade: number | null): boolean; // origin && grade ∈ {6, 9}
export function isMathSubject(subject: string | null | undefined): boolean; // "Toán", "toán", "Toan", "Toán học", "Toán 9"
export const TUTOR_HOME = "/gia-su?from=hoc-tap";
export function tutorTaskHref(title: string): string; // "/gia-su?from=hoc-tap&task=<encoded, ≤ 120 ký tự>"
```
- [ ] **Step 1: failing test**: `tutorOrigin("https://gia-su-ai.vercel.app/")` → `"https://gia-su-ai.vercel.app"`; `"http://x"` → null (chỉ https; `http://localhost:3001` được nhận khi `NODE_ENV !== "production"`); `"javascript:alert(1)"`, `""`, `undefined` → null; `tutorEnabled(o, 7)` false, `(o, 9)` true, `(null, 9)` false; `isMathSubject` đúng với "Toán", "toán", "Toan", "TOÁN", "Toán học", "Toán 9", sai với "Tin học", "Ngữ văn", null; `tutorTaskHref("Bài 3 & 4")` → `/gia-su?from=hoc-tap&task=B%C3%A0i%203%20%26%204`; tiêu đề 300 ký tự bị cắt còn 120.
- [ ] **Step 2:** FAIL. **Step 3:** cài (bỏ dấu bằng `normalize("NFD")` + bỏ `̀-ͯ`, `đ→d`; khớp `^toan(\s|$)`).
- [ ] **Step 4:** PASS. Commit `feat: tutor entry rules`.

### Task 11: Rewrite + proxy (launcher)

**Files:** Modify `next.config.ts`, `proxy.ts`, `.env.example`; test `tests/nextConfig.test.ts` (nếu Launcher chưa có test cấu hình thì thêm: import `next.config.ts`, gọi `rewrites()` với/không có biến).

- [ ] **Step 1: failing test**: không có `TUTOR_APP_ORIGIN` → `rewrites()` trả `[]`; có `https://t.example` → `[{ source: "/gia-su", destination: "https://t.example/gia-su" }, { source: "/gia-su/:path*", destination: "https://t.example/gia-su/:path*" }]`.
- [ ] **Step 2:** FAIL. **Step 3:** `async rewrites()` dùng `tutorOrigin(process.env.TUTOR_APP_ORIGIN)`; proxy matcher thêm `gia-su(?:/|$)` vào phần loại trừ (app gia sư tự làm mới phiên; tránh mỗi lượt hỏi cô thêm 1 lần gọi Supabase Auth và tránh chạy proxy trên `/gia-su/_next/static`). `.env.example`: `TUTOR_APP_ORIGIN=` + chú thích.
- [ ] **Step 4:** PASS + `npm run typecheck && npm run lint && npm test`. Commit `feat: route /gia-su to the tutor app (D20)`.

### Task 12: Thẻ ① + nút ② (launcher)

**Files:** Modify `app/today/page.tsx` (tính `tutor = tutorEnabled(tutorOrigin(env), ctx.grade)`), `app/today/today-screen.tsx` (prop `tutor: boolean` → `StudyCorner`), `app/today/study-corner.tsx`.

- Thẻ ① đầu Góc học tập (ẩn khi "Chỉ hiện bài này"): tiêu đề "Cô gia sư Toán", dòng "Kẹt bài Toán? Cô hỏi gợi ý từng bước, không làm hộ.", nút `<a href={TUTOR_HOME}>Hỏi cô</a>` (min-h-11, màu của con).
- Nút ② trong `WorkPanel` khi `tutor && isMathSubject(item.subject) && item.state !== "done"`: `<a href={tutorTaskHref(item.title)}>Em kẹt bài này? Hỏi cô</a>` dưới `TaskActions`.
- [ ] **Step 1:** `npm run typecheck && npm run lint && npm test` xanh; chạy `npm run dev` với `TUTOR_APP_ORIGIN` trống → Góc học tập y như cũ. Commit `feat: two tutor entry points in Góc học tập`.

### Task 13: Docs + PR L-1 (launcher)

- [ ] `CLAUDE.md`: Warnings "Không thêm dịch vụ bên thứ ba…" thêm ngoại lệ **T1** (gia sư AI gửi ảnh/bài làm sang Anthropic, không gửi tên/trường; repo `gia-su-ai-math`); Key decisions thêm D20 (rewrite `/gia-su`, `TUTOR_APP_ORIGIN`) + D21 (schema `tutor` ở repo này); Biến môi trường thêm `TUTOR_APP_ORIGIN`.
- [ ] `docs/PROGRESS.md`: dòng GS1.
- [ ] PR (tiếng Việt): **không đụng database**; chưa có biến → không đổi gì; cách thử (sau khi G1 deploy: thêm biến ở Vercel Preview → Redeploy → Góc học tập thấy thẻ; việc môn Toán có nút ②; bấm → không đăng nhập lại). Ghi rủi ro: preview Launcher dùng database preview (SETUP H) thì phiên không hợp với app gia sư (database thật) → thử đầy đủ sau merge trên link chính thức.

---

## Tự soát
- **Phủ spec:** US1 phần chữ (Task 5–8), quyền §2 (Task 2, 5, 7: con chỉ đọc qua phiên, phụ huynh chỉ con trong nhà), idempotency (Task 5), 20 lượt (Task 5), chi phí ghi `model_calls` + `usage_monthly` (Task 6), cửa vào đã duyệt (Task 10–12), D20 (Task 11). Chưa làm (đúng lát): guard Haiku, mức gợi ý, nản (G2); ảnh (G3); công cụ (G4); thẻ kiến thức (G5); ôn đầu buổi (G6); báo cáo, economy (G7).
- **Tên nhất quán:** `Actor`, `TutorRepo`, `Claim`, `StoredReply`, `handleTurn`, `newProblem`, `startSession`, `loadLayers`, `promptVersion`, `withRetry`, `realClient`, `tutorOrigin`, `tutorEnabled`, `isMathSubject`, `tutorTaskHref`, `TUTOR_HOME`.
- **Giả định ghi rõ:** Vercel chuyển tiếp `Set-Cookie` qua rewrite ra ngoài (kiểm ở Task 9/13 bằng thử thật); Deployment Protection của Vercel không chặn địa chỉ production của app gia sư (nếu bị chặn: tắt cho Production).
