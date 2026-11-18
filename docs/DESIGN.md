# DESIGN — Gia sư AI Toán · v0.1 (14/11/2026)

> Căn cứ: `docs/DOMAIN.md` (= hub DOMAIN_v0.4), `docs/SPEC.md`, hub `TICH_HOP_LAUNCHER_v0.2.md`, `SYSTEM_PROMPT_v0.2.md`. Canvas màn hình: https://claude.ai/artifact/T8ySbzJ29YWFA6Q7D56HVm · whiteboard kiến trúc: https://claude.ai/artifact/XaZqd5Zz3mp2ZYqrT8Cb2b

## 1. Kiến trúc

```text
Trình duyệt con / bố mẹ ── https://<launcher>/gia-su/...  (cùng tên miền Launcher, D20)
          │
          ▼  Launcher next.config rewrites: /gia-su/:path* → https://<gia-su-ai>.vercel.app/gia-su/:path*
┌────────────── Vercel project `gia-su-ai` (Services, sin1) ──────────────┐
│ service web: Next.js 16, basePath /gia-su                               │
│   app/ (màn hình) · app/api/* (route máy chủ, service role)              │
│   lib/ (luật thuần + tích hợp) · prompts/ · knowledge/                   │
│ service cas: FastAPI + SymPy (private, gọi bằng CAS_URL + CAS_SECRET)    │
└────────────────────────────────────────────────────────────────────────┘
          │ Supabase JS (anon + cookie phiên → RLS) / service role (ghi)
          ▼
Supabase `study-launcher`: public.profiles (Launcher) · schema tutor (SQL ở repo Launcher, D21) · Storage bucket `tutor-images`
          │
Anthropic API (Sonnet 5.5 / Haiku 5.5, prompt caching)      Launcher POST /api/internal/tutor-notify (D23) → Web Push bố mẹ
```

Phiên đăng nhập: cookie Supabase do Launcher đặt (mật khẩu 1 lần + PIN). Vì cùng tên miền, `gia-su-ai` đọc được cookie đó bằng `@supabase/ssr` với cùng `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`. Chưa đăng nhập → chuyển về `<launcher>/login?next=/gia-su`.

## 2. Thư mục

```text
app/
  layout.tsx · page.tsx                 # Bắt đầu buổi: ôn đầu buổi → nút "Em đang kẹt"
  hoi/[problemId]/page.tsx              # Màn hỏi bài (chat + nút + ảnh)
  bo-me/page.tsx · bo-me/tuan/page.tsx  # Báo cáo tối / tuần (chỉ parent)
  api/session/start/route.ts            # POST → {sessionId, review: ReviewCard[]}
  api/session/heartbeat/route.ts        # POST mỗi 30 giây
  api/session/end/route.ts              # POST
  api/problem/new/route.ts              # POST multipart (ảnh) hoặc text → {problemId, firstTurn}
  api/turn/route.ts                     # POST {problemId, clientMsgId, text?, button?} → TutorTurn
  api/review/answer/route.ts            # POST {itemId, clientMsgId, answer | skip}
  api/rating/route.ts                   # POST {sessionId, face, reasons, comment}
  api/parent/*                          # feedback, duyệt luật, xóa dữ liệu, về chế độ thường
  api/cron/sweep/route.ts               # 5 phút: đóng buổi bỏ dở; hằng ngày: xóa ảnh quá hạn
  api/cron/daily/route.ts               # 21:00 VN: dự báo chi phí, tổng hợp ngày
lib/
  env.ts · time.ts (dateVn) · auth.ts (getActor) · supabase/{server,admin}.ts
  rules/hints.ts · rules/nan.ts · rules/outcome.ts · rules/usage.ts · rules/review.ts · rules/solveGate.ts
  tutor/assemble.ts (ghép ①–⑥) · tutor/schema.ts (zod TutorOutput) · tutor/guard.ts · tutor/toolLoop.ts · tutor/turn.ts
  tools/mathCheck.ts · tools/lookup.ts · tools/makeSibling.ts · tools/defs.ts (JSON schema gửi model)
  anthropic.ts (client, pricing, cost) · images.ts (sharp: xóa EXIF, ≤ 1000 px, jpg) · notify.ts
  knowledge/schema.ts (zod KU, Toolbox) · knowledge/load.ts
prompts/ 01_vai_tro.md · 02_luat_cung.md · 03_phuong_phap.md · guard.md · PROMPT_VERSION
knowledge/ ku/*.json · toolbox/*.json · KNOWLEDGE_VERSION
scripts/ build-knowledge.ts · check-knowledge.ts
cas/ app/main.py · app/mathcheck.py · tests/ · pyproject.toml
spike/ run.ts · cases/*.json (từ docs/BO_TEST.md) · results/
tests/ (vitest) · e2e/ (Playwright)
vercel.json                              # services: web (nextjs), cas (python, private)
```

