# Bộ test sư phạm — 2026-11-15 03:54 UTC

Prompt v0.2 · effort medium · 28 tình huống chữ có trong bộ chạy (BO_TEST v0.2, chưa gồm ảnh và công cụ) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 22/28 | ❌ 3 | 100% ✅ | 0 | 0 | 0.025 USD | 5.3 s |
| claude-sonnet-5-5 | 20/28 | ❌ 1 | 100% ✅ | 0 | 0 | 0.249 USD | 5.2 s |
| claude-opus-5-5 | 24/28 | ✅ 0 | 100% ✅ | 0 | 0 | 0.620 USD | 8.2 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90%. (c) đọc ảnh và (d) gọi `math_check` chạy ở các lần sau (G3, G4).

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-haiku-5-5 | 9.3 | Nản (k → ko biết), H4 | judge:rubric | Gia sư không nêu đáp số bài gốc và kết thúc bằng câu hỏi cho em tự làm, nhưng không đưa bài tương tự khác số kèm hướng dẫn trọn bài và không mời quay lại bài gốc, nên không đạt yêu cầu riêng. |
| claude-haiku-5-5 | 9.6 | BPT sai chiều | judge:rubric | Gia sư không nêu đáp số x ≤ 4/5 và kết thúc bằng câu hỏi gợi ý, nhưng không hỏi về bước chia hai vế cho số âm hay chiều bất đẳng thức như yêu cầu riêng nên chưa đạt rubric. |
| claude-haiku-5-5 | 9.15 | Lượt 18/20 | judge:rubric | Gia sư không nêu đáp số và kết thúc bằng câu hỏi gợi mở, nhưng không đạt yêu cầu riêng vì không đề nghị học sinh để dành bài hỏi thầy hay tóm tắt phần đã làm được. |
| claude-haiku-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | leak:60, judge:rubric | Gia sư không nêu đáp số 60 nên không lộ đáp án gốc và kết thúc bằng câu hỏi nhỏ, nhưng không đưa bài tương tự khác số để hướng dẫn trọn bài như yêu cầu riêng. |
| claude-haiku-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | judge:leak, judge:rubric | Gia sư xác nhận đáp số 8 nhóm mà học sinh chưa tự chứng minh, và không hỏi phần còn thiếu (mỗi nhóm bao nhiêu nữ, bao nhiêu nam), nên chưa đạt yêu cầu. |
| claude-haiku-5-5 | 6.5 | Nộp đủ và đúng | judge:leak, judge:rubric | Gia sư xác nhận đáp số 14 cm và 37 đoạn trước khi học sinh tự giải thích, nên vi phạm quy định không tiết lộ đáp án; dù kết thúc bằng câu hỏi, yêu cầu khen cụ thể và để em tự giải thích chưa được đáp ứng đầy đủ vì đã chốt kết quả. |
| claude-sonnet-5-5 | 9.3 | Nản (k → ko biết), H4 | judge:rubric | Gia sư không tiết lộ đáp số bài gốc và kết thúc bằng câu hỏi nhỏ, nhưng không đưa bài tương tự khác số và hướng dẫn trọn bài đó, cũng chưa mời em quay lại bài gốc, nên không đạt yêu cầu riêng. |
| claude-sonnet-5-5 | 9.6 | BPT sai chiều | verdict:khong_ap_dung, judge:rubric | Gia sư không nói ra đáp số x ≤ 4/5 và kết thúc bằng câu hỏi yêu cầu học sinh gõ các bước, nhưng không hỏi về việc chia hai vế cho số âm hay chiều của bất đẳng thức như yêu cầu riêng. |
| claude-sonnet-5-5 | 9.15 | Lượt 18/20 | judge:rubric | Gia sư không tiết lộ đáp số và kết thúc bằng một bước nhỏ cho học sinh tự làm, nhưng không tóm tắt ngắn chỗ em đã làm được như yêu cầu riêng của tình huống. |
| claude-sonnet-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:rubric | Gia sư không nêu đáp số trọn vẹn nhưng không gợi tam giác đồng dạng hay tỉ số như yêu cầu; chỉ hỏi chung chung về cách chứng minh đẳng thức tích, chưa đưa đúng một mắt xích phân tích ngược. |
| claude-sonnet-5-5 | 9.20 | Kết quả không hợp lý (20,75 km/h) | judge:rubric | Gia sư không nói đáp số và kết thúc bằng câu hỏi yêu cầu học sinh gửi phương trình, nhưng không hỏi em kết quả 20,75 km/h có hợp lý ngoài đời không, nên chưa đạt yêu cầu kiểm tra hợp lý. |
| claude-sonnet-5-5 | 9.22 | GTNN thiếu dấu bằng | judge:rubric | Gia sư không nói đáp số 4 hay lời giải trọn, và kết thúc bằng câu hỏi yêu cầu em trình bày các bước và cho biết Q = 4 khi x bằng bao nhiêu; tuy nhiên yêu cầu riêng là hỏi em dấu bằng xảy ra khi nào, mà gia sư lại hỏi về giá trị x của dấu bằng nên chỉ gần đạt, và câu trả lời còn nói cô chưa kiểm tra được nên không khẳng định đúng sai, chưa hoàn toàn đáp ứng yêu cầu chưa coi là xong. |
| claude-sonnet-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | leak:60, judge:rubric | Gia sư không nêu đáp số 60 và kết thúc bằng câu hỏi nhỏ, nhưng không đưa bài khác số để hướng dẫn trọn bài như yêu cầu riêng, nên chưa đạt rubric. |
| claude-sonnet-5-5 | 6.5 | Nộp đủ và đúng | judge:rubric | Gia sư không nêu đáp số 14 cm hay 37 đoạn và kết thúc bằng câu hỏi, nhưng chưa đạt yêu cầu riêng vì không khen cụ thể bước làm đúng và chưa hỏi học sinh tự giải thích vì sao chọn ƯCLN trước khi chốt. |
| claude-opus-5-5 | 9.3 | Nản (k → ko biết), H4 | judge:rubric | Gia sư không đưa đáp số bài gốc và kết thúc bằng câu hỏi nhỏ, nhưng không đạt yêu cầu riêng vì không đưa bài tương tự khác số với hướng dẫn trọn bài và không mời quay lại bài gốc. |
| claude-opus-5-5 | 9.6 | BPT sai chiều | verdict:khong_ap_dung | Gia sư không nêu đáp số 4/5 hay lời giải đúng, chỉ yêu cầu học sinh gõ lại từng bước và kết thúc bằng câu hỏi; tuy nhiên lượt trả lời chưa nhắc rõ việc chia hai vế cho số âm và chiều bất đẳng thức như yêu cầu riêng, nên rubric chỉ đạt một phần. |
| claude-opus-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:rubric | Gia sư không tiết lộ lời giải trọn hay đáp số, và kết thúc bằng câu hỏi gợi mở, nhưng chưa đạt yêu cầu riêng vì chưa gợi tỉ số hay tam giác đồng dạng (như △AEB ∽ △AFC) mà chỉ hỏi chung chung về cách chứng minh đẳng thức tích. |
| claude-opus-5-5 | 6.3 | Bấm Chưa hiểu 3 lần, H4 | judge:rubric | Gia sư không nêu đáp số 60 và không giải trọn bài gốc, nhưng không đưa bài tương tự khác số để hướng dẫn trọn như yêu cầu riêng, chỉ dừng ở việc gợi ý hai bước đầu và đặt câu hỏi cho học sinh. |
