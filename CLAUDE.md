# Gia sư AI Toán (`gia-su-ai`)

> Repo GitHub: `haleytruong89-moon/gia-su-ai-math` — **PUBLIC** (từ 14/11/2026). Trong tài liệu gọi tắt là `gia-su-ai`.

Web app cho 2 con tự học Toán buổi chiều với một "cô" gia sư AI: con chụp/gõ bài đang kẹt → cô xác nhận đề → hỏi gợi mở theo thang H0–H5, **không đưa lời giải bài gốc** → con tự làm xong, hoặc để dành hỏi thầy. Tối bố mẹ đọc báo cáo 5 phút. Con: HS-9A (lớp 9), HS-6A (lớp 6), SGK Kết nối tri thức.

Chủ dự án là phụ huynh, **không phải dev**. Giải thích bằng tiếng Việt đơn giản; mỗi PR có hướng dẫn thử trên link preview.

## Đọc trước khi làm bất cứ việc gì
1. `docs/DOMAIN.md` — **nguồn đúng duy nhất cho quy tắc** (data model, quyền, trạng thái, quy tắc tính + ví dụ chuẩn). Mục ghi *Đề xuất* chưa được phụ huynh chốt: code được nhưng đánh dấu `TODO(rule-unconfirmed)` và ghi trong PR.
2. `docs/SPEC.md` — user stories + tiêu chí nghiệm thu.
3. `docs/DESIGN.md` — kiến trúc, luồng một lượt, công cụ, các lát build (§9).
4. `docs/PROGRESS.md` — lát nào xong, đang dở gì.
   `docs/ROADMAP.json` — **bản đồ lộ trình** (mục đích, kiến trúc, lát G0–G9, quyết định, việc của bố mẹ). Trang xem: https://claude.ai/artifact/WXNYNiyHkY3zP7mWeskKUo (slug `ef169bfc-206f-490e-898b-599005810e0c`; nguồn `docs/roadmap-page/`, build `npm run roadmap:page` → `.roadmap-site/`).
5. `prompts/` + `docs/BO_TEST.md` — system prompt và bộ test sư phạm.

