# Bộ test sư phạm — 2026-11-18 16:12 UTC

Prompt v0.5 · effort medium · 10 tình huống chữ có trong bộ chạy (BO_TEST v0.2, chưa gồm ảnh và công cụ) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | 5/10 | ❌ 2 | 70% ❌ | 0 | 0 | 0.157 USD | 6.3 s |
| claude-opus-5-5 | 5/10 | ❌ 1 | 70% ❌ | 0 | 0 | 0.194 USD | 6.9 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90%. (c) đọc ảnh và (d) gọi `math_check` chạy ở các lần sau (G3, G4).

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-sonnet-5-5 | 9.3 | Nản (k → ko biết), H4 | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgp2Pnup8yuUq5J9hDL"} |  |
| claude-sonnet-5-5 | 9.23 | Nản (nan=true) ở H4 → bài anh em đã kiểm | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgp1sY4LU7KNiPMMtGD"} |  |
| claude-sonnet-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:leak | Gia sư nêu đúng đẳng thức tích cần chứng minh và hỏi em cách chứng minh, nhưng nút bấm chứa 'Tam giác đồng dạng' là đúng mắt xích đáp số của bài gốc (△AEB ∽ △AFC), nên bị tính là lộ đáp số dù rubric phân tích ngược về cơ bản được đáp ứng. |
| claude-sonnet-5-5 | 9.19 | Hổng nền: không tách được x − 9 (dạy bù N8.02) | judge:leak, judge:rubric | Gia sư nêu sẵn hằng đẳng thức a² − b² và dùng x − 9 làm ví dụ trực tiếp, không dạy bằng ví dụ khác số (như x − 4) và không hẹn quay lại bài; nút bấm gợi ý [a = √x, b = 3] là đáp án đúng của bước tách, nên đã đặt sẵn lời giải của bài gốc. |
| claude-sonnet-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgpjtPQZZi6LJvY6Qnz"} |  |
| claude-opus-5-5 | 9.3 | Nản (k → ko biết), H4 | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgq5kV8p5VG6HdDTku1"} |  |
| claude-opus-5-5 | 9.23 | Nản (nan=true) ở H4 → bài anh em đã kiểm | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgqPhj3kVnt7Duc7jw8"} |  |
| claude-opus-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:leak, judge:rubric | Nút bấm có [Tam giác đồng dạng] là gợi ý đúng mắt xích cần dùng của đáp số gốc (△AEB ∽ △AFC), và lời gia sư nói 'thường được suy ra từ một công cụ quen thuộc' cùng nút gợi ý làm lộ hướng giải; yêu cầu chỉ gợi đúng một mắt xích và không lộ đáp số nên chưa đạt. |
| claude-opus-5-5 | 9.19 | Hổng nền: không tách được x − 9 (dạy bù N8.02) | judge:rubric | Gia sư không đưa đáp số hay lời giải trọn của bài gốc và kết thúc bằng bước nhỏ cho học sinh tự làm, nhưng không nói sẽ quay lại bài và chưa dạy bù ngắn đúng yêu cầu vì chưa nêu rõ bước tách x − 9 với ví dụ khác số như x − 4. |
| claude-opus-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | error:400 {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties: object' is not supported. Please set 'additionalProperties' to false"},"request_id":"req_011ChAgr2oQnxgAwmLM64HB3"} |  |

## Bộ kiểm tra (9.24, 9.25)

| # | Tình huống | Kết quả | Lý do |
|---|---|---|---|
| 9.24 | Khẳng định đúng mà không có math_check | ✅ | 1: Câu trả lời xác nhận x = −2 là nghiệm, tức lộ đáp số cuối của bài gốc khi da_nop_loi_giai = false.; 6: Khẳng định học sinh làm đúng và x = −2 là nghiệm mà không có math_check nào được gọi trong lượt. |
| 9.25 | Bài anh em không qua make_sibling | ✅ | 6: message có hai vòi chảy 12 giờ và 25% bể, máy không gọi math_check nên không được khẳng định phép tính, và cô liệt kê các bước kiểu bài anh em (tuy không có đáp số bài gốc); 7: message có bài anh em nhưng không gọi make_sibling với verified=true và numbers_differ=true |
