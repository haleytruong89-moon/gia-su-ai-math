# G5 — Kho kiến thức, phân loại bài, dạy bù nền, checklist lớp 6 · Implementation Plan

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cô biết mỗi bài thuộc bài SGK nào (KU), có thẻ kiến thức đúng bài đó trong prompt, tra được kiến thức nền và hộp công cụ, dạy bù ngắn khi con hổng nền, hỏi đúng checklist theo dạng bài (cả lớp 6). Bài hình chứng minh và ý chặn đề vào 10 của lớp 9 chạy Opus ngay từ lượt đầu.

**Architecture:**
- **Dữ liệu** (D25): 4 file md trong hub được làm sạch thành `knowledge/src/*.md` (repo công khai: bỏ mọi ghi chú riêng), cộng `knowledge/src/MAP.md` (KU → mục checklist, KU → mục hộp công cụ). Script sinh `knowledge/*.json` và `KNOWLEDGE_VERSION`. CI chạy lại script, báo lỗi nếu JSON lệch hoặc lọt chữ riêng tư.
- **Thư viện** `lib/knowledge/`:
  - `knowledgeCard()` dựng lớp ⑤ (≤ 3.500 ký tự);
  - `lookupText()` cho công cụ `lookup` (≤ 1.500 ký tự);
  - `kuIndex()` là danh mục rút gọn đưa cho bộ phân loại.
- **Lượt đầu mỗi bài:** Haiku phân loại (`purpose = classify`), trả `ku_code`, `exam_slot` (chỉ lớp 9, chỉ khi chắc) và `geometry_proof`. Máy chủ ghi vào `problems`, dựng thẻ ⑤, chọn model (D28 dấu hiệu 3–4).
- **Sau mỗi câu trả lời:**
  - cô sửa `ku_code` lúc xác nhận đề;
  - `prereq_gap` được cộng vào `problems.prereq_gaps` và ghi `diagnoses` (concept, KU nền);
  - máy chủ đếm số lượt dạy bù liền nhau, đủ 2 lượt thì ⑥ báo "quay lại bài gốc".
- **Checklist:** lớp 6 có 5 mục (đề xuất, chờ chốt). Lớp 6 và lớp 9 đều phải hỏi ≥ 1 mục trước `self_solved`.

**Tech Stack:** Next.js 16, TypeScript strict, zod 4, Vitest, `@anthropic-ai/sdk` (Haiku 5.5, structured output), GitHub Actions.

**Spec:**
- `docs/DOMAIN.md`: §1 (cột `ku_code`, `exam_slot`, `prereq_gaps`, `knowledge_version`, bảng `diagnoses`), §4.10, §4.13, §4.14 (dấu hiệu `geometry_proof`, `exam_slot_hard`; ví dụ h, i), D25, D27.
- `docs/DESIGN.md`: §4 bước 6–7, §5 `lookup`, §6 kho kiến thức.
- `docs/BO_TEST.md`: ca 9.17, 9.18, 9.19.
- Nguồn trong hub: `BAN_DO_CHUONG_TRINH_TOAN9_v0.2.md`, `BAN_DO_CHUONG_TRINH_TOAN6_v0.1.md`, `HOP_CONG_CU_HINH_9_v0.2.md`, `HOP_CONG_CU_RUT_GON_9_v0.1.md`.

## Quyết định (phụ huynh chốt 16/11/2026)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Repo công khai mà file hub có ghi chú riêng | **Bản sạch vào repo.** Ghi chú riêng (lỗi con đã gặp, nhận xét của thầy, đề cương và đề của trường, ý chặn theo thầy) bị bỏ khi chép. Bố mẹ nhập phần cần thiết vào Hồ sơ dạy học (④, nằm trong DB). CI chặn nếu lọt |
| Q2 | D25: 4 file hub đang "chờ xem" | **Chốt D25**, dùng 4 bản trên làm v1. Thầy góp ý sau thì sửa md trong hub → chạy lại script → PR mới (đổi `KNOWLEDGE_VERSION`) |
| Q3 | Checklist lớp 6 | **Claude soạn 5 mục**, ghi DOMAIN §4.10b *Đề xuất*, code bắt buộc như lớp 9, đánh dấu `TODO(rule-unconfirmed)` |
| Q4 | D27 nhãn ý đề vào 10 | **Chốt D27.** Haiku chỉ gắn `exam_slot` khi đề rõ là đề vào 10 (có "Bài II câu 3", "Bài 4 ý c"… hoặc con nói là đề ôn thi vào 10); không chắc thì để `null` |

## Global Constraints

- **Repo công khai** (D9): không họ tên thật, không trường, không nhận xét của thầy cô, không đề của trường, không "lỗi con đã gặp". `knowledge/src/*.md` và `knowledge/*.json` phải qua kiểm riêng tư (Task 1). Danh sách từ cấm mang tính riêng (tên) **không** được viết trong repo: đọc từ GitHub Secret `PRIVATE_TERMS`.
- Không sửa tay `knowledge/*.json`. Chỉ sửa `knowledge/src/*.md`, rồi chạy `npm run knowledge`.
- Không SQL mới. Các cột cần dùng đã có trong `0017`: `problems.ku_code` (regex `^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$`), `exam_slot` (regex `^HN10-[1-5][a-c]?(-y[12])?$`), `prereq_gaps text[]`, `knowledge_version`; `study_sessions.knowledge_version`; `diagnoses(root, source, ku_code)`; `model_calls.purpose` có `classify`; `tool_calls.tool` có `lookup`.
- Thẻ ⑤ không chứa lời giải mẫu (bỏ các cột / mục "ví dụ" có đáp số) để cô không có sẵn đáp án bài gốc.
- Bộ phân loại lỗi hoặc hết giờ → bài vẫn chạy, chỉ không có thẻ (`[KIẾN THỨC — chưa xác định]`, Sonnet). Phân loại chỉ chạy khi còn ≥ 200 s trong lượt.
- Không log nội dung đề của con. Log lỗi chỉ ghi `e.message`.
- `npm run typecheck && npm run lint && npm test` xanh; `npm run knowledge:check` xanh; đổi prompt → `PROMPT_VERSION` = `v0.5`, chạy G0 các ca liên quan.

## File Structure

