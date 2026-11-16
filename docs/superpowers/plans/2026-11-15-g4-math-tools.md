# G4 — Máy tính đại số, vòng công cụ, cổng "tự làm xong", bài anh em · Implementation Plan

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cô gọi được `math_check` (SymPy) trước khi nói đúng/sai. Bài chỉ thành `self_solved` khi có `math_check` đạt cho đáp số con nộp. Ở H4 cô giải **bài anh em** đã được máy kiểm đáp số và có số khác đề gốc.

**Architecture:**
- **`cas/`** (FastAPI + SymPy, đã có, 14 test) chạy **riêng tư** trong cùng project Vercel bằng **Vercel Services**:
  - `vercel.json` khai 2 service: `web` (Next.js) và `cas` (FastAPI).
  - Chỉ `web` có đường public. `web` gọi `cas` qua *binding*; URL được bơm vào biến `CAS_SERVICE_URL`.
  - `CAS_SECRET` vẫn bắt buộc (binding chỉ chặn đường, không xác thực).
- **Vòng công cụ** (`lib/tutor/toolLoop.ts`): model trả `tool_use` → máy chủ chạy `math_check` / `make_sibling` → gửi `tool_result` → gọi lại.
  - Tối đa **3 vòng công cụ** mỗi câu trả lời, nằm trong hạn 240 s của lượt.
  - Hết vòng hoặc hết giờ → vòng cuối `tool_choice: none` để buộc ra JSON.
- **Cổng tự làm xong** (`decideSolve`, đã có) nhận nhật ký `math_check` thật của lượt nộp bài.
  - Model đề nghị `self_solved` mà chưa có `math_check` đạt → máy chủ nhắc thêm 1 vòng "gọi math_check trước khi kết luận". Đây là DOMAIN §4.12 b. Sonnet/Opus 5.5 luôn suy nghĩ, nên **không ép** được `tool_choice` cụ thể; chỉ nhắc bằng lời.
- **Bài anh em** (`lib/tools/makeSibling.ts`): 1 lời gọi Sonnet (`purpose = sibling`) sinh đề, các bước giải, đáp số và **lệnh kiểm** dạng `math_check`.
  - Máy chủ chạy lệnh kiểm, rồi so tập số với đề gốc. Không đạt → thử lại 1 lần, vẫn không đạt → `verified: false`.
  - Bài anh em đã hiện cho con → lượt sau con vẫn sai bài gốc thì H4 → **H5** (DOMAIN §3.3).

**Tech Stack:** Next.js 16, `@anthropic-ai/sdk` (tools + structured output + adaptive thinking), FastAPI/SymPy, Vercel Services, Vitest, pytest, Playwright, GitHub Actions.

**Spec:**
- `docs/DOMAIN.md` §3.3 (H4/H5), §4.1 d, **§4.12**, §5 (C1 lỗi), D24
- `docs/DESIGN.md` §4 bước 7–10, §5 (công cụ)
- hub `SYSTEM_PROMPT_v0.3.md` mục "Công cụ" + guard 6–7
- BO_TEST 9.16, 9.21, 9.22, 9.23, 9.24, 9.25, 6.9
- Docs Vercel Services: `vercel.com/docs/services`, `vercel.com/kb/guide/full-stack-preview-deployments-on-vercel` (đọc 15/11/2026)

## Quyết định (phụ huynh chốt 15/11/2026: Q1–Q4 theo đề xuất ✅)

| # | Câu hỏi | Đề xuất | Lý do |
|---|---|---|---|
| Q1 | `cas` chạy ở đâu (D24) | ✅ **Vercel Services**, cùng project: phụ huynh đổi *Framework Preset* của project sang **Services** (1 lần, hướng dẫn trong PR A). Dự phòng nếu lỗi: project Vercel riêng cho `cas` + `CAS_URL` | Docs Vercel: service không có rewrite thì không có đường public; deploy chung nên `web` và `cas` luôn cùng phiên bản |
| Q2 | Luật DOMAIN §4.12 a–c (đang "Đề xuất") + checklist trước khi chốt | ✅ Chốt a–c. **Lớp 9:** phải có ≥ 1 mục checklist §4.10 đã hỏi trong bài mới được `self_solved`. **Lớp 6:** chưa bắt checklist (chờ G5 có checklist theo dạng bài) | Đúng ý "rút gọn đến tận cùng / kết luận từng ý" của cô. Lớp 6 chưa có barem |
| Q3 | Lời giải tham khảo sau `self_solved` | ✅ **Để sau (G7)**, chưa sinh ở G4 | Thêm 1 lời gọi model mỗi bài xong; báo cáo G7 mới cần |
| Q4 | Mở rộng `cas` | ✅ Thêm `solve_system`, `check_solution` (hệ 2–3 ẩn) và `gcd`/`lcm` trong biểu thức | Lớp 9 "giải bài toán bằng lập HPT" (ca 9.1, 9.23) và lớp 6 ƯCLN/BCNN (6.9) cần; bản hiện tại chỉ 1 ẩn |

## Global Constraints

- Repo **public**: không tên thật, không ảnh thật, không khóa thật. Bài trong test là đề bịa hoặc đề trong bộ test.
- Không log nội dung chữ/ảnh của con; log lỗi chỉ `e.message`.
- `CAS_SECRET`, `ANTHROPIC_API_KEY` chỉ ở máy chủ (không `NEXT_PUBLIC_`). Không tự đặt biến `CAS_SERVICE_URL` (binding tự bơm; biến tự đặt sẽ đè binding — docs Vercel).
- Máy chủ quyết `self_solved`. Model chỉ đề nghị (`ket_qua_bai`).
- `math_check` timeout phía Node **5 s** (cas tự dừng ở 4 s). Lỗi/hết giờ → tool_result `{ok:false, error}`; cô không khẳng định, cờ `tutor_unsure` (prompt luật 10).
- Mỗi câu trả lời: **≤ 3 vòng công cụ**. Cả lượt vẫn trong `TURN_BUDGET_MS = 240 s`.
- Không SQL mới: `tool_calls`, `model_calls.purpose = 'sibling'` đã có trong 0017.
- `npm run typecheck && npm run lint && npm test` + `cd cas && pytest` xanh; e2e xanh; đụng prompt → chạy G0 ca liên quan.

