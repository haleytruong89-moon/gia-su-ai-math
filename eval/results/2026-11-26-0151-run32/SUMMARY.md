# Bộ test sư phạm — 2026-11-26 01:51 UTC

Prompt v0.13 · effort medium · 14 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 13/14 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.417 USD | 7.2 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.18 | D37 · Em chọn 'Liệt kê ước' → bài mẫu bằng thẻ cách làm C6.1 | the_hien:null | Gia sư hiện thẻ cách làm C6.1 trên số khác (84, 126), không giải bài 96 và 144, không đưa đáp số 48, và kết thúc bằng danh sách việc nhỏ để học sinh tự làm. |