| File | Trách nhiệm |
|---|---|
| `knowledge/hub/` (gitignore) | Bản gốc tải từ hub, chỉ ở máy người chạy script |
| `scripts/knowledge/sanitize.ts` | Luật làm sạch (thuần) + CLI: `knowledge/hub/*.md` → `knowledge/src/*.md` |
| `scripts/knowledge/privacy.ts` | Kiểm chữ riêng tư: mẫu chung + `PRIVATE_TERMS` |
| `knowledge/src/{toan9,toan6,hinh9,rutgon9,MAP}.md` | Nguồn đã sạch, phụ huynh đọc được |
| `lib/knowledge/schema.ts` | zod: `KnowledgeUnit`, `ToolboxSection`, `ChecklistItem`, `KnowledgeBundle` |
| `scripts/knowledge/build.ts` | Đọc bảng markdown → `knowledge/knowledge.json` + `knowledge/KNOWLEDGE_VERSION` |
| `lib/knowledge/load.ts` | Nạp + kiểm JSON một lần; tra theo mã |
| `lib/knowledge/card.ts` | `knowledgeCard`, `lookupText`, `kuIndex`, `checklistFor` |
| `prompts/classify.md`, `lib/tutor/classify.ts` | Bộ phân loại Haiku |
| `lib/tools/defs.ts`, `lib/tools/lookup.ts` | Công cụ `lookup` |
| `lib/tutor/repo.ts` + `tests/helpers/memoryRepo.ts` + `lib/db/supabaseRepo.ts` | Đọc/ghi `ku_code`, `exam_slot`, `prereq_gaps`, `knowledge_version`, `diagnoses`, lượt dạy bù |
| `lib/tutor/assemble.ts`, `lib/tutor/handlers.ts` | Nối vào lượt |
| `prompts/method.md`, `prompts/PROMPT_VERSION` | Nhắc `lookup`, `day_bu_nen` ≤ 2 lượt, checklist trong ⑤ |
| `eval/*` | Ca 9.17–9.19 có phân loại + thẻ ⑤ |
| `docs/DOMAIN.md`, `docs/DESIGN.md`, `docs/PROGRESS.md`, `docs/ROADMAP.json` | Ghi chốt + tiến độ |

---

## PR A — Kho kiến thức (nhánh `feature/g5-knowledge-data`; app chưa dùng, không đổi hành vi)

### Task 1: Làm sạch nguồn hub + kiểm riêng tư

**Files:** Create `scripts/knowledge/sanitize.ts`, `scripts/knowledge/privacy.ts`, `tests/knowledge/sanitize.test.ts`, `tests/knowledge/privacy.test.ts`; Modify `.gitignore` (+ `knowledge/hub/`).

**Interfaces — Produces:**
```ts
// scripts/knowledge/sanitize.ts
export interface SanitizeRules { dropColumns: string[]; dropSections: RegExp[]; dropParens: RegExp[];
  /** Table cells are split on ";": a part matching one of these is removed. */ dropCellParts: RegExp[];
  replaceText: [RegExp, string][]; }
export const RULES: SanitizeRules;
/** Pure: returns the public-safe markdown. Never adds text except one header line naming the source. */
export function sanitize(md: string, source: string, rules?: SanitizeRules): string;
export const SOURCES: { hub: string; out: string }[]; // hub file name → knowledge/src/<out>.md
// scripts/knowledge/privacy.ts
export const GENERIC_PATTERNS: RegExp[];
/** Lines that look private: generic patterns + extra terms (from env PRIVATE_TERMS, comma-separated). */
export function privacyHits(text: string, extraTerms?: string[]): { line: number; match: string }[];
```

Luật làm sạch (`RULES`):
- `dropColumns`: `Đề cương HK I`, `Ý chặn (theo thầy)`, `Học ở trường`. Áp cho mọi bảng có cột tên đó.
- `dropSections`: theo tiêu đề, xóa cả mục đến tiêu đề cùng cấp kế tiếp.
  - Bản đồ chương trình: `/^## 4\. Dạng đề cương/`, `/^## 4\. Đang học/`.
  - Hộp công cụ: `/^### 2\.1\./`, `/^### 2\.2\./` (đề của trường), `/^## 3\. Dùng cho gói chủ đề/`, `/^## 2\. Ví dụ mẫu/` (có đáp số bài 9.16), `/^## 6\. Gói chủ đề/`, `/^## 5\. Danh sách kiểm/` (đã có trong MAP).
  - Đoạn chữ sau bảng mục 5 của Toán 9: `**Ngưỡng điểm` và `**Hệ quả cho gia sư AI:**` cùng danh sách ngay sau.
- `dropParens`: xóa đoạn trong ngoặc có `đã gặp ở`, `thầy`, `barem`, `giữa kỳ`, `đề cương`, `nhận xét`, `ý chặn`.
- `dropCellParts`: trong ô bảng, phần (tách theo `;`) có `giữa kỳ`, `thầy`, `đã gặp`, `ý chặn` bị xóa (vd cột "Dùng cho" của N7.16, N8.10).
- `replaceText`: `[/ — ví dụ từ bài giữa kỳ I/, ""]` (tiêu đề §2 hộp hình).
- Xóa phần đuôi ô bắt đầu bằng ` — ⚠️`, và các dòng blockquote `>` ở đầu file. Thay bằng 1 dòng `> Nguồn: hub \`<source>\` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts).`
- Cột "Ví dụ (đã kiểm)" của bảng câu phụ (rút gọn §3) bị xóa: có đáp số.

`GENERIC_PATTERNS`:
```ts
[/đã gặp ở/i, /\bthầy\b/i, /cô giáo/i, /đề cương/i, /giữa kỳ/i, /barem/i, /⚠️/, /HS-[69]A/, /trường\s+THCS/i, /chuyên\s+(Anh|Toán)/i, /@[a-z0-9.-]+\.[a-z]{2,}/i]
```

- [ ] **Step 1: tests** (fixture bịa, không chép file hub thật)
```ts
// tests/knowledge/sanitize.test.ts
import { describe, expect, it } from "vitest";
import { sanitize } from "@/scripts/knowledge/sanitize";
const MD = [
  "# Bản đồ X · v0.2", "> Lập: … ghi chú riêng", "",
  "| Mã | Bài | Lỗi hay gặp | Nền cần | Đề cương HK I |", "|---|---|---|---|---|",
  "| T9.4 | PT quy về PT bậc nhất | 🎯 **thiếu ĐKXĐ** (đã gặp ở HS-9A; barem −0,25) | N8.02 | D1 bài 1 |", "",
  "| Mã | Kiến thức | Lớp | Dùng cho |", "|---|---|---|---|",
  "| N8.02 | Hằng đẳng thức — ⚠️ **HS-9A chưa thuộc** (thầy 14/11) | 8 | T9.4 |", "",
  "## 4. Dạng đề cương HK I ↔ mã KU", "| D1 | T9.2 |", "", "## 5. Lớp ưu tiên", "ok",
].join("\n");
describe("sanitize", () => {
  const out = sanitize(MD, "BAN_DO_X_v0.2.md");
  it("drops the school column, private notes and sections", () => {
    expect(out).toContain("| Mã | Bài | Lỗi hay gặp | Nền cần |\n|---|---|---|---|");
    expect(out).toContain("| T9.4 | PT quy về PT bậc nhất | 🎯 **thiếu ĐKXĐ** | N8.02 |");
    expect(out).toContain("| N8.02 | Hằng đẳng thức | 8 | T9.4 |");
    expect(out).not.toMatch(/đã gặp|barem|thầy|⚠️|Đề cương|D1 bài/);
    expect(out).toContain("## 5. Lớp ưu tiên");
  });
  it("drops private parts of a cell", () => {
    const t = sanitize("| Mã | Kiến thức | Dùng cho |\n|---|---|---|\n| N7.16 | Đường cao | T9.28; **bài giữa kỳ IV.2b2** |", "X");
    expect(t).toContain("| N7.16 | Đường cao | T9.28 |");
  });
  it("replaces the header notes with one source line", () => {
    expect(out.split("\n").filter((l) => l.startsWith(">"))).toEqual(["> Nguồn: hub `BAN_DO_X_v0.2.md` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts)."]);
  });
});
// tests/knowledge/privacy.test.ts
import { privacyHits } from "@/scripts/knowledge/privacy";
it("finds generic private markers and extra terms", () => {
  expect(privacyHits("dòng 1\nlỗi (đã gặp ở HS-9A)").map((h) => h.line)).toEqual([2]);
  expect(privacyHits("Bé Xyz làm bài", ["Xyz"])).toHaveLength(1);
  expect(privacyHits("Tam giác đồng dạng g.g")).toEqual([]);
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Code. Chỉnh `tsconfig`/`vitest.config` alias nếu `@/scripts` chưa trỏ được. CLI `node --experimental-strip-types scripts/knowledge/sanitize.ts`: đọc `knowledge/hub/<hub>` theo `SOURCES` → ghi `knowledge/src/<out>.md`. Sau khi ghi, chạy `privacyHits` trên kết quả; có dòng nào khớp thì in số dòng (không in nội dung) rồi `exit 1`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(knowledge): sanitize hub sources for the public repo, privacy check`.