## File Structure

| File | Trách nhiệm |
|---|---|
| `vercel.json` | `services` web + cas, binding `CAS_SERVICE_URL`, rewrite catch-all → web, `regions` |
| `cas/app/main.py`, `cas/app/mathcheck.py`, `cas/tests/*` | Mode mới `solve_system`, `check_solution`; `gcd`/`lcm`; route `/health` cho service |
| `lib/env.ts` | `CAS_SERVICE_URL` (binding) — `casUrl()` = `CAS_URL ?? CAS_SERVICE_URL` |
| `app/api/admin/cas-health/route.ts` | Bố mẹ bấm thử: máy chủ gọi `cas /health` + 1 phép thử, trả ok/lỗi |
| `lib/tools/mathCheck.ts` | Định nghĩa tool cho model + đổi input model → args cas + gọi HTTP có timeout |
| `lib/tools/makeSibling.ts`, `prompts/sibling.md` | Sinh + kiểm bài anh em |
| `lib/tools/defs.ts` | Danh sách tool gửi model; `ToolRecord` |
| `lib/tutor/toolLoop.ts` | Vòng công cụ (thuần, client + runner tiêm vào) |
| `lib/tutor/turn.ts` | `ModelClient` nhận nội dung có `tool_use`/`thinking`; `runTutorTurn` nhận `tools`, `tool_choice` |
| `lib/rules/outcome.ts` | Nhận `checks` thật + `checklistRequired/Asked` |
| `lib/tutor/handlers.ts` | Thay `ask()` bằng vòng công cụ; afterSibling; cổng; ghi tool_calls |
| `lib/tutor/repo.ts` + 2 repo | `SaveReplyInput.tools`; `ProblemRow.siblingShown`, `checklistAsked` |
| `prompts/guard.md`, `lib/tutor/guard.ts` | Bỏ câu "app CHƯA có công cụ"; `toolsCalled` có kết quả rút gọn |
| `eval/*`, `.github/workflows/eval.yml`, `.github/workflows/ci.yml` | Ca công cụ; chạy `cas` cục bộ trong eval + e2e |

---

## PR A — `cas` lên Vercel Services (nhánh `feature/g4-cas-service`)

### Task 1: Cấu hình Services + đường kiểm cho bố mẹ

**Files:** Modify `vercel.json`, `lib/env.ts`, `tests/env.test.ts`, `.env.example`, `cas/app/main.py` (thêm `index.py`/entry nếu Vercel yêu cầu), `docs/PROGRESS.md`. Create `app/api/admin/cas-health/route.ts`, `lib/tools/casClient.ts`, `tests/casClient.test.ts`.

**Interfaces:**
- Produces:
```ts
// lib/env.ts
CAS_SERVICE_URL: z.string().url().optional()          // injected by the Vercel binding
export function casUrl(env: ServerEnv): string | null  // CAS_URL ?? CAS_SERVICE_URL ?? null
// lib/tools/casClient.ts
export type CasResult = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
export interface CasClient { check(mode: string, args: Record<string, unknown>): Promise<CasResult>; health(): Promise<boolean> }
export function httpCas(baseUrl: string, secret: string, timeoutMs?: number /* 5000 */, fetchImpl?: typeof fetch): CasClient;
```
- [ ] **Step 1: tests**
```ts
// tests/casClient.test.ts
import { describe, expect, it } from "vitest";
import { httpCas } from "@/lib/tools/casClient";
const fake = (status: number, body: unknown, delayMs = 0): typeof fetch => async (_u, init) => {
  await new Promise((r, j) => { const t = setTimeout(r, delayMs); init?.signal?.addEventListener("abort", () => { clearTimeout(t); j(new DOMException("aborted", "AbortError")); }); });
  return new Response(JSON.stringify(body), { status });
};
describe("httpCas", () => {
  it("sends the secret and returns the cas answer", async () => {
    let seen: Headers | null = null;
    const f: typeof fetch = async (_u, init) => { seen = new Headers(init?.headers); return new Response(JSON.stringify({ ok: true, result: { is_root: true } })); };
    const r = await httpCas("http://cas", "s3", 5000, f).check("check_root", { equation: "x-2=0", value: "2" });
    expect(r).toEqual({ ok: true, result: { is_root: true } });
    expect(seen!.get("x-cas-secret")).toBe("s3");
  });
  it("timeout, 5xx and 401 are errors, never throws", async () => {
    expect(await httpCas("http://cas", "s", 20, fake(200, {}, 200)).check("x", {})).toEqual({ ok: false, error: "timeout" });
    expect(await httpCas("http://cas", "s", 5000, fake(500, {})).check("x", {})).toEqual({ ok: false, error: "cas_http_500" });
    expect(await httpCas("http://cas", "s", 5000, fake(401, {})).check("x", {})).toEqual({ ok: false, error: "cas_http_401" });
  });
});
// tests/env.test.ts (thêm)
it("cas URL: CAS_URL wins, else the Vercel binding, else none", () => {
  expect(casUrl(parseServerEnv({ ...base, CAS_URL: "https://a.example", CAS_SERVICE_URL: "https://b.example" }))).toBe("https://a.example");
  const { CAS_URL: _d, ...noUrl } = base;
  expect(casUrl(parseServerEnv({ ...noUrl, CAS_SERVICE_URL: "https://b.example" }))).toBe("https://b.example");
  expect(casUrl(parseServerEnv(noUrl))).toBeNull();
});
```
- [ ] **Step 2:** FAIL. **Step 3: code.** `httpCas`:
  - `POST ${base}/check` với `{ mode, args }`, header `content-type: application/json` và `x-cas-secret`;
  - dùng `AbortController` (timeout) → `"timeout"`; `!res.ok` → `cas_http_<status>`; lỗi mạng → `cas_unreachable`;
  - `health()` = `GET /health`, timeout 3 s.

  `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
  "services": {
    "web": {
      "root": "./",
      "framework": "nextjs",
      "bindings": [{ "type": "service", "service": "cas", "format": "url", "env": "CAS_SERVICE_URL" }]
    },
    "cas": { "root": "cas/", "framework": "fastapi", "entrypoint": "app.main:app" }
  },
  "rewrites": [{ "source": "/(.*)", "destination": { "service": "web" } }]
}
```
  `cas` **không** có rewrite → không có đường public.

  Đọc lại `vercel.com/docs/services` khi làm: kiểm vị trí `regions`/`functions` (khi có `services`, các khóa top-level chia 2 nhóm) và việc `web` root `./` có chứa thư mục `cas/` không. Docs đổi thì sửa theo docs và ghi vào PR.

  `app/api/admin/cas-health/route.ts`: chỉ **parent** (`getActor()`), gọi `health()` + `check("check_root", { equation: "x - 2 = 0", value: "2" })` → `{ health, sample }`. Không phải parent → 401.
