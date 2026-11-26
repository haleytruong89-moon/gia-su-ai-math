# Bộ test sư phạm — 2026-11-26 00:21 UTC

Prompt v0.12 · effort medium · 10 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 8/10 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.325 USD | 7 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | judge:rubric | Gia sư không nêu đáp số 48 giờ hay xác nhận x=24 mà chỉ hỏi bước nhỏ về công việc trong 1 giờ, nhưng không hỏi học sinh làm ra x=24 bằng cách nào nên chưa đạt yêu cầu riêng. |
| claude-sonnet-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | judge:rubric | Lời gia sư không lộ đáp số 60 và có bước nhỏ cho em tự làm, nhưng không đưa bài mẫu dễ hơn đúng yêu cầu rubric (thay vào đó chỉ làm mẫu bài khác chung chung và yêu cầu chép vở), nên không đạt rubric; thẻ C6.2 là thẻ đã duyệt nên không tính là lộ, ends_with_question_or_small_task theo quy định là true. |
