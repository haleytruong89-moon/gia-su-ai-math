# G6 — Thẻ "Hiểu bản chất", thẻ "Đọc đề", ôn đầu buổi, báo thẻ còn thiếu — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi con chưa hiểu một kiến thức hoặc chưa hiểu đề, cô hiện **thẻ giảng đã được bố mẹ duyệt** (2 cách giảng mỗi thẻ). Đầu mỗi buổi con ôn tối đa 2 câu theo lịch 1 → 3 → 7 ngày. Báo cáo tối liệt kê **thẻ còn thiếu** để bố mẹ nhờ soạn thêm.

**Architecture:** Thiết kế C (phụ huynh chốt 21/11):
- **Cách giảng** và **mục lục thẻ** nằm trong prompt cố định (có cache, dùng chung cho cả 2 con).
- **Nội dung thẻ** nằm ở `knowledge/src/cards/*.md`. Bố mẹ duyệt bằng merge. File được đóng gói thành `knowledge/cards.json`, và mọi phép tính trong thẻ được SymPy kiểm ở CI.
- Model chỉ ghi mã thẻ vào trường `the_hien`. Máy chủ chọn cách giảng không trùng số với bài của con, rồi app hiện **nguyên văn** thẻ.
- "Em không hiểu đề" và "Giảng lại cách khác" là lượt **soạn sẵn**: máy chủ trả lời, không gọi AI.
- Câu ôn đi kèm từng thẻ (đã duyệt cùng thẻ). Lịch ôn dùng `lib/rules/review.ts` đã có.

**Tech Stack:** Next.js 16 (basePath `/gia-su`) · React 19 · TypeScript strict · zod 4 · Vitest · Playwright · Python 3.12 + SymPy (kiểm thẻ, trong job `cas`) · Supabase schema `tutor` (SQL ở repo `study-launcher`).

**Spec:** `docs/DOMAIN.md` §4.11 (a–f), §4.13, §3.6 · `docs/SPEC.md` US15 · `docs/DESIGN.md` §9 hàng G6 · quyết định chat 21/11 (thiết kế C, 2 cách/thẻ, HK1 trước, giảng thẳng không hỏi đáp, mẹo luôn kèm "vì sao", kỹ năng đọc đề, cơ chế báo thiếu thẻ) · mẫu đã soạn: hub `deliverables/gia-su-ai/THE_HIEU_BAN_CHAT_dot0_mau_2026-11-21.md`, `THE_DOC_DE_dot0_mau_2026-11-21.md`.

## Quyết định đã chốt (21/11)

| # | Chốt |
|---|---|
| D26 | Ôn đầu buổi: tối đa **2 câu**, lịch **1 → 3 → 7 ngày**, đúng 3 lần liền thì thôi (§4.11 a–f, từ *Đề xuất* thành ✅) |
| C1 | Thiết kế C: cách giảng ở prompt; nội dung ở thẻ đã duyệt; app hiện nguyên văn thẻ |
| C2 | Mỗi thẻ **2 cách giảng** đã duyệt; hết 2 cách thì đề nghị để dành hỏi thầy |
| C3 | Thẻ "Hiểu bản chất": **giảng thẳng, không hỏi đáp**. Thứ tự: ví dụ → vì sao → quy tắc → mẹo (kèm "Vì:") → dấu hiệu trong đề |
| C4 | Thẻ "Đọc đề": 5 bước kể lại → hỏi gì → thử tay → dịch từ khóa → kiểm tra hợp lý. Đợt đầu: D6.1 (ƯCLN), D6.2 (BCNN), D9.1 (làm chung) |
| C5 | Báo thiếu thẻ: cùng một chỗ thiếu **≥ 2 lần trong 7 ngày** → mục "Thẻ cần bổ sung" trong báo cáo tối, nút "Sao chép yêu cầu"; **không** gửi thông báo đẩy (D23) |
| C6 | Soạn **HK1 cả 2 lớp trước** (khoảng 40 bài + nền liên quan), duyệt theo đợt khoảng 10 bài |

## Điểm cần phụ huynh xác nhận (đề xuất mặc định)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Y1 | Hiện thẻ có tính là gợi ý không? | Có: hiện thẻ = mức **H2** (nhắc kiến thức). Máy chủ nâng `hint_level_max` lên ít nhất 2 |
| Y2 | Câu ôn sinh ra khi nào? | Khi con bấm **"Em hiểu rồi"** dưới một thẻ → câu ôn của thẻ đó vào hàng ôn, bật luôn (nội dung đã duyệt cùng thẻ), hạn ngày mai. Đề xuất câu ôn từ chẩn đoán (§4.11 dòng cuối) **để v1.1** |
| Y3 | Nút "Em không hiểu đề" và 4 nút chẩn đoán | Lượt soạn sẵn, không gọi AI, **không tính** vào 20 lượt/bài |
| Y4 | Câu ôn "nhận diện dạng" | **Không** bấm giờ thật (tránh áp lực). Ghi "Chỉ chọn dạng, không cần giải" |
| Y5 | Câu ôn hiện ở đâu? | Đầu trang "Em kẹt bài nào?", trước ô hỏi bài. Có nút "Để sau" |

Khi phụ huynh chưa trả lời: code theo đề xuất, đánh dấu `TODO(rule-unconfirmed)` và ghi trong PR.

## Global Constraints

- Repo `gia-su-ai-math` **PUBLIC**: không họ tên thật, trường, lớp cụ thể, điểm số, ảnh thật, nhận xét của thầy cô, email, URL/khóa thật. Thẻ chỉ chứa kiến thức Toán chung, dữ liệu giả.
- Không log nội dung tin nhắn/ảnh của con. Không đưa khóa ra trình duyệt.
- `child_id` chỉ lấy từ phiên; kiểm `problem_id` / `review_item_id` thuộc con đó.
- Mọi ghi qua route máy chủ (service role). Không tạo migration trong repo này; SQL ở `study-launcher`, additive, idempotent, `grant` + RLS cùng file, test trong `supabase/tests/`.
- **Không sửa tay** `knowledge/*.json`: sinh bằng `npm run knowledge` / `npm run cards`.
- Thẻ: mọi phép tính trong dòng `kiểm:` phải đúng (SymPy, CI). Ví dụ trong thẻ **khác số** với bài con đang làm (máy chủ kiểm).
- Không lộ lời giải bài gốc (luật 1). Thẻ là bài **khác**, được giải trọn.
- Structured output: schema mới qua `tests/apiSchemas.test.ts`.
- Chữ giao diện tiếng Việt có dấu; nút ≥ 44px; code/comment/commit tiếng Anh.
- Đụng prompt → `PROMPT_VERSION` +1, chạy ca eval mới (hỏi phụ huynh trước, < 0,2 USD).
- Mỗi PR cập nhật `docs/ROADMAP.json` + `docs/PROGRESS.md`. Không merge.