- [ ] **Step 4:** PASS; build; `cd cas && pytest`.
- [ ] **Step 5:** commit `feat(deploy): cas as a private Vercel service, parent health check`. PR A gồm hướng dẫn cho phụ huynh, **làm trước khi merge**:
  1. Vercel → project `gia-su-ai-math` → **Settings → Build and Deployment → Framework Preset = Services** → Save.
  2. Environment Variables: thêm `CAS_SECRET` (chuỗi ngẫu nhiên dài; tôi đưa lệnh tạo), cho cả Production và Preview. **Không** thêm `CAS_SERVICE_URL`.
  3. Redeploy preview của PR A → mở `<preview>/gia-su` (vẫn chạy) và `<preview>/gia-su/api/admin/cas-health` (đăng nhập bố mẹ) → thấy `{"health":true,"sample":{"ok":true,...}}`.
  4. Kiểm cas không public: mở `<preview>/check` hoặc `<preview>/health` → **không** ra kết quả của cas.
  5. Đạt → merge. Lỗi → báo tôi, chuyển phương án dự phòng (project riêng cho cas + `CAS_URL`).

---

## PR B — Vòng công cụ (nhánh `feature/g4-tools`, sau khi PR A chạy được trên production)

### Task 2: `cas` — hệ phương trình, gcd/lcm

**Files:** Modify `cas/app/mathcheck.py`, `cas/tests/test_mathcheck.py`.

**Interfaces:**
- Produces (mode mới trong `MODES`):
  - `solve_system(equations: list[str], variables: list[str]) -> {"solutions": [ {var: str} ], "no_solution": bool}` (2–3 ẩn, phương trình bậc ≤ 2);
  - `check_solution(equations: list[str], values: dict[str, str]) -> {"satisfies": bool, "failed": [int]}`;
  - `_ALLOWED` thêm `gcd`, `lcm`. `evaluate("lcm(10, 12, 15)")` → `{"exact": "60"}`.
- [ ] **Step 1: tests (pytest)**
```python
def test_solve_system_two_workers():  # BO_TEST 9.1: 1/x + 1/y = 1/16 ; 3/x + 6/y = 1/4
    r = mathcheck.solve_system(["1/x + 1/y = 1/16", "3/x + 6/y = 1/4"], ["x", "y"])
    assert r == {"solutions": [{"x": "24", "y": "48"}], "no_solution": False}

def test_check_solution():
    eqs = ["x + y = 5", "x - y = 1"]
    assert mathcheck.check_solution(eqs, {"x": "3", "y": "2"}) == {"satisfies": True, "failed": []}
    assert mathcheck.check_solution(eqs, {"x": "4", "y": "1"}) == {"satisfies": False, "failed": [1]}

def test_lcm_gcd_grade6():  # BO_TEST 6.9
    assert mathcheck.evaluate("lcm(10, 12, 15)")["exact"] == "60"
    assert mathcheck.evaluate("gcd(24, 36)")["exact"] == "12"

def test_system_rejects_bad_variables():
    with pytest.raises(mathcheck.MathInputError):
        mathcheck.solve_system(["x = 1"], ["__x"])
```
- [ ] **Step 2:** FAIL. **Step 3: code**
  - `_symbols_many(names)`: mỗi tên qua `_symbols`, tối đa 3 tên.
  - `solve_system`: `sp.solve([Eq(...)], syms, dict=True)`. Chỉ giữ nghiệm thực, không làm mẫu = 0. Số → `str(sp.nsimplify(v))`.
  - `check_solution`: thay giá trị vào từng phương trình, `simplify(lhs - rhs) == 0`. `failed` = chỉ số phương trình sai.
  - Giới hạn chung `MAX_LEN`; tối đa 3 phương trình.
- [ ] **Step 4:** `cd cas && pytest` PASS. **Step 5:** commit `feat(cas): systems of equations, gcd/lcm`.

### Task 3: Công cụ `math_check` cho model

**Files:** Create `lib/tools/mathCheck.ts`, `lib/tools/defs.ts`, `tests/mathCheck.test.ts`.

