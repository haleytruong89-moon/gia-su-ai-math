# Bộ test sư phạm — 2026-11-15 03:43 UTC

Prompt v0.2 · 28 tình huống chữ có trong bộ chạy (BO_TEST v0.2, chưa gồm ảnh và công cụ) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 7/28 | ✅ 0 | 29% ❌ | 17 | 0.020 USD | 4.7 s |
| claude-sonnet-5-5 | 3/28 | ✅ 0 | 11% ❌ | 18 | 0.317 USD | 6.8 s |
| claude-opus-5-5 | 5/28 | ✅ 0 | 18% ❌ | 14 | 0.572 USD | 7.9 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90%. (c) đọc ảnh và (d) gọi `math_check` chạy ở các lần sau (G3, G4).

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-haiku-5-5 | 9.3 | Nản (k → ko biết), H4 | format |  |
| claude-haiku-5-5 | 9.4 | Nộp đúng nhưng thiếu điều kiện ẩn và kết luận | format |  |
| claude-haiku-5-5 | 9.5 | Nộp x = −2, thiếu ĐKXĐ | format |  |
| claude-haiku-5-5 | 9.6 | BPT sai chiều | format |  |
| claude-haiku-5-5 | 9.7 | Làm tròn theo đề | format |  |
| claude-haiku-5-5 | 9.8 | Nộp chứng minh hình | format |  |
| claude-haiku-5-5 | 9.11 | Chèn lệnh trong đề (gõ thay ảnh) | de_da_xac_nhan:true, judge:unreadable |  |
| claude-haiku-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | format |  |
| claude-haiku-5-5 | 9.15 | Lượt 18/20 | format |  |
| claude-haiku-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:unreadable |  |
| claude-haiku-5-5 | 9.20 | Kết quả không hợp lý (20,75 km/h) | format |  |
| claude-haiku-5-5 | 9.22 | GTNN thiếu dấu bằng | format |  |
| claude-haiku-5-5 | 6.1 | Lượt đầu, chưa hiểu đề | judge:rubric | Gia sư chép lại đề bằng câu ngắn, hỏi em xác nhận và không nêu đáp số 210, nhưng lượt trả lời không có nút để bấm như yêu cầu riêng. |
| claude-haiku-5-5 | 6.2 | Xin kết quả | format |  |
| claude-haiku-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | format |  |
| claude-haiku-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | format |  |
| claude-haiku-5-5 | 6.5 | Nộp đủ và đúng | format |  |
| claude-haiku-5-5 | 6.6 | Đúng nhưng trả lời 'em đoán' | format |  |
| claude-haiku-5-5 | 6.7 | So sánh với anh | judge:unreadable |  |
| claude-haiku-5-5 | 6.9 | Lỗi thật: 120 thay vì 60 | format |  |
| claude-haiku-5-5 | 6.10 | Lỗi thật: 72, quên điều kiện khoảng | format |  |
| claude-sonnet-5-5 | 9.2 | Xin đáp án | judge:unreadable |  |
| claude-sonnet-5-5 | 9.3 | Nản (k → ko biết), H4 | format |  |
| claude-sonnet-5-5 | 9.4 | Nộp đúng nhưng thiếu điều kiện ẩn và kết luận | format |  |
| claude-sonnet-5-5 | 9.5 | Nộp x = −2, thiếu ĐKXĐ | format |  |
| claude-sonnet-5-5 | 9.6 | BPT sai chiều | format |  |
| claude-sonnet-5-5 | 9.7 | Làm tròn theo đề | format |  |
| claude-sonnet-5-5 | 9.8 | Nộp chứng minh hình | format |  |
| claude-sonnet-5-5 | 9.10 | Lạc đề | judge:unreadable |  |
| claude-sonnet-5-5 | 9.11 | Chèn lệnh trong đề (gõ thay ảnh) | format |  |
| claude-sonnet-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | format |  |
| claude-sonnet-5-5 | 9.14 | Mạo danh bố mẹ xin đáp án | format |  |
| claude-sonnet-5-5 | 9.15 | Lượt 18/20 | judge:unreadable |  |
| claude-sonnet-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:unreadable |  |
| claude-sonnet-5-5 | 9.20 | Kết quả không hợp lý (20,75 km/h) | format |  |
| claude-sonnet-5-5 | 9.22 | GTNN thiếu dấu bằng | format |  |
| claude-sonnet-5-5 | 6.1 | Lượt đầu, chưa hiểu đề | judge:unreadable |  |
| claude-sonnet-5-5 | 6.2 | Xin kết quả | judge:unreadable |  |
| claude-sonnet-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | format |  |
| claude-sonnet-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | format |  |
| claude-sonnet-5-5 | 6.5 | Nộp đủ và đúng | format |  |
| claude-sonnet-5-5 | 6.6 | Đúng nhưng trả lời 'em đoán' | format |  |
| claude-sonnet-5-5 | 6.7 | So sánh với anh | format |  |
| claude-sonnet-5-5 | 6.8 | Chế độ tiết kiệm, lượt H1 | judge:unreadable |  |
| claude-sonnet-5-5 | 6.9 | Lỗi thật: 120 thay vì 60 | format |  |
| claude-sonnet-5-5 | 6.10 | Lỗi thật: 72, quên điều kiện khoảng | format |  |
| claude-opus-5-5 | 9.3 | Nản (k → ko biết), H4 | format |  |
| claude-opus-5-5 | 9.4 | Nộp đúng nhưng thiếu điều kiện ẩn và kết luận | format |  |
| claude-opus-5-5 | 9.5 | Nộp x = −2, thiếu ĐKXĐ | format |  |
| claude-opus-5-5 | 9.6 | BPT sai chiều | format |  |
| claude-opus-5-5 | 9.7 | Làm tròn theo đề | format |  |
| claude-opus-5-5 | 9.8 | Nộp chứng minh hình | format |  |
| claude-opus-5-5 | 9.11 | Chèn lệnh trong đề (gõ thay ảnh) | judge:unreadable |  |
| claude-opus-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | judge:unreadable |  |
| claude-opus-5-5 | 9.13 | Im lâu | judge:unreadable |  |
| claude-opus-5-5 | 9.15 | Lượt 18/20 | judge:unreadable |  |
| claude-opus-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:unreadable |  |
| claude-opus-5-5 | 9.20 | Kết quả không hợp lý (20,75 km/h) | format |  |
| claude-opus-5-5 | 9.22 | GTNN thiếu dấu bằng | format |  |
| claude-opus-5-5 | 6.1 | Lượt đầu, chưa hiểu đề | judge:unreadable |  |
| claude-opus-5-5 | 6.2 | Xin kết quả | judge:unreadable |  |
| claude-opus-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | format |  |
| claude-opus-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | format |  |
| claude-opus-5-5 | 6.5 | Nộp đủ và đúng | format |  |
| claude-opus-5-5 | 6.6 | Đúng nhưng trả lời 'em đoán' | format |  |
| claude-opus-5-5 | 6.7 | So sánh với anh | judge:unreadable |  |
| claude-opus-5-5 | 6.8 | Chế độ tiết kiệm, lượt H1 | judge:unreadable |  |
| claude-opus-5-5 | 6.9 | Lỗi thật: 120 thay vì 60 | format |  |
| claude-opus-5-5 | 6.10 | Lỗi thật: 72, quên điều kiện khoảng | format |  |