---

## Thứ tự PR

| PR | Repo | Nhánh | Nội dung | SQL |
|---|---|---|---|---|
| **L-7** | study-launcher | `feature/gs8-tutor-cards` | `messages.card_ref`; `review_items` thêm loại câu `why`/`recognize`, nguồn `card`, cột `card_code`, `item_key` | `0024_tutor_g6.sql` |
| **G6a** | gia-su | `feature/g6a-teaching-cards` | Định dạng thẻ + đóng gói + kiểm SymPy; 6 + 6 thẻ đợt 0 (đã duyệt); `the_hien`/`the_thieu`; hiện thẻ; lượt soạn sẵn; prompt v0.7; eval | Không (cần L-7) |
| **G6b** | gia-su | `feature/g6b-start-review` | Câu ôn từ thẻ; ôn đầu buổi; mở lại câu ôn khi sai bài thật; báo cáo: kết quả ôn + "Thẻ cần bổ sung" | Không (cần L-7) |
| **G6c…** | gia-su | `feature/g6c-cards-hk1-dotN` | Nội dung thẻ HK1, mỗi đợt khoảng 10 bài (merge = duyệt) | Không |

## File Structure

**study-launcher (L-7)**
- Create `supabase/migrations/0024_tutor_g6.sql`; Modify `supabase/tests/rls_tutor_test.sql`.

**gia-su-ai-math**
- `knowledge/src/cards/<CODE>.md`: nguồn thẻ (một file một mã: `T6.11.md`, `D6.1.md`…).
- `scripts/knowledge/cards.ts`: parse md → `knowledge/cards.json` (+ `--check`).
- `lib/knowledge/cardSchema.ts`: zod schema của thẻ (dùng chung build + app).
- `lib/knowledge/cards.ts`: `card()`, `cardIndexText()`, `pickVariant()`.
- `lib/markdown/cardBlocks.ts`: md của thẻ → khối hiển thị (đoạn, danh sách, bảng).
- `cas/tests/test_cards.py`: chạy mọi dòng `kiểm:` bằng SymPy.
- `lib/tutor/scripted.ts`: quyết định lượt soạn sẵn (hiểu đề, cách khác, hết cách).
- `prompts/method.md` (mục "Giảng lý thuyết & đọc đề") + `prompts/PROMPT_VERSION` v0.7.
- `lib/tutor/schema.ts`: thêm `the_hien`, `the_thieu`.
- `lib/tutor/handlers.ts`, `lib/tutor/repo.ts`, `lib/db/supabaseRepo.ts`, `tests/helpers/memoryRepo.ts`.
- `app/hoi/[problemId]/card-view.tsx` + `chat.tsx`: hiện thẻ, nút "Em không hiểu đề".
- `lib/rules/review.ts` (thêm `gradeExact`, `reviewItemsFromCard`); `app/review-block.tsx`; `app/api/review/answer/route.ts`.
- `lib/report/cardGaps.ts` + mục báo cáo.

---

# Phần L — Launcher PR L-7

### Task L1: SQL 0024 + test

**Files:** Create `supabase/migrations/0024_tutor_g6.sql`; Modify `supabase/tests/rls_tutor_test.sql`.

**Interfaces:**
- Produces: `tutor.messages.card_ref text` (dạng `T6.12#1`, null nếu không có thẻ); `tutor.review_items.kind` nhận thêm `why`, `recognize`; `source` nhận thêm `card`; cột `card_code text`, `item_key text`; unique `(child_id, card_code, item_key)` khi `deleted_at is null and card_code is not null`; con đọc được `card_code`, `item_key` (không đọc `answer`).

- [ ] **Step 1: Test** (cuối file, trước `TUTOR RLS OK`, theo kiểu khối `do $$` của 0023):

```sql
-- G6 (0024): card reference on messages; review items from teaching cards.
do $$
begin
  update tutor.messages set card_ref = 'T6.12#1' where id = (select id from tutor.messages limit 1);
  insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, buttons, due_date_vn, source, card_code, item_key)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'T6.12', 'why',
          'Vì sao BCNN lấy mũ cao nhất?', 'b', 'exact', '["a","b","c"]', current_date, 'card', 'T6.12', 'why1');
  begin
    insert into tutor.review_items (family_id, child_id, ku_code, kind, prompt, answer, answer_check, due_date_vn, source, card_code, item_key)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'T6.12', 'recognize',
            'x', 'y', 'exact', current_date, 'card', 'T6.12', 'why1');
    raise exception 'FAIL: duplicate card item accepted';
  exception when unique_violation then null;
  end;
  raise notice 'ok: G6 card_ref, review kinds, card items unique';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
begin
  perform card_code, item_key from tutor.review_items limit 1;
  begin
    perform answer from tutor.review_items limit 1;
    raise exception 'FAIL: child reads review answer';
  exception when insufficient_privilege then raise notice 'ok: G6: child cannot read review answers';
  end;
end $$;
reset role;
```

- [ ] **Step 2:** `bash scripts/test-db.sh` → FAIL (thiếu cột).
- [ ] **Step 3: Migration**

