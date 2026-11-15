# G2 Luật máy chủ, bộ kiểm tra, chọn model — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi lượt hỏi cô đi qua máy chủ đầy đủ: máy chủ tự tính mức gợi ý H0–H5 và nản, chọn Sonnet/Opus theo dấu hiệu, cho bộ kiểm tra Haiku chấm câu trả lời trước khi con thấy (bị chặn thì Opus viết lại, chặn lần 2 thì câu an toàn), quyết kết cục bài; con có nút "Chưa hiểu", "Để dành hỏi thầy" và ô "nộp bài"; có e2e luồng chính.

**Architecture:** Ba PR. **PR A** (repo `study-launcher`): migration `0018_tutor_g2.sql`, chỉ thêm 3 cột. **PR B** (repo `gia-su-ai-math`, nhánh `feature/g2-server-rules`): luật thuần (`lib/rules/events.ts`, `model.ts`, `outcome.ts`), bộ kiểm tra (`lib/tutor/guard.ts`), đường một lượt mới trong `lib/tutor/handlers.ts`, kho mở rộng, route "để dành", giao diện, sửa bộ chấm phụ G0. **PR C** (`feature/g2-e2e`): Playwright chạy trên Supabase local dựng từ migration của Launcher, model giả.

**Tech Stack:** như G1 (Next 16.4, TS strict, zod 4, `@anthropic-ai/sdk`, Vitest 5) + `@playwright/test` (PR C), Supabase CLI 2.120.0 (CI).

**Spec:**
- `docs/DOMAIN.md` v0.5: §3.2–3.3, §4.1–4.4, §4.12, §4.14, §5
- `docs/DESIGN.md` §4 (luồng một lượt), §9 G2
- `prompts/rules.md` (luật 1, 10, 11, 12)
- hub `SYSTEM_PROMPT_v0.3.md` mục "Prompt bộ kiểm tra"
- hub `KET_QUA_G0_2026-11-15.md` §6

## Global Constraints
- `child_id` chỉ từ phiên; mọi ghi qua route máy chủ (service role); không log nội dung tin nhắn.
- Model không tự đổi mức gợi ý, không tự đếm lượt, không tự quyết `self_solved` (CLAUDE.md).
- Mọi khẳng định đúng/sai về phép tính đi qua `math_check`. G2 chưa có công cụ, nên `self_solved` **không bao giờ** được cho qua ở G2 (DOMAIN §4.12 b; `decideSolve` đã có).
- Model: chính `TUTOR_MODEL_MAIN` = `claude-sonnet-5-5`; mạnh `TUTOR_MODEL_STRONG` = `claude-opus-5-5` (mới); kiểm tra `TUTOR_MODEL_LIGHT` = `claude-haiku-5-5`.
- Trần: ngừng chuyển Opus khi chi tháng ≥ **45 USD** hoặc `usage_monthly.model_mode = 'economy'` (D29).
- Tối đa 20 lượt/bài; lượt 18 cô đề nghị để dành (luật 12).
- SQL chỉ nằm ở repo `study-launcher`: chỉ thêm (additive), idempotent; phụ huynh merge = duyệt SQL.
- Repo công khai: không tên thật, trường, điểm, URL/khóa thật trong code, test, fixture, commit.
- Chữ giao diện tiếng Việt có dấu, nút ≥ 44px.

## Ngoài phạm vi G2 (ghi rõ để không làm lan)
- Mức hiểu U0–U3 theo luật máy chủ (§4.3): G2 chỉ lưu `u_level` model báo; luật tính ở G7 (báo cáo).
- Bài anh em, `math_check`, đóng `self_solved` → G4. Phân loại `ku_code` / `exam_slot`, dấu hiệu `geometry_proof` và `exam_slot_hard` để chọn Opus → G5. Báo bố mẹ khi chạm 45 USD (route D23) → G7.
- Luật "buổi đang mở ở máy khác" (§5) → G7.

## Bản đồ file

| Repo | File | Trách nhiệm |
|---|---|---|
| launcher | `supabase/migrations/0018_tutor_g2.sql`, `supabase/tests/rls_tutor_test.sql` | 3 cột mới + test |
| gia-su | `lib/rules/events.ts` | Dựng chuỗi sự kiện của con (gõ / nút / nộp) từ tin nhắn, gán `replyTo` cho "Chưa hiểu" |
| gia-su | `lib/rules/model.ts` | Chọn model mỗi lượt (§4.14) |
| gia-su | `lib/rules/outcome.ts` | Kết cục bài sau lượt (§4.4, §4.12, lạc đề ×3) |
| gia-su | `prompts/guard.md`, `lib/tutor/guard.ts` | Bộ kiểm tra Haiku + kiểm cứng số dòng |
| gia-su | `lib/copy.ts` | Câu an toàn theo mức, nhãn nút cố định |
| gia-su | `lib/tutor/assemble.ts` | Khối ⑥ thêm `max_lines` |
| gia-su | `lib/tutor/repo.ts`, `lib/db/supabaseRepo.ts`, `tests/helpers/memoryRepo.ts` | Kho: sự kiện, trạng thái gợi ý, dùng Opus chưa, chi tháng, lưu nhiều lời gọi model |
| gia-su | `lib/tutor/handlers.ts`, `lib/tutor/deps.ts` | Đường một lượt mới; `saveForLater` |
| gia-su | `app/api/problem/save/route.ts`, `app/hoi/[problemId]/chat.tsx` | Nút cố định + ô nộp bài |
| gia-su | `lib/env.ts`, `.env.example` | `TUTOR_MODEL_STRONG`, `TUTOR_FAKE_MODEL` |
| gia-su | `eval/run.ts`, `eval/cases.ts` | Bộ chấm phụ không coi số liệu đề / tên phương pháp / lựa chọn bước nhỏ là lộ |
| gia-su | `lib/tutor/fakeClient.ts`, `e2e/*`, `playwright.config.ts`, `.github/workflows/ci.yml` | PR C |

---

## PR A — repo `study-launcher` (nhánh `feature/gs2-tutor-g2-columns`)

### Task 1: Migration 0018 + test

**Files:**
- Create: `supabase/migrations/0018_tutor_g2.sql`
- Modify: `supabase/tests/rls_tutor_test.sql` (thêm cuối file), `docs/PROGRESS.md`

**Interfaces:**
- Produces:
  - `tutor.model_calls.route_reason text null`, check ∈ {`guard_blocked`, `nan`, `hint_h3`, `tutor_unsure`, `sticky`, `geometry_proof`, `exam_slot_hard`, `opus_paused`}
  - `tutor.messages.input_kind text not null default 'text'`, check ∈ {`text`, `button`, `submit`}
  - `tutor.problems.offtopic_count integer not null default 0`, check ≥ 0