**Interfaces:**
- Consumes: `CasClient` (Task 1).
- Produces:
```ts
// lib/tools/defs.ts
export type ToolName = "math_check" | "make_sibling";
export interface ToolRecord { tool: ToolName; input: unknown; output: unknown; ok: boolean; ms: number; round: number }
export const TOOL_DEFS: { name: ToolName; description: string; input_schema: object }[]; // sent to the model
// lib/tools/mathCheck.ts
export const MATH_MODES = ["equivalent","simplify_check","solve","check_root","evaluate","inequality","domain","solve_system","check_solution"] as const;
export interface MathCheckInput { mode: (typeof MATH_MODES)[number]; expr_a?: string; expr_b?: string; equation?: string; equations?: string[];
  value?: string; values?: Record<string, string>; inequality?: string; variable?: string; variables?: string[]; assumptions?: string[]; round_to?: number }
/** Maps the model's input to the cas arguments of each mode; null when a needed field is missing. */
export function toCasArgs(i: MathCheckInput): Record<string, unknown> | null;
export async function runMathCheck(cas: CasClient | null, input: unknown): Promise<{ ok: boolean; output: CasResult }>;
```
  Bảng ánh xạ:

  | mode | trường của model → tham số cas |
  |---|---|
  | `equivalent` | `expr_a`, `expr_b`, `variable`, `assumptions` |
  | `simplify_check` | `expr_a` → `expr_child`, `expr_b` → `expr_original`, `variable`, `assumptions` |
  | `solve` | `equation`, `variable`, `assumptions` |
  | `check_root` | `equation`, `value`, `variable` |
  | `evaluate` | `expr_a` → `expr`, `variable`, `value`, `round_to` |
  | `inequality` | `inequality` → `inequality_text`, `variable` |
  | `domain` | `expr_a` → `expr`, `variable` |
  | `solve_system` | `equations`, `variables` |
  | `check_solution` | `equations`, `values` |

  `cas === null` (chưa cấu hình) → `{ ok: false, output: { ok: false, error: "cas_not_configured" } }`.
- [ ] **Step 1: tests**
```ts
import { describe, expect, it } from "vitest";
import { runMathCheck, toCasArgs } from "@/lib/tools/mathCheck";
describe("math_check tool", () => {
  it("maps simplify_check (9.16) and check_solution (9.1)", () => {
    expect(toCasArgs({ mode: "simplify_check", expr_a: "(-3*sqrt(x)-9)/(x-9)", expr_b: "3/(3-sqrt(x))", assumptions: ["x >= 0", "x != 9"] }))
      .toEqual({ expr_child: "(-3*sqrt(x)-9)/(x-9)", expr_original: "3/(3-sqrt(x))", variable: "x", assumptions: ["x >= 0", "x != 9"] });
    expect(toCasArgs({ mode: "check_solution", equations: ["1/x+1/y=1/16"], values: { x: "24", y: "48" } }))
      .toEqual({ equations: ["1/x+1/y=1/16"], values: { x: "24", y: "48" } });
  });
  it("a missing field is an error result, cas is not called", async () => {
    let called = false;
    const cas = { check: async () => { called = true; return { ok: true as const, result: {} }; }, health: async () => true };
    expect(await runMathCheck(cas, { mode: "check_root", equation: "x=2" })).toEqual({ ok: false, output: { ok: false, error: "missing_field" } });
    expect(called).toBe(false);
  });
  it("cas not configured → error result (the tutor must not claim right/wrong)", async () => {
    expect((await runMathCheck(null, { mode: "evaluate", expr_a: "1+1" })).output).toEqual({ ok: false, error: "cas_not_configured" });
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** code + `TOOL_DEFS`.
  - `math_check.input_schema`: `mode` enum, các trường trên đều tùy chọn; không dùng `minimum`/`maxLength` (API không nhận, xem `apiSafeSchema`).
  - `description`: "Dùng trước khi nói một phép tính/đáp số/bước biến đổi là đúng hay sai. Cú pháp SymPy: sqrt(x), x**2, phân số a/b. Kết quả không chép vào message khi em chưa nộp."
  - `make_sibling` schema: `original_statement`, `ku_code` (nullable), `difficulty` ∈ {`same`, `easier`}.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(tools): math_check tool for the tutor`.

### Task 4: Vòng công cụ

**Files:** Modify `lib/tutor/turn.ts`. Create `lib/tutor/toolLoop.ts`, `tests/toolLoop.test.ts`.

**Interfaces:**
- Consumes: `TOOL_DEFS`, `ToolRecord` (Task 3).
- Produces:
```ts
// lib/tutor/turn.ts — ModelClient content widened:
export type ContentPart = { type: string; text?: string; id?: string; name?: string; input?: unknown; [k: string]: unknown };
// runTutorTurn(client, { model, system, messages, effort?, tools?, toolChoice? }) → { output, raw, content: ContentPart[], stopReason, costUsd, tokens }
// lib/tutor/toolLoop.ts
export const MAX_TOOL_ROUNDS = 3;
export type ToolRunner = (name: string, input: unknown) => Promise<{ ok: boolean; output: unknown }>;
export interface LoopResult {
  final: Answer;                 // the call whose JSON is the answer (output may be null)
  calls: Answer[];               // every model call of the loop, in order (cost)
  tools: ToolRecord[];           // round = index into calls of the call that asked
}
export async function runToolLoop(client: ModelClient, req: {
  model: string; system: SystemBlock[]; messages: Msg[]; run: ToolRunner;
  timeLeft: () => number;        // ms
  /** after a final answer: text to send back for one more round (e.g. "gọi math_check trước khi kết luận"), or null */
  review?: (output: TutorOutput | null, tools: ToolRecord[]) => string | null;
}): Promise<LoopResult>;
```
  Thuật toán:
  1. Gọi model với `tools: TOOL_DEFS`, `tool_choice: auto`.
  2. `stop_reason === "tool_use"` và còn vòng và `timeLeft() ≥ 70 s`:
     - nối `{ role: "assistant", content: res.content }` (giữ nguyên khối `thinking` + chữ ký, API bắt buộc);
     - chạy mọi `tool_use` trong content **tuần tự**;
     - nối `{ role: "user", content: [{ type: "tool_result", tool_use_id, content: JSON.stringify(output), is_error: !ok }] }`;
     - lặp lại bước 1.
  3. Hết vòng hoặc hết giờ mà model vẫn muốn công cụ: gọi lại với `tool_choice: { type: "none" }`.
  4. Có JSON: nếu `review(output, tools)` trả chữ và còn vòng/giờ → nối assistant + user `[APP] <chữ>` → lặp lại bước 1 (tối đa 1 lần nhắc).

  `Msg.content` thêm được các khối `tool_use`/`tool_result`/`thinking`: mở rộng `ContentBlock` trong `assemble.ts` bằng `{ type: string; [k: string]: unknown }`.
