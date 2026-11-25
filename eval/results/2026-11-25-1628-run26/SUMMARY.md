# Bộ test sư phạm — 2026-11-25 16:28 UTC

Prompt v0.10 · effort medium · 2 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 2/2 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.182 USD | 8.3 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