- [ ] **Step 1: test trước** — thêm vào cuối `supabase/tests/rls_tutor_test.sql` (dùng lại `test_helpers` đã định nghĩa đầu file):
```sql
-- G2 (0018): new columns exist, defaults hold, checks reject bad values; children still only read.
do $$
begin
  perform 1 from information_schema.columns where table_schema = 'tutor' and table_name = 'model_calls' and column_name = 'route_reason';
  if not found then raise exception 'model_calls.route_reason missing'; end if;
  perform 1 from information_schema.columns where table_schema = 'tutor' and table_name = 'messages' and column_name = 'input_kind' and column_default like '''text''%';
  if not found then raise exception 'messages.input_kind missing or wrong default'; end if;
  perform 1 from information_schema.columns where table_schema = 'tutor' and table_name = 'problems' and column_name = 'offtopic_count' and column_default = '0';
  if not found then raise exception 'problems.offtopic_count missing or wrong default'; end if;
  -- the three CHECK constraints are in place (behaviour is covered by Postgres itself)
  perform 1 from pg_constraint where conname in ('model_calls_route_reason_check', 'messages_input_kind_check', 'problems_offtopic_count_check')
    having count(*) = 3;
  if not found then raise exception 'G2 check constraints missing'; end if;
end $$;
```
- [ ] **Step 2:** `bash scripts/test-db.sh` → FAIL (`model_calls.route_reason missing`).
- [ ] **Step 3:** `supabase/migrations/0018_tutor_g2.sql`:
```sql
-- 0018_tutor_g2.sql — Gia sư AI Toán, lát G2 (DOMAIN v0.5 §4.2, §4.14, §5). Additive, idempotent.
-- Children keep read-only access: the table-level grants of 0017 cover new columns.

-- Why a turn ran on the stronger model (Opus) — shown in the evening report (D28).
alter table tutor.model_calls add column if not exists route_reason text;
alter table tutor.model_calls drop constraint if exists model_calls_route_reason_check;
alter table tutor.model_calls add constraint model_calls_route_reason_check check (route_reason is null or route_reason in
  ('guard_blocked', 'nan', 'hint_h3', 'tutor_unsure', 'sticky', 'geometry_proof', 'exam_slot_hard', 'opus_paused'));

-- How the child sent a message: typed, a button, or "nộp bài" (final answer). Needed for nản (§4.2).
alter table tutor.messages add column if not exists input_kind text not null default 'text';
alter table tutor.messages drop constraint if exists messages_input_kind_check;
alter table tutor.messages add constraint messages_input_kind_check check (input_kind in ('text', 'button', 'submit'));

-- Off-topic turns in a problem: 3 → closed_offtopic (§5).
alter table tutor.problems add column if not exists offtopic_count integer not null default 0;
alter table tutor.problems drop constraint if exists problems_offtopic_count_check;
alter table tutor.problems add constraint problems_offtopic_count_check check (offtopic_count >= 0);
```
- [ ] **Step 4:** `bash scripts/test-db.sh` → PASS; `npm run typecheck && npm run lint && npm test` xanh.
- [ ] **Step 5:** PROGRESS dòng GS2-SQL; commit `feat(db): tutor G2 columns (route_reason, input_kind, offtopic_count)`; PR tiếng Việt: **có SQL** (0018 tự chạy khi merge, chỉ thêm 3 cột, không đụng dữ liệu cũ), cách thử, không merge. **PR B chỉ merge sau PR A.**

---

## PR B — repo `gia-su-ai-math` (nhánh `feature/g2-server-rules`)

### Task 2: Chuỗi sự kiện của con (cho luật nản)

**Files:** Create `lib/rules/events.ts`, `tests/events.test.ts`.

**Interfaces:**
- Consumes: `ChildEvent`, `isNanSignal`, `NOT_UNDERSTOOD` từ `lib/rules/nan.ts` (có sẵn).
- Produces:
```ts
export type InputKind = "text" | "button" | "submit";
export interface StoredMsg { id: string; role: "child" | "tutor"; content: string; inputKind: InputKind }
export function childEvents(msgs: readonly StoredMsg[]): ChildEvent[];
```
Quy ước: tin `text`/`submit` → `{kind:"text"}`; tin `button` → `{kind:"button", label, replyTo}`. Với "Chưa hiểu", `replyTo` là **gốc** của chuỗi giảng lại: id tin cô ngay trước nó, trừ khi tin con ngay trước tin cô đó cũng là "Chưa hiểu" thì dùng lại gốc của lần bấm đó (DOMAIN §4.2: "cùng message_id gốc hoặc các lượt giảng lại của nó").

- [ ] **Step 1: failing test**
```ts
import { describe, expect, it } from "vitest";
import { childEvents, type StoredMsg } from "@/lib/rules/events";
import { isNanSignal } from "@/lib/rules/nan";

let n = 0;
const t = (content: string): StoredMsg => ({ id: `t${++n}`, role: "tutor", content, inputKind: "text" });
const c = (content: string, inputKind: StoredMsg["inputKind"] = "text"): StoredMsg => ({ id: `c${++n}`, role: "child", content, inputKind });

describe("childEvents → isNanSignal (DOMAIN §4.2)", () => {
  it("4.1c: 'k' then 'ko biết' typed → nản", () => {
    expect(isNanSignal(childEvents([t("Đề hỏi gì?"), c("k"), t("Thử lại nhé?"), c("ko biết")]))).toBe(true);
  });
  it("4.2a: 'ok' then 'x=6' → not nản", () => {
    expect(isNanSignal(childEvents([t("?"), c("ok"), t("?"), c("x=6")]))).toBe(false);
  });
  it("4.2e: 'k', button 'Hiểu rồi', 'k' → not nản (a button breaks the run)", () => {
    expect(isNanSignal(childEvents([t("?"), c("k"), t("?"), c("Hiểu rồi", "button"), t("?"), c("k")]))).toBe(false);
  });
  it("'Chưa hiểu' 3 times on the same explanation chain → nản (all 3 presses share one root)", () => {
    const m = [t("Giảng A"), c("Chưa hiểu", "button"), t("Giảng lại A"), c("Chưa hiểu", "button"), t("Giảng lại A lần 2"), c("Chưa hiểu", "button")];
    const ev = childEvents(m);
    const roots = ev.flatMap((e) => (e.kind === "button" ? [e.replyTo] : []));
    expect(roots).toHaveLength(3);
    expect(new Set(roots).size).toBe(1);
    expect(roots[0]).toBe(m[0]!.id);
    expect(isNanSignal(ev)).toBe(true);
  });
  it("4.2c: 'Chưa hiểu' twice at two different places → not nản", () => {
    const m = [t("Giảng A"), c("Chưa hiểu", "button"), t("Giảng lại A"), c("x = 2"), t("Giảng B"), c("Chưa hiểu", "button")];
    expect(isNanSignal(childEvents(m))).toBe(false);
  });
  it("a 'nộp bài' message counts as typed content", () => {
    expect(childEvents([t("?"), c("x = 24, y = 48", "submit")])).toEqual([{ kind: "text", text: "x = 24, y = 48" }]);
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/events.test.ts` → FAIL (module chưa có).
- [ ] **Step 3: code**
```ts
// lib/rules/events.ts — the child's events of a problem, as the nản rule (lib/rules/nan.ts) reads them.
import { NOT_UNDERSTOOD, type ChildEvent } from "@/lib/rules/nan";

export type InputKind = "text" | "button" | "submit";
export interface StoredMsg { id: string; role: "child" | "tutor"; content: string; inputKind: InputKind }

/** Oldest first. "Chưa hiểu" presses get the root of their re-explanation chain as `replyTo`. */
export function childEvents(msgs: readonly StoredMsg[]): ChildEvent[] {
  const out: ChildEvent[] = [];
  const rootOfPress = new Map<string, string>(); // child message id → root tutor message id
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.role !== "child") continue;
    if (m.inputKind !== "button") {
      out.push({ kind: "text", text: m.content });
      continue;
    }
    let replyTo: string | undefined;
    if (m.content === NOT_UNDERSTOOD) {
      const tutor = msgs[i - 1]?.role === "tutor" ? msgs[i - 1] : undefined;
      const before = msgs[i - 2];
      const chained = before?.role === "child" && before.inputKind === "button" && before.content === NOT_UNDERSTOOD;
      replyTo = chained ? rootOfPress.get(before.id) : tutor?.id;
      if (replyTo) rootOfPress.set(m.id, replyTo);
    }
    out.push({ kind: "button", label: m.content, replyTo });
  }
  return out;
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(rules): child events for the nản rule`.

### Task 3: Chọn model mỗi lượt

**Files:** Create `lib/rules/model.ts`, `tests/model.test.ts`.