- [ ] **Step 1: tests** (client giả theo kịch bản):
```ts
import { describe, expect, it } from "vitest";
import { runToolLoop } from "@/lib/tutor/toolLoop";
import fewshot from "./fixtures/fewshot.json";
const final = JSON.stringify((fewshot as object[])[1]);
const toolUse = (id: string, input: object) => ({ content: [{ type: "thinking", thinking: "…", signature: "sig" },
  { type: "tool_use", id, name: "math_check", input }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } });
const text = (t: string) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } });
function scripted(steps: object[]) {
  const reqs: Record<string, unknown>[] = []; let i = 0;
  return { reqs, create: async (r: object) => { reqs.push(r as never); return steps[Math.min(i++, steps.length - 1)] as never; } };
}
const base = { model: "claude-sonnet-5-5", system: [], messages: [{ role: "user" as const, content: "x" }], timeLeft: () => 200_000 };

describe("runToolLoop", () => {
  it("runs the tool, sends tool_result (thinking kept), then returns the JSON answer", async () => {
    const c = scripted([toolUse("t1", { mode: "check_root", equation: "x-2=0", value: "2" }), text(final)]);
    const r = await runToolLoop(c, { ...base, run: async () => ({ ok: true, output: { ok: true, result: { is_root: true } } }) });
    expect(r.final.output).not.toBeNull();
    expect(r.tools).toEqual([expect.objectContaining({ tool: "math_check", ok: true, round: 0 })]);
    const second = c.reqs[1]!.messages as { role: string; content: { type: string; is_error?: boolean }[] }[];
    expect(second.at(-2)!.content.map((b) => b.type)).toEqual(["thinking", "tool_use"]);
    expect(second.at(-1)!.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1", is_error: false });
  });
  it("at most 3 tool rounds, then tool_choice none forces the answer", async () => {
    const c = scripted([toolUse("a", {}), toolUse("b", {}), toolUse("c", {}), text(final)]);
    const r = await runToolLoop(c, { ...base, run: async () => ({ ok: true, output: {} }) });
    expect(r.tools).toHaveLength(3);
    expect(c.reqs.at(-1)!.tool_choice).toEqual({ type: "none" });
    expect(r.calls).toHaveLength(4); // 3 calls that asked for tools + 1 forced final
  });
  it("no time left → no tool round", async () => {
    const c = scripted([toolUse("a", {}), text(final)]);
    const r = await runToolLoop(c, { ...base, timeLeft: () => 30_000, run: async () => ({ ok: true, output: {} }) });
    expect(r.tools).toHaveLength(0);
    expect(c.reqs.at(-1)!.tool_choice).toEqual({ type: "none" });
  });
  it("review can ask once more (DOMAIN §4.12 b)", async () => {
    const c = scripted([text(final), toolUse("m", { mode: "equivalent" }), text(final)]);
    let asked = 0;
    const r = await runToolLoop(c, { ...base, run: async () => ({ ok: true, output: { ok: true, result: { equivalent: true } } }),
      review: (_o, tools) => (tools.length === 0 && asked++ === 0 ? "Gọi math_check cho đáp số cuối trước khi kết luận." : null) });
    expect(r.tools).toHaveLength(1);
    expect(JSON.stringify(c.reqs[1]!.messages)).toContain("[APP] Gọi math_check");
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** code theo thuật toán. `runTutorTurn` chỉ thêm `tools`/`tool_choice` vào request khi có, và trả `content`.
- [ ] **Step 4:** PASS (cả test cũ). **Step 5:** commit `feat(tutor): tool loop (≤ 3 rounds, thinking kept, forced final)`.

### Task 5: `make_sibling`

**Files:** Create `prompts/sibling.md`, `lib/tools/makeSibling.ts`, `tests/makeSibling.test.ts`. Modify `lib/tutor/layers.ts` (+ `sibling`), `next.config.ts` (`outputFileTracingIncludes` đã gồm `prompts/**`; kiểm).

**Interfaces:**
- Consumes: `CasClient`, `runMathCheck`, `toCasArgs` (Task 3), `ModelClient`.
- Produces:
```ts
export interface SiblingInput { original_statement: string; ku_code: string | null; difficulty: "same" | "easier" }
export interface SiblingOutput { statement: string; solution_steps: string[]; final_answer: string; verified: boolean; numbers_differ: boolean }
/** Numbers written in a statement (12, 1,25, 3/4, 25%) as normalized strings. */
export function numbersIn(text: string): string[];
/** "Different" = the sibling does not reuse the original's numbers: at most 1 shared, and never all of them. */
export function numbersDiffer(original: string, sibling: string): boolean;
export async function makeSibling(d: { client: ModelClient; model: string; prompt: string; cas: CasClient | null },
  input: SiblingInput): Promise<{ output: SiblingOutput; calls: Answer[] }>; // calls = model calls (purpose sibling)
