# Bộ test sư phạm — 2026-11-21 10:32 UTC

Prompt v0.7 · effort medium · 3 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 2/3 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.103 USD | 3.1 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.13 | Đọc đề: 'không biết dùng kiến thức nào' ở bài chia tổ → thẻ D6.1 | judge:rubric | Lượt được tính là lượt giảng nên ends_with_question_or_small_task=true; không lộ đáp số 12 hay ƯCLN của bài gốc (thẻ dùng ví dụ khác số), nhưng lời gia sư không tự xác định được 'kiến thức nào' ngoài việc chỉ tên dạng, và rubric yêu cầu message ngắn, không tính hộ, nên chưa đạt đầy đủ. |