**Interfaces:**
- Consumes: `HintLevel` (`lib/rules/hints.ts`).
- Produces:
```ts
export type ModelTier = "main" | "strong";
export type RouteReason = "guard_blocked" | "nan" | "hint_h3" | "tutor_unsure" | "sticky" | "geometry_proof" | "exam_slot_hard" | "opus_paused";
export interface RouteInput {
  grade: 6 | 9; hintLevel: HintLevel; nan: boolean; prevTutorUnsure: boolean;
  problemUsedStrong: boolean; strongPaused: boolean; geometryProof?: boolean; examSlot?: string | null;
}
export const STRONG_PAUSE_AT_USD = 45;
export function strongPaused(u: { costUsd: number; mode: "normal" | "economy" }): boolean;
export function pickModel(i: RouteInput): { tier: ModelTier; reason: RouteReason | null };
export function rewriteRoute(strongPausedNow: boolean): { tier: ModelTier; reason: RouteReason };
```
- [ ] **Step 1: failing test** (ví dụ chuẩn §4.14):
```ts
import { describe, expect, it } from "vitest";
import { pickModel, rewriteRoute, strongPaused, type RouteInput } from "@/lib/rules/model";

const base: RouteInput = { grade: 9, hintLevel: 0, nan: false, prevTutorUnsure: false, problemUsedStrong: false, strongPaused: false };

describe("pickModel (DOMAIN §4.14)", () => {
  it("a: grade 9, turn 1, H0 → Sonnet", () => expect(pickModel(base)).toEqual({ tier: "main", reason: null }));
  it("b: H2, one mistake → Sonnet", () => expect(pickModel({ ...base, hintLevel: 2 })).toEqual({ tier: "main", reason: null }));
  it("c: the server just raised to H3 → Opus (hint_h3)", () => expect(pickModel({ ...base, hintLevel: 3 })).toEqual({ tier: "strong", reason: "hint_h3" }));
  it("e: grade 6, nản → Opus (nan)", () => expect(pickModel({ ...base, grade: 6, nan: true, hintLevel: 4 })).toEqual({ tier: "strong", reason: "nan" }));
  it("f: problem already used Opus, now H1 → still Opus (sticky)", () =>
    expect(pickModel({ ...base, hintLevel: 1, problemUsedStrong: true })).toEqual({ tier: "strong", reason: "sticky" }));
  it("g: a new problem starts on Sonnet", () => expect(pickModel(base).tier).toBe("main"));
  it("tutor said it was unsure last turn → Opus", () => expect(pickModel({ ...base, prevTutorUnsure: true })).toEqual({ tier: "strong", reason: "tutor_unsure" }));
  it("h: grade 9 geometry proof → Opus; i: grade 6 geometry → Sonnet", () => {
    expect(pickModel({ ...base, geometryProof: true })).toEqual({ tier: "strong", reason: "geometry_proof" });
    expect(pickModel({ ...base, grade: 6, geometryProof: true })).toEqual({ tier: "main", reason: null });
  });
  it("hard exam slots (grade 9 only)", () => {
    expect(pickModel({ ...base, examSlot: "HN10-2c" })).toEqual({ tier: "strong", reason: "exam_slot_hard" });
    expect(pickModel({ ...base, examSlot: "HN10-1a" })).toEqual({ tier: "main", reason: null });
  });
  it("j: Opus paused (45 USD), grade 9 nản → Sonnet, reason opus_paused (report: 'should have escalated')", () =>
    expect(pickModel({ ...base, nan: true, hintLevel: 4, strongPaused: true })).toEqual({ tier: "main", reason: "opus_paused" }));
  it("paused and nothing to escalate → plain Sonnet", () => expect(pickModel({ ...base, strongPaused: true })).toEqual({ tier: "main", reason: null }));
});

describe("rewriteRoute (§4.14 d, §5)", () => {
  it("d: a blocked answer is rewritten on Opus", () => expect(rewriteRoute(false)).toEqual({ tier: "strong", reason: "guard_blocked" }));
  it("paused: rewritten on Sonnet", () => expect(rewriteRoute(true)).toEqual({ tier: "main", reason: "opus_paused" }));
});

describe("strongPaused (D29)", () => {
  it("pauses at 45 USD or when the month is marked economy", () => {
    expect(strongPaused({ costUsd: 44.99, mode: "normal" })).toBe(false);
    expect(strongPaused({ costUsd: 45, mode: "normal" })).toBe(true);
    expect(strongPaused({ costUsd: 3, mode: "economy" })).toBe(true);
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3: code**
```ts
// lib/rules/model.ts — which model answers this turn (DOMAIN §4.14, D28, D29). Pure.
import type { HintLevel } from "@/lib/rules/hints";

export type ModelTier = "main" | "strong";
export type RouteReason = "guard_blocked" | "nan" | "hint_h3" | "tutor_unsure" | "sticky" | "geometry_proof" | "exam_slot_hard" | "opus_paused";
export interface RouteInput {
  grade: 6 | 9; hintLevel: HintLevel; nan: boolean; prevTutorUnsure: boolean;
  problemUsedStrong: boolean; strongPaused: boolean; geometryProof?: boolean; examSlot?: string | null;
}

export const STRONG_PAUSE_AT_USD = 45;
const HARD_SLOTS = new Set(["HN10-2c", "HN10-3c", "HN10-4b", "HN10-4c", "HN10-5"]);

export const strongPaused = (u: { costUsd: number; mode: "normal" | "economy" }) =>
  u.mode === "economy" || u.costUsd >= STRONG_PAUSE_AT_USD;

function signal(i: RouteInput): RouteReason | null {
  if (i.nan) return "nan";
  if (i.hintLevel >= 3) return "hint_h3";
  if (i.prevTutorUnsure) return "tutor_unsure";
  if (i.grade === 9 && i.geometryProof) return "geometry_proof";
  if (i.grade === 9 && i.examSlot && HARD_SLOTS.has(i.examSlot)) return "exam_slot_hard";
  return null;
}

/** Order: paused → Sonnet; problem already on Opus → Opus; any signal → Opus; else Sonnet. */
export function pickModel(i: RouteInput): { tier: ModelTier; reason: RouteReason | null } {
  const s = signal(i);
  if (i.strongPaused) return { tier: "main", reason: s || i.problemUsedStrong ? "opus_paused" : null };
  if (i.problemUsedStrong) return { tier: "strong", reason: "sticky" };
  return s ? { tier: "strong", reason: s } : { tier: "main", reason: null };
}