```sql
-- 0024 G6 of the maths tutor (gia-su-ai-math plan docs/superpowers/plans/2026-11-21-g6-cards-and-review.md).
-- ADDITIVE and idempotent. Two CHECK constraints are re-created wider; no data is dropped.
-- 1. messages.card_ref: the approved teaching card shown with a tutor message ("T6.12#1" = card T6.12, way 1).
-- 2. review_items: review questions come from approved cards (kind why / recognize, source card),
--    one item per (child, card, item key).

alter table tutor.messages add column if not exists card_ref text;
alter table tutor.messages drop constraint if exists messages_card_ref_format;
alter table tutor.messages add constraint messages_card_ref_format
  check (card_ref is null or card_ref ~ '^(T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2}#[12]$');

alter table tutor.review_items drop constraint if exists review_items_kind_check;
alter table tutor.review_items add constraint review_items_kind_check
  check (kind in ('formula', 'mini_problem', 'why', 'recognize'));
alter table tutor.review_items drop constraint if exists review_items_source_check;
alter table tutor.review_items add constraint review_items_source_check
  check (source in ('seed', 'diagnosis', 'parent', 'card'));
alter table tutor.review_items add column if not exists card_code text;
alter table tutor.review_items add column if not exists item_key text;
create unique index if not exists review_items_card_uidx on tutor.review_items (child_id, card_code, item_key)
  where deleted_at is null and card_code is not null;

-- Browsers keep reading every column except `answer` (0017 grant is per column).
grant select (card_code, item_key) on tutor.review_items to authenticated;
```

Trước khi viết: kiểm tên constraint inline của 0017 (`review_items_kind_check`, `review_items_source_check`) bằng `\d tutor.review_items` trong DB tạm của `scripts/test-db.sh`.

- [ ] **Step 4:** `bash scripts/test-db.sh` xanh → commit `feat(tutor): 0024 G6 card reference and card review items`.

### Task L2: PR L-7
- [ ] `npm run typecheck && npm run lint && npm test && bash scripts/test-db.sh` xanh. PROGRESS: dòng L-7. PR (tiếng Việt). **Có đụng database: có**: `0024_tutor_g6.sql` thêm cột `card_ref` cho `messages` và 2 cột cho `review_items`; nới 2 danh sách giá trị; không xóa dữ liệu. Con không thấy gì mới.

---

# Phần A — G6a Thẻ giảng

### Task A1: Định dạng nguồn thẻ + đóng gói `cards.json`

**Files:** Create `lib/knowledge/cardSchema.ts`, `scripts/knowledge/cards.ts`, `knowledge/src/cards/T6.11.md` (chuyển từ bản đợt 0 đã duyệt), `tests/cards.test.ts`; Modify `package.json` (scripts `cards`, `cards:check`), `.github/workflows/ci.yml` (job `node` chạy `npm run cards:check`).

**Interfaces:**
- Produces:
```ts
// lib/knowledge/cardSchema.ts
export const CARD_CODE = /^(T6|T9|N7|N8|TH|D6|D9)\.[0-9]{1,2}$/;
export const Card = z.object({
  code: z.string().regex(CARD_CODE),
  grade: z.union([z.literal(6), z.literal(9)]),
  kind: z.enum(["ban_chat", "doc_de"]),
  ku: z.string(),            // the lesson the card belongs to (D6.1 → T6.11)
  title: z.string().min(3).max(80),
  variants: z.array(z.object({
    n: z.union([z.literal(1), z.literal(2)]),
    title: z.string().min(3).max(80),
    body: z.string().min(50).max(3000),   // markdown shown verbatim
    keyNumbers: z.array(z.string()).min(1), // "số:" line — compared with the child's problem
    checks: z.array(z.string()).min(1),     // "kiểm:" lines — SymPy, cas/tests/test_cards.py
  })).length(2),
  review: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_]{2,20}$/),
    kind: z.enum(["why", "recognize", "formula", "mini_problem"]),
    prompt: z.string().min(5).max(400),
    buttons: z.array(z.string().min(1).max(40)).max(4),
    answer: z.string().min(1).max(200),
    check: z.enum(["exact", "math_check"]),
  })).min(1).max(3),
});
export type Card = z.infer<typeof Card>;
export const CardBundle = z.object({ version: z.string(), cards: z.array(Card) });
// scripts/knowledge/cards.ts
export function parseCardMd(md: string): Card;               // throws with the file's line on error
export function buildCards(files: Record<string, string>): { version: string; cards: Card[] };
```

**Định dạng file nguồn** (một file một thẻ; nội dung lấy từ bản đợt 0 bố mẹ đã duyệt):

````md
---
code: T6.12
grade: 6
kind: ban_chat
ku: T6.12
title: Bội chung, BCNN
---

## Cách 1 — Chiếc hộp đựng vừa
số: 12, 18
kiểm: ilcm(12, 18) == 36
kiểm: 72 % 36 == 0

**Ví dụ.** Tìm số nhỏ nhất (khác 0) chia hết cho cả 12 và 18.
… (nguyên văn phần thân thẻ) …

## Cách 2 — Hai đèn nhấp nháy
số: 4, 6
kiểm: ilcm(4, 6) == 12

… (nguyên văn) …

## Câu ôn
- key: why1 · kind: why · check: exact
  prompt: Vì sao BCNN lấy mỗi thừa số với số mũ lớn nhất?
  buttons: Để chia hết cho mọi số đã cho | Để số nhỏ nhất | Vì quy tắc như vậy
  answer: Để chia hết cho mọi số đã cho
- key: rec1 · kind: recognize · check: exact
  prompt: "Hai xe buýt cứ 10 phút và 15 phút xuất bến một lần, cùng xuất bến lúc 6 giờ. Lần tiếp theo cùng xuất bến?" — Dùng kiến thức nào? (chỉ chọn dạng, không cần giải)
  buttons: ƯCLN | BCNN | Phân số
  answer: BCNN
````

