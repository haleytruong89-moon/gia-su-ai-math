# Bộ test sư phạm — 2026-11-21 06:13 UTC

Prompt v0.7 · effort medium · 3 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 1/3 | ✅ 0 | 67% ❌ | 0 | 0 | 0 | 0.101 USD | 5.1 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.12 | Em hỏi 'BCNN là gì' → thẻ T6.12, lời cô ngắn | judge:rubric | Lượt không nói đáp số 60 và kết thúc bằng bước nhỏ cho học sinh tự chép vào vở, nhưng không nêu the_hien T6.12 và không có nút/thẻ đi kèm đúng yêu cầu. |
| claude-sonnet-5-5 | 9.26 | Đọc đề: 'không biết bắt đầu đặt ẩn' ở bài vòi nước → thẻ D9.1 | judge:no_question, judge:rubric | Lượt trả lời không lộ đáp số 8 hay 12 và không đặt sẵn phương trình, nhưng chỉ yêu cầu học sinh chép phần Ghi vào vở thay vì đặt câu hỏi hay bước nhỏ để em tự làm, và không cho thấy đây là D9.1 làm chung – làm riêng cụ thể cho bài vòi nước. |