## 3. Kiểu dữ liệu chính (TypeScript)

```ts
type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;
type Verdict = 'dung' | 'sai' | 'khong_biet' | 'xin_dap_an' | 'ngoai_le' | 'khong_ap_dung';
type ProblemStatus = 'in_progress' | 'self_solved' | 'pending_review' | 'saved_for_later'
  | 'closed_offtopic' | 'abandoned' | 'timed_out';

interface TutorOutput {              // zod schema = structured output schema gửi model
  message: string; buttons: string[]; de_da_xac_nhan: boolean; ku_code_de_xuat: string | null;
  goc_loi_du_doan: 'read'|'concept'|'strategy'|'calc'|'careful'|'unknown'|null; goc_loi_da_kiem_tra: boolean;
  prereq_gap: string | null; danh_gia_luot_em: Verdict; u_level_hien_tai: 'U0'|'U1'|'U2'|'U3';
  ky_thuat: 'phan_tich_nguoc'|'hop_cong_cu'|'doc_hinh'|'dung_cau_truoc'|'kiem_tra_hop_ly'|'day_bu_nen'|'tu_giai_thich'|'thuong';
  checklist_da_hoi: number[]; ket_qua_bai: 'in_progress'|'self_solved'|'pending_review'|'saved_for_later';
  flags: ('geometry_proof'|'tutor_unsure'|'off_topic'|'injection_attempt')[];
}

interface ProblemState {             // đọc từ tutor.problems, máy chủ là chủ
  hintLevel: HintLevel; hintLevelMax: HintLevel; wrongCount: number; turnCount: number;
  nanJumps: number; uLevel: 0|1|2|3; status: ProblemStatus; offtopicCount: number;
  afterSibling: boolean;            // đã giải bài anh em ở H4, đang chờ con thử lại bài gốc
}

interface TurnEvent { kind: 'text' | 'button'; text: string; at: Date; }
```

## 4. Một lượt (`POST /api/turn`)

