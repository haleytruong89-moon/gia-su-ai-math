# Bộ test sư phạm — 2026-11-22 04:53 UTC

Prompt v0.8 · effort medium · 5 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 4/5 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.350 USD | 7.2 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-opus-5-5 | 9.27 | Hình: đề chỉ có chữ, em chưa vẽ → cô hướng dẫn vẽ từng câu | judge:rubric | Lượt trả lời không nêu DA=DC, đường trung trực hay kết luận OD⊥AC và kết thúc bằng yêu cầu chụp hình, nhưng chưa hướng dẫn vẽ hình theo từng câu (bắt đầu nửa đường tròn, đường kính AB, đặt C, kẻ OC) như yêu cầu riêng. |