## Tech stack
- Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 — **cùng stack với Study Launcher**
- Chạy dưới địa chỉ Launcher: `basePath: "/gia-su"`; Launcher chuyển tiếp `/gia-su/*` sang deploy này (D20) → dùng chung phiên đăng nhập Supabase và PIN
- Supabase project **`study-launcher`** (dùng chung), schema **`tutor`**. **SQL nằm trong repo `study-launcher`**, không nằm ở đây (D21)
- Claude API (`@anthropic-ai/sdk`): Sonnet 5.5 chính, Haiku 5.5 kiểm tra + phân loại; Opus 5.5 phần khó (D28)
- Máy tính đại số `cas/`: Python + SymPy + FastAPI, chạy riêng tư cùng project Vercel (Vercel Services) — D24
- Test: Vitest (logic máy chủ), pytest (`cas/`), Playwright (luồng chính), bộ test sư phạm `spike/`
- Vercel region `sin1`; múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`

## Conventions
- Code, comment, tên file, commit: **tiếng Anh**. Chữ trên giao diện và lời của "cô": **tiếng Việt có dấu**.
- camelCase TS; snake_case cột DB. Conventional commits.
- Mỗi lát = 1 nhánh `feature/gN-<ten-ngan>` = 1 PR thẳng vào `main`.
- Mô tả PR (tiếng Việt): làm gì · cách thử trên preview · **có cần SQL bên repo Launcher không** · tiêu chí nghiệm thu nào đạt.
- Giao diện bám canvas: https://claude.ai/artifact/T8ySbzJ29YWFA6Q7D56HVm (màn "con hỏi bài", "bài hình", "ôn đầu buổi", "Boox", "báo cáo"). Nút ≥ 44px (Boox ≥ 48px). Font Be Vietnam Pro + Lexend.

## Key decisions (đã chốt — chi tiết `docs/DOMAIN.md` §0)
- **T1** Gửi ảnh/bài làm/câu trả lời của con sang Anthropic API; **không gửi họ tên, trường**; chỉ dùng mã con.
- **T2/T3** Chung Supabase `study-launcher`, schema `tutor`; repo riêng, deploy riêng.
- **Máy chủ giữ trạng thái.** Mức gợi ý, số lượt, nản, trạng thái bài, mức U do **máy chủ** tính; model chỉ trả nhận định (`danh_gia_luot_em`). Con chỉ SELECT qua RLS; mọi ghi qua route máy chủ (service role).
- **Không lộ lời giải bài gốc** trước khi con nộp; bộ kiểm tra Haiku chấm mọi câu trả lời; lời giải tham khảo chỉ gửi sau `self_solved`.
- **Mọi khẳng định đúng/sai về phép tính đi qua `math_check`** (DOMAIN §4.12).
- Trần **50 USD/tháng** (Console). ~45 USD → báo bố mẹ + tạm ngừng Opus (D29, không có chế độ tiết kiệm). Tối đa 20 lượt/bài.
- Không giới hạn giờ/buổi/ngày. Buổi 30–45 phút, nhiều bài; mỗi bài một ngữ cảnh AI mới.
- Kho kiến thức `knowledge/*.json` sinh từ md đã duyệt trong hub (D25); **không sửa tay JSON**.

## Warnings — KHÔNG được làm
- Không đưa `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CAS_SECRET`, `TUTOR_NOTIFY_SECRET` ra trình duyệt (không tiền tố `NEXT_PUBLIC_`). Không log nội dung tin nhắn/ảnh của con ra console.
- **Repo công khai:** không đưa lên họ tên thật, trường, lớp cụ thể, điểm số, ảnh bài làm thật, nhận xét của thầy cô, email, URL/khóa thật vào code, prompt, test, docs, fixture, commit message (D9). Dùng HS-9A, HS-6A và dữ liệu giả. Tài liệu có thông tin thật ở lại hub Study BB (riêng tư).
- Không tạo migration trong repo này. Cần đổi DB → PR riêng bên `study-launcher` theo luật của repo đó (additive, idempotent, grant + RLS cùng file, test trong `supabase/tests/`); phụ huynh merge = duyệt SQL.
- Không lấy `child_id` từ body request — chỉ từ phiên (`auth.uid()`), rồi kiểm `session_id`/`problem_id` thuộc con đó.
- Không để model tự đổi mức gợi ý, tự đếm lượt, tự quyết `self_solved` mà bỏ qua kiểm tra máy chủ.
- Không thêm streak, bảng xếp hạng, điểm thưởng. Không thêm dịch vụ bên thứ ba nhận dữ liệu của con (ngoài Anthropic theo T1).
- Không đổi luật khóa/mở của Launcher. Thấy spec thiếu hoặc mâu thuẫn → **dừng, ghi vào PR / PROGRESS.md, hỏi phụ huynh**.

## Quy trình mỗi lát
1. Đọc DESIGN §9 cho lát đó + mục DOMAIN liên quan → kế hoạch ngắn ở đầu PR.
2. TDD: viết test từ **ví dụ chuẩn trong DOMAIN** trước (không khóa theo số code chạy ra).
3. `npm run typecheck && npm run lint && npm test` xanh; `cas/`: `pytest`; đụng prompt → chạy `npm run eval` (bộ test sư phạm) và ghi kết quả.
4. PR → preview → cập nhật `docs/PROGRESS.md` **và `docs/ROADMAP.json`** (trạng thái lát + tính năng, PR, `parentTodo`, `log`, `updated`; CI job `roadmap` báo lỗi nếu PR đổi code mà quên). Không merge.
5. Sau khi phụ huynh merge: cập nhật ROADMAP (PR → merged, lát → done) ở PR kế tiếp và **đăng lại `roadmap.json` lên trang bản đồ** (`publish_files`, chỉ file `roadmap.json`).

## Lệnh thường dùng
```bash
npm run dev          # http://localhost:3000/gia-su
npm run typecheck && npm run lint && npm test
npm run eval         # bộ test sư phạm (gọi API thật, tốn tiền — hỏi trước khi chạy cả bộ)
npm run knowledge    # sinh knowledge/*.json từ hub md + kiểm schema
cd cas && pip install -r requirements.txt && pytest
```

## Biến môi trường (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (workspace riêng, D19), `TUTOR_MODEL_MAIN`, `TUTOR_MODEL_LIGHT`, `CAS_URL`, `CAS_SECRET`, `LAUNCHER_URL`, `TUTOR_NOTIFY_SECRET`, `CRON_SECRET`

## Current status
- Phase: 3 — Implementation. Last updated: 18/11/2026.
- **Trạng thái chi tiết ở `docs/ROADMAP.json`** (trang bản đồ lộ trình) và `docs/PROGRESS.md`; mục này chỉ tóm tắt.
- Xong: G0, L-0, G1, L-1, G2 (+ e2e), G3, G4 (`cas` trên Vercel Services, vòng công cụ, cổng "tự làm xong", bài anh em), G5 (kho kiến thức bản sạch, phân loại bài, thẻ ⑤, lookup, dạy bù nền, checklist lớp 6).
- Tiếp: G7 (báo cáo bố mẹ; phụ huynh chọn làm trước G6, 18/11).
- Hồ sơ dạy học (lớp ④) bố mẹ nhập ở `/gia-su/bo-me`, chỉ nằm trong DB — không đưa vào repo.
- Chưa cho con dùng thật trước G9. Chờ phụ huynh: D23, D26; chạy G0 các ca G4 + G5.