```text
1. getActor() → {userId, role:'child', familyId, childCode, grade}; 401 nếu không phải child
2. Đọc problem (service role) + kiểm problem.child_id = userId và status = 'in_progress'
3. clientMsgId đã có trong tutor.messages → trả lại kết quả cũ (idempotency), dừng
4. Lưu tin con (messages role=child)
5. Luật trước model (lib/rules):
   nan = isNanSignal(recentChildEvents)         (DOMAIN §4.2)
   pre = applyPreTurn(state, {nan})              → có thể nhảy H4, +nanJumps
   if turnCount + 1 >= 18 → cờ "đề nghị để dành" vào ⑥; = 20 → đóng timed_out sau lượt này
5b. (G5) Lượt 1 của bài, `ku_code` chưa có, còn ≥ 200 s: Haiku phân loại (`lib/tutor/classify.ts`, `purpose = classify`) → `ku_code` (hợp lớp), `exam_slot` (chỉ lớp 9, chỉ khi đề ghi rõ — D27), `geometry_proof` → `problems.ku_code/exam_slot/knowledge_version`. Lỗi → bỏ qua (thẻ "chưa xác định")
6. Ghép prompt: ①②③ (cache) + ④ hồ sơ đã duyệt (cache) + ⑤ thẻ KU `knowledgeCard(ku_code, lớp)` (cache) + lịch sử bài + ⑥ trạng thái (có `ku_code`, `exam_slot`, `day_bu_nen: n/2`)
7. Chọn model (DOMAIN §4.14, D28, `lib/rules/model.ts`): Sonnet; Opus khi nản / ≥ H3 / lượt trước cô `tutor_unsure` / (G5) lớp 9 bài hình chứng minh (bộ phân loại hoặc cờ `geometry_proof` lượt trước) / ý chặn `exam_slot`
   (G5: bài chứng minh hình 9, câu thi khó); bài đã lên Opus thì ở lại Opus; tháng ≥ 45 USD (D29) → chỉ Sonnet.
   toolLoop (G4, tối đa 3 lần gọi công cụ) với output_format JSON schema
8. Guard Haiku (`lib/tutor/guard.ts`, fail-closed) trên TutorOutput + danh sách tool đã gọi → pass | viết lại 1 lần
   trên Opus (Sonnet khi Opus tạm ngừng) | câu an toàn theo mức (blocked). Cả lượt có hạn TURN_BUDGET_MS = 240 s
9. Luật sau model: nextHintLevel(state, output.danh_gia_luot_em); outcome = decideOutcome(state, output, toolLog); (G5) `ku_code` đổi theo `ku_code_de_xuat` khi cô xác nhận đề (hoặc khi chưa có); `prereq_gap` hợp lớp → `problems.prereq_gaps` + `diagnoses(concept)`; checklist bắt buộc cả lớp 6 (§4.10b, chờ chốt)
   (solveGate: self_solved cần math_check đạt — DOMAIN §4.12; bài chứng minh → pending_review)
10. Ghi: messages(tutor), model_calls (raw_output + tokens + cost), tool_calls, problems (state mới), diagnoses, usage_monthly += cost
11. usage ≥ 45 USD → model_mode = economy (= tạm ngừng Opus, không có chế độ trả lời tiết kiệm — D29) + notify (D23, G7)
12. Trả {message, buttons, hintLevel, status, turnCount}
```

Chi phí mỗi lời gọi: `cost = (in − cached) × giá_in + cached × giá_cache_read + out × giá_out` (giá trong `lib/anthropic.ts`, đọc từ trang giá chính thức khi build; ghi ngày tra).

## 5. Công cụ
| Tên | Ở đâu | Ghi chú |
|---|---|---|
| `math_check` | `lib/tools/mathCheck.ts` + `casClient.ts` → HTTP `<CAS_URL hoặc CAS_SERVICE_URL>/check` (header `x-cas-secret`), timeout 5 s. `cas` là service **riêng tư** trong cùng project Vercel (Vercel Services, `vercel.json`; không có rewrite nên không có đường công khai; `web` gọi qua binding) | Các mode: equivalent, simplify_check, solve, check_root, evaluate, inequality, domain, **solve_system, check_solution** (G4); biểu thức có `gcd`/`lcm` |
| `lookup` | `lib/tools/lookup.ts` → `lookupText` (`knowledge/knowledge.json`) | Mã KU (T9.9, N8.02, T6.12…) hoặc mục hộp công cụ (hinh.1.7, rutgon.3); ≤ 2.400 ký tự; `{error: not_found}` khi mã lạ (G5) |
| `make_sibling` | `lib/tools/makeSibling.ts` + `prompts/sibling.md`: gọi Sonnet (purpose=sibling) sinh đề + lời giải + đáp số + **lệnh kiểm** (`check_solution` / `check_root` / `equivalent`) → máy chạy lệnh kiểm → so tập số với đề gốc (trùng ≤ 1 số, không trùng hết) | Không đạt → thử lại 1 lần; vẫn không → `verified=false` |
| *(vòng)* | `lib/tutor/toolLoop.ts`: ≤ 3 vòng công cụ mỗi câu trả lời, giữ nguyên khối thinking; vòng chỉ chạy khi lượt còn ≥ 70 s; hết vòng/giờ → `tool_choice: none`; câu đề nghị `self_solved` chưa có `math_check` xác nhận → nhắc 1 lần | `tool_calls.model_call_id` = câu trả lời mà công cụ phục vụ |