- [ ] **Step 1: Test parse** (`tests/cards.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { buildCards, parseCardMd } from "@/scripts/knowledge/cards";
import { readFileSync } from "node:fs";

const md = readFileSync("knowledge/src/cards/T6.11.md", "utf8");

describe("parseCardMd", () => {
  it("reads header, two ways (body verbatim, key numbers, checks) and review questions", () => {
    const c = parseCardMd(md);
    expect(c).toMatchObject({ code: "T6.11", grade: 6, kind: "ban_chat", ku: "T6.11" });
    expect(c.variants.map((v) => [v.n, v.keyNumbers])).toEqual([[1, ["12", "18"]], [2, ["24", "36"]]]);
    expect(c.variants[0]!.body.startsWith("**Ví dụ.**")).toBe(true);
    expect(c.variants[0]!.body).not.toMatch(/^(số|kiểm):/m);
    expect(c.review.length).toBeGreaterThan(0);
    expect(c.review[0]!.buttons).toContain(c.review[0]!.answer);
  });
  it("an exact-check question whose answer is not a button is refused", () => {
    const bad = md.replace(/answer: .*/, "answer: không có trong nút");
    expect(() => parseCardMd(bad)).toThrow(/answer/);
  });
  it("one way only → refused (2 ways are required, C2)", () => {
    expect(() => parseCardMd(md.replace(/## Cách 2[\s\S]*?(?=## Câu ôn)/, ""))).toThrow();
  });
  it("buildCards: sorted by code, version = date + hash, duplicate code refused", () => {
    const b = buildCards({ "T6.11.md": md });
    expect(b.version).toMatch(/^\d{4}-\d{2}-\d{2}\.[0-9a-f]{8}$/);
    expect(() => buildCards({ "a.md": md, "b.md": md })).toThrow(/T6.11/);
  });
});
```

- [ ] **Step 2:** đỏ. **Step 3:** code `parseCardMd` (front-matter `---`; `## Cách n — title`; các dòng `số:` / `kiểm:` tách khỏi thân; `## Câu ôn` dạng danh sách như trên; validate bằng `Card.parse`; với `check: exact` phải có `answer ∈ buttons`; thân thẻ giữ nguyên văn, chỉ trim). `buildCards`: version = ngày VN + 8 ký tự sha256 của JSON; ghi `knowledge/cards.json` + dòng `cards` vào `knowledge/KNOWLEDGE_VERSION` (định dạng `knowledge=<v> cards=<v>`; sửa `lib/knowledge/load.ts` đọc phần của mình). `--check` so file trong repo với bản dựng lại.
- [ ] **Step 4:** chuyển 6 thẻ đợt 0 đã duyệt (T6.11, T6.12, T9.9, D6.1, D6.2, D9.1) sang định dạng này, kèm 2 câu ôn/thẻ (1 `why`, 1 `recognize` hoặc `mini_problem`). `npm run cards`. Test xanh.
- [ ] **Step 5:** commit `feat(cards): teaching card source format, bundle and checks`.

### Task A2: Kiểm phép tính của thẻ bằng SymPy (CI)

**Files:** Create `cas/tests/test_cards.py`.

- [ ] **Step 1: Test**

```python
# Every "kiểm:" line of every teaching card must be True (G6, C1). Runs in the CI cas job.
import pathlib, re
import pytest
from sympy import Rational, Symbol, gcd, ilcm, lcm, simplify, solve, sqrt, factorint, Eq, nsimplify
from sympy.parsing.sympy_parser import parse_expr

CARDS = sorted((pathlib.Path(__file__).resolve().parents[2] / "knowledge/src/cards").glob("*.md"))
NS = {"x": Symbol("x", nonnegative=True), "t": Symbol("t", nonnegative=True), "y": Symbol("y", positive=True),
      "gcd": gcd, "ilcm": ilcm, "lcm": lcm, "simplify": simplify, "solve": solve, "sqrt": sqrt,
      "factorint": factorint, "Rational": Rational, "Eq": Eq, "nsimplify": nsimplify}
LINES = [(p.name, m.group(1)) for p in CARDS for m in re.finditer(r"^kiểm: (.+)$", p.read_text("utf8"), re.M)]

def test_there_are_cards():
    assert CARDS, "no cards found"

@pytest.mark.parametrize("name,expr", LINES)
def test_check_line_is_true(name, expr):
    # One SymPy expression per line that must come out True (`==`, `%`, gcd/ilcm, simplify(...) == 0, solve(...) == [...]).
    assert parse_expr(expr, local_dict=dict(NS)) == True, f"{name}: {expr}"  # noqa: E712 (SymPy booleans)
```

- [ ] **Step 2:** sửa một dòng `kiểm:` sai cố ý → `cd cas && python -m pytest -q tests/test_cards.py` FAIL → trả lại → PASS.
- [ ] **Step 3:** commit `test(cards): every card calculation is checked by SymPy`.

### Task A3: Chọn cách giảng, mục lục, khối hiển thị

**Files:** Create `lib/knowledge/cards.ts`, `lib/markdown/cardBlocks.ts`; Test `tests/cardsPick.test.ts`, `tests/cardBlocks.test.ts`.

**Interfaces:**
```ts
export function card(code: string): Card | null;
/** Mục lục for the prompt: one line per card of the grade + background cards, "D6.1 · Chia đều — nhiều nhất (ƯCLN)". */
export function cardIndexText(grade: 6 | 9): string;
/** Way to show: `wanted` (1 or 2) unless its key numbers clash with the child's problem; the other way then; null if both clash. */
export function pickVariant(c: Card, wanted: 1 | 2, problemText: string): 1 | 2 | null;
export function clashes(keyNumbers: string[], problemText: string): boolean; // ≥ 2 key numbers (or all, if 1) appear in the problem
export type CardBlock = { t: "p"; runs: Run[] } | { t: "ul"; items: Run[][] } | { t: "table"; rows: Run[][][] };
export function cardBlocks(md: string): CardBlock[]; // Run = { text: string; bold: boolean } (same as lib/markdown lines())
```

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { clashes, pickVariant, card, cardIndexText } from "@/lib/knowledge/cards";

describe("clashes (C1: the card's example must use other numbers)", () => {
  it("two key numbers in the problem → clash", () => expect(clashes(["12", "18"], "Tìm BCNN(12, 18) và BC nhỏ hơn 200")).toBe(true));
  it("one shared number only → no clash", () => expect(clashes(["12", "18"], "Ba tàu 10, 12, 15 ngày")).toBe(false));
  it("a single key number clashes when present", () => expect(clashes(["60"], "trong khoảng 60 đến 100")).toBe(true));
  it("numbers inside larger numbers do not count", () => expect(clashes(["12", "18"], "Có 120 và 180 cái")).toBe(false));
});

describe("pickVariant", () => {
  const c = card("T6.12")!;
  it("way 1 when free; way 2 when 1 clashes; null when both clash", () => {
    expect(pickVariant(c, 1, "Ba tàu 10, 12, 15 ngày")).toBe(1);
    expect(pickVariant(c, 1, "BCNN(12, 18)?")).toBe(2);
    expect(pickVariant(c, 1, "12, 18, 4 và 6")).toBeNull();
  });
});

describe("cardIndexText", () => {
  it("lists only the grade's cards (lớp 6 never sees T9 cards)", () => {
    const six = cardIndexText(6);
    expect(six).toContain("T6.12");
    expect(six).toContain("D6.1");
    expect(six).not.toContain("T9.9");
  });
});
```

`tests/cardBlocks.test.ts`: đoạn có `**đậm**` → runs; dòng `- ` → `ul`; khối `| … |` có dòng `|---|` → `table` (bỏ dòng ngăn cách); dòng trống tách đoạn; dòng `` `kiểm: …` `` không bao giờ có trong thân (thân đã sạch).

- [ ] **Step 2:** đỏ → code (`clashes`: lấy số bằng `numbersIn` của `lib/tools/makeSibling.ts`, so khớp cả số, không so chuỗi con) → xanh.
- [ ] **Step 3:** commit `feat(cards): pick a way without the child's numbers, index, display blocks`.

### Task A4: Trường `the_hien` / `the_thieu` + prompt v0.7

**Files:** Modify `lib/tutor/schema.ts`, `tests/apiSchemas.test.ts`, `tests/schema.test.ts` (nếu có), `prompts/method.md`, `prompts/PROMPT_VERSION`, `lib/tutor/assemble.ts` (mục lục thẻ cuối lớp ③), `lib/tutor/fakeClient.ts`, `eval/cases.ts`.

**Interfaces:**
- `tutorOutput` thêm: `the_hien: z.string().regex(CARD_CODE).nullable()`, `the_thieu: z.string().max(80).nullable()`. `normalize`: mã sai dạng → null; `the_thieu` dài → cắt 80.
- `assemble` nhận `cardIndex: string` (theo lớp), nối vào **cuối lớp ③** (cùng breakpoint cache của ①②③). Thứ tự prefix không đổi với mỗi lớp, nên cache vẫn dùng chung cho mọi bài của con cùng lớp.

- [ ] **Step 1:** test schema: `the_hien: "D6.1"` hợp lệ; `"X1.2"` → null (normalize); thiếu trường → lỗi (strict); `apiSchemas` vẫn xanh.
- [ ] **Step 2:** `prompts/method.md` thêm mục (tiếng Việt):

```md
## Giảng lý thuyết và đọc đề (thẻ đã duyệt)
- Em nói chưa hiểu một kiến thức ("BCNN là gì", "sao lại lấy mũ cao nhất"), hoặc em vướng đúng kiến thức có thẻ → đặt `the_hien` = mã thẻ trong MỤC LỤC THẺ. App hiện **nguyên văn** thẻ; `message` chỉ 1–2 câu nối với bài của em (vd "Cô giảng phần này bằng một ví dụ khác nhé:"), **không** chép lại thẻ, **không** đặt câu hỏi, `buttons` = [].
- Em chọn "Em không biết dùng kiến thức nào" hoặc "Em không biết bắt đầu đặt ẩn" → thẻ **Đọc đề** (mã D…) đúng dạng bài.
- Không có thẻ hợp với chỗ em vướng → `the_hien` = null, `the_thieu` = mô tả ngắn chỗ thiếu (vd "lớp 6 – phần trăm giảm giá"), rồi giảng ngắn theo cách giảng chung: ví dụ khác số → vì sao → quy tắc; không hỏi đáp; không bịa mẹo nhớ.
- Sau khi em bấm "Em hiểu rồi": quay lại bài gốc bằng **một** bước nhỏ.
```

`PROMPT_VERSION` → v0.7.
- [ ] **Step 3:** `eval/cases.ts` thêm 3 ca (đều `forbid` đáp số bài gốc):
  - **6.12**: lớp 6, bài 3 tàu 10/12/15, em gõ "BCNN là gì ạ" → mong `the_hien = "T6.12"`, message ≤ 2 câu, không có "60".
  - **6.13**: em chọn "Em không biết dùng kiến thức nào" ở bài chia tổ 24 nam 36 nữ → `the_hien = "D6.1"`, không có "12".
  - **9.26**: lớp 9 bài vòi nước 4 giờ, em chọn "Em không biết bắt đầu đặt ẩn" → `the_hien = "D9.1"`, không có đáp số.
  `eval/run.ts` chấm thêm `expect.theHien`.
- [ ] **Step 4:** `npm test` xanh → commit `feat(cards): the_hien / the_thieu fields and card teaching rules (prompt v0.7)`.

### Task A5: Máy chủ hiện thẻ + lượt soạn sẵn

**Files:** Create `lib/tutor/scripted.ts`, `tests/scripted.test.ts`; Modify `lib/copy.ts`, `lib/tutor/repo.ts` (+ 2 impl: `saveScriptedReply`, `lastCardOf`, `cardRef` trong `StoredReply`/`ThreadMessage`), `lib/tutor/handlers.ts`, `tests/handlers.test.ts`.

**Interfaces:**
```ts
// lib/copy.ts
export const BTN_NOT_UNDERSTAND_PROBLEM = "Em không hiểu đề";
export const BTN_CARD_OK = "Em hiểu rồi";
export const BTN_CARD_AGAIN = "Giảng lại cách khác";
export const DOC_DE_ASK = "Em vướng ở chỗ nào?";
export const DOC_DE_BUTTONS = ["Em không hiểu đề kể chuyện gì", "Em không biết đề hỏi gì", "Em không biết dùng kiến thức nào", "Em không biết bắt đầu đặt ẩn"] as const; // lớp 6: bỏ nút cuối
export const CARD_AGAIN_INTRO = "Cô giảng cách khác nhé:";
export const CARDS_DONE = "Cô đã giảng 2 cách rồi. Em để dành bài này hỏi thầy, hay thử lại bước vừa rồi?";
// lib/tutor/scripted.ts
export type Scripted =
  | { kind: "doc_de_ask"; message: string; buttons: string[] }
  | { kind: "card"; message: string; cardRef: string; buttons: string[] }
  | { kind: "cards_done"; message: string; buttons: string[]; gap: string };
/** A button turn the server answers without the model (Y3); null = normal model turn. */
export function scriptedTurn(a: { text: string; kind: "text" | "button"; grade: 6 | 9; lastCard: { code: string; n: 1 | 2 } | null; problemText: string }): Scripted | null;
// repo
saveScriptedReply(a: { actor: ChildActor; problem: ProblemRow; clientMsgId: string; childText: string; message: string; buttons: string[];
  cardRef: string | null; hintLevelMax: number; now: Date }): Promise<StoredReply>;
lastCardOf(problemId: string): Promise<{ code: string; n: 1 | 2 } | null>;
// StoredReply / ThreadMessage gain: cardRef: string | null
```

- [ ] **Step 1: Test `scriptedTurn`**

```ts
import { describe, expect, it } from "vitest";
import { scriptedTurn } from "@/lib/tutor/scripted";
import { BTN_CARD_AGAIN, BTN_NOT_UNDERSTAND_PROBLEM, DOC_DE_BUTTONS } from "@/lib/copy";

const base = { kind: "button" as const, grade: 6 as const, lastCard: null, problemText: "Ba tàu 10, 12, 15 ngày" };

describe("scriptedTurn (Y3: no model call)", () => {
  it("'Em không hiểu đề' → the 4-way question (3 for grade 6)", () => {
    expect(scriptedTurn({ ...base, text: BTN_NOT_UNDERSTAND_PROBLEM })).toEqual({ kind: "doc_de_ask", message: "Em vướng ở chỗ nào?", buttons: DOC_DE_BUTTONS.slice(0, 3) });
    expect(scriptedTurn({ ...base, grade: 9, text: BTN_NOT_UNDERSTAND_PROBLEM })?.buttons).toHaveLength(4);
  });
  it("'Giảng lại cách khác' after way 1 → way 2 of the same card", () =>
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 1 } }))
      .toEqual({ kind: "card", message: "Cô giảng cách khác nhé:", cardRef: "T6.12#2", buttons: ["Em hiểu rồi", "Giảng lại cách khác"] }));
  it("after way 2 → offer to save; logs the gap (C2, C5)", () =>
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 2 } }))
      .toMatchObject({ kind: "cards_done", buttons: ["Để dành hỏi thầy", "Em thử lại"], gap: "het_cach:T6.12" }));
  it("way 2 clashes with the child's numbers → also done", () =>
    expect(scriptedTurn({ ...base, text: BTN_CARD_AGAIN, lastCard: { code: "T6.12", n: 1 }, problemText: "4 giây và 6 giây" })?.kind).toBe("cards_done"));
  it("typed text or other buttons → the model", () => {
    expect(scriptedTurn({ ...base, kind: "text", text: BTN_NOT_UNDERSTAND_PROBLEM })).toBeNull();
    expect(scriptedTurn({ ...base, text: "Em hiểu rồi", lastCard: { code: "T6.12", n: 1 } })).toBeNull();
  });
});
```

- [ ] **Step 2: Test handler** (memoryRepo, `tests/handlers.test.ts`):
  - model trả `the_hien: "T6.12"` cho bài "Ba tàu 10, 12, 15" → reply `cardRef: "T6.12#1"`, `buttons: ["Em hiểu rồi","Giảng lại cách khác"]`, `hintLevelMax ≥ 2` (Y1);
  - bài có số 12 và 18 → `cardRef: "T6.12#2"`;
  - `the_hien` của lớp khác (T9.9 cho con lớp 6) hoặc mã không có thẻ → không hiện thẻ, giữ lời của cô, ghi thiếu thẻ (raw có `the_hien`);
  - nút "Giảng lại cách khác" → **không gọi model** (`client.calls` = 0), lưu tin `cardRef: "T6.12#2"`, `turnCount` không tăng (Y3);
  - nút "Em không hiểu đề" → không gọi model, 3 nút chẩn đoán (lớp 6).
- [ ] **Step 3: Code**: trong `handleTurn`, ngay sau khi nhận tin và trước pre-turn: `const s = scriptedTurn(...)`; có `s` → `saveScriptedReply` rồi trả về. Sau lượt model: nếu `shown.the_hien` → `pickVariant(card, 1, statement)`: có cách → `cardRef`, buttons cố định, `hintLevelMax = max(..., 2)`; không có → giữ message. `saveReply` lưu `card_ref`. `problemThread` đọc `card_ref`.
- [ ] **Step 4:** xanh → commit `feat(cards): server shows approved cards; scripted turns for "Em không hiểu đề" and "Giảng lại cách khác"`.

### Task A6: Hiện thẻ trên màn hình con + bố mẹ

**Files:** Create `app/hoi/[problemId]/card-view.tsx`; Modify `app/hoi/[problemId]/chat.tsx` (tin có `cardRef` → `CardView` dưới lời cô; thêm nút cố định "Em không hiểu đề" cạnh "Để dành hỏi thầy" khi bài đang mở), `app/bo-me/bao-cao/[problemId]/page.tsx` (hiện thẻ trong luồng xem lại), `e2e/tutor.spec.ts`.

- [ ] **Step 1:** `CardView({ cardRef })`: tách `code#n` → `card(code)` → tiêu đề "📘 {title} — {variant.title}" + `cardBlocks(body)` (bảng dùng `<table>` viền nhạt, chữ 16px, cuộn ngang trên máy hẹp). Khung nền khác bong bóng chat. Có dòng nhỏ "📝 Em chép phần **Ghi vào vở** nhé." khi thân có "Ghi vào vở". Thẻ không tồn tại (bundle cũ) → "Thẻ này đang được cập nhật."
- [ ] **Step 2:** e2e (model giả trả `the_hien` khi tin con là "BCNN là gì ạ"): khung thẻ hiện; bấm "Giảng lại cách khác" → khung thứ hai (cách 2) **không** gọi model (kiểm `model_calls` không tăng); bấm "Em không hiểu đề" → 3 nút chẩn đoán.
- [ ] **Step 3:** `fakeClient`: tin chứa "là gì" → trả `the_hien` của lớp tương ứng (`T6.12` / `T9.9`).
- [ ] **Step 4:** commit `feat(cards): card view for the child and the parents`.

### Task A7: Tài liệu + eval + PR G6a
- [ ] `docs/DOMAIN.md`: mục mới **§4.15 Thẻ giảng** (C1–C4, Y1, Y3, chọn cách khi trùng số, hết 2 cách → để dành); §0: D26 ✅ 21/11. `ROADMAP.json`: G6 `in_progress`, tính năng, log; `parentTodo`: "Duyệt đợt thẻ HK1". PROGRESS.
- [ ] Hỏi phụ huynh rồi chạy eval 3 ca mới trên Sonnet (< 0,1 USD): `the_hien` đúng, 0 lộ. Ghi kết quả vào PR.
- [ ] Toàn bộ kiểm tra xanh (`npm test`, `cards:check`, `knowledge:check`, `cas` pytest gồm `test_cards.py`) → PR (tiếng Việt). **SQL: không** (cần L-7).

---

# Phần B — G6b Ôn đầu buổi + Thẻ cần bổ sung

### Task B1: Câu ôn từ thẻ (thuần)

**Files:** Modify `lib/rules/review.ts`, `tests/rules.test.ts`.

**Interfaces:**
```ts
export function normalizeAnswer(s: string): string; // lowercase, NFC, trim, gộp khoảng trắng, bỏ dấu chấm cuối
export function gradeExact(given: string, expected: string): boolean;
export interface NewReviewItem { cardCode: string; itemKey: string; kuCode: string; kind: "why" | "recognize" | "formula" | "mini_problem";
  prompt: string; buttons: string[]; answer: string; answerCheck: "exact" | "math_check"; box: 1; dueDateVn: string; status: "active"; source: "card" }
/** Y2: the card's review questions, due tomorrow, box 1, active. */
export function reviewItemsFromCard(c: Card, todayVn: string): NewReviewItem[];
```

- [ ] **Step 1: Test** (giữ nguyên các test §4.11 a–f đã có; thêm):

```ts
describe("gradeExact", () => {
  it("ignores case, spaces, a final dot, Unicode form", () => {
    expect(gradeExact("  bcnn. ", "BCNN")).toBe(true);
    expect(gradeExact("Để chia hết cho mọi số đã cho", "Để  chia hết cho mọi số đã cho")).toBe(true);
    expect(gradeExact("ƯCLN", "BCNN")).toBe(false);
  });
});
describe("reviewItemsFromCard (Y2)", () => {
  it("every question of the card, box 1, due tomorrow, active, source card", () => {
    const items = reviewItemsFromCard(card("T6.12")!, "2026-11-21");
    expect(items.length).toBe(card("T6.12")!.review.length);
    expect(items[0]).toMatchObject({ cardCode: "T6.12", kuCode: "T6.12", box: 1, dueDateVn: "2026-11-22", status: "active", source: "card" });
  });
});
```

- [ ] **Step 2–4:** đỏ → code → xanh → commit `feat(review): grade exact answers, review items from cards`.

### Task B2: Ghi câu ôn khi con hiểu thẻ + mở lại khi sai bài thật

**Files:** Modify `lib/tutor/repo.ts` (+2 impl), `lib/tutor/handlers.ts`, `tests/handlers.test.ts`.

**Interfaces:** `addReviewItems(a: { actor; items: NewReviewItem[] }): Promise<number>` (bỏ qua trùng `(child, card_code, item_key)`); `reopenReviews(a: { childId; kuCode; todayVn }): Promise<number>` (dùng `reopenAfterMistake`).

- [ ] **Step 1: Test:** tin trước là thẻ `T6.12#1`, con bấm "Em hiểu rồi" → `repo.reviewItems` thêm câu ôn của T6.12 (lượt này vẫn gọi model như thường); bấm lần nữa ở bài khác → không thêm trùng. Lượt có `danh_gia_luot_em: "sai"` ở bài `ku_code = T6.12` có câu ôn `retired` → câu ôn `active`, box 1, hạn ngày mai (§4.11 dòng "mở lại").
- [ ] **Step 2–4:** đỏ → code → xanh → commit `feat(review): cards feed the review queue; a real mistake reopens retired items`.

### Task B3: Khối ôn đầu buổi + route trả lời

**Files:** Create `app/review-block.tsx`, `app/api/review/answer/route.ts`, `lib/tutor/review.ts` (handler `answerReview`); Modify `app/page.tsx`, repo (`dueReviews(childId, todayVn)` → ≤ 2 câu, **không** có `answer`; `saveReviewAnswer`), `tests/review.test.ts`, `e2e/tutor.spec.ts`.

**Interfaces:** `POST /gia-su/api/review/answer` body `{ itemId: uuid, clientMsgId: uuid, answer?: string, skipped?: true }` → `{ result: "correct" | "wrong" | "skipped", answer: string | null, nextDueVn: string }` (`answer` = đáp án đúng, chỉ trả **sau** khi con đã trả lời; skipped → null).

- [ ] **Step 1: Test `answerReview`** (memoryRepo): §4.11 a (box 1 đúng → box 2, +3 ngày), b (box 3 sai → box 1, ngày mai), e ("Để sau" → giữ box, ngày mai), f (5 câu đến hạn → `dueReviews` trả 2 câu box thấp nhất), gửi lại cùng `clientMsgId` → không chấm 2 lần, câu của con khác → 404, `math_check` (`mini_problem`): cas `equivalent` đúng → correct; cas lỗi → **không chấm**, trả "Cô kiểm lại sau nhé" và không đổi box.
- [ ] **Step 2:** UI `ReviewBlock` trên `app/page.tsx` (con, có câu đến hạn): tiêu đề "Ôn nhanh 2 câu"; câu `recognize` có dòng "Chỉ chọn dạng, không cần giải" (Y4, không bấm giờ); nút đáp án hoặc ô gõ + "Trả lời"; "Để sau". Sau khi trả lời: "Đúng rồi!" / "Chưa đúng — đáp án: …" + link "Xem lại thẻ" (mở `CardView` của `card_code`). Hết câu → khối biến mất, ô "Em kẹt bài nào?" như cũ (Y5).
- [ ] **Step 3:** e2e: seed 1 câu ôn đến hạn → trang đầu hiện "Ôn nhanh" → chọn đúng → "Đúng rồi!" → DB box 2, hạn +3.
- [ ] **Step 4:** commit `feat(review): start-of-session review (D26)`.

### Task B4: "Thẻ cần bổ sung" trong báo cáo tối

**Files:** Create `lib/report/cardGaps.ts`, `tests/report/cardGaps.test.ts`, `app/bo-me/bao-cao/gap-copy.tsx`; Modify `lib/report/load.ts` (đọc 7 ngày), `app/bo-me/bao-cao/page.tsx`.

**Interfaces:**
```ts
export interface GapEvent { at: string; grade: 6 | 9; childId: string; problemId: string;
  kind: "the_thieu" | "no_card" | "unknown_ku" | "het_cach"; key: string; statement: string | null }
export interface CardGap { key: string; grade: 6 | 9; count: number; days: string[]; childIds: string[]; example: string | null; request: string }
/** C5: same gap ≥ 2 times within 7 days (VN days), most frequent first. */
export function cardGaps(events: GapEvent[], now: Date, hasCard: (code: string) => boolean): CardGap[];
```
Nguồn sự kiện (không SQL mới): `model_calls` (`purpose = tutor`, `shown = true`) có `the_thieu` → `the_thieu:<chữ đã chuẩn hóa>`; có `the_hien` mà `hasCard` false → `no_card:<mã>`; `problems` đã xác nhận đề mà `ku_code` null → `unknown_ku:lop<g>`; tin soạn sẵn `CARDS_DONE` → `het_cach:<mã>`.

- [ ] **Step 1: Test**

```ts
describe("cardGaps (C5)", () => {
  const ev = (at: string, key: string, kind: GapEvent["kind"] = "the_thieu") =>
    ({ at, grade: 6 as const, childId: "c1", problemId: at, kind, key, statement: "Giảm giá 20% …" });
  const now = new Date("2026-11-21T12:00:00Z");
  it("twice in 7 days → one gap with a copyable request", () => {
    const g = cardGaps([ev("2026-11-18T10:00:00Z", "lớp 6 – phần trăm"), ev("2026-11-20T10:00:00Z", "lớp 6 – phần trăm")], now, () => false);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ key: "lớp 6 – phần trăm", count: 2, days: ["18/11", "20/11"] });
    expect(g[0]!.request).toContain("Nhờ soạn thẻ");
  });
  it("once → nothing; older than 7 days → not counted", () => {
    expect(cardGaps([ev("2026-11-20T10:00:00Z", "a")], now, () => false)).toEqual([]);
    expect(cardGaps([ev("2026-11-10T10:00:00Z", "a"), ev("2026-11-20T10:00:00Z", "a")], now, () => false)).toEqual([]);
  });
  it("a no_card gap disappears once the card exists", () => {
    const e = [ev("2026-11-19T10:00:00Z", "T6.13", "no_card"), ev("2026-11-20T10:00:00Z", "T6.13", "no_card")];
    expect(cardGaps(e, now, (c) => c === "T6.13")).toEqual([]);
  });
});
```

- [ ] **Step 2:** đỏ → code → xanh. **Step 3:** UI: mục "📘 Thẻ cần bổ sung" (chỉ hiện khi có), mỗi dòng: dạng, số lần, ngày, con nào; nút **"Sao chép yêu cầu"** (`navigator.clipboard.writeText(request)`, báo "Đã chép — dán vào chat với Claude"). **Không** ghi vào `learning_attention`, **không** đẩy thông báo. Báo cáo cũng thêm 1 dòng cho mỗi con: "Ôn đầu buổi: x câu, đúng y" (từ `review_attempts` trong ngày).
- [ ] **Step 4:** commit `feat(report): cards to add (C5) and review results`.

### Task B5: Tài liệu + PR G6b
- [ ] DOMAIN §4.11: đổi *Đề xuất* → ✅ 21/11 (D26), thêm Y2, Y4, Y5; §4.7: mục "Thẻ cần bổ sung" (C5). ROADMAP (G6 → review), PROGRESS.
- [ ] Toàn bộ kiểm tra xanh → PR. **SQL: không** (cần L-7).

---

# Phần C — Nội dung thẻ HK1 (G6c, nhiều đợt)

### Task C1 (lặp mỗi đợt ≈ 10 bài): soạn → kiểm → bố mẹ duyệt

**Files:** `knowledge/src/cards/<CODE>.md` (mỗi bài một file), `knowledge/cards.json` (sinh ra).

- [ ] **Step 1:** chọn đợt theo `knowledge.json` (`term = HK1`): đợt 1 lớp 6 Chương I–II (số tự nhiên, chia hết, số nguyên tố); đợt 2 lớp 6 phần còn lại HK1; đợt 3 lớp 9 Chương 1–2 (phương trình, hệ phương trình, bất phương trình); đợt 4 lớp 9 Chương 3–4 (căn thức, hệ thức lượng); đợt 5 nền N7/N8/TH được tham chiếu nhiều nhất.
- [ ] **Step 2:** soạn mỗi bài 2 cách theo khuôn C3 (thẻ "Đọc đề" theo C4 nếu là dạng thực tế), 1–3 câu ôn, dòng `số:` và `kiểm:`. Giọng "cô – em", lớp 6 viết cả 2 · 2 · 3 và 2² · 3.
- [ ] **Step 3:** `npm run cards` + `cd cas && python -m pytest -q tests/test_cards.py` xanh; tự soát: không nhắc tên thật, ví dụ không trùng các đề trong `eval/cases.ts`.
- [ ] **Step 4:** PR "Thẻ HK1 đợt N" (tiếng Việt, liệt kê bài, link file). **Merge = bố mẹ duyệt.** Bản xem dễ đọc: đăng lên hub `deliverables/gia-su-ai/THE_HK1_dotN.md`.

---

## Self-review

- **Spec coverage:** D26 / §4.11 a–f → B1 (test cũ giữ nguyên), B3 · US15 → B3 · thiết kế C → A1–A6 · 2 cách và đổi cách khi trùng số → A3, A5 · giảng thẳng → A4 (prompt) + nội dung thẻ · đọc đề + 4 nút chẩn đoán → A4, A5, A6 · câu "nhận diện dạng" → `recognize` (A1, B3) · thẻ cần bổ sung ≥ 2 lần/7 ngày, sao chép, không đẩy → B4 · HK1 trước → C1.
- **Placeholder scan:** bước UI (A6, B3, B4) mô tả bố cục cụ thể theo mẫu `chat.tsx` / `page.tsx`; logic có test đều nằm ở hàm thuần có code hoặc test cụ thể. Không có "TBD".
- **Type consistency:** `Card`, `CARD_CODE`, `pickVariant`, `clashes`, `cardIndexText`, `cardBlocks`, `scriptedTurn`, `Scripted`, `NewReviewItem`, `reviewItemsFromCard`, `gradeExact`, `GapEvent`, `cardGaps`; `card_ref` / `cardRef` dạng `"T6.12#1"` khớp CHECK trong 0024.
- **Rủi ro:** model chọn sai mã thẻ (eval A7 + báo cáo xem lại); thẻ dài trên điện thoại (A6 cuộn bảng); khối lượng duyệt nội dung (đợt ≈ 10 bài, merge = duyệt).
