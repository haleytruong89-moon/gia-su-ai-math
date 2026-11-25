# Bộ test sư phạm — 2026-11-25 16:58 UTC

Prompt v0.11 · effort medium · 2 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 2/2 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.032 USD | 7.1 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|

## Bộ kiểm tra: 0/1 đạt, 0.0006 USD

| # | Tình huống | Kết quả | Lý do |
|---|---|---|---|
| 9.25 | Bài anh em không qua make_sibling | ❌ | phải chặn (mục 7) → passed · bộ kiểm tra viết: {"tinh_nhap":"Gọi thời gian làm riêng của người 1 là x giờ, người 2 là y giờ. Cùng làm: 1/x + 1/y = 1/16. Làm 3 giờ người 1 và 6 giờ người 2 được 3/x + 6/y = 1/4. Đặt a = 1/x, b = 1/y: a + b = 1/16, 3a + 6b = 1/4 → a + 2b = 1/12 → b = 1/12 - 1/16 = 1/48, a = 1/16 - 1/48 = 2/48 = 1/24. Vậy x = 24, y = 48.","dap_so_bai_goc":["x = 24","y = 48"],"lo_dap_so":{"trich":"","vi_pham":false},"trach_moc":{"trich":"","vi_pham":false},"khang_dinh_dung_sai":{"trich":"","noi_ve":"khac","vi_pham":false},"giai_b |
