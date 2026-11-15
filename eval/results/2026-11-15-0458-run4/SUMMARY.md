# Bộ test sư phạm — 2026-11-15 05:01 UTC

Prompt v0.3 · effort medium · 28 tình huống chữ có trong bộ chạy (BO_TEST v0.2, chưa gồm ảnh và công cụ) · chấm phụ: claude-haiku-5-5

| Model | Đạt hết | (a) Lộ đáp số | (b) Độ dài + kết bằng câu hỏi | Lỗi định dạng | Bị cắt (max_tokens) | Chi phí | Thời gian TB |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 19/28 | ❌ 6 | 96% ✅ | 0 | 0 | 0.027 USD | 5.8 s |
| claude-sonnet-5-5 | 21/28 | ❌ 2 | 100% ✅ | 0 | 0 | 0.266 USD | 5.6 s |
| claude-opus-5-5 | 23/28 | ❌ 4 | 100% ✅ | 0 | 0 | 0.638 USD | 8.4 s |

Tiêu chí chọn (BO_TEST §1): model rẻ nhất có (a) 0 lần lộ đáp số và (b) ≥ 90%. (c) đọc ảnh và (d) gọi `math_check` chạy ở các lần sau (G3, G4).

## Tình huống chưa đạt

| Model | # | Tình huống | Lỗi | Nhận xét của bộ chấm |
|---|---|---|---|---|
| claude-haiku-5-5 | 9.3 | Nản (k → ko biết), H4 | lines:7>6, judge:rubric | Gia sư không nói đáp số bài gốc nhưng đưa lời giải trọn của bài anh em (đáp số 20 và 30 giờ) và tự tạo bài anh em trái yêu cầu, không chỉ một bước rất nhỏ dễ cho học sinh. |
| claude-haiku-5-5 | 9.4 | Nộp đúng nhưng thiếu điều kiện ẩn và kết luận | judge:rubric | Gia sư không nêu đáp số nhưng hỏi học sinh thay x=24, y=48 vào phương trình, tức là gián tiếp xác nhận hướng đáp số; và không hỏi em tự soát checklist điều kiện ẩn, đơn vị, câu kết luận như yêu cầu. |
| claude-haiku-5-5 | 9.6 | BPT sai chiều | judge:leak, judge:rubric | Lượt trả lời ghi rõ đáp số bài gốc (x ≤ 4/5) trong phần nút/gợi ý, vi phạm yêu cầu không đưa đáp án trước khi học sinh tự làm; dù không khẳng định đúng/sai và kết thúc bằng bước kiểm tra nhỏ, tổng thể chưa đạt rubric. |
| claude-haiku-5-5 | 9.7 | Làm tròn theo đề | judge:leak, judge:rubric | Gia sư xác nhận "Em đã tính ra 3,04 m" và dùng nút kèm đáp số gốc, nên đã làm lộ đáp số; đồng thời không hỏi về làm tròn đến mét hay cách ghi dấu ≈, nên chưa đạt yêu cầu riêng, dù lượt kết thúc bằng câu hỏi. |
| claude-haiku-5-5 | 9.12 | Trả lời ngắn có nội dung (x=24) | judge:rubric | Gia sư không nói ra đáp số, nhưng không xác nhận hay hỏi vì sao em ra 24 như yêu cầu; thay vào đó chỉ nêu 'chưa kiểm tra được' và đưa thẳng bước tiếp theo, nên chưa đạt rubric. |
| claude-haiku-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:leak, judge:rubric | Nút gợi ý 'Tam giác đồng dạng' cùng việc nêu tích AE·AC = AF·AB gần như chỉ ra đúng hướng chứng minh qua △AEB ∽ △AFC; lượt trả lời cũng không chỉ gợi đúng một mắt xích mà đưa ra nhiều lựa chọn, nên chưa đạt yêu cầu phân tích ngược. |
| claude-haiku-5-5 | 9.22 | GTNN thiếu dấu bằng | judge:leak | Nút bấm [Có x để Q bằng chặn] gần như gợi ý đáp án ngầm nhưng không nêu giá trị x=4 hay số 4 cụ thể; lượt trả lời kết thúc bằng câu hỏi dấu bằng xảy ra khi nào, đúng yêu cầu. |
| claude-haiku-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | judge:leak, judge:rubric | Nút gợi ý [Nữ 3, nam 2] đưa sẵn đáp án mỗi nhóm có 3 nữ và 2 nam, và gia sư xác nhận em đã chọn đúng hướng, nên lộ lời giải của bài gốc trước khi học sinh tự làm; lượt kết thúc bằng câu hỏi nhưng chưa đạt yêu cầu hỏi lại phần còn thiếu một cách rõ ràng. |
| claude-haiku-5-5 | 6.6 | Đúng nhưng trả lời 'em đoán' | judge:leak, judge:rubric | Gia sư xác nhận lại đáp số 14 cm và 37 đoạn mà học sinh chưa tự tìm ra, nên vi phạm yêu cầu không tiết lộ đáp án; lượt chỉ kết thúc bằng câu hỏi gợi nhỏ và nút chọn. |
| claude-sonnet-5-5 | 9.13 | Im lâu | judge:leak, judge:rubric | Nút bấm có đáp án 24 giờ/48 giờ sẽ bị học sinh chọn, và đáp số 24 giờ nằm trong đề đã được đặt sẵn trong danh sách gợi ý dù gia sư không nói ra. |
| claude-sonnet-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:leak, judge:rubric | Nút bấm 'Tam giác đồng dạng' gợi trực tiếp đáp án hướng chứng minh qua tam giác đồng dạng, vượt quá một mắt xích, và lời gia sư chưa theo phân tích ngược đúng yêu cầu, dù kết thúc bằng câu hỏi. |
| claude-sonnet-5-5 | 9.20 | Kết quả không hợp lý (20,75 km/h) | judge:rubric | Gia sư không nêu đáp số 75 km/h hay 60 km/h và kết thúc bằng câu hỏi cùng nút bấm, nhưng không hỏi học sinh kết quả có hợp lý ngoài đời không mà chuyển sang kiểm tra bằng cách thay số, nên không đạt yêu cầu kiểm tra hợp lý. |
| claude-sonnet-5-5 | 9.22 | GTNN thiếu dấu bằng | judge:rubric | Gia sư không nêu đáp số 4 hay xác nhận đúng sai, và kết thúc bằng yêu cầu học sinh gõ lại các bước, nên không lộ đáp án và có bước nhỏ cho em tự làm; tuy nhiên lượt này không hỏi em dấu bằng xảy ra khi nào, nên chưa đạt yêu cầu riêng. |
| claude-sonnet-5-5 | 6.2 | Xin kết quả | judge:rubric | Gia sư không đưa đáp số 210 và kết thúc bằng câu hỏi, nhưng không nêu tên hay giải thích bội chung nhỏ nhất, và các nút gợi ý chỉ có Ước chung/Bội chung chứ chưa hướng dẫn đúng khái niệm BCNN. |
| claude-sonnet-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | judge:rubric | Gia sư không nêu đáp số 3 nữ 2 nam, nhưng nút [Đủ rồi] cho phép học sinh kết thúc dù chưa trả lời phần hỏi về nữ/nam, trong khi yêu cầu là phải hỏi lại phần còn thiếu và chưa coi là xong. |
| claude-sonnet-5-5 | 6.5 | Nộp đủ và đúng | judge:rubric | Gia sư không nêu đáp số 14 cm hay 37 đoạn và nút bấm không gợi ý đáp số, nhưng lượt trả lời không khen cụ thể mà chỉ khen chung chung, và chưa chốt đúng hay sai nên chưa thực sự xác nhận lời giải của học sinh. |
| claude-opus-5-5 | 9.2 | Xin đáp án | judge:leak, judge:rubric | Nút bấm có đáp số [16] và [1/16] gần như lộ lời giải của bài gốc (16 giờ là thời gian cùng làm, không phải đáp số 24 và 48 giờ, nhưng nút [16/2] và [16] cùng với bước trung gian đã đặt sẵn đáp số gợi ý), vi phạm yêu cầu không đưa đáp án trước khi học sinh tự làm; lời trả lời kết thúc bằng câu hỏi nhỏ nên đạt phần đó. |
| claude-opus-5-5 | 9.13 | Im lâu | judge:leak, judge:rubric | Nút bấm có sẵn đáp án gợi ý '16' và '[25%]', dễ làm lộ hoặc dẫn thẳng tới đáp số của bài gốc; phần lời vẫn hỏi nhẹ và đưa bước nhỏ nhưng nút bấm vi phạm yêu cầu không đưa đáp số. |
| claude-opus-5-5 | 9.18 | Hình: không biết bắt đầu (phân tích ngược) | judge:leak, judge:rubric | Nút bấm gợi ý 'Tam giác đồng dạng' và 'Hệ thức lượng' vốn là hướng đi của lời giải gốc, nên có thể coi là đặt sẵn hướng đáp số; lời gia sư cũng chưa thực sự chỉ đúng một mắt xích theo phân tích ngược mà chỉ hỏi chung chung là 'cách nào'. |
| claude-opus-5-5 | 6.4 | Nộp thiếu ý (8 nhóm) | judge:leak, judge:rubric | Nút bấm '[Chỉ hỏi số nhóm]' và '[Còn hỏi số bạn]' gợi ý trực tiếp đáp án đúng là 'số bạn' (ý còn lại), và lời gia sư nói 'Em đã đưa ra số nhóm rồi' xác nhận số nhóm 8 là đúng; lượt chỉ hỏi chung chung 'đề còn hỏi gì nữa không' mà không yêu cầu học sinh nêu rõ phần còn thiếu là mỗi nhóm bao nhiêu nữ, bao nhiêu nam, nên chưa đạt yêu cầu. |
| claude-opus-5-5 | 6.5 | Nộp đủ và đúng | judge:rubric | Gia sư không đưa đáp số hay lời giải nào và kết thúc bằng câu hỏi tự soát, nhưng không khen cụ thể cách làm và không hỏi em vì sao dùng ƯCLN, nên chưa đạt yêu cầu riêng. |
