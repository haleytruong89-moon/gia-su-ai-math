# SPEC — Gia sư AI Toán · bản cho repo (rebuild 14/11/2026)

> Rút gọn từ hub `SPEC_GIA_SU_AI_v0.2.md` (13/11) + `NANG_LUC_GIA_SU_AI_v0.1.md` (14/11). Phần quy tắc nằm ở `docs/DOMAIN.md`; khi hai file khác nhau, **DOMAIN thắng**.

## 1. Vấn đề và mục tiêu
Buổi chiều 2 con có nhiều thời gian tự học nhưng không có người lớn. Bố mẹ có ~2 giờ buổi tối, gia sư người 2 buổi/tuần. Tốc độ tiến bộ do giờ tự học buổi chiều quyết định.

| # | Giả thuyết kiểm chứng trong thí điểm 2 tuần | Đo bằng |
|---|---|---|
| H1 | Con tự học buổi chiều lâu hơn khi có gia sư AI gỡ chỗ kẹt | Phút học/chiều; số bài gỡ được |
| H2 | Con tự làm xong mà không chép lời giải, không bỏ cuộc | Tỉ lệ self_solved / saved_for_later / abandoned |
| H3 | Giảng may đo theo chỗ kẹt dễ hiểu hơn bài giảng chung | Con tự chấm 😊😐😕 |
| H4 | Báo cáo tối giúp bố mẹ/gia sư can thiệp đúng chỗ trong ≤ 5 phút | Thời gian đọc; số góp ý thành luật dạy |
| H6 | Một lõi dùng cho cả lớp 6 và lớp 9, khác ở hồ sơ dạy học | So 2 con |

Mục tiêu riêng HS-9A (thầy, 14/11): đề vào 10 Hà Nội, Toán 8,5–9,25; ưu tiên ý chặn 2c, 3c, 4b ý 2 (8,5) và 4c, 5 (9,5).

## 2. Phạm vi v1
**Trong:** Toán 6 và Toán 9 KNTT cả năm + kiến thức nền lớp dưới; hỏi bằng ảnh (camera, ảnh Boox) + gõ + nút; luồng 1 (con hỏi bài) và luồng 2 (con chấm, bố mẹ đọc báo cáo, góp ý → luật dạy); ôn cách quãng đầu buổi; máy tính đại số; laptop, iPad, Boox (chế độ e-ink).
**Ngoài:** luồng 3 (gói chủ đề) vẫn soạn trong hub; chấm quyết định bài chứng minh hình (chỉ gợi ý hướng + chờ thầy); môn khác; streak/xếp hạng; tài khoản gia sư người; vẽ hình C2 (v1.1); mức nắm vững M0–M4 trong app (v1.1).

## 3. Người dùng và thiết bị
| Vai | Khi nào | Thiết bị |
|---|---|---|
| Con HS-9A, HS-6A | Buổi chiều, một mình | iPad (chụp), Boox Nova Air C (viết tay → xuất PNG), laptop |
| Bố mẹ | Buổi tối, 5 phút đọc | iPhone (thông báo), laptop (báo cáo) |
| Gia sư người | 2 buổi/tuần | Không có tài khoản; bố mẹ chia sẻ báo cáo |

## 4. User stories + tiêu chí nghiệm thu
| ID | Story | Tiêu chí (tự kiểm) |
|---|---|---|
| US1 | Con gửi ảnh bài đang kẹt + chọn chỗ kẹt | ≤ 3 thao tác; nhận ảnh từ camera và file; xác nhận đề ở 100% ca test |
| US2 | Con được giảng đúng chỗ kẹt, ngắn | ≤ 6 dòng (HS-6A ≤ 4); kết thúc bằng câu hỏi hoặc bước tự làm |
| US3 | "Chưa hiểu" → giảng cách khác | Câu thăm dò mới + bước nhỏ hơn; không lặp lời cũ |
| US4 | Không chép được lời giải nhưng vẫn làm xong | 0 lần lộ lời giải bài gốc trong bộ test; thang H đúng DOMAIN §3.3, §4.1 |
| US5 | Nản thì được đổi cách | Ca nản DOMAIN §4.2: nhảy H4 bằng bài anh em đã kiểm (C3) |
| US6 | Con chấm gia sư ≤ 5 giây | 1 chạm; lý do tùy chọn; 1 lần/buổi |
| US7 | Bố mẹ đọc báo cáo tối ≤ 5 phút | Gộp 2 con; cờ DOMAIN §4.7 đúng trên dữ liệu test; KU nền bị hổng; ý chặn |
| US8 | Góp ý của bố mẹ thành luật dạy | proposed → approved → có hiệu lực từ buổi sau; có version |
| US10 | Gia sư người xem điểm nghẽn tuần + bài hình chờ xem | Trang tuần lọc theo con, gốc lỗi, KU |
| US11 | Dùng được trên Boox | E-ink: không animation, tương phản cao, nút ≥ 48px, phân trang; PNG từ Boox Notes tải lên được |
| US12 | Chi phí không vượt trần | DOMAIN §4.5 a–e |
| US13 *(mới)* | Phép tính được kiểm chính xác | DOMAIN §4.12: `self_solved` chỉ khi `math_check` đạt; bài anh em đã kiểm |
| US14 *(mới)* | Con vướng kiến thức lớp dưới được dạy bù | DOMAIN §4.13: ≤ 2 lượt, ghi `prereq_gaps`, báo cáo liệt kê |
| US15 *(mới)* | Ôn lại chỗ từng vướng đầu buổi | DOMAIN §4.11 a–f |
| US16 *(mới)* | Bài ngoài đề cương / HK II vẫn được dạy | Bộ test 9.17: không trả lời "ngoài phạm vi" |

## 5. Thí điểm và go/no-go (D7)
2 tuần, cả 2 con. Tính riêng từng con: ≥ 60% bài kết thúc U2–U3; ≤ 10% bỏ dở; ≥ 70% buổi con chấm 😊 hoặc 😐; **0 lần lộ lời giải**; chi phí ≤ trần; bố mẹ thấy báo cáo hữu ích.
