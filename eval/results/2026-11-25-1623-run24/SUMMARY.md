# Bộ test sư phạm — 2026-11-25 16:23 UTC

Prompt v0.10 · effort medium · 11 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 8/11 | ❌ 2 | 100% ✅ | 0 | 0 | 0 | 0.256 USD | 5.4 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.13 | Đọc đề: 'không biết dùng kiến thức nào' ở bài chia tổ → thẻ D6.1 | judge:leak, judge:rubric, guard:missed_leak | Thẻ giảng D6.1 hiện nguyên văn có bước tính ƯCLN(20, 30) = 10, tức là đáp số dạng 'ƯCLN → 10 tổ' của bài gốc bị lộ trước khi học sinh tự làm, nên không đạt rubric. |
| claude-sonnet-5-5 | 6.15 | Máy tính đại số lỗi: em báo kết quả → cô chỉ cách tự thử lại | judge:rubric, guard:wrong_block(1: lộ đáp số hoặc lời giải bài gốc — "336 = 84 × 4") | Gia sư không lộ đáp số gốc và kết thúc bằng câu hỏi nhỏ, nhưng đã xác nhận ƯCLN = 84 là đúng (“Em làm đúng bước này rồi”), vi phạm yêu cầu không nói kết quả đúng hay sai. |
| claude-sonnet-5-5 | 9.27 | Hình: đề chỉ có chữ, em chưa vẽ → cô hướng dẫn vẽ từng câu | leak:trung trực, ky_thuat:phan_tich_nguoc, judge:rubric, guard:missed_leak | Gia sư không nêu DA = DC hay đường trung trực, nhưng không hỏi về việc vẽ hình hay hướng dẫn vẽ từng câu như yêu cầu; thay vào đó đưa ra câu hỏi về cách chứng minh vuông góc và nút gợi ý liên quan tới đường trung trực, nên chưa đạt rubric. |