### Task 2: Nguồn sạch + MAP (checklist, hộp công cụ) + DOMAIN

**Files:** Create `knowledge/src/toan9.md`, `toan6.md`, `hinh9.md`, `rutgon9.md` (sinh bằng Task 1 từ 4 file hub, **đọc lại toàn bộ** trước khi commit), `knowledge/src/MAP.md` (viết tay). Modify `docs/DOMAIN.md` (§0 D25, D27 ✅; §4.10b lớp 6 *Đề xuất*; §4.13 ghi chốt; change log).

- [ ] **Step 1:** Tải 4 file hub (`project_read`) vào `knowledge/hub/` (gitignore). Chạy sanitize. Đọc từng file kết quả, tìm chữ riêng còn sót, nếu có thì sửa `RULES` (không sửa tay md). Chạy privacy với `PRIVATE_TERMS` lấy từ biến môi trường cục bộ.
- [ ] **Step 2:** Viết `knowledge/src/MAP.md`:
```markdown
# Bảng nối KU → checklist, hộp công cụ (soạn trong repo, phụ huynh duyệt khi merge)

## Checklist lớp 9 (DOMAIN §4.10)
| # | Mục |
|---|---|
| 1 | PT chứa ẩn ở mẫu: có ĐKXĐ và đã loại nghiệm không thỏa |
| 2 | Có câu kết luận đúng (PT, BPT, hệ PT) |
| 3 | Bài lập PT/HPT: điều kiện của ẩn đúng, có đơn vị |
| 4 | Làm tròn: có dấu "≈" |
| 5 | Hình vẽ đúng giả thiết |
| 6 | Có câu kết luận cho từng ý |
| 7 | Rút gọn đến tận cùng (tử, mẫu không còn nhân tử chung) |
| 8 | Kết luận trả lời đúng đại lượng đề hỏi |
| 9 | Nhân/chia hai vế BPT với số âm thì đổi chiều |
| 10 | Kết quả hợp lý ngoài đời |

## Checklist lớp 6 (DOMAIN §4.10b — Đề xuất 16/11)
| # | Mục |
|---|---|
| 1 | Câu trả lời đúng điều đề hỏi, có đơn vị |
| 2 | Bài "nhiều nhất / ít nhất": chọn đúng ƯCLN hay BCNN |
| 3 | Bài có điều kiện "trong khoảng", "từ … đến …": đã đối chiếu, chọn đúng số |
| 4 | Viết tập hợp: đủ dấu { }, đủ phần tử, không lặp |
| 5 | Thử lại kết quả (thay vào đề hoặc ước lượng) |

## KU → mục checklist, hộp công cụ
| KU | Checklist | Hộp công cụ |
|---|---|---|
| T9.2 | 2, 6 | — |
| T9.3, T9.21 | 2, 3, 6, 8, 10 | — |
| T9.4 | 1, 2, 6 | rutgon.0 |
| T9.5, T9.6 | 2, 6, 9 | — |
| T9.7, T9.8, T9.9, T9.10 | 6, 7 | rutgon.0, rutgon.1, rutgon.3, rutgon.4 |
| T9.12, T9.15, T9.31, T9.32 | 4, 6, 10 | — |
| T9.13, T9.14, T9.16, T9.17, T9.27, T9.28, T9.29 | 5, 6 | hinh.0, hinh.1.1–hinh.1.10 |
| T9.19, T9.20 | 2, 6 | — |
| (lớp 9, KU khác) | 6 | — |
| T6.1 | 4 | — |
| T6.11, T6.12 | 1, 2, 3, 5 | — |
| T6.20, T6.27, T6.31 | 1, 5 | — |
| (lớp 6, KU khác) | 1, 5 | — |

## KU là bài hình chứng minh khi đề có "chứng minh"
T9.13, T9.14, T9.16, T9.17, T9.27, T9.28, T9.29
```
- [ ] **Step 3:** DOMAIN:
  - §0: D25, D27 → ✅ 16/11, ghi lại câu chốt Q1–Q4.
  - Thêm §4.10b: bảng lớp 6 ở trên kèm `*Đề xuất 16/11 — chờ phụ huynh chốt*`. Ví dụ: (a) lớp 6 nộp bài BCNN đúng số, cô chưa hỏi mục nào → chưa `self_solved`, cô hỏi mục 3; (b) đã hỏi mục 3, máy xác nhận → `self_solved`.
  - §4.13: thêm ví dụ chuẩn (a) con không tách được x − 9 → `prereq_gap = N8.02`, `problems.prereq_gaps` ∋ `N8.02`, 1 dòng `diagnoses(concept, N8.02)`; (b) lượt dạy bù thứ 3 liền nhau → ⑥ ghi `day_bu_nen: 2/2 — quay lại bài gốc`.
  - Change log 16/11.
- [ ] **Step 4:** commit `docs(knowledge): public-safe sources, KU map (checklists, toolbox), DOMAIN D25/D27, §4.10b`.

### Task 3: Schema + script sinh JSON

**Files:** Create `lib/knowledge/schema.ts`, `scripts/knowledge/build.ts`, `knowledge/knowledge.json`, `knowledge/KNOWLEDGE_VERSION`, `tests/knowledge/build.test.ts`; Modify `package.json` (`knowledge`, `knowledge:check`), `.github/workflows/ci.yml` (job `node`: `npm run knowledge:check` với `PRIVATE_TERMS: ${{ secrets.PRIVATE_TERMS }}`).

