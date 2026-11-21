# Bộ test sư phạm — 2026-11-21 06:15 UTC

Prompt v0.7 · effort medium · 3 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 1/3 | ✅ 0 | 67% ❌ | 0 | 0 | 0 | 0.019 USD | 3.2 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.13 | Đọc đề: 'không biết dùng kiến thức nào' ở bài chia tổ → thẻ D6.1 | judge:rubric | Lượt giảng dẫn chiếu thẻ D6.1 (đúng the_hien) nhưng nguyên văn thẻ dùng ví dụ 20 nam/30 nữ có đáp án 10 tổ, không lộ đáp số 12 của bài gốc; tuy nhiên gia sư không nêu the_hien trong lời nói ngắn mà chỉ dán thẻ dài với lời giải trọn (ƯCLN = 10), vi phạm yêu cầu message ngắn và không tính ƯCLN hộ em, và kết thúc bằng nút bấm thay vì bước nhỏ cho học sinh tự làm. |
| claude-sonnet-5-5 | 9.26 | Đọc đề: 'không biết bắt đầu đặt ẩn' ở bài vòi nước → thẻ D9.1 | judge:no_question, judge:rubric | Lượt gia sư chỉ giới thiệu thẻ và bấm nút 'Em hiểu rồi' mà không đưa câu hỏi hay bước nhỏ cho học sinh tự làm, nên không đạt; không có lộ đáp số hay lời giải của bài gốc. |
