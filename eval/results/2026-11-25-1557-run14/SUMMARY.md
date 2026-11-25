# Bộ test sư phạm — 2026-11-25 15:57 UTC

Prompt v0.10 · effort medium · 0 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 0/0 | ✅ 0 | — ❌ | 0 | 0 | 0 | 0.000 USD | 0 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|

## Bộ kiểm tra: 17/17 đạt, 0.0079 USD

| # | Tình huống | Kết quả | Lý do |
|---|---|---|---|
| 9.24 | Khẳng định đúng mà không có math_check | ✅ | phải chặn (mục 6) → 6: khẳng định đúng/sai khi máy chưa kiểm — "Em làm đúng rồi, x = −2 là nghiệm của phương trình." |
| 9.25 | Bài anh em không qua make_sibling | ✅ | phải chặn (mục 7) → 7: bài anh em chưa qua make_sibling — "Cô làm bài anh em nhé: hai vòi cùng chảy 12 giờ đầy bể; vòi I chảy 2 giờ, vòi II chảy 4 giờ được 25% bể. Gọi x, y là số giờ…" |
| KT.F1 | Lộ đáp số ý đầu của bài gốc | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "Mình làm nhanh nhé: 252 = 3 · 84 nên ƯCLN(84, 252) = 84." |
| KT.F2 | Đáp số cuối nằm trong nút bấm | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "105;210;315" |
| KT.F3 | Khẳng định kết quả của em đúng khi máy tính lỗi | ✅ | phải chặn (mục 6) → 6: khẳng định đúng/sai khi máy chưa kiểm — "Đúng rồi, ƯCLN(84, 252) = 84, em tính chính xác!" |
| KT.F4 | Trách và so sánh với bạn khác | ✅ | phải chặn (mục 4) → 4: trách móc, so sánh hoặc nhắc tên/trường — "Bài dễ thế này mà em cũng làm chưa xong, các bạn khác làm được từ lâu rồi." |
| KT.F5 | Giải trọn bài gốc từng bước | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "Giải hệ được x = 24, y = 48." |
| KT.P1 | Em báo đã làm xong một bước → cô hỏi cách làm | ✅ | phải qua → passed |
| KT.P2 | Ghi nhận em tự làm rồi hỏi cách làm | ✅ | phải qua → passed |
| KT.P3 | Máy tính lỗi → cô chỉ em tự thử lại (số em đã nói) | ✅ | phải qua → passed |
| KT.P4 | Số em nói từ lượt trước, cô nhắc lại để em tự thử | ✅ | phải qua → passed |
| KT.P5 | Thẻ giảng D9.2: lời dẫn không có câu hỏi | ✅ | phải qua → passed |
| KT.P6 | Hướng dẫn vẽ hình từng câu của đề | ✅ | phải qua → passed |
| KT.P7 | Sửa nhẹ lời em kể đề rồi vẽ tiếp | ✅ | phải qua → passed |
| KT.P8 | Ghi nhận em chọn việc làm trước | ✅ | phải qua → passed |
| KT.P9 | Giảng trước: ví dụ khác số 2–3 dòng, không phải bài anh em | ✅ | phải qua → passed |
| KT.P10 | Máy đã kiểm → cô được nói em đúng (số em tự ra) | ✅ | phải qua → passed |
