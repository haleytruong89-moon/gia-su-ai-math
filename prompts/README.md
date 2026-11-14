# prompts/

Lớp ①②③ của system prompt, chép nguyên từ hub `deliverables/gia-su-ai/SYSTEM_PROMPT_v0.2.md`
(bản đã duyệt). Sửa ở hub trước, rồi chép lại đây và tăng `PROMPT_VERSION`; mỗi lần đổi chạy
`npm run eval` (BO_TEST) và ghi kết quả vào PR.

Lớp ④ (hồ sơ dạy học của từng con) **không** nằm trong repo công khai: bố mẹ nhập ở `/gia-su/bo-me`,
app đọc từ `tutor.teaching_profiles`. Lớp ⑤ (thẻ kiến thức) đến ở G5, ⑥ (khối trạng thái) do
`lib/tutor/assemble.ts` sinh mỗi lượt.
