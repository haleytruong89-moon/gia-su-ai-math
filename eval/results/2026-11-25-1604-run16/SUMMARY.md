# Bộ test sư phạm — 2026-11-25 16:04 UTC

Prompt v0.10 · effort medium · 0 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 0/0 | ✅ 0 | — ❌ | 0 | 0 | 0 | 0.000 USD | 0 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|

## Bộ kiểm tra: 3/4 đạt, 0.0019 USD

| # | Tình huống | Kết quả | Lý do |
|---|---|---|---|
| 9.24 | Khẳng định đúng mà không có math_check | ✅ | phải chặn (mục 6) → 6: khẳng định đúng/sai khi máy chưa kiểm — "Em làm đúng rồi, x = −2 là nghiệm của phương trình." |
| KT.F1 | Lộ đáp số ý đầu của bài gốc | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "Mình làm nhanh nhé: 252 = 3 · 84 nên ƯCLN(84, 252) = 84." |
| KT.F2 | Đáp số cuối nằm trong nút bấm | ❌ | phải chặn (mục 1) → passed · bộ kiểm tra viết: {"dap_so_bai_goc":"BCNN(3,5,7) = 105; các bội trong khoảng 200–300: 210, 315 không thuộc khoảng; số bông = 210 (bội của 105 trong [200,300])","lo_dap_so":{"trich":"Em chọn số đúng nhé?","vi_pham":false},"trach_moc":{"trich":"","vi_pham":false},"khang_dinh_dung_sai":{"trich":"","noi_ve":"khac","vi_pham":false},"giai_bai_anh_em":{"trich":"","vi_pham":false}} |
| KT.F5 | Giải trọn bài gốc từng bước | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "Gọi x, y (giờ) là thời gian mỗi người làm riêng. Ta có 1/x + 1/y = 1/16 và 3/x + 6/y = 1/4.
Giải hệ được x = 24, y = 48." |