**Interfaces — Produces:**
```ts
// lib/knowledge/schema.ts
export const ROOTS = ["read", "concept", "strategy", "calc", "careful"] as const;
export const KU_CODE = /^(T6|T9|N7|N8|TH)\.[0-9]{1,2}$/;
export const KnowledgeUnit = z.object({
  code: z.string().regex(KU_CODE), grade: z.union([z.literal(6), z.literal(9)]), // the grade whose program it serves
  level: z.enum(["bai", "nen"]), term: z.enum(["HK1", "HK2", "nen"]), chapter: z.string(), title: z.string(),
  core: z.string(), problemTypes: z.string(), errors: z.array(z.object({ root: z.enum(ROOTS).nullable(), text: z.string() })),
  prereqs: z.array(z.string().regex(KU_CODE)), usedBy: z.array(z.string()),
  checklist: z.array(z.number().int().min(1).max(10)), toolbox: z.array(z.string()), proof: z.boolean(),
});
export const ToolboxSection = z.object({ id: z.string().regex(/^(hinh|rutgon)\.[0-9.]+$/), title: z.string(), text: z.string() });
export const ChecklistItem = z.object({ grade: z.union([z.literal(6), z.literal(9)]), n: z.number().int(), text: z.string() });
export const KnowledgeBundle = z.object({ version: z.string(), units: z.array(KnowledgeUnit), toolbox: z.array(ToolboxSection), checklist: z.array(ChecklistItem) });
export type KnowledgeUnit = z.infer<typeof KnowledgeUnit>; // (and the other three)
// scripts/knowledge/build.ts
/** Pure: the four sources + MAP → bundle (version = date + first 8 hex of sha256 of the sources). */
export function buildBundle(src: Record<"toan9" | "toan6" | "hinh9" | "rutgon9" | "MAP", string>, date: string): KnowledgeBundle;
export function parseTables(md: string): { heading: string; header: string[]; rows: string[][] }[];
```

Quy tắc đọc:
- Mỗi bảng có cột `Mã` khớp `KU_CODE` là một KU. `heading` gần nhất (`### Chương …`) là `chapter`.
- KU nằm dưới `## 1.` thì `term` = HK1, dưới `## 2.` thì HK2. Bảng nền (cột `Kiến thức`) cho `level` = nen, `term` = nen, `usedBy` lấy từ cột "Dùng cho".
- `errors`: tách theo `;`. Ký hiệu đầu đoạn đổi sang gốc lỗi: 📖 → read, 🧩a → concept, 🧩b → strategy, 🧮 → calc, 🎯 → careful, không có ký hiệu → null. Bỏ `**`.
- `prereqs`: mọi mã khớp `KU_CODE` trong cột "Nền cần" (bỏ phần ngoặc).
- `checklist`, `toolbox`, `proof` lấy từ MAP. `hinh.1.1–hinh.1.10` mở thành 10 id.
- Toolbox: `hinh9.md` thì mục `## 0` → `hinh.0`, `### 1.k` → `hinh.1.k`, `### 2.3` → `hinh.2.3`. `rutgon9.md` thì mục `## k` → `rutgon.k`. `text` là markdown của mục, cắt ≤ 1.400 ký tự (cắt theo dòng, thêm `…`).

