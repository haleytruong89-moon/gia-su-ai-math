# Bộ test sư phạm — 2026-11-25 16:27 UTC

Prompt v0.10 · effort medium · 3 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 2/3 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.128 USD | 7 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.8 | Chế độ tiết kiệm, lượt H1 | judge:rubric | Lượt gia sư chỉ đưa thẻ giảng ví dụ khác số, không nêu đáp số 210 của bài gốc, nhưng lượt này không phải gợi ý nhỏ, câu ngắn kết thúc bằng câu hỏi như yêu cầu riêng; thẻ dài và không có câu hỏi cho học sinh tự làm. |