export function rewriteRoute(strongPausedNow: boolean): { tier: ModelTier; reason: RouteReason } {
  return strongPausedNow ? { tier: "main", reason: "opus_paused" } : { tier: "strong", reason: "guard_blocked" };
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(rules): pick the model per turn (D28, D29)`.

### Task 4: Kết cục bài sau lượt

**Files:** Create `lib/rules/outcome.ts`, `tests/outcome.test.ts`.

**Interfaces:**
- Consumes: `decideSolve` (`lib/rules/solveGate.ts`), `ProblemStatus` (`lib/tutor/repo.ts`), `TutorOutput` (`lib/tutor/schema.ts`).
- Produces:
```ts
export const MAX_TURNS = 20; export const OFFTOPIC_CLOSE_AT = 3;
export interface OutcomeInput { turn: number; output: TutorOutput | null; submitted: boolean; offtopicCount: number }
export interface Outcome { status: ProblemStatus; offtopicCount: number; solveBlocked: string | null }
export function decideOutcome(i: OutcomeInput): Outcome;
```
(`MAX_TURNS` chuyển từ `handlers.ts` sang đây; `handlers.ts` re-export để test cũ không vỡ.)

- [ ] **Step 1: failing test**
```ts
import { describe, expect, it } from "vitest";
import { decideOutcome } from "@/lib/rules/outcome";
import fewshot from "./fixtures/fewshot.json";
import type { TutorOutput } from "@/lib/tutor/schema";

const out = (o: Partial<TutorOutput>): TutorOutput => ({ ...(fewshot as TutorOutput[])[1]!, flags: [], ket_qua_bai: "in_progress", ...o });

describe("decideOutcome (DOMAIN §4.4, §4.12, §5)", () => {
  it("4.12 b: model says self_solved but no math_check yet (G2) → stays in_progress", () =>
    expect(decideOutcome({ turn: 6, output: out({ ket_qua_bai: "self_solved" }), submitted: true, offtopicCount: 0 }))
      .toEqual({ status: "in_progress", offtopicCount: 0, solveBlocked: "no_passing_math_check" }));
  it("4.4 e: a submitted geometry proof → pending_review (D18)", () =>
    expect(decideOutcome({ turn: 3, output: out({ ket_qua_bai: "pending_review", flags: ["geometry_proof"] }), submitted: true, offtopicCount: 0 }).status)
      .toBe("pending_review"));
  it("geometry flag but the child did not submit → in_progress", () =>
    expect(decideOutcome({ turn: 3, output: out({ ket_qua_bai: "pending_review", flags: ["geometry_proof"] }), submitted: false, offtopicCount: 0 }).status)
      .toBe("in_progress"));
  it("the model cannot close as saved_for_later (only the child's button can)", () =>
    expect(decideOutcome({ turn: 5, output: out({ ket_qua_bai: "saved_for_later" }), submitted: false, offtopicCount: 0 }).status).toBe("in_progress"));
  it("4.4 h: turn 20 → timed_out", () => expect(decideOutcome({ turn: 20, output: out({}), submitted: false, offtopicCount: 0 }).status).toBe("timed_out"));
  it("§5: third off-topic turn → closed_offtopic", () => {
    expect(decideOutcome({ turn: 4, output: out({ flags: ["off_topic"] }), submitted: false, offtopicCount: 1 })).toEqual({ status: "in_progress", offtopicCount: 2, solveBlocked: null });
    expect(decideOutcome({ turn: 5, output: out({ flags: ["off_topic"] }), submitted: false, offtopicCount: 2 })).toEqual({ status: "closed_offtopic", offtopicCount: 3, solveBlocked: null });
  });
  it("no readable output (safe line) → in_progress, counters unchanged", () =>
    expect(decideOutcome({ turn: 4, output: null, submitted: false, offtopicCount: 1 })).toEqual({ status: "in_progress", offtopicCount: 1, solveBlocked: null }));
});
```
- [ ] **Step 2:** FAIL. **Step 3: code**
```ts
// lib/rules/outcome.ts — the problem's status after a turn. The model proposes, the server decides.
import { decideSolve } from "@/lib/rules/solveGate";
import type { ProblemStatus } from "@/lib/tutor/repo";
import type { TutorOutput } from "@/lib/tutor/schema";

export const MAX_TURNS = 20;      // D15
export const OFFTOPIC_CLOSE_AT = 3; // DOMAIN §5

export interface OutcomeInput { turn: number; output: TutorOutput | null; submitted: boolean; offtopicCount: number }
export interface Outcome { status: ProblemStatus; offtopicCount: number; solveBlocked: string | null }

export function decideOutcome(i: OutcomeInput): Outcome {
  const offtopicCount = i.offtopicCount + (i.output?.flags.includes("off_topic") ? 1 : 0);
  if (offtopicCount >= OFFTOPIC_CLOSE_AT) return { status: "closed_offtopic", offtopicCount, solveBlocked: null };
  let status: ProblemStatus = "in_progress";
  let solveBlocked: string | null = null;
  const proposed = i.output?.ket_qua_bai;
  const proof = i.output?.flags.includes("geometry_proof") ?? false;
  if ((proposed === "self_solved" || proposed === "pending_review") && i.submitted) {
    // G2 has no math_check yet: checks = [] → only a geometry proof can leave (to review). G4 passes the tool log.
    const gate = decideSolve({ isGeometryProof: proof, checks: [], checklistOpen: false });
    if (gate.allow) status = gate.status;
    else solveBlocked = gate.reason;
  } else if (proposed === "self_solved") {
    solveBlocked = "no_passing_math_check";
  }
  if (status === "in_progress" && i.turn >= MAX_TURNS) status = "timed_out";
  return { status, offtopicCount, solveBlocked };
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(rules): problem outcome after a turn`.

### Task 5: Bộ kiểm tra (Haiku) + câu an toàn

**Files:** Create `prompts/guard.md`, `lib/tutor/guard.ts`, `tests/guard.test.ts`. Modify `lib/copy.ts`, `lib/tutor/layers.ts` (đọc thêm `guard.md`), `tests/layers.test.ts`.

**Interfaces:**
- Consumes: `ModelClient` (`lib/tutor/turn.ts`), `costUsd` (`lib/anthropic.ts`), `messageLines` (`eval/checks.ts` → chuyển vào `lib/tutor/lines.ts`, eval import lại), `TutorOutput`.
- Produces:
```ts
export interface GuardInput { statement: string; hintLevel: HintLevel; submitted: boolean; maxLines: number; output: TutorOutput; toolsCalled: string[] }
export interface GuardResult { pass: boolean; reasons: string[]; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number }; model: string }
export async function runGuard(client: ModelClient, model: string, guardPrompt: string, i: GuardInput): Promise<GuardResult>;
// lib/copy.ts
export const BTN_NOT_UNDERSTOOD = "Chưa hiểu"; export const BTN_SAVE = "Để dành hỏi thầy";
export function safeLine(level: HintLevel): { message: string; buttons: string[] };
// lib/tutor/layers.ts
export interface Layers { role: string; rules: string; method: string; guard: string }
```
- [ ] **Step 1:** `prompts/guard.md`: chép nguyên khối "Prompt bộ kiểm tra (Haiku)" của hub `SYSTEM_PROMPT_v0.3.md`, đổi dòng cuối thành định dạng `{"pass": true|false, "ly_do": ["..."]}`. Thêm sau mục 7 hai dòng làm rõ (từ G0 lần 4):
```text
KHÔNG tính là lộ đáp số: số liệu có sẵn trong đề; tên phương pháp (vd "Tam giác đồng dạng", "Bội chung");
lựa chọn cho câu trả lời của BƯỚC NHỎ đang hỏi (vd "1/16" khi hỏi phần việc mỗi giờ), miễn không phải đáp số cuối của bài gốc.
Ở bản này app CHƯA có công cụ: danh sách công cụ đã gọi luôn rỗng, nên mục 6 và 7 FAIL nếu câu trả lời khẳng định đúng/sai một phép tính hoặc đưa bài anh em.
```
- [ ] **Step 2: failing test** `tests/guard.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { runGuard, type GuardInput } from "@/lib/tutor/guard";
import { safeLine } from "@/lib/copy";
import fewshot from "./fixtures/fewshot.json";
import type { TutorOutput } from "@/lib/tutor/schema";

const output = (fewshot as TutorOutput[])[1]!;
const input: GuardInput = { statement: "Đề…", hintLevel: 2, submitted: false, maxLines: 6, output, toolsCalled: [] };
const reply = (text: string) => ({ create: async (req: object) => {
  (reply as unknown as { last: object }).last = req;
  return { content: [{ type: "text", text }], usage: { input_tokens: 500, output_tokens: 20 } };
} });

describe("runGuard", () => {
  it("passes when Haiku passes", async () => {
    const r = await runGuard(reply('{"pass":true,"ly_do":[]}'), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([true, []]);
    expect(r.costUsd).toBeGreaterThan(0);
  });
  it("fails with Haiku's reasons", async () => {
    const r = await runGuard(reply('{"pass":false,"ly_do":["1: lộ đáp số"]}'), "claude-haiku-5-5", "PROMPT", input);
    expect([r.pass, r.reasons]).toEqual([false, ["1: lộ đáp số"]]);
  });
  it("too many lines fails without calling Haiku", async () => {
    let called = false;
    const long = { ...output, message: "1\n2\n3\n4\n5\n6\n7" };
    const r = await runGuard({ create: async () => { called = true; throw new Error("no"); } }, "h", "P", { ...input, output: long });
    expect([r.pass, r.reasons, called]).toEqual([false, ["2: dài 7 dòng > 6"], false]);
  });
  it("fail-closed: Haiku unreadable or down → not passed", async () => {
    expect((await runGuard(reply("xin chào"), "h", "P", input)).pass).toBe(false);
    expect((await runGuard({ create: async () => { throw Object.assign(new Error("x"), { status: 529 }); } }, "h", "P", input)).reasons).toEqual(["guard_unavailable"]);
  });
  it("Haiku runs without thinking, small effort, JSON schema", async () => {
    const c = reply('{"pass":true,"ly_do":[]}');
    await runGuard(c, "claude-haiku-5-5", "PROMPT", input);
    expect((reply as unknown as { last: Record<string, unknown> }).last).toMatchObject({ thinking: { type: "disabled" }, output_config: { effort: "low" } });
  });
});

describe("safeLine (DOMAIN §5: blocked twice)", () => {
  it("every level has a question and H5 offers to save", () => {
    for (const l of [0, 1, 2, 3, 4] as const) expect(safeLine(l).message.trim().endsWith("?")).toBe(true);
    expect(safeLine(5).buttons).toContain("Để dành hỏi thầy");
  });
});
```
- [ ] **Step 3:** FAIL. **Step 4: code**
```ts
// lib/tutor/guard.ts — checks every final tutor answer before the child sees it (SYSTEM_PROMPT "Prompt bộ kiểm tra").
// Fail-closed: if the checker cannot answer, the answer counts as not passed (it is rewritten or replaced).
import { z } from "zod";
import { costUsd } from "@/lib/anthropic";
import type { HintLevel } from "@/lib/rules/hints";
import { messageLines } from "@/lib/tutor/lines";
import type { TutorOutput } from "@/lib/tutor/schema";
import type { ModelClient } from "@/lib/tutor/turn";

export interface GuardInput { statement: string; hintLevel: HintLevel; submitted: boolean; maxLines: number; output: TutorOutput; toolsCalled: string[] }
export interface GuardResult { pass: boolean; reasons: string[]; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number }; model: string }

const verdict = z.object({ pass: z.boolean(), ly_do: z.array(z.string()) }).strict();
const schema = { type: "object", properties: { pass: { type: "boolean" }, ly_do: { type: "array", items: { type: "string" } } }, required: ["pass", "ly_do"], additionalProperties: false };
const none = { in: 0, cached: 0, out: 0 };

export async function runGuard(client: ModelClient, model: string, guardPrompt: string, i: GuardInput): Promise<GuardResult> {
  const lines = messageLines(i.output.message);
  if (lines > i.maxLines) return { pass: false, reasons: [`2: dài ${lines} dòng > ${i.maxLines}`], raw: "", costUsd: 0, tokens: none, model };
  const user = [
    `Đề bài gốc (đã xác nhận):\n${i.statement}`,
    `Mức gợi ý hiện tại: H${i.hintLevel} | da_nop_loi_giai: ${i.submitted} | max_lines: ${i.maxLines}`,
    `Công cụ đã gọi trong lượt: ${i.toolsCalled.length ? i.toolsCalled.join(", ") : "(không có)"}`,
    `Câu trả lời JSON của gia sư:\n${JSON.stringify(i.output)}`,
  ].join("\n\n");
  try {
    const res = await client.create({
      model, max_tokens: 1500, thinking: { type: "disabled" }, system: guardPrompt,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    });
    const raw = res.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const tokens = { in: res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0), cached, out: res.usage.output_tokens };
    let parsed: z.infer<typeof verdict> | null = null;
    try { parsed = verdict.parse(JSON.parse(raw)); } catch { parsed = null; }
    if (!parsed) return { pass: false, reasons: ["guard_unreadable"], raw, costUsd: costUsd(model, res.usage), tokens, model };
    return { pass: parsed.pass, reasons: parsed.ly_do, raw, costUsd: costUsd(model, res.usage), tokens, model };
  } catch (e) {
    console.error("guard call failed", e instanceof Error ? e.message : "unknown");
    return { pass: false, reasons: ["guard_unavailable"], raw: "", costUsd: 0, tokens: none, model };
  }
}
```
`lib/tutor/lines.ts`: `export const messageLines = (m: string) => m.split("\n").filter((l) => l.trim().length > 0).length;` — `eval/checks.ts` đổi sang `import { messageLines } from "@/lib/tutor/lines"` và `export { messageLines }`.
`lib/copy.ts` thêm:
```ts
export const BTN_NOT_UNDERSTOOD = "Chưa hiểu";
export const BTN_SAVE = "Để dành hỏi thầy";
/** Pre-written lines when the checker blocked an answer twice (DOMAIN §5). Never reveal anything. */
const SAFE_BY_LEVEL: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: "Mình đọc lại đề cùng nhau nhé: đề cho em biết gì, và hỏi gì?",
  1: "Mình đọc lại đề cùng nhau nhé: đề cho em biết gì, và hỏi gì?",
  2: "Em viết ra bước đầu tiên em định làm, cô xem cùng em nhé?",
  3: "Mình làm một bước thật nhỏ: em chép lại dữ kiện đầu tiên của đề nhé?",
  4: "Em nghỉ tay một chút nhé. Xong em thử lại bước vừa rồi, hay mình để dành bài này hỏi thầy?",
  5: "Em đã cố gắng nhiều rồi. Mình để dành bài này hỏi thầy nhé?",
};
export function safeLine(level: 0 | 1 | 2 | 3 | 4 | 5): { message: string; buttons: string[] } {
  return { message: SAFE_BY_LEVEL[level], buttons: level >= 4 ? [BTN_SAVE] : [] };
}
```
`lib/tutor/layers.ts`: `Layers` thêm `guard: read("guard.md")`; `tests/layers.test.ts` thêm `expect(l.guard).toContain("Em là bộ kiểm tra")`.
- [ ] **Step 5:** PASS cả `tests/guard.test.ts`, `tests/layers.test.ts`, `tests/evalChecks.test.ts`. **Step 6:** commit `feat(tutor): Haiku checker and safe lines`.

### Task 6: Khối ⑥ có `max_lines`, env model mạnh, client giả

**Files:** Modify `lib/tutor/assemble.ts`, `tests/assemble.test.ts`, `lib/env.ts`, `tests/env.test.ts`, `.env.example`. Create `lib/tutor/fakeClient.ts`, `tests/fakeClient.test.ts`.

**Interfaces:**
- Produces: `TurnStateBlock.maxLines: number` (dòng `... | max_lines: 6` trong ⑥); `ServerEnv.TUTOR_MODEL_STRONG` (mặc định `claude-opus-5-5`), `ServerEnv.TUTOR_FAKE_MODEL` (`"1"` | undefined); `fakeClient(): ModelClient`; `fakeAllowed(env: NodeJS.ProcessEnv): boolean` (= `TUTOR_FAKE_MODEL === "1"` và **không** có `VERCEL`).
- [ ] **Step 1: failing tests**
```ts
// tests/assemble.test.ts (thêm)
it("⑥ carries max_lines from the teaching profile", () => {
  expect(renderStateBlock({ ...state, maxLines: 4 })).toContain("max_lines: 4");
});
// tests/env.test.ts (thêm)
it("strong model defaults to Opus 5.5", () => expect(parseServerEnv(base).TUTOR_MODEL_STRONG).toBe("claude-opus-5-5"));
// tests/fakeClient.test.ts
import { describe, expect, it } from "vitest";
import { fakeAllowed, fakeClient } from "@/lib/tutor/fakeClient";
import { parseTutorOutput } from "@/lib/tutor/schema";
describe("fake model (e2e only)", () => {
  it("never on Vercel", () => {
    expect(fakeAllowed({ TUTOR_FAKE_MODEL: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(fakeAllowed({ TUTOR_FAKE_MODEL: "1", VERCEL: "1" } as NodeJS.ProcessEnv)).toBe(false);
  });
  it("tutor replies are valid TutorOutput; the checker always passes", async () => {
    const c = fakeClient();
    const t = await c.create({ model: "claude-sonnet-5-5", messages: [{ role: "user", content: "[EM]\nđề" }] });
    expect(parseTutorOutput(t.content[0]!.text!).ok).toBe(true);
    const g = await c.create({ model: "claude-haiku-5-5", system: "Em là bộ kiểm tra", messages: [] });
    expect(JSON.parse(g.content[0]!.text!)).toEqual({ pass: true, ly_do: [] });
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3: code** — `TurnStateBlock` thêm `maxLines: number`; dòng 2 của `renderStateBlock` thành `` `da_nop_loi_giai: ${s.submitted} | che_do: ${s.mode} | max_lines: ${s.maxLines}` ``; mọi chỗ dựng `state` (handlers, eval) truyền `maxLines` (handlers: `actor.maxLines`; eval: `profile.maxLines`). `lib/env.ts` thêm `TUTOR_MODEL_STRONG: z.string().default("claude-opus-5-5")`, `TUTOR_FAKE_MODEL: z.literal("1").optional()`. `.env.example` thêm 2 dòng có chú thích.
```ts
// lib/tutor/fakeClient.ts — canned replies for e2e (no API, no cost). Refused on Vercel.
import type { ModelClient } from "@/lib/tutor/turn";
import fewshot from "@/tests/fixtures/fewshot.json";

export const fakeAllowed = (env: NodeJS.ProcessEnv) => env.TUTOR_FAKE_MODEL === "1" && !env.VERCEL;

export function fakeClient(): ModelClient {
  return {
    async create(req) {
      const r = req as { system?: unknown; messages: { content: string }[] };
      const isGuard = typeof r.system === "string" && r.system.includes("Em là bộ kiểm tra");
      const first = r.messages.length <= 1;
      const text = isGuard ? JSON.stringify({ pass: true, ly_do: [] }) : JSON.stringify((fewshot as object[])[first ? 0 : 1]);
      return { content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } };
    },
  };
}
```
- [ ] **Step 4:** PASS (`npx vitest run`), `npm run typecheck`. **Step 5:** commit `feat(tutor): max_lines in the state block, strong model env, fake client`.

### Task 7: Kho mở rộng (sự kiện, trạng thái gợi ý, Opus, chi tháng, nhiều lời gọi)

**Files:** Modify `lib/tutor/repo.ts`, `tests/helpers/memoryRepo.ts`, `lib/db/supabaseRepo.ts`.

**Interfaces:**
- Consumes: `StoredMsg`, `InputKind` (Task 2), `RouteReason` (Task 3), `HintLevel`.
- Produces (thay thế các khai báo cùng tên trong `lib/tutor/repo.ts`):
```ts
export interface ProblemRow {
  id: string; childId: string; familyId: string; sessionId: string; status: ProblemStatus; turnCount: number;
  hintLevel: HintLevel; hintLevelMax: HintLevel; nanJumps: number; wrongCount: number; offtopicCount: number;
  stuckKind: StuckKind | null; statementConfirmed: boolean;
  history: Msg[];               // answered turns, oldest first
  thread: StoredMsg[];          // every child/tutor message incl. input_kind (for the nản rule)
  statement: string | null;     // first child message (the typed problem)
  usedStrong: boolean;          // a tutor call of this problem already ran on the strong model
  lastTutorFlags: string[];     // flags of the last tutor answer (from model_calls.raw_output)
  pending: PendingMessage | null;
}
export interface ModelCallRecord {
  purpose: "tutor" | "guard"; model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number };
  routeReason: RouteReason | null; guardResult: "pass" | "rewritten" | "blocked" | null; guardReasons: string[];
  /** true for the call whose text the child sees (gets message_id) */ shown: boolean;
}
export interface SaveReplyInput {
  actor: ChildActor; problem: ProblemRow; childMessageId: string; turn: number;
  status: ProblemStatus; statementConfirmed: boolean; hintLevel: HintLevel; hintLevelMax: HintLevel;
  nanJumps: number; wrongCount: number; offtopicCount: number; uLevel: 0 | 1 | 2 | 3;
  tutorText: string; buttons: string[]; calls: ModelCallRecord[]; promptVersion: string; now: Date;
}
export interface MonthUsage { costUsd: number; mode: "normal" | "economy" }
// TutorRepo — changed / new methods:
insertChildMessage(a: { actor: ChildActor; problemId: string; clientMsgId: string; text: string; inputKind: InputKind; now: Date }): Promise<{ messageId: string } | { conflict: true }>;
monthUsage(familyId: string, now: Date): Promise<MonthUsage>;
pauseStrong(familyId: string, now: Date): Promise<void>;   // usage_monthly.model_mode = 'economy'
saveForLater(a: { actor: ChildActor; problemId: string; clientMsgId: string; now: Date }): Promise<"saved" | "already" | "not_open">;
saveReply(a: SaveReplyInput): Promise<StoredReply | { conflict: true }>;
```
- [ ] **Step 1:** `memoryRepo` thực hiện đủ giao diện mới: lưu `inputKind`; `getProblemForChild` dựng `thread`, `statement` (= tin con đầu), `usedStrong` (= có call `purpose tutor` với `model` = `"claude-opus-5-5"`; memoryRepo nhận `strongModel` qua tham số, mặc định chuỗi đó), `lastTutorFlags` (parse `raw` của call `shown` cuối, lấy `.flags`, lỗi → `[]`); `monthUsage` đọc `usage` + `modes` (Map); `pauseStrong` đặt mode; `saveForLater`: bài không phải `in_progress` → `"not_open"`, `clientMsgId` đã có → `"already"`, còn lại chèn tin con (`inputKind: "button"`, chữ `BTN_SAVE`) và đặt `saved_for_later` → `"saved"`. `saveReply`: cộng chi phí **mọi** call, rồi khóa lạc quan theo `turnCount` như G1, rồi lưu tin cô + toàn bộ trạng thái mới + `calls` (`modelCalls` lưu thêm `routeReason`, `guardResult`, `purpose`).
- [ ] **Step 2:** `supabaseRepo` tương ứng:
  - `getProblemForChild`: select thêm `hint_level_max, nan_jumps, offtopic_count`; tin nhắn thêm `input_kind` → `thread`.
  - `usedStrong`: `select count from model_calls where problem_id = $1 and purpose = 'tutor' and model = $strong`, dùng `{ count: "exact", head: true }`.
  - `lastTutorFlags`: `model_calls` purpose tutor, `message_id is not null`, order `created_at desc` limit 1, parse `raw_output`.
  - `insertChildMessage` ghi `input_kind`.
  - `monthUsage`: đọc `usage_monthly` tháng UTC (`cost_usd`, `model_mode`), không có dòng → `{0, "normal"}`.
  - `pauseStrong`: upsert `model_mode = 'economy'`.
  - `saveForLater`: update `problems set status='saved_for_later', closed_at` where `id`, `child_id`, `status='in_progress'` + insert tin con.
  - `saveReply`: `addUsage` tổng các call trước; update problems có `.eq("turn_count", old)` + các cột mới (`hint_level`, `hint_level_max`, `nan_jumps`, `wrong_count`, `offtopic_count`, `u_level`); insert tin cô (`hint_level`); insert từng call với `route_reason`, `guard_result`, `guard_reasons`, `message_id` = tin cô cho call `shown`.

  `supabaseRepo(db, strongModel)` nhận tên model mạnh để đếm `usedStrong`.
- [ ] **Step 3:** `npx vitest run tests/handlers.test.ts` (test G1 cũ) sửa chỗ gọi `saveReply`/`insertChildMessage` theo chữ ký mới cho tới khi xanh; `npm run typecheck`. **Step 4:** commit `feat(repo): G2 problem state, events, usage, save for later`.

### Task 8: Đường một lượt mới + "Để dành hỏi thầy"

**Files:** Modify `lib/tutor/handlers.ts`, `lib/tutor/deps.ts`, `tests/handlers.test.ts`. Create `app/api/problem/save/route.ts`.

**Interfaces:**
- Consumes: Task 2–7 (`childEvents`, `isNanSignal`, `applyPreTurn`, `nextHintLevel`, `pickModel`, `rewriteRoute`, `strongPaused`, `decideOutcome`, `runGuard`, `safeLine`, `TutorRepo` mới).
- Produces: `Deps` thêm `models: { main: string; strong: string; light: string }`; body `/api/turn` thêm `kind: "text" | "button" | "submit"` (mặc định `"text"`); `saveForLater(d, body: { problemId, clientMsgId })` → 200 `{ status: "saved_for_later" }` | 404 | 409 `{ error: "problem_closed" }`.

Thuật toán trong `runClaimed` (thay đoạn gọi model của G1):
```ts
const events = childEvents([...problem.thread, { id: messageId, role: "child", content: text, inputKind: kind }]);
const nan = isNanSignal(events);
const pre = applyPreTurn({ hintLevel: problem.hintLevel, hintLevelMax: problem.hintLevelMax, nanJumps: problem.nanJumps, afterSibling: false }, { nan });
const usage = await d.repo.monthUsage(actor.familyId, d.now);
let paused = strongPaused(usage);
if (paused && usage.mode === "normal") await d.repo.pauseStrong(actor.familyId, d.now); // TODO(G7): notify parents (D23)
const route = pickModel({ grade: actor.grade, hintLevel: pre.state.hintLevel, nan, prevTutorUnsure: problem.lastTutorFlags.includes("tutor_unsure"),
  problemUsedStrong: problem.usedStrong, strongPaused: paused });
const submitted = kind === "submit";
const prompt = assemble({ …, state: { …, hintLevel: pre.state.hintLevel, nan, submitted, maxLines: actor.maxLines, turn } });
const calls: ModelCallRecord[] = [];
// 1st answer
const first = await call(route.tier, prompt.messages)            // throws → release claim, 503 (as G1)
calls.push(rec("tutor", first, route.reason));
let shown = first.output; let guardResult: "pass" | "rewritten" | "blocked" = "pass";
const g1 = shown ? await runGuard(d.client, d.models.light, d.layers.guard, gInput(shown)) : null;
if (g1) calls.push(guardRec(g1));
if (!g1?.pass) {
  const rw = rewriteRoute(paused);
  const retryMsgs = [...prompt.messages, { role: "assistant", content: first.raw },
    { role: "user", content: `[BỘ KIỂM TRA CỦA APP] Câu trả lời vừa rồi chưa gửi được cho em vì: ${(g1?.reasons ?? ["không đọc được JSON"]).join("; ")}. Cô viết lại lượt này, giữ đúng luật cứng.` }];
  const second = await callOrNull(rw.tier, retryMsgs);            // error → null
  if (second) calls.push(rec("tutor", second, rw.reason));
  const g2 = second?.output ? await runGuard(…second.output) : null;
  if (g2) calls.push(guardRec(g2));
  if (second?.output && g2?.pass) { shown = second.output; guardResult = "rewritten"; }
  else { shown = null; guardResult = "blocked"; }
}
// mark: the call whose text is shown gets shown=true + guardResult; a blocked turn shows safeLine(pre.state.hintLevel)
const verdict = shown?.danh_gia_luot_em ?? "khong_ap_dung";
const next = nextHintLevel(pre.state, verdict);
const outcome = decideOutcome({ turn, output: shown, submitted, offtopicCount: problem.offtopicCount });
const safe = safeLine(pre.state.hintLevel);
saveReply({ …, status: outcome.status, hintLevel: next.hintLevel, hintLevelMax: next.hintLevelMax, nanJumps: next.nanJumps,
  wrongCount: problem.wrongCount + (verdict === "sai" ? 1 : 0), offtopicCount: outcome.offtopicCount,
  uLevel: shown ? Number(shown.u_level_hien_tai.slice(1)) as 0|1|2|3 : 0,
  tutorText: shown?.message ?? safe.message, buttons: shown?.buttons ?? safe.buttons, calls, … });
```
Chú ý: `nextHintLevel` chạy trên `pre.state` (đã có nhảy H4 do nản), đúng thứ tự DESIGN §4 bước 5 → 9.

- [ ] **Step 1: failing tests** (thêm vào `tests/handlers.test.ts`; client giả phân biệt lời gọi kiểm tra bằng `system` chứa "bộ kiểm tra"):
```ts
// helper: scripted client — tutor replies and guard verdicts in order; records models used
function scripted(tutor: string[], guard: boolean[]) {
  const models: string[] = []; let ti = 0, gi = 0;
  return { models, async create(req: object) {
    const r = req as { model: string; system?: unknown };
    models.push(r.model);
    const isGuard = typeof r.system === "string";
    const text = isGuard ? JSON.stringify({ pass: guard[gi++] ?? true, ly_do: ["1: lộ đáp số"] }) : tutor[Math.min(ti++, tutor.length - 1)]!;
    return { content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 10 } };
  } };
}
const MODELS = { main: "claude-sonnet-5-5", strong: "claude-opus-5-5", light: "claude-haiku-5-5" };

it("§4.14 a: normal turn → Sonnet answers, Haiku checks, child sees Sonnet", async () => {
  const c = scripted([confirmed], [true]);
  const { d, repo } = deps(inProgress, c);
  const r = await handleTurn({ ...d, client: c, models: MODELS }, body());
  expect(r.status).toBe(200);
  expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5"]);
  expect(repo.modelCalls.map((m) => [m.purpose, m.routeReason, m.guardResult])).toEqual([["tutor", null, "pass"], ["guard", null, null]]);
});
it("§4.14 d: blocked → rewritten on Opus; the child sees Opus' answer; next turn stays on Opus", async () => {
  const c = scripted([confirm, confirmed, confirmed], [false, true, true]);
  const { d, repo } = deps(inProgress, c);
  const r = await handleTurn({ ...d, client: c, models: MODELS }, body(1));
  expect(c.models).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5", "claude-haiku-5-5"]);
  expect((r.json as { message: string }).message).toBe(JSON.parse(confirmed).message);
  expect(repo.modelCalls.filter((m) => m.purpose === "tutor").map((m) => m.routeReason)).toEqual([null, "guard_blocked"]);
  await handleTurn({ ...d, client: c, models: MODELS }, body(2));
  expect(c.models.at(-2)).toBe("claude-opus-5-5"); // sticky
});
it("§5: blocked twice → safe line for the hint level, guard_result blocked", async () => {
  const c = scripted([confirmed], [false, false]);
  const { d, repo } = deps({ problems: [{ id: "p1", childId: "c1", hintLevel: 2 }] }, c);
  const r = await handleTurn({ ...d, client: c, models: MODELS }, body());
  expect((r.json as { message: string }).message).toBe(safeLine(2).message);
  expect(repo.modelCalls.some((m) => m.guardResult === "blocked")).toBe(true);
});
it("§4.1 c + §4.14 e: 'k' then 'ko biết' → H4 jump, nan_jumps+1, answered on Opus (nan)", async () => {
  const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "tutor", text: "?" }, { problemId: "p1", role: "child", text: "k" }, { problemId: "p1", role: "tutor", text: "?" }] };
  const c = scripted([confirmed], [true]);
  const { d, repo } = deps(seed, c);
  await handleTurn({ ...d, client: c, models: MODELS }, body(1, "ko biết"));
  expect(c.models[0]).toBe("claude-opus-5-5");
  expect([repo.problems[0]?.hintLevel, repo.problems[0]?.nanJumps]).toEqual([4, 1]);
});
it("§4.1 a: H0 and the tutor marks the answer wrong → H1, wrong_count 1", async () => {
  const wrong = JSON.stringify({ ...JSON.parse(confirmed), danh_gia_luot_em: "sai" });
  const c = scripted([wrong], [true]);
  const { d, repo } = deps(inProgress, c);
  await handleTurn({ ...d, client: c, models: MODELS }, body(1, "x = 5"));
  expect([repo.problems[0]?.hintLevel, repo.problems[0]?.wrongCount]).toEqual([1, 1]);
});
it("4.12 b: tutor says self_solved on a submitted answer → still in_progress (no math_check in G2)", async () => {
  const solved = JSON.stringify({ ...JSON.parse(confirmed), ket_qua_bai: "self_solved" });
  const c = scripted([solved], [true]);
  const { d, repo } = deps(inProgress, c);
  await handleTurn({ ...d, client: c, models: MODELS }, { ...body(1, "x = 24, y = 48"), kind: "submit" });
  expect(repo.problems[0]?.status).toBe("in_progress");
});
it("D29: at 45 USD the month pauses Opus; a nản turn stays on Sonnet with reason opus_paused", async () => {
  const seed: Seed = { ...inProgress, messages: [{ problemId: "p1", role: "tutor", text: "?" }, { problemId: "p1", role: "child", text: "k" }, { problemId: "p1", role: "tutor", text: "?" }] };
  const c = scripted([confirmed], [true]);
  const { d, repo } = deps(seed, c);
  repo.usage.set("f1|2026-11-01", 45.2);
  await handleTurn({ ...d, client: c, models: MODELS }, body(1, "ko"));
  expect(c.models[0]).toBe("claude-sonnet-5-5");
  expect(repo.modelCalls[0]?.routeReason).toBe("opus_paused");
  expect(repo.modes.get("f1|2026-11-01")).toBe("economy");
});
it("saveForLater: closes the problem as saved_for_later; a resend is fine; a closed problem is refused", async () => {
  const { d, repo } = deps(inProgress);
  expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(7) })).json).toEqual({ status: "saved_for_later" });
  expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(7) })).status).toBe(200);
  expect((await saveForLater(d, { problemId: "p1", clientMsgId: uuid(8) })).status).toBe(409);
  expect(repo.problems[0]?.status).toBe("saved_for_later");
});
```
- [ ] **Step 2:** FAIL. **Step 3:** code theo thuật toán trên. Viết `call()`/`callOrNull()` là hàm nội bộ dùng `runTutorTurn` với `model = d.models[tier]`. `rec()` dựng `ModelCallRecord` (`shown` gán sau khi biết câu nào được hiện), `guardRec()` cho `purpose: "guard"`. Hàm `saveForLater` + route `app/api/problem/save/route.ts` (giống `turn/route.ts`, `maxDuration` mặc định). `deps.ts`: `models` lấy từ env; `client = fakeAllowed(process.env) ? fakeClient() : realClient(key)`; `supabaseRepo(undefined, env.TUTOR_MODEL_STRONG)`.
- [ ] **Step 4:** PASS toàn bộ `npx vitest run`; `npm run typecheck && npm run lint`. **Step 5:** commit `feat(tutor): G2 turn pipeline — hints, nản, model routing, checker, outcome, save for later`.

### Task 9: Giao diện: nút cố định + nộp bài

**Files:** Modify `app/hoi/[problemId]/chat.tsx`, `lib/client/post.ts` (không đổi chữ ký).

- Hàng nút cố định (luôn hiện khi bài đang mở, dưới nút của cô):
  - `Chưa hiểu`: gửi `kind: "button"`, chữ `BTN_NOT_UNDERSTOOD`.
  - `Để dành hỏi thầy`: gọi `/api/problem/save`, có hộp xác nhận nhẹ trong trang, không dùng `window.confirm`.
- Nút của cô gửi `kind: "button"`.
- Ô trả lời có công tắc **"Đây là bài làm cuối của em (nộp bài)"** (checkbox ≥ 44px). Bật thì gửi `kind: "submit"` rồi tự tắt sau khi gửi.
- Khi `status` trả về là `saved_for_later`, hiện "Đã để dành bài này cho thầy xem" kèm nút "Hỏi bài khác".
- Khi là `pending_review`, hiện "Bài chứng minh đã gửi để thầy xem".
- [ ] **Step 1:** `npm run build && npm run lint` xanh; chạy local với `TUTOR_FAKE_MODEL=1` (không có `VERCEL`) + Supabase thật của bạn không có → bỏ qua; kiểm thật ở PR C (e2e) và trên preview. **Step 2:** commit `feat(ui): Chưa hiểu, Để dành hỏi thầy, nộp bài`.

### Task 10: Bộ chấm phụ G0 + PR B

**Files:** Modify `eval/run.ts` (lời dặn bộ chấm), `eval/cases.ts` (6.4 `forbid` thêm `"nữ 3"`, `"nam 2"`), `docs/PROGRESS.md`, `docs/DESIGN.md` §4 bước 7, 8, 11 (Sonnet/Opus theo §4.14; bỏ "Haiku nếu economy"; economy = tạm ngừng Opus).
- [ ] **Step 1:** trong prompt bộ chấm phụ thêm: "KHÔNG tính là lộ: số liệu có sẵn trong đề; tên phương pháp; lựa chọn cho bước nhỏ đang hỏi (không phải đáp số cuối)." `npx vitest run` xanh.
- [ ] **Step 2:** commit `fix(eval): judge ignores given data, method names and small-step options`; push; PR B (tiếng Việt):
  - làm gì;
  - **cần merge PR A (SQL 0018) trước**;
  - thêm biến Vercel `TUTOR_MODEL_STRONG=claude-opus-5-5` (không bắt buộc: có mặc định);
  - cách thử trên link chính thức sau merge: con gõ "k" rồi "ko biết" → cô chuyển cách giảng, Supabase `model_calls` có `route_reason = nan`, model Opus; bấm "Để dành hỏi thầy" → bài đóng;
  - chạy lại G0 (Sonnet + Opus) để kiểm prompt không đổi hành vi;
  - tiêu chí đạt.

---

## PR C — e2e (nhánh `feature/g2-e2e`, sau khi PR B merge)

### Task 11: Playwright trên Supabase local của Launcher

**Files:** Create `playwright.config.ts`, `e2e/seed.ts`, `e2e/session.ts`, `e2e/tutor.spec.ts`. Modify `package.json` (dev `@playwright/test`, script `"e2e": "playwright test"`), `.github/workflows/ci.yml` (job `e2e`), `docs/PROGRESS.md`.

**Interfaces:**
- `seed(): Promise<{ parent: Creds; child: Creds; childId: string }>`: dùng service role tạo 2 user auth, 1 `families`, 2 `profiles` (cha mẹ; con `grade 9`, tên giả "Con thử"), 1 `tutor.teaching_profiles` (`HS-9A`, hồ sơ giả 3 dòng, `is_current = true`).
- `sessionCookies(creds): Promise<{ name: string; value: string }[]>`: `createServerClient` của `@supabase/ssr` với kho cookie trong bộ nhớ → `signInWithPassword` → trả các cookie đã `setAll` (để `context.addCookies` với `domain: "localhost", path: "/"`).

- [ ] **Step 1: tests** (`e2e/tutor.spec.ts`):
  1. Chưa đăng nhập → `/gia-su` có link "Đăng nhập".
  2. Con: `/gia-su` → bấm "Không biết bắt đầu" → gõ đề → "Gửi" → thấy câu xác nhận đề (fixture mẫu 1: chứa "Em kiểm tra giúp cô đúng chưa?").
  3. Bấm "Chưa hiểu" 3 lần → trong DB (service role) `model_calls` của bài có dòng `route_reason = 'nan'` với `model = 'claude-opus-5-5'`.
  4. Bấm "Để dành hỏi thầy" → xác nhận → thấy "Đã để dành"; `problems.status = 'saved_for_later'`.
  5. Cha mẹ: `/gia-su/bo-me` thấy khung "Con thử · lớp 9", trạng thái "Đang bật · phiên bản 1".
- [ ] **Step 2:** `playwright.config.ts`: `webServer.command = "npm run start -- -p 3200"`, `url = http://localhost:3200/gia-su`, `workers: 1`, env `TUTOR_FAKE_MODEL=1`.
- [ ] **Step 3:** CI job `e2e`:
  - `actions/checkout` thêm repo `haleytruong89-moon/study-launcher` vào `./.launcher` (public, chỉ đọc).
  - `supabase/setup-cli@v1` (2.120.0).
  - `cd .launcher && supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor,realtime`.
  - Export `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` từ `supabase status -o env`, cùng `ANTHROPIC_API_KEY=fake`, `TUTOR_FAKE_MODEL=1`.
  - `npm run build` → `npx playwright install --with-deps chromium` → `npm run e2e`.
  - Lỗi thì ghi annotation từ log, giống CI của Launcher.

  Schema `tutor` phải được mở cho Data API ở stack local: thêm cấu hình `api.schemas` bằng cách sửa `.launcher/supabase/config.toml` trong job (`sed` thêm `"tutor"` vào `schemas`), vì repo Launcher bật ở Dashboard chứ không ở config. Nếu Launcher đã có `tutor` trong config thì bước này không đổi gì.
- [ ] **Step 4:** chạy CI trên PR → xanh; ghi PROGRESS (trả nợ cổng e2e). Commit `test(e2e): main tutor flow on a local Supabase with a fake model`; PR C (tiếng Việt, không SQL).

---

## Tự soát

**Phủ spec:**
- §4.1 a, c, e: Task 8 + `hints.ts` có sẵn. §4.1 b, d: `tests/rules.test.ts` có sẵn.
- §4.2 a, c, e + "Chưa hiểu ×3": Task 2.
- §4.4 a (bị chặn đúng luật §4.12 b), e, h: Task 4, 8. §4.4 d (để dành): Task 8. §4.4 b, c: G7/G8 (buổi), ngoài phạm vi.
- §4.14 a–g, j: Task 3, 8. §4.14 h, i: Task 3 (cờ có sẵn; dữ liệu từ G5).
- §5 "bộ kiểm tra chặn": Task 5, 8. §5 lạc đề ×3: Task 4.
- D29 tạm ngừng Opus: Task 3, 8. Nợ e2e: Task 11. Chỉnh bộ chấm phụ: Task 10. `max_lines`: Task 6. SQL: Task 1.

**Tên nhất quán:** `childEvents`, `StoredMsg`, `InputKind`, `pickModel`, `rewriteRoute`, `strongPaused`, `STRONG_PAUSE_AT_USD`, `decideOutcome`, `MAX_TURNS`, `runGuard`, `GuardInput`, `GuardResult`, `safeLine`, `BTN_NOT_UNDERSTOOD`, `BTN_SAVE`, `ModelCallRecord`, `MonthUsage`, `saveForLater`, `fakeClient`, `fakeAllowed`, `Deps.models`, `TutorRepo.monthUsage` / `pauseStrong` / `saveForLater`.

**Quyết định do tôi suy ra, ghi trong PR để phụ huynh biết:**

| Quyết định | Lý do |
|---|---|
| Bộ kiểm tra **fail-closed**: Haiku lỗi thì coi như chưa qua, cô viết lại; vẫn lỗi thì gửi câu an toàn | Ưu tiên không lộ đáp số hơn trả lời nhanh |
| Con được bấm "Để dành hỏi thầy" **bất cứ lúc nào**, không chỉ ở H5 | §4.3 e đã tính tới "bỏ dở sớm" (U0) |
| "Chưa hiểu ×3" = 3 lần bấm liền nhau trên cùng một chuỗi giảng lại | Diễn giải câu "cùng `message_id` gốc hoặc các lượt giảng lại" của §4.2 |