```
  `prompts/sibling.md` yêu cầu model trả JSON đúng schema:
  `{ statement, solution_steps: string[] (≤ 8), final_answer, check: { mode, …trường như math_check… } }`.
  - `check` là lệnh để máy kiểm đáp số, vd `check_solution` với hệ PT của bài anh em, `check_root`, hoặc `evaluate` + so với `final_answer`.
  - Cùng dạng, cùng KU, **số khác hẳn**, đáp số đẹp, lớp 6/9 KNTT, tiếng Việt.

  `makeSibling`:
  1. Gọi model (`thinking: disabled` không dùng được với Sonnet → `effort: "low"`, `max_tokens` 4000, structured output).
  2. Chạy `check`:
     - `evaluate` thì so `exact` với `final_answer` qua `equivalent`;
     - `check_root` / `check_solution` / `equivalent` thì dùng kết quả `is_root` / `satisfies` / `equivalent`.
  3. `verified = ok && đúng`; `numbers_differ = numbersDiffer(...)`.
  4. Một trong hai sai → thử lại 1 lần với câu nhắc lý do. Vẫn sai → trả `verified: false` (cô không dùng; cờ `tutor_unsure`, prompt luật 11).
- [ ] **Step 1: tests**
```ts
describe("make_sibling", () => {
  it("numbers: 16, 3, 6, 25% vs 12, 2, 4, 50% differ; reusing them does not", () => {
    const THO = "Hai người cùng làm 16 giờ xong; người I làm 3 giờ, người II làm 6 giờ được 25% công việc.";
    expect(numbersIn(THO)).toEqual(["16", "3", "6", "25%"]);
    expect(numbersDiffer(THO, "Hai vòi cùng chảy 12 giờ đầy bể; vòi I chảy 2 giờ, vòi II chảy 4 giờ được 25% bể.")).toBe(true);
    expect(numbersDiffer(THO, "Hai người cùng làm 16 giờ xong; người I làm 3 giờ, người II làm 6 giờ được 50% công việc.")).toBe(false);
  });
  it("verified when cas confirms the sibling's answer; retries once otherwise", async () => {
    const good = { statement: "Hai vòi cùng chảy 12 giờ đầy bể…", solution_steps: ["…"], final_answer: "x = 20, y = 30",
      check: { mode: "check_solution", equations: ["1/x+1/y=1/12"], values: { x: "20", y: "30" } } };
    const client = scriptedJson([{ ...good, check: { ...good.check, values: { x: "21", y: "30" } } }, good]); // 1st wrong, 2nd right
    const cas = casFrom({ check_solution: (a) => ({ satisfies: (a.values as Record<string, string>).x === "20", failed: [] }) });
    const r = await makeSibling({ client, model: "claude-sonnet-5-5", prompt: "P", cas }, { original_statement: THO, ku_code: "T9.3", difficulty: "same" });
    expect([r.output.verified, r.output.numbers_differ, r.calls.length]).toEqual([true, true, 2]);
  });
  it("cas down → verified false (never shown as a checked sibling)", async () => { /* cas returns {ok:false,error:"timeout"} twice → verified false, calls 2 */ });
});
```
  Hai helper ở đầu file test (không để trống):
  - `scriptedJson(list)`: trả lần lượt `{ content: [{ type: "text", text: JSON.stringify(x) }], usage: { input_tokens: 10, output_tokens: 5 } }`.
  - `casFrom(modes)`: `{ check: async (m, a) => ({ ok: true, result: modes[m]!(a) }), health: async () => true }`.

  Test thứ 3 viết đủ: `casFrom` trả `{ ok: false, error: "timeout" }` cho mọi mode.
- [ ] **Step 2:** FAIL. **Step 3:** code. **Step 4:** PASS. **Step 5:** commit `feat(tools): make_sibling with a checked answer and different numbers`.

### Task 6: Cổng "tự làm xong" dùng nhật ký thật + H5 sau bài anh em

**Files:** Modify `lib/rules/outcome.ts`, `tests/outcome.test.ts`, `lib/tutor/repo.ts`, `tests/helpers/memoryRepo.ts`, `lib/db/supabaseRepo.ts`.

**Interfaces:**
- Consumes: `decideSolve`, `MathCheckRecord` (`lib/rules/solveGate.ts`), `ToolRecord`.
- Produces:
```ts
// lib/rules/outcome.ts
export interface OutcomeInput { turn: number; output: TutorOutput | null; submitted: boolean; offtopicCount: number;
  checks: MathCheckRecord[];            // math_check of THIS turn (the submitted answer)
  checklistRequired: boolean;           // Q2: grade 9
  checklistAsked: number[];             // union over the problem, this answer included
}
export const checksFrom = (tools: readonly ToolRecord[]): MathCheckRecord[]; // math_check records → {ok, mode, result}
// ProblemRow gains:
siblingShown: boolean;      // a verified make_sibling was part of an answer the child saw (earlier turn)
checklistAsked: number[];   // union of checklist_da_hoi of the answers the child saw
// SaveReplyInput gains:
tools: (ToolRecord & { callIndex: number })[];   // callIndex = index in `calls` of the model call that asked
```
  `checklistOpen = checklistRequired && checklistAsked.length === 0`. TODO(rule-unconfirmed) cho tới khi phụ huynh chốt Q2.
- [ ] **Step 1: tests (DOMAIN §4.12 a–c, giữ các test G2 đang có)**
```ts
const ok = (mode: string, result: object) => ({ ok: true, mode, result });
const solved = { ...out, ket_qua_bai: "self_solved" as const };
it("4.12 a: submitted, cas confirms, checklist asked → self_solved", () => {
  expect(decideOutcome({ turn: 6, output: solved, submitted: true, offtopicCount: 0, checks: [ok("simplify_check", { equivalent: true, fully_simplified: true })],
    checklistRequired: true, checklistAsked: [7] }).status).toBe("self_solved");
});
it("4.12 b: no math_check this turn → stays open (no_passing_math_check)", () => {
  expect(decideOutcome({ turn: 6, output: solved, submitted: true, offtopicCount: 0, checks: [], checklistRequired: true, checklistAsked: [7] }))
    .toMatchObject({ status: "in_progress", solveBlocked: "no_passing_math_check" });
});
it("4.12 c: equivalent but a common factor left → not_fully_simplified", () => {
  expect(decideOutcome({ turn: 6, output: solved, submitted: true, offtopicCount: 0,
    checks: [ok("simplify_check", { equivalent: true, fully_simplified: false, common_factor: "sqrt(x)+3" })], checklistRequired: true, checklistAsked: [7] }))
    .toMatchObject({ status: "in_progress", solveBlocked: "not_fully_simplified" });
});
it("Q2: grade 9 with no checklist item asked yet → checklist_open; grade 6 → self_solved", () => {
  const i = { turn: 6, output: solved, submitted: true, offtopicCount: 0, checks: [ok("check_root", { is_root: true })], checklistAsked: [] };
  expect(decideOutcome({ ...i, checklistRequired: true }).solveBlocked).toBe("checklist_open");
  expect(decideOutcome({ ...i, checklistRequired: false }).status).toBe("self_solved");
});
it("not submitted → never self_solved, even with a passing check", () => {
  expect(decideOutcome({ turn: 6, output: solved, submitted: false, offtopicCount: 0, checks: [ok("check_root", { is_root: true })],
    checklistRequired: false, checklistAsked: [] }).status).toBe("in_progress");
});
```
  (`out` = few-shot 2 như test hiện có.)
- [ ] **Step 2:** FAIL. **Step 3:** code.
  - `memoryRepo` lưu `tools` (`toolCalls[]`), tính `siblingShown` (có `make_sibling` `ok` + `output.verified === true` và call của nó `shown`), `checklistAsked` (hợp `checklist_da_hoi` của các call `shown`).
  - `supabaseRepo.saveReply`:
    - insert `model_calls` theo thứ tự, `.select("id")` để lấy id;
    - insert `tool_calls` (`model_call_id = ids[callIndex]`, `tool`, `input`, `output`, `ok`, `ms`);
    - `getProblemForChild` đọc `tool_calls` của bài kèm `model_calls(message_id)` để tính 2 trường mới; `checklistAsked` từ `raw_output` các call có `message_id`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(rules): solve gate on real math_check log; sibling and checklist state`.