- [ ] **Step 1: tests** (đọc file thật trong `knowledge/src/`, kiểm giá trị chuẩn theo bản đồ chương trình)
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/scripts/knowledge/build";
import { KnowledgeBundle } from "@/lib/knowledge/schema";
const src = Object.fromEntries(["toan9", "toan6", "hinh9", "rutgon9", "MAP"].map((k) => [k, readFileSync(`knowledge/src/${k}.md`, "utf8")])) as never;
const b = buildBundle(src, "2026-11-16");
const ku = (c: string) => b.units.find((u) => u.code === c)!;
describe("knowledge build", () => {
  it("is valid and covers both programs", () => {
    expect(() => KnowledgeBundle.parse(b)).not.toThrow();
    expect(b.units.filter((u) => u.grade === 9 && u.level === "bai")).toHaveLength(32);
    expect(b.units.filter((u) => u.grade === 6 && u.level === "bai")).toHaveLength(43);
  });
  it("T9.9: prereqs, roots, checklist 6–7, rút gọn toolbox", () => {
    expect(ku("T9.9")).toMatchObject({ term: "HK1", prereqs: ["T9.7", "T9.8", "N8.02", "N8.05"], checklist: [6, 7] });
    expect(ku("T9.9").errors.map((e) => e.root)).toContain("careful");
    expect(ku("T9.9").toolbox).toEqual(["rutgon.0", "rutgon.1", "rutgon.3", "rutgon.4"]);
  });
  it("background unit N8.02 and HK II unit T9.20", () => {
    expect(ku("N8.02")).toMatchObject({ level: "nen", title: "Hằng đẳng thức đáng nhớ" });
    expect(ku("T9.20")).toMatchObject({ term: "HK2", prereqs: ["T9.19"] });
  });
  it("grade 6: T6.12 errors and checklist 1, 2, 3, 5; proof flags only on geometry", () => {
    expect(ku("T6.12").checklist).toEqual([1, 2, 3, 5]);
    expect(ku("T9.16").proof).toBe(true);
    expect(ku("T9.9").proof).toBe(false);
  });
  it("toolbox sections exist for every id a unit points to, and hold no worked answers", () => {
    const ids = new Set(b.toolbox.map((t) => t.id));
    for (const u of b.units) for (const t of u.toolbox) expect(ids, `${u.code} → ${t}`).toContain(t);
    expect(JSON.stringify(b.toolbox)).not.toContain("3/(3 − √x)");
  });
  it("same sources → same version", () => {
    expect(buildBundle(src, "2026-11-16").version).toBe(b.version);
    expect(b.version).toMatch(/^2026-11-16\.[0-9a-f]{8}$/);
  });
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Code.
  - `npm run knowledge` = sanitize (chỉ khi có `knowledge/hub/`), build, rồi ghi `knowledge/knowledge.json` (JSON đẹp, khóa theo thứ tự cố định) + `KNOWLEDGE_VERSION`. Ngày = ngày VN lúc chạy.
  - `npm run knowledge:check` = build lại trong bộ nhớ với **ngày lấy từ `KNOWLEDGE_VERSION`** rồi so với file: lệch thì báo "chạy npm run knowledge". Sau đó `privacyHits` trên `knowledge/src/*.md` và `knowledge.json` với `PRIVATE_TERMS`.
- [ ] **Step 4:** PASS; `npm run knowledge:check` xanh.
- [ ] **Step 5:** commit `feat(knowledge): build knowledge.json from the sources, CI check`.

### Task 4: Nạp + thẻ ⑤ + lookup text + danh mục cho bộ phân loại

**Files:** Create `lib/knowledge/load.ts`, `lib/knowledge/card.ts`, `tests/knowledge/card.test.ts`; Modify `next.config.ts` nếu cần (`knowledge.json` import tĩnh nên tự có trong bundle).

**Interfaces — Produces:**
```ts
// lib/knowledge/load.ts
export const KNOWLEDGE: KnowledgeBundle;           // parsed once (zod) from knowledge/knowledge.json
export const knowledgeVersion: string;
export function unit(code: string): KnowledgeUnit | null;
/** A KU code is usable for a grade: grade 9 → T9, N7, N8; grade 6 → T6, TH. */
export function codeFitsGrade(code: string, grade: 6 | 9): boolean;
// lib/knowledge/card.ts
export const CARD_MAX = 3500, LOOKUP_MAX = 1500;
export function checklistFor(code: string | null, grade: 6 | 9): { n: number; text: string }[];
/** Layer ⑤. null code → the "unknown" card (checklist defaults of the grade + lookup hint). */
export function knowledgeCard(code: string | null, grade: 6 | 9): string;
/** The lookup tool: a KU card (short) or a toolbox section; null when the code is unknown. */
export function lookupText(code: string): string | null;
/** One line per KU of the grade's program (code · title), for the classifier prompt. */
export function kuIndex(grade: 6 | 9): string;
```

Thẻ ⑤ (ví dụ T9.9):
```text
[KIẾN THỨC — bài này] T9.9 · Biến đổi đơn giản và rút gọn biểu thức chứa căn (HK1, Chương 3)
Cốt lõi: …
Dạng bài: …
Lỗi hay gặp: [calc] quy đồng sai · [careful] không đối chiếu ĐK · …
Kiến thức nền: T9.7 Căn bậc hai… · T9.8 … · N8.02 Hằng đẳng thức đáng nhớ · N8.05 …
  → Em vướng đúng phần nền: dạy bù ≤ 2 lượt (ky_thuat day_bu_nen, điền prereq_gap = mã nền), rồi quay lại bài.
Checklist trước khi chốt (hỏi theo dạng bài, ghi số vào checklist_da_hoi): 6. … · 7. …
Hộp công cụ (tra bằng lookup): rutgon.0 Hằng đẳng thức · rutgon.1 Quy trình rút gọn 6 bước · rutgon.3 Câu phụ · rutgon.4 Kịch bản gợi ý
[hộp công cụ rutgon.1 — chép sẵn]
…
```
- Thẻ chép sẵn **mục hộp công cụ đầu tiên** sau `.0`. Bài hình chép `hinh.0` (ba bước khi "không biết bắt đầu"). Phải giữ trong `CARD_MAX`: cắt mục chép sẵn trước, không bao giờ cắt checklist.
- Mã lạ thì trả thẻ chưa xác định: `[KIẾN THỨC — chưa xác định] … Checklist mặc định lớp N: … Tra kiến thức bằng lookup("T9.x")`.

- [ ] **Step 1: tests**
```ts
import { describe, expect, it } from "vitest";
import { CARD_MAX, LOOKUP_MAX, checklistFor, knowledgeCard, kuIndex, lookupText } from "@/lib/knowledge/card";
import { codeFitsGrade } from "@/lib/knowledge/load";
describe("knowledge card", () => {
  it("T9.9 card: prereq N8.02, checklist 6 and 7, toolbox ids, within the limit", () => {
    const c = knowledgeCard("T9.9", 9);
    expect(c).toContain("N8.02");
    expect(c).toMatch(/6\. .*\n?.*7\. /s);
    expect(c).toContain("rutgon.1");
    expect(c.length).toBeLessThanOrEqual(CARD_MAX);
  });
  it("geometry KU carries hinh.0 (three steps); grade 6 card has the grade 6 checklist", () => {
    expect(knowledgeCard("T9.16", 9)).toContain("hinh.0");
    expect(checklistFor("T6.12", 6).map((i) => i.n)).toEqual([1, 2, 3, 5]);
    expect(checklistFor(null, 6).map((i) => i.n)).toEqual([1, 5]);
    expect(checklistFor(null, 9).map((i) => i.n)).toEqual([6]);
  });
  it("unknown code → the unknown card, never throws", () => {
    expect(knowledgeCard("T9.99", 9)).toContain("[KIẾN THỨC — chưa xác định]");
    expect(knowledgeCard(null, 6)).toContain("[KIẾN THỨC — chưa xác định]");
  });
  it("lookup: a KU, a toolbox section, unknown", () => {
    expect(lookupText("N8.02")).toContain("Hằng đẳng thức");
    expect(lookupText("hinh.1.10")!.length).toBeLessThanOrEqual(LOOKUP_MAX);
    expect(lookupText("xyz")).toBeNull();
  });
  it("grade filter and index", () => {
    expect([codeFitsGrade("N8.02", 9), codeFitsGrade("T6.12", 9), codeFitsGrade("TH.04", 6)]).toEqual([true, false, true]);
    expect(kuIndex(9).split("\n").filter((l) => l.startsWith("T9."))).toHaveLength(32);
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** Code. **Step 4:** PASS, typecheck, lint, build.
- [ ] **Step 5:** docs và PR A.
  - DESIGN §6: một file `knowledge/knowledge.json` thay cho `ku/*.json` + `toolbox/*.json`, kèm cách cập nhật.
  - PROGRESS: thêm dòng.
  - ROADMAP: G5 `in_progress`, feature "Kho kiến thức" `review`, thêm PR.
  - Commit `feat(knowledge): card for layer ⑤, lookup text, classifier index`.
  - Push, mở PR A. Mô tả gồm: không SQL, app chưa dùng kho; bố mẹ đọc `knowledge/src/*.md` để duyệt nội dung; **bố mẹ thêm Secret `PRIVATE_TERMS`** (tên thật của 2 con, tên trường, tên thầy cô, cách nhau dấu phẩy) trước khi merge.
  - Danh sách những gì đã bỏ khỏi bản công khai (để bố mẹ chép vào Hồ sơ dạy học ④) **chỉ ghi trong hub** (`deliverables/gia-su-ai/G5_PHAN_RIENG_HO_SO_2026-11-16.md`), không ghi trong PR.

---

## PR B — Cô dùng kho kiến thức (nhánh `feature/g5-knowledge-tutor`, sau khi PR A merge)

### Task 5: Bộ phân loại Haiku

**Files:** Create `prompts/classify.md`, `lib/tutor/classify.ts`, `tests/classify.test.ts`; Modify `lib/tutor/layers.ts` (+ `classify`).

**Interfaces:**
- Consumes: `kuIndex`, `unit`, `codeFitsGrade` (Task 4); `ModelClient`, `runTutorTurn`-style call (`lib/tutor/turn.ts`); `ImageData`.
- Produces:
```ts
export interface Classification { ku_code: string | null; exam_slot: string | null; geometry_proof: boolean }
export const EXAM_SLOT = /^HN10-[1-5][a-c]?(-y[12])?$/;
export interface ClassifyCall { model: string; raw: string; costUsd: number; tokens: { in: number; cached: number; out: number } }
/** Never throws: a failed or unreadable call gives the empty classification. */
export async function classifyProblem(client: ModelClient, d: { model: string; prompt: string },
  input: { grade: 6 | 9; statement: string | null; image?: ImageData }): Promise<{ output: Classification; call: ClassifyCall | null }>;
export const EMPTY: Classification; // { ku_code: null, exam_slot: null, geometry_proof: false }
```
  - Request:
    - system = `prompt` (cache) + `kuIndex(grade)` (cache);
    - user = ảnh (nếu có) + `"Lớp: N\nĐề (con gõ hoặc trong ảnh):\n<statement>"`;
    - structured output schema `{ ku_code: string|null, exam_slot: string|null, geometry_proof: boolean }`;
    - `max_tokens` 2000, `effort: "low"`.
  - Hậu kiểm:
    - `ku_code` phải tồn tại và hợp lớp (`codeFitsGrade`), sai thì `null`;
    - `exam_slot` chỉ nhận khi lớp 9 và khớp `EXAM_SLOT`, sai thì `null`;
    - `geometry_proof` chỉ `true` khi lớp 9 và (KU có `proof` hoặc model nói đúng).
  - `prompts/classify.md` (tiếng Việt):
    - chọn **một** mã trong danh mục, là bài SGK chứa kiến thức chính của đề; không chắc thì `null`;
    - `exam_slot` chỉ khi đề ghi rõ cấu trúc đề vào 10 Hà Nội (vd "Bài II … câu 3" → `HN10-2c`) hoặc con nói là đề ôn thi vào 10; không chắc thì `null`;
    - `geometry_proof` = đề yêu cầu **chứng minh** một tính chất hình học.
- [ ] **Step 1: tests**
```ts
import { describe, expect, it } from "vitest";
import { classifyProblem, EMPTY } from "@/lib/tutor/classify";
const reply = (o: object) => ({ content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", usage: { input_tokens: 400, output_tokens: 20 } });
const client = (o: object | Error) => ({ create: async () => { if (o instanceof Error) throw o; return reply(o) as never; } });
const d = { model: "claude-haiku-5-5", prompt: "P" };
describe("classifyProblem", () => {
  it("rút gọn → T9.9; a stated HN10 item keeps its slot", async () => {
    const r = await classifyProblem(client({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: false }), d, { grade: 9, statement: "Bài II câu 3 …" });
    expect(r.output).toEqual({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: false });
    expect(r.call?.costUsd).toBeGreaterThan(0);
  });
  it("9.18 hai đường cao, chứng minh → T9.x geometry_proof (Opus signal)", async () => {
    const r = await classifyProblem(client({ ku_code: "T9.16", exam_slot: null, geometry_proof: true }), d, { grade: 9, statement: "chứng minh AE·AC = AF·AB" });
    expect(r.output.geometry_proof).toBe(true);
  });
  it("grade 6: no slot, no proof flag, a grade 9 code is dropped", async () => {
    const r = await classifyProblem(client({ ku_code: "T9.9", exam_slot: "HN10-2c", geometry_proof: true }), d, { grade: 6, statement: "x" });
    expect(r.output).toEqual(EMPTY);
  });
  it("unknown code or a made-up slot → null; model down → EMPTY, no throw", async () => {
    expect((await classifyProblem(client({ ku_code: "T9.77", exam_slot: "HN10-9z", geometry_proof: false }), d, { grade: 9, statement: "x" })).output).toEqual(EMPTY);
    expect(await classifyProblem(client(new Error("529")), d, { grade: 9, statement: "x" })).toEqual({ output: EMPTY, call: null });
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** Code (giá theo `lib/anthropic.ts`). **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(tutor): Haiku classifier (KU, exam slot, geometry proof)`.

### Task 6: Công cụ `lookup`

**Files:** Create `lib/tools/lookup.ts`, `tests/lookup.test.ts`; Modify `lib/tools/defs.ts` (`ToolName` + `"lookup"`, `TOOL_DEFS` + định nghĩa), `lib/tutor/handlers.ts` (`toolSummary`), `eval/checks.ts` (`toolKeys` → `lookup:<code>`).

**Interfaces — Produces:**
```ts
export function runLookup(input: unknown): { ok: boolean; output: { text: string } | { error: "not_found" | "bad_input" } };
// defs: { name: "lookup", description: "Tra thẻ kiến thức theo mã KU (T9.9, N8.02, T6.12…) hoặc một mục hộp công cụ (hinh.1.7, rutgon.3). Dùng khi em vướng kiến thức nền hoặc cần cách làm theo mục tiêu.", input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"], additionalProperties: false } }
// toolSummary(lookup) → "lookup(N8.02 → ok)" | "lookup(xyz → error: not_found)"
```
- [ ] **Step 1: tests**
```ts
import { expect, it } from "vitest";
import { runLookup } from "@/lib/tools/lookup";
import { toolSummary } from "@/lib/tutor/handlers";
it("lookup: known, unknown, bad input; checker summary", () => {
  expect(runLookup({ code: "N8.02" })).toMatchObject({ ok: true, output: { text: expect.stringContaining("Hằng đẳng thức") } });
  expect(runLookup({ code: "xyz" })).toEqual({ ok: false, output: { error: "not_found" } });
  expect(runLookup({})).toEqual({ ok: false, output: { error: "bad_input" } });
  expect(toolSummary({ tool: "lookup", input: { code: "N8.02" }, output: { text: "…" }, ok: true, ms: 1, round: 0 })).toBe("lookup(N8.02 → ok)");
});
```
- [ ] **Step 2–4:** FAIL → code → PASS. **Step 5:** commit `feat(tools): lookup for knowledge units and toolbox sections`.

### Task 7: Repo — KU, ý đề, lỗ hổng nền, chẩn đoán, lượt dạy bù

**Files:** Modify `lib/tutor/repo.ts`, `tests/helpers/memoryRepo.ts`, `lib/db/supabaseRepo.ts`, `tests/handlers.test.ts` (dùng memoryRepo), `tests/repo.test.ts` (nếu có; nếu không thì kiểm qua handler).

**Interfaces — Produces:**
```ts
// ProblemRow gains:
kuCode: string | null; examSlot: string | null; prereqGaps: string[];
/** Shown tutor answers at the end of the thread with ky_thuat = day_bu_nen, counted back to the last other one. */
bridgeTurns: number;
// TutorRepo gains:
setClassification(problemId: string, c: { kuCode: string | null; examSlot: string | null; knowledgeVersion: string }): Promise<void>;
// ModelCallRecord.purpose: "tutor" | "guard" | "sibling" | "classify"
// SaveReplyInput gains:
kuCode: string | null;                 // value to store (unchanged = problem.kuCode)
prereqGaps: string[];                  // full new list (union)
diagnoses: { root: "read" | "concept" | "strategy" | "calc" | "careful" | "unknown"; source: "verified" | "self_reported"; kuCode: string | null }[];
```
- `supabaseRepo`:
  - `getProblemForChild` đọc thêm `ku_code`, `exam_slot`, `prereq_gaps`.
  - `bridgeTurns` tính từ `raw_output.ky_thuat` của các tutor call đã `shown`, theo thứ tự mới nhất trước (đã đọc ở G4 cho `checklistAsked`).
  - `saveReply` cập nhật `ku_code`, `prereq_gaps` và insert `diagnoses` (`family_id`, `child_id`, `problem_id`, `root`, `source`, `ku_code`) trong cùng bước ghi.
  - `setClassification` cập nhật `ku_code`, `exam_slot`, `knowledge_version`.
- `memoryRepo` làm tương đương (mảng `diagnoses`).
- [ ] **Step 1: tests** (memoryRepo trực tiếp):
```ts
it("classification, prereq gaps, diagnoses and bridge turns round-trip", async () => {
  const { repo, actor, problemId } = await seedProblem();          // existing helper of handlers tests
  await repo.setClassification(problemId, { kuCode: "T9.9", examSlot: null, knowledgeVersion: "2026-11-16.abcd1234" });
  let p = (await repo.getProblemForChild(problemId, actor.userId))!;
  expect([p.kuCode, p.examSlot, p.prereqGaps, p.bridgeTurns]).toEqual(["T9.9", null, [], 0]);
  await saveShown(repo, p, { ky_thuat: "day_bu_nen", prereq_gap: "N8.02" }, { prereqGaps: ["N8.02"], diagnoses: [{ root: "concept", source: "verified", kuCode: "N8.02" }] });
  p = (await repo.getProblemForChild(problemId, actor.userId))!;
  expect([p.prereqGaps, p.bridgeTurns, repo.diagnoses.length]).toEqual([["N8.02"], 1, 1]);
});
```
  `saveShown(repo, problem, outputPatch, extra)`: helper mới trong `tests/helpers/memoryRepo.ts`. Nó gọi `repo.saveReply` với một tutor call `shown: true`, `raw` = JSON few-shot 2 có `outputPatch`, cùng các trường bắt buộc khác giữ nguyên như problem.
- [ ] **Step 2–4:** FAIL → code → PASS (cả các test G2–G4).
- [ ] **Step 5:** commit `feat(repo): knowledge unit, exam slot, prereq gaps, diagnoses, bridge turns`.

### Task 8: Nối vào lượt (thẻ ⑤, chọn model, dạy bù, checklist lớp 6)

**Files:** Modify `lib/tutor/handlers.ts`, `lib/tutor/assemble.ts` (`TurnStateBlock.bridgeTurns`), `lib/tutor/deps.ts`, `prompts/method.md`, `prompts/PROMPT_VERSION` (→ `v0.5`), `tests/handlers.test.ts`, `tests/assemble.test.ts`.

**Interfaces:**
- Consumes: Task 4–7.
- Produces: `Deps.layers.classify: string`. `renderStateBlock` thêm dòng `day_bu_nen: <n>/2` (khi n ≥ 2: `day_bu_nen: 2/2 — đã đủ, quay lại bài gốc`).

Các bước trong `runClaimed`:
1. **Phân loại** khi `problem.kuCode === null && turn === 1 && left() >= 200_000`:
   - gọi `classifyProblem(d.client, { model: d.models.light, prompt: d.layers.classify }, { grade, statement: typed ?? null, image: photos[0]?.image })`;
   - rồi `setClassification(..., knowledgeVersion)`;
   - call (nếu có) thêm vào `calls` với `purpose: "classify"`, `shown: false`;
   - lỗi thì để `EMPTY`.
2. `kuCode = problem.kuCode ?? cls.ku_code`, `examSlot = problem.examSlot ?? cls.exam_slot`.
3. `pickModel({ …, geometryProof: cls.geometry_proof || problem.lastTutorFlags.includes("geometry_proof"), examSlot })`. Hàm `pickModel` đã xử lý lớp 9 (§4.14 h, i).
4. `assemble({ knowledgeCard: knowledgeCard(kuCode, grade), state: { …, kuCode, examSlot, bridgeTurns: problem.bridgeTurns } })`.
5. `run` thêm nhánh `name === "lookup"` → `runLookup(input)`.
6. Sau khi có `shown`:
   - `ku_code` mới = `shown.ku_code_de_xuat` khi hợp lớp **và** (`kuCode === null` hoặc lượt này xác nhận đề `de_da_xac_nhan && !problem.statementConfirmed`); ngược lại giữ.
   - `prereqGaps = union(problem.prereqGaps, shown.prereq_gap hợp lớp ? [it] : [])`.
   - `diagnoses`:
     - `prereq_gap` mới thì thêm 1 dòng `{ root: "concept", source: shown.goc_loi_da_kiem_tra ? "verified" : "self_reported", kuCode: gap }`;
     - nếu không thì, khi `goc_loi_da_kiem_tra && goc_loi_du_doan`, thêm 1 dòng `{ root, source: "verified", kuCode }`.
7. `decideOutcome({ …, checklistRequired: true })`. Lớp 6 kèm `// TODO(rule-unconfirmed) DOMAIN §4.10b (Đề xuất 16/11)`.

`prompts/method.md`:
- công cụ `lookup` (tra KU nền, mục hộp công cụ);
- `day_bu_nen` tối đa 2 lượt, ⑥ ghi `2/2` thì quay lại bài gốc;
- checklist lấy từ ⑤ (cả lớp 6);
- `ku_code_de_xuat` chỉ đổi khi chắc.

- [ ] **Step 1: tests** (client kịch bản phân biệt classify / tutor / guard qua `system`; viết đủ, không để trống)
```ts
it("§4.14 h: grade 9 proof problem, turn 1 → classifier says geometry_proof → Opus (geometry_proof)", async () => { /* classify reply {ku_code:"T9.16",geometry_proof:true}; expect c.models[tutor call] = strong, saved model_calls route_reason "geometry_proof", purpose classify recorded */ });
it("§4.14 i: grade 6 geometry → Sonnet", async () => { /* grade 6 actor, classify {ku_code:"T6.20",geometry_proof:false} → main model */ });
it("exam slot HN10-2c on grade 9 → Opus (exam_slot_hard); problem stores ku_code T9.9 + exam_slot", async () => { /* … */ });
it("layer ⑤ is the T9.9 card; classifier down → unknown card, Sonnet, turn still answered", async () => { /* inspect system[4].text */ });
it("§4.13 a: prereq_gap N8.02 → prereq_gaps [N8.02], one concept diagnosis on N8.02", async () => { /* tutor JSON ky_thuat day_bu_nen, prereq_gap N8.02 */ });
it("§4.13 b: after 2 bridge turns the state block says 2/2 — quay lại bài gốc", async () => { /* two turns with day_bu_nen, third request's user text contains "day_bu_nen: 2/2" */ });
it("ku_code changes only at confirmation (or when unknown)", async () => { /* classify T9.8; turn 1 confirms with ku_code_de_xuat T9.9 → T9.9; turn 2 suggests T9.4 → stays T9.9 */ });
it("§4.10b: grade 6 submitted, cas confirms, no checklist item asked → checklist_open; asked [3] → self_solved", async () => { /* … */ });
it("lookup runs and is shown to the checker", async () => { /* tool_use lookup N8.02 → guard request contains "lookup(N8.02 → ok)" */ });
```
- [ ] **Step 2–4:** FAIL → code → PASS toàn bộ; typecheck; lint; build.
- [ ] **Step 5:** commit `feat(tutor): knowledge card, classifier routing, prereq gaps, bridge limit, grade 6 checklist`.

### Task 9: Bộ test sư phạm + tài liệu + PR B

**Files:** Modify `eval/run.ts`, `eval/cases.ts`, `eval/checks.ts` (`Expect.kyThuat?: string[]`, `Expect.prereqGap?: string`), `tests/evalChecks.test.ts`, `docs/DESIGN.md` §4–6, `docs/PROGRESS.md`, `docs/ROADMAP.json`.

- [ ] **Step 1: eval**
  - `runCase` gọi `classifyProblem` (Haiku thật) khi ca là lượt 1 hoặc `c.kuCode` chưa đặt, rồi dùng `knowledgeCard(...)`. Thêm `EvalCase.kuCode?: string` để ca giữa bài có thẻ đúng.
  - Ghi `classification` vào kết quả.
  - Ca:
    - **9.17**: `forbid: ["19", "ngoài phạm vi", "chưa học"]`, kỳ vọng phân loại `T9.20`.
    - **9.18**: `kuCode` hình, `expect: { flags: ["geometry_proof"], buttonMatches: /đồng dạng/i, kyThuat: ["phan_tich_nguoc", "hop_cong_cu"] }`, phân loại `geometry_proof = true`.
    - **9.19** (mới): `history: started(RUT_GON)`, `childText: "em không biết x − 9 tách thế nào"`, `state: { hintLevel: 2, turn: 3 }`, `kuCode: "T9.9"`, `forbid: ["3/(3 − √x)"]`, `expect: { kyThuat: ["day_bu_nen"], prereqGap: "N8.02" }`, rubric "dạy bù hằng đẳng thức a² − b² ngắn, hỏi em tự tách, nói sẽ quay lại bài".
    - **6.x** (mới, lớp 6 checklist): bài BCNN "trong khoảng", con nộp đúng, `submitted: true`, `expect: { notSelfSolved: true }`, rubric "hỏi em soát mục 3 (đối chiếu khoảng)".
  - Xóa ghi chú "9.19 waits for G5" ở đầu `eval/cases.ts`.
- [ ] **Step 2:** docs.
  - DESIGN §4 bước 6–7 (phân loại, ⑤), §5 (`lookup`), §6 (cách cập nhật kho).
  - PROGRESS.
  - ROADMAP: G5 các tính năng chuyển `review`, thêm PR, `parentTodo` (chạy G0 các ca 9.17, 9.18, 9.19, 6.x, 9.16; chốt §4.10b lớp 6), log.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm test && npm run knowledge:check`; push; mở PR B (tiếng Việt).
  - **Không SQL.**
  - Cách thử trên link chính thức:
    - **Lớp 9:** gõ đề rút gọn P (như 9.16). Supabase `tutor.problems.ku_code` phải là `T9.9`, `model_calls` có `purpose = classify`. Trả lời "em không biết x − 9 tách thế nào" → cô dạy bù hằng đẳng thức rồi quay lại bài; `problems.prereq_gaps` có `N8.02`; `diagnoses` có dòng `concept`.
    - **Lớp 9:** gõ bài hình "chứng minh AE·AC = AF·AB" → lượt đầu đã chạy Opus (`route_reason = geometry_proof`).
    - **Lớp 6:** bài BCNN "trong khoảng", nộp đúng → cô hỏi một mục checklist trước khi công nhận xong.
  - Chạy G0 với `cases = 9.16,9.17,9.18,9.19,6.x,9.3`, models Sonnet + Opus.

---

## Tự soát

**Phủ spec:**

| Yêu cầu | Task |
|---|---|
| D25 kho sinh từ md hub, có `KNOWLEDGE_VERSION`, không sửa tay | 1–3 |
| Repo công khai (D9) — bản sạch, CI chặn | 1, 3 |
| DESIGN §5 `lookup` ≤ 1.500 ký tự | 4, 6 |
| Lớp ⑤ thẻ KU + KU nền + hộp công cụ + checklist theo dạng | 2, 4, 8 |
| Haiku phân loại `ku_code` lượt đầu; cô sửa khi xác nhận đề (DOMAIN §1) | 5, 8 |
| `problems.knowledge_version` | 7, 8 |
| §4.13 dạy bù ≤ 2 lượt, `prereq_gaps`, chẩn đoán `concept` có mã nền | 7, 8 |
| §4.13 bài HK II vẫn dạy (US16, 9.17) | 9 |
| §4.14 h, i (`geometry_proof` lớp 9), `exam_slot_hard` (D27) | 5, 8 |
| §4.10 checklist theo dạng (lớp 9) + §4.10b lớp 6 (Q3) | 2, 4, 8 |
| BO_TEST 9.17, 9.18, 9.19 | 9 |

**Ngoài lát (ghi PROGRESS):**
- Báo cáo tối đếm KU nền bị hổng → G7.
- `study_sessions.knowledge_version` → G7 (cần khi báo cáo theo buổi; bài đã có version).
- Câu ôn tự đề xuất từ chẩn đoán → G6.
- Hộp công cụ đại số khác (lập PT, lớp 6) → khi hub soạn xong.

**Placeholder:** test `/* … */` ở Task 8 đã ghi kịch bản dữ liệu và điều cần `expect`. Người làm phải viết đủ theo mẫu client kịch bản của G4 (`tests/handlers.test.ts`).

**Kiểu:** `KnowledgeUnit`, `KnowledgeBundle`, `knowledgeCard`, `lookupText`, `kuIndex`, `checklistFor`, `codeFitsGrade`, `Classification`, `classifyProblem`, `EMPTY`, `runLookup`, `setClassification`, `bridgeTurns`, `prereqGaps`, `diagnoses` dùng thống nhất ở Task 3–9.

**Rủi ro:**
1. **Lọt thông tin riêng lên repo công khai:**
   - luật làm sạch là danh sách cố định, có thể sót;
   - chặn bằng 3 lớp: Claude đọc lại toàn bộ trước commit, privacy check có `PRIVATE_TERMS` trong CI, bố mẹ đọc diff `knowledge/src/` khi merge.
2. **Phân loại sai KU** → thẻ ⑤ lệch bài. Cô vẫn đọc đề và sửa `ku_code` khi xác nhận; thẻ chỉ là gợi ý. G0 ghi tỉ lệ phân loại đúng.
3. **Lượt đầu chậm thêm** ~2–4 s (Haiku). Chỉ chạy khi còn ≥ 200 s.
4. **Cache:** ⑤ đổi khi `ku_code` đổi lúc xác nhận đề, nên cache phần ⑤ hỏng 1 lần mỗi bài. Chấp nhận được.
