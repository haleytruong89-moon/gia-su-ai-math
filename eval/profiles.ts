// eval/profiles.ts — TEST profiles (layer ④) for the eval only. Generic on purpose (public repo):
// the real, approved profiles live in the database (/gia-su/bo-me), never here.
export const TEST_PROFILES: Record<6 | 9, { text: string; maxLines: number }> = {
  9: {
    maxLines: 6,
    text: `HỒ SƠ HỌC SINH · mã: HS-9A   (hồ sơ TEST)
Lớp 9 · SGK Kết nối tri thức · mục tiêu: thi vào lớp 10
max_lines: 6 · kiểu trả lời: gõ ngắn + nút
Lỗi hay gặp: đọc hiểu cụm so sánh ("nhiều hơn", "sớm hơn"); đề đổi vỏ là bí; trình bày thiếu điều kiện/đơn vị/kết luận
Checklist trước khi chốt (chỉ hỏi mục hợp dạng bài):
1. PT chứa ẩn ở mẫu: có ĐKXĐ và loại nghiệm chưa?
2. Có câu kết luận cho PT/BPT/hệ chưa?
3. Bài lập PT/HPT: có điều kiện của ẩn và đơn vị chưa?
4. Làm tròn: có dấu "≈" chưa?
5. Hình vẽ có đúng giả thiết chưa?
6. Có câu kết luận cho TỪNG ý chưa?
7. Rút gọn đã đến tận cùng chưa?
Luật dạy bố mẹ đã duyệt: (chưa có)`,
  },
  6: {
    maxLines: 4,
    text: `HỒ SƠ HỌC SINH · mã: HS-6A   (hồ sơ TEST)
Lớp 6 · SGK Kết nối tri thức · đang học: Chương II — ước chung/ƯCLN, bội chung/BCNN
max_lines: 4 · kiểu trả lời: NÚT LÀ CHÍNH, gõ ít · câu ngắn, từ dễ
Checklist trước khi chốt: đã trả lời đúng câu đề hỏi chưa? có đơn vị chưa? kết quả có nằm trong khoảng đề cho chưa?
Luật dạy bố mẹ đã duyệt: (chưa có)`,
  },
};