### Task 7: Nối vào lượt + bộ kiểm tra biết công cụ

**Files:** Modify `lib/tutor/handlers.ts`, `lib/tutor/deps.ts`, `lib/tutor/guard.ts`, `prompts/guard.md`, `PROMPT_VERSION` (→ `v0.4`), `tests/handlers.test.ts`, `tests/guard.test.ts`.

**Interfaces:**
- Consumes: Task 3–6.
- Produces: `Deps` thêm `cas: CasClient | null`. `GuardInput.toolsCalled: string[]` dạng `math_check(simplify_check → equivalent=true, fully_simplified=false)`, `make_sibling(verified=true, numbers_differ=true)`, lỗi → `math_check(error: timeout)`.

  Trong `runClaimed`:
  1. `ask()` đổi thành `runToolLoop(...)`, với `run` là:
     - `math_check` → `runMathCheck(d.cas, input)`;
     - `make_sibling` → `makeSibling(...)`, các call sibling ghi `purpose: "sibling"`;
     - tên khác → `{ ok: false, output: { error: "unknown_tool" } }`.
  2. `review(output, tools)`: `submitted && output?.ket_qua_bai === "self_solved" && !checksFrom(tools).some(passing)` → `"Em đã nộp bài. Gọi math_check cho đáp số cuối của em trước khi kết luận (không nói đáp số)."`.
  3. Rewrite (guard chặn) cũng chạy qua `runToolLoop`, với `timeLeft` còn lại.
  4. `calls`:
     - mỗi call của vòng là 1 `ModelCallRecord` (`purpose tutor`, chỉ call cuối có thể `shown`);
     - các call sibling là `purpose sibling`;
     - `tools` có `callIndex` trỏ đúng call.
  5. Guard nhận `toolsCalled` của câu trả lời đó (vòng đầu hoặc vòng viết lại).
  6. `afterSibling: problem.siblingShown`; checklist dùng `checklistRequired: actor.grade === 9`.
  7. `decideOutcome({ …, checks: checksFrom(tools của câu được hiện), checklistAsked: union(problem.checklistAsked, shown.checklist_da_hoi) })`.

  `prompts/guard.md`: bỏ đoạn "Ở bản này app CHƯA có công cụ…". Mục 6 thêm: "math_check có `error` thì cũng không được khẳng định".
- [ ] **Step 1: tests** (client giả phân biệt tutor/guard/sibling bằng `system`; cas giả):
```ts
it("4.12 a end to end: child submits, tutor calls math_check, cas confirms, checklist asked → self_solved", async () => { /* scripted: tool_use(simplify_check) → JSON self_solved with checklist_da_hoi [7]; guard pass; cas equivalent+fully_simplified → status self_solved; repo.toolCalls has 1 math_check with callIndex 0 */ });
it("4.12 b: tutor says self_solved without a check → the app asks for math_check once; cas confirms → self_solved", async () => { /* scripted: JSON self_solved → tool_use(check_root) → JSON self_solved; expect 3 tutor calls, one tool call, review text in request 2 */ });
it("4.12 c: cas says a common factor is left → stays in_progress", async () => { /* … */ });
it("§4.12 cas down: tool result is an error, nothing is claimed; tutor_unsure next turn → Opus", async () => { /* cas returns timeout; tutor JSON flags ['tutor_unsure']; next turn routeReason tutor_unsure */ });
it("H4 nản: make_sibling verified → shown; next turn the child is wrong on the original → H5", async () => { /* nanSeed; tool_use(make_sibling) → sibling client JSON + cas satisfies → tutor JSON; then turn 2 with danh_gia 'sai' → hintLevel 5 */ });
it("guard sees the tools with results", async () => { /* guard request text contains 'math_check(simplify_check → equivalent=true' */ });
it("the rewrite after a block may call tools too", async () => { /* guard false then tool_use on the strong model then pass */ });
```
  Mỗi `/* … */` được viết đủ: dựng client kịch bản như helper `scripted` (Task 4) + client guard trả `PASS`, gọi `handleTurn` với `kind: "submit"` khi cần, `expect` trên `repo.problems[0].status`, `repo.toolCalls`, `c.models`. Không để test rỗng.
- [ ] **Step 2:** FAIL. **Step 3:** code. `deps.ts`:
```ts
const url = casUrl(env);
cas: url && env.CAS_SECRET ? httpCas(url, env.CAS_SECRET) : null,
```
- [ ] **Step 4:** PASS toàn bộ; typecheck; lint. **Step 5:** commit `feat(tutor): tools in every turn, solve gate, sibling → H5, guard sees tool results`.

### Task 8: Bộ test sư phạm có công cụ + e2e + CI + tài liệu, PR B