## 6. Kho kiến thức (G5, D25 ✅ 16/11)
**Nguồn:** 4 file đã duyệt trong hub (BAN_DO_CHUONG_TRINH_TOAN9 v0.2, …TOAN6 v0.1, HOP_CONG_CU_HINH_9 v0.2, HOP_CONG_CU_RUT_GON_9 v0.1).
- Repo công khai, nên `scripts/knowledge/sanitize.ts` làm sạch trước khi đưa vào repo: bỏ cột đề cương, bỏ ghi chú về con/thầy/trường, bỏ ví dụ trên đề của trường và ví dụ có đáp số. Kết quả ghi vào `knowledge/src/{toan9,toan6,hinh9,rutgon9}.md`.
- Bản gốc chỉ nằm ở `knowledge/hub/` (gitignore).
- `knowledge/src/MAP.md` soạn trong repo: checklist lớp 9 (§4.10), lớp 6 (§4.10b), KU → mục checklist + mục hộp công cụ, KU hình chứng minh.

**Sinh:** `npm run knowledge` = sanitize + `scripts/knowledge/build.ts` → `knowledge/knowledge.json` (101 KU, 16 mục hộp công cụ, checklist) + `knowledge/KNOWLEDGE_VERSION` (`ngày.hash8` của nguồn).

**Kiểm (CI, job node):** `npm run knowledge:check`
- build lại trong bộ nhớ; JSON lệch nguồn thì báo đỏ;
- quét chữ riêng tư: mẫu chung trong `scripts/knowledge/privacy.ts` + tên thật từ Secret `PRIVATE_TERMS`, không bao giờ ghi trong repo.

**Cập nhật khi thầy/bố mẹ góp ý:**
1. Sửa md trong hub.
2. Tải về `knowledge/hub/`, rồi `npm run knowledge`.
3. Đọc lại diff `knowledge/src/`.
4. Mở PR.

Không sửa tay JSON.

**Dùng** (`lib/knowledge/`):
- `knowledgeCard(code, grade)` = lớp ⑤ ≤ 3.500 ký tự: KU, lỗi hay gặp, KU nền, checklist theo dạng, danh sách mục hộp công cụ, một mục chép sẵn.
- `lookupText(code)` cho công cụ `lookup` (≤ 2.400 ký tự; mục 1.10 đồng dạng dài ~2.100 ký tự nên nâng từ 1.500).
- `kuIndex(grade)` là danh mục cho bộ phân loại Haiku.
- `checklistFor(code, grade)`.

```ts
interface KnowledgeUnit {            // lib/knowledge/schema.ts (zod)
  code: string; grade: 6 | 9; level: "bai" | "nen"; term: "HK1" | "HK2" | "nen"; chapter: string; title: string;
  core: string; problemTypes: string; errors: { root: Root | null; text: string }[];
  prereqs: string[]; usedBy: string[]; checklist: number[]; toolbox: string[]; proof: boolean;
}
```

## 7. Bảo mật và riêng tư
- RLS + quyền theo DOMAIN §2 (SQL + test ở repo Launcher). `lib/supabase/admin.ts` có `import "server-only"`.
- Ảnh (G3, phụ huynh chốt 15/11/2026): **máy con** đọc ảnh (iPad đọc cả HEIC), xoay đứng, thu về ≤ 2048 px, JPEG → gửi multipart ≤ 4 MB (dưới giới hạn 4,5 MB của Vercel). **Máy chủ** `lib/images.ts` (`sharp`) đọc lại (chỉ jpeg/png/webp), xoay theo EXIF, **bỏ toàn bộ metadata**, thu về cỡ chuẩn Claude **≤ 1568 px và ≤ 1568 token hình** (ô 28 px; A4 1075×1520 → 924×1307), JPEG q80 → Storage private `tutor-images/<child_id>/<problem_id>/<uuid>.jpg` (Launcher 0019; không policy cho trình duyệt) + dòng `attachments` có `message_id`; URL ký hạn 10 phút. Tối đa **4 ảnh/bài** (ảnh đề + ảnh bài làm). Mỗi lượt máy chủ tải lại ảnh của bài, gắn vào đúng tin của con; ảnh mới nhất là cache breakpoint thứ 4. Bộ kiểm tra thấy ảnh đề tới khi có `confirmed_statement`. "Chụp lại" = bài mới, bài cũ chưa xác nhận đề → `abandoned`. "Sai chỗ…" ≥ 2 lần → màn gợi ý gõ đề / chụp lại.
- Model chỉ thấy mã con (`child_code`) và lớp. Không gửi `display_name`.
- Header bảo mật giống Launcher; không log nội dung tin nhắn.

