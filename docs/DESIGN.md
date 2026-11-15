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
6. Ghép prompt: ①②③ (cache) + ④ hồ sơ đã duyệt (cache) + ⑤ thẻ KU (cache) + lịch sử bài + ⑥ trạng thái
7. toolLoop (tối đa 3 lần gọi công cụ): Sonnet (hoặc Haiku nếu economy) với tools + output_format JSON schema
8. Guard Haiku trên TutorOutput + danh sách tool đã gọi → pass | viết lại 1 lần | câu an toàn (blocked)
9. Luật sau model: nextHintLevel(state, output.danh_gia_luot_em); outcome = decideOutcome(state, output, toolLog)
   (solveGate: self_solved cần math_check đạt — DOMAIN §4.12; bài chứng minh → pending_review)
10. Ghi: messages(tutor), model_calls (raw_output + tokens + cost), tool_calls, problems (state mới), diagnoses, usage_monthly += cost
11. usage vượt ngưỡng → notify (D23) + model_mode = economy
12. Trả {message, buttons, hintLevel, status, turnCount}
```

Chi phí mỗi lời gọi: `cost = (in − cached) × giá_in + cached × giá_cache_read + out × giá_out` (giá trong `lib/anthropic.ts`, đọc từ trang giá chính thức khi build; ghi ngày tra).

## 5. Công cụ
| Tên | Ở đâu | Ghi chú |
|---|---|---|
| `math_check` | `lib/tools/mathCheck.ts` → HTTP `CAS_URL/check` (header `x-cas-secret`), timeout 5 s | Các mode: equivalent, simplify_check, solve, check_root, evaluate, inequality, domain (xem `cas/app/mathcheck.py`) |
| `lookup` | `lib/tools/lookup.ts` đọc `knowledge/` trong bộ nhớ | Trả thẻ KU rút gọn ≤ 1.500 ký tự |
| `make_sibling` | `lib/tools/makeSibling.ts`: gọi Sonnet (purpose=sibling) sinh đề + lời giải + đáp số dạng SymPy → `math_check` kiểm đáp số → so tập số trong đề với đề gốc | `verified=false` → thử lại 1 lần |

## 6. Kho kiến thức
`scripts/build-knowledge.ts` đọc các file md đã duyệt (chép từ hub vào `knowledge/src/`: BAN_DO_CHUONG_TRINH_TOAN9, TOAN6, HOP_CONG_CU_HINH_9, HOP_CONG_CU_RUT_GON_9) → parse các bảng markdown → `knowledge/ku/T9.9.json` …, `knowledge/toolbox/*.json`; `KNOWLEDGE_VERSION` = ngày + hash nội dung. `check-knowledge.ts` chạy trong CI: zod, mọi mã nền tồn tại, mọi `exam_slot` đúng mẫu.

```ts
interface KnowledgeUnit {
  code: string; grade: 6|7|8|9; term: 'HK1'|'HK2'|'nen'; chapter: string; title: string;
  core: string; problemTypes: string[]; commonErrors: { root: 'read'|'concept'|'strategy'|'calc'|'careful'; text: string }[];
  prereqs: string[]; toolbox: string[]; checklist: number[]; examSlots: string[]; examNotes: string[];
}
```

## 7. Bảo mật và riêng tư
- RLS + quyền theo DOMAIN §2 (SQL + test ở repo Launcher). `lib/supabase/admin.ts` có `import "server-only"`.
- Ảnh: nhận jpg/png/heic ≤ 10 MB → `sharp` xoay theo EXIF rồi **bỏ toàn bộ metadata**, cạnh dài ≤ 1000 px, jpg q80 → Storage `tutor-images/<child_id>/<problem_id>/<uuid>.jpg`; URL ký hạn 10 phút.
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
| **G2** | Luật máy chủ: hints, nan, outcome, 20 lượt, idempotency, guard Haiku, câu an toàn | G1 | DOMAIN §4.1–4.4 bằng Vitest; bộ test 9.2, 9.3, 9.12–9.15 |
| **G3** | Ảnh: upload, xóa EXIF, thu nhỏ, Storage, xác nhận đề, "em đang làm bài số mấy" | G2 | US1; 9.9, 9.11 |
| **G4** | `cas` lên Vercel Services + toolLoop + solveGate + make_sibling | G2 | DOMAIN §4.12; 9.16, 9.21–9.25 |
| **G5** | Kho kiến thức + ⑤ + Haiku phân loại `ku_code` + lookup + prereq_gaps | G4 | 9.17–9.19; check-knowledge trong CI |
| **G6** | Ôn cách quãng đầu buổi | G5 | DOMAIN §4.11 a–f |
| **G7** | Báo cáo bố mẹ, chấm buổi, góp ý → luật dạy, chi phí/economy, **L-2** notify, **L-3** thẻ Xem gộp | G2 | US6–US8, US12; §4.5, §4.7 |
| **G8** | Boox e-ink, xóa dữ liệu theo yêu cầu, cron dọn, trang tuần cho gia sư | G7 | US10, US11; §4.8 |
| **G9** | Chạy toàn bộ bộ test sư phạm trên model đã chọn → mở cho 2 con | tất cả | 0 lộ lời giải; tiêu chí BO_TEST §1 |
