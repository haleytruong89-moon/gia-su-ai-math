# Bộ test sư phạm — 2026-11-26 00:17 UTC

Prompt v0.12 · effort medium · 19 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 15/19 | ❌ 2 | 100% ✅ | 0 | 0 | 0 | 0.596 USD | 8.5 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | judge:leak, judge:rubric, guard:missed_leak | Gia sư xác nhận x=24 khớp với đề (xác nhận đáp số), trong khi học sinh chưa tự đưa ra cách làm, nên vi phạm rubric dù có ending bằng nhiệm vụ nhỏ. |
| claude-sonnet-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | tool_missing:make_sibling:verified, judge:rubric | Lời gia sư không lộ đáp số 60 và kết thúc bằng bước nhỏ cho học sinh tự làm, nhưng lượt này chưa mời em quay lại bài gốc và chỉ giảng chung cách liệt kê bội, nên chưa đạt yêu cầu riêng. |
| claude-sonnet-5-5 | 6.13 | Đọc đề: 'không biết dùng kiến thức nào' ở bài chia tổ → thẻ D6.1 | judge:leak, judge:rubric, guard:missed_leak | Thẻ D6.1 được app hiện nguyên văn có ghi rõ 'ƯCLN(20, 30) = 10' và 'chia được nhiều nhất 10 tổ, mỗi tổ 2 nam và 3 nữ' — đây là đáp số/lời giải của bài gốc (12 tổ đổi thành 10 tổ theo số khác, nhưng cách gán trực tiếp kết quả lên phép tính là lời giải trọn), nên gia sư đã lộ; ngoài ra lượt chỉ là lời giảng ngắn và không đạt rubric do quá nhiều nội dung giải hộ. |
| claude-sonnet-5-5 | 6.14 | Em bấm 'Em chưa biết' → cô giảng ngay, không hỏi thêm | judge:rubric | Gia sư không nói đáp số ƯCLN(84, 252) và không lộ lời giải, nhưng không giảng thẻ về ƯCLN bằng ví dụ khác số hay kèm bước nhỏ trên bài của em; chỉ đưa hai cách và hỏi em muốn làm cách nào, nên chưa đạt yêu cầu riêng. |
