# PROGRESS — gia-su-ai

| Ngày | Lát | Trạng thái | Việc còn mở | SQL bên Launcher |
|---|---|---|---|---|
| 14/11/2026 | (chuẩn bị) | Bridge files, `cas/` math_check (14 test xanh), SQL 0017 + test RLS (xanh trên Postgres tạm) | D20–D27 chờ phụ huynh | 0017 chưa mở PR |
| 14/11/2026 | Repo | Repo `haleytruong89-moon/gia-su-ai-math` (**public**) có gói khởi đầu; CI GitHub xanh (48 Vitest + 14 pytest) | Repo công khai → không đưa thông tin thật của con lên | — |
| 14/11/2026 | L-0 ✅ | Study Launcher **PR #75 đã merge** (22:18 VN): schema `tutor` 16 bảng + RLS; Supabase chạy SQL thành công; CI 5/5 xanh | — | `0017_tutor_schema.sql` đã chạy |
| 14/11/2026 | D22 ✅ | Phụ huynh thêm `tutor` vào Supabase → Integrations → Data API → Settings → Exposed schemas (giữ tắt "Automatically expose new tables") | Tiếp: chờ duyệt D20 → lát G1 | — |
| 14/11/2026 | D19 ✅ | Phụ huynh tạo workspace **GS AI - Math** + key `gs-ai-math` (chỉ chạy trong workspace này), trần chi tiêu + email báo đặt trong workspace | ⏰ **Key hết hạn 31/10/2027** — thay key mới trên Vercel trước ngày này | — |
| 14/11/2026 | D20 ✅ | Phụ huynh duyệt: gia sư chạy dưới địa chỉ Launcher (`/gia-su`). Cửa vào: ① thẻ "Cô gia sư Toán" đầu Góc học tập, ② nút "Em kẹt bài này? Hỏi cô" khi việc là môn Toán | — | — |
| 14/11/2026 | G1 | **PR mở** (`feature/g1-walking-skeleton`, plan `docs/superpowers/plans/2026-11-14-g1-walking-skeleton.md`): khung Next `/gia-su`, đọc phiên Launcher, con chọn chỗ kẹt + gõ đề → cô xác nhận đề (1 lần gọi Sonnet, structured output), gửi tiếp nhiều lượt; ghi `study_sessions`, `problems`, `messages`, `model_calls`, `usage_monthly`; chống gửi trùng bằng `clientMsgId`; tối đa 20 lượt; trang **Hồ sơ dạy học** cho bố mẹ (`/gia-su/bo-me`, mỗi lần lưu = phiên bản mới, nút tắt cho từng con) | **Chưa có (đúng lát):** bộ kiểm tra Haiku + mức gợi ý + nản (G2), ảnh (G3), máy tính đại số (G4). **Nợ cổng:** e2e Playwright (cần Supabase local có schema Launcher) → làm ở G2. `usage_monthly` cộng kiểu đọc-rồi-ghi (TODO G7: hàm SQL). Không cho con dùng thật trước G2 | Không SQL |