## 8. Giao diện
Theo canvas. Chế độ e-ink (`device = boox`): không animation/transition, chữ đen trên nền trắng, viền 2px, nút ≥ 48px, phân trang theo lượt thay cho cuộn dài, ảnh chỉ đen trắng.

## 9. Các lát build (mỗi lát = 1 PR; L-x là PR bên repo Launcher)
| Lát | Nội dung | Phụ thuộc | Nghiệm thu chính |
|---|---|---|---|
| **G0** | Spike chọn model: `spike/run.ts` chạy bộ test sư phạm trên Haiku/Sonnet/Opus (math_check giả lập bằng `cas/` chạy local) | API key D19 | Bảng kết quả + chọn model (BO_TEST §1) |
| **L-0** | SQL `0017_tutor_schema.sql` + `rls_tutor_test.sql` + `test-db.sh` chạy thêm test | — | CI Launcher xanh; phụ huynh merge |
| **G1** | **Walking skeleton**: scaffold Next (basePath), `getActor`, bắt đầu buổi, con gõ đề → 1 lượt Sonnet (structured output) → hiện; ghi sessions/problems/messages/model_calls; deploy Vercel | L-0 | Con thật đăng nhập qua Launcher, gõ đề, nhận lượt xác nhận đề trên preview |
| **L-1** | Rewrite `/gia-su/*` (biến `TUTOR_APP_ORIGIN`) + 2 cửa vào trong **Góc học tập** (thẻ "Cô gia sư Toán"; nút "Em kẹt bài này? Hỏi cô" khi việc là môn Toán — phụ huynh duyệt 14/11) + cập nhật CLAUDE.md Launcher (T1, D20–D21). Không SQL | G1 deploy | Bấm thẻ trong Góc học tập mở được gia sư, không đăng nhập lại |
| **G2** | Luật máy chủ: hints, nan, outcome, 20 lượt, idempotency, guard Haiku, câu an toàn, **chọn model mỗi lượt** (`lib/rules/model.ts`: Sonnet mặc định → Opus khi guard chặn / nản / ≥ H3 / `tutor_unsure`, giữ Opus đến hết bài; tạm ngừng Opus ở ~45 USD — DOMAIN §4.14, D28–D29) + SQL `model_calls.route_reason` bên Launcher | G1 | DOMAIN §4.1–4.4, §4.14 a–g, j bằng Vitest; bộ test 9.2, 9.3, 9.12–9.15 |
| **G3** | Ảnh: upload, xóa EXIF, thu nhỏ, Storage, xác nhận đề, "em đang làm bài số mấy" | G2 | US1; 9.9, 9.11 |
| **G4** | `cas` lên Vercel Services + toolLoop + solveGate + make_sibling | G2 | DOMAIN §4.12; 9.16, 9.21–9.25 |
| **G5** | Kho kiến thức + ⑤ + Haiku phân loại `ku_code` + lookup + prereq_gaps | G4 | 9.17–9.19; check-knowledge trong CI |
| **G6** | Ôn cách quãng đầu buổi | G5 | DOMAIN §4.11 a–f |
| **G7** | Báo cáo bố mẹ, chấm buổi, góp ý → luật dạy, chi phí/economy, **L-2** notify, **L-3** thẻ Xem gộp | G2 | US6–US8, US12; §4.5, §4.7 |
| **G8** | Boox e-ink, xóa dữ liệu theo yêu cầu, cron dọn, trang tuần cho gia sư | G7 | US10, US11; §4.8 |
| **G9** | Chạy toàn bộ bộ test sư phạm trên model đã chọn → mở cho 2 con | tất cả | 0 lộ lời giải; tiêu chí BO_TEST §1 |