**Files:** Modify `eval/cases.ts`, `eval/run.ts`, `.github/workflows/eval.yml`, `.github/workflows/ci.yml` (job e2e), `e2e/tutor.spec.ts`, `docs/PROGRESS.md`, `docs/DESIGN.md` §5, `docs/DOMAIN.md` §4.12 (ghi chốt Q2 sau khi phụ huynh trả lời).

- [ ] **Step 1: eval**
  - `run.ts` dùng `runToolLoop` với `run` thật: `httpCas(process.env.CAS_URL, process.env.CAS_SECRET)` và `makeSibling`.
  - Ghi `tools` vào kết quả; `CheckSpec.expect` thêm `toolsInclude?: string[]`. Ví dụ `["math_check:simplify_check"]`, `["make_sibling:verified"]`.
  - Ca **9.16, 9.21, 9.22** (`math_check`, không lộ đáp số, chưa `self_solved`).
  - Ca **9.23** (nản H4 → `make_sibling` verified, `numbers_differ`; `forbid` 24, 48).
  - Ca **6.9** (`math_check`, không nói 60).
  - Ca guard **9.24, 9.25**: chạy thẳng `runGuard` với câu trả lời giả, `toolsCalled: []` → kỳ vọng `pass: false` với lý do 6 / 7.
  - Bỏ các `TODO(G4)` ở 9.3/6.3/9.6: đặt lại kỳ vọng có `math_check`.
- [ ] **Step 2: workflows**
  - `eval.yml` và job `e2e` của `ci.yml` thêm bước:
```yaml
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - name: Start cas (local, private)
        run: |
          pip install -r cas/requirements.txt uvicorn
          export CAS_SECRET=ci-$(openssl rand -hex 16)
          echo "CAS_SECRET=$CAS_SECRET" >> "$GITHUB_ENV"
          echo "CAS_URL=http://127.0.0.1:8100" >> "$GITHUB_ENV"
          (cd cas && nohup uvicorn app.main:app --port 8100 > "$RUNNER_TEMP/cas.log" 2>&1 &)
          for i in $(seq 1 30); do curl -fs http://127.0.0.1:8100/health && break; sleep 1; done
```
  - e2e thêm test: bố mẹ mở `/gia-su/api/admin/cas-health` → `{"health":true,"sample":{"ok":true,…}}`.
- [ ] **Step 3:** docs:
  - PROGRESS: G4 mở; còn lại: báo bố mẹ khi C1 lỗi ≥ 2 lần/ngày → G7; lời giải tham khảo → G7; `lookup` → G5.
  - DESIGN §5: các mode mới, vòng ≤ 3, Services.
  - DOMAIN §4.12: trạng thái chốt.
- [ ] **Step 4:** push, PR B (tiếng Việt):
  - làm gì;
  - **không SQL**;
  - cần PR A đã chạy trên production;
  - cách thử trên link chính thức:
    - lớp 9: gõ bài rút gọn 9.16, nộp `(-3√x-9)/(x-9)` → cô hỏi "còn rút gọn tiếp được không?", bài chưa xong;
    - nộp `3/(3-√x)` → cô hỏi 1 mục checklist → trả lời → bài **xong**;
    - Supabase: `tool_calls` có `math_check`;
    - gõ "k", "ko biết" → cô giải **bài anh em** có số khác;
  - chạy G0 với `cases = 9.16,9.21,9.22,9.23,9.24,9.25,6.9`.

---

## Tự soát

**Phủ spec:**

| Yêu cầu | Task |
|---|---|
| D24 cas riêng tư cùng project | 1 |
| §4.12 a (C1 xác nhận → self_solved sau checklist) | 6, 7 |
| §4.12 b (không gọi C1 → máy chủ buộc gọi rồi mới quyết) | 4 (`review`), 7 |
| §4.12 c (còn nhân tử chung → không xong, hỏi mục 7) | 6 (gate) + prompt mẫu 4 có sẵn |
| §4.12 bài anh em verified + số khác | 5, 7 |
| §4.12 C1 lỗi → không khẳng định, `tutor_unsure` | 3 (`cas_not_configured`/timeout), prompt luật 10, 7 |
| §3.3 / §4.1 d H4 → H5 sau bài anh em | 6 (`siblingShown`), 7 |
| Guard mục 6–7 có dữ liệu thật | 7 |
| BO_TEST 9.16, 9.21–9.25, 6.9 | 8 |
| §4.14 `tutor_unsure` → Opus (đã có G2) | 7 test |

**Ngoài lát (ghi PROGRESS):** `lookup` (G5, cần kho kiến thức); lời giải tham khảo (Q3 → G7); báo bố mẹ khi C1 lỗi ≥ 2 lần/ngày (G7); `draw_figure` (v1.1).

**Placeholder:** test có `/* … */` ở Task 5 và 7 đã ghi rõ phải viết đủ, kèm kịch bản dữ liệu và điều cần `expect`.

**Kiểu:** `CasClient`, `CasResult`, `httpCas`, `casUrl`, `ToolRecord`, `TOOL_DEFS`, `runMathCheck`, `toCasArgs`, `runToolLoop`, `LoopResult`, `MAX_TOOL_ROUNDS`, `makeSibling`, `numbersDiffer`, `checksFrom`, `siblingShown`, `checklistAsked` dùng thống nhất ở Task 1–8.

**Rủi ro cần kiểm khi làm:**
1. **Structured output + tools + adaptive thinking trong cùng request.** Thử bằng G0 ca 9.16 ngay sau Task 4 (1 ca, < 0,05 USD) trước khi làm tiếp. Không được → vòng công cụ không dùng `output_config.format` ở các vòng có công cụ, chỉ vòng cuối (`tool_choice: none`) mới dùng.
2. **`tool_choice: none` khi lịch sử có `tool_use`.** Kiểm ở cùng lần thử trên.
3. **Vercel Services là beta.** PR A tách riêng; có phương án dự phòng (project riêng + `CAS_URL`).
4. **Thời gian:** 3 vòng công cụ + bài anh em + guard + viết lại có thể chạm 240 s. Vòng chỉ chạy khi còn ≥ 70 s; bài anh em chỉ khi còn ≥ 90 s.
