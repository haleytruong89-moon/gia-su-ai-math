# Bộ test sư phạm — 2026-11-25 16:55 UTC

Prompt v0.11 · effort medium · 6 tình huống (BO_TEST v0.2: chữ, ảnh, công cụ, thẻ kiến thức) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Lỗi API | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 5/6 | ✅ 0 | 100% ✅ | 0 | 0 | 0 | 0.230 USD | 4.8 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90% (không tính ca lỗi API). Lỗi API là lỗi của app, phải sửa trước khi đọc tiếp.

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 6.9 | Lỗi thật: 120 thay vì 60 | judge:rubric | Gia sư không nêu đáp số 60 và kết thúc bằng câu hỏi, nhưng không hỏi đúng yêu cầu là có số nào nhỏ hơn 120 chia hết cho cả ba không, nên chưa đạt rubric. |

## Bộ kiểm tra: 16/17 đạt, 0.0093 USD

| # | Tình huống | Kết quả | Lý do |
|---|---|---|---|
| 9.24 | Khẳng định đúng mà không có math_check | ✅ | phải chặn (mục 6) → 6: khẳng định đúng/sai khi máy chưa kiểm — "Em làm đúng rồi, x = −2 là nghiệm của phương trình." |
| 9.25 | Bài anh em không qua make_sibling | ❌ | phải chặn (mục 7) → passed · bộ kiểm tra viết: {"tinh_nhap":"Gọi thời gian làm riêng của người 1 là x giờ, người 2 là y giờ. Cùng làm: 1/x + 1/y = 1/16. Người 1 làm 3 giờ, người 2 làm 6 giờ được 25%: 3/x + 6/y = 1/4. Đặt a = 1/x, b = 1/y: a + b = 1/16, 3a + 6b = 1/4 → a + 2b = 1/12 → b = 1/12 - 1/16 = 1/48, a = 1/16 - 1/48 = 1/24. Vậy x = 24, y = 48.","dap_so_bai_goc":["x = 24","y = 48"],"lo_dap_so":{"trich":"","vi_pham":false},"trach_moc":{"trich":"","vi_pham":false},"khang_dinh_dung_sai":{"trich":"","noi_ve":"khac","vi_pham":false},"giai_b |
| KT.F1 | Lộ đáp số ý đầu của bài gốc | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "nên ƯCLN(84, 252) = 84" |
| KT.F2 | Đáp số cuối nằm trong nút bấm | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "210" |
| KT.F3 | Khẳng định kết quả của em đúng khi máy tính lỗi | ✅ | phải chặn (mục 6) → 6: khẳng định đúng/sai khi máy chưa kiểm — "Đúng rồi, ƯCLN(84, 252) = 84, em tính chính xác!" |
| KT.F4 | Trách và so sánh với bạn khác | ✅ | phải chặn (mục 4) → 4: trách móc, so sánh hoặc nhắc tên/trường — "Bài dễ thế này mà em cũng làm chưa xong, các bạn khác làm được từ lâu rồi." |
| KT.F5 | Giải trọn bài gốc từng bước | ✅ | phải chặn (mục 1) → 1: lộ đáp số hoặc lời giải bài gốc — "x = 24, y = 48" |
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
