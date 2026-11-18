# Hộp công cụ rút gọn biểu thức · lớp 9 · v0.1
> Nguồn: hub `HOP_CONG_CU_RUT_GON_9_v0.1.md` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts).

## 0. Hằng đẳng thức — phải thuộc lòng

### 0.1. Bảy hằng đẳng thức (lớp 8)
| # | Dạng |
|---|---|
| 1 | (a + b)² = a² + 2ab + b² |
| 2 | (a − b)² = a² − 2ab + b² |
| 3 | a² − b² = (a − b)(a + b) |
| 4 | (a + b)³ = a³ + 3a²b + 3ab² + b³ |
| 5 | (a − b)³ = a³ − 3a²b + 3ab² − b³ |
| 6 | a³ + b³ = (a + b)(a² − ab + b²) |
| 7 | a³ − b³ = (a − b)(a² + ab + b²) |

### 0.2. Cùng hằng đẳng thức, viết với √x (x ≥ 0) — dạng gặp trong bài rút gọn
| Biểu thức | Phân tích | Dùng HĐT |
|---|---|---|
| x − 1 | (√x − 1)(√x + 1) | 3 |
| x − 9 | (√x − 3)(√x + 3) | 3 |
| x − 2√x + 1 | (√x − 1)² | 2 |
| x + 4√x + 4 | (√x + 2)² | 1 |
| x√x − 1 | (√x − 1)(x + √x + 1) | 7 |
| x√x + 8 | (√x + 2)(x − 2√x + 4) | 6 |
| x + √x − 2 | (√x − 1)(√x + 2) | tam thức, nhẩm nghiệm |
| x − √x | √x(√x − 1) | đặt nhân tử chung |

**Mẹo nhìn ra:** coi √x là một chữ (vd t), thì x = t², x√x = t³. Biểu thức theo √x thành đa thức theo t.

### 0.3. Câu ôn đầu buổi (khối D, ôn cách quãng)
- Mỗi buổi 1–2 câu, **con viết lại từ trí nhớ**, gia sư AI không nhắc sẵn. Ví dụ: "Viết hằng đẳng thức a³ − b³" · "Phân tích x − 4" · "x√x + 27 bằng gì nhân gì?"
- Lịch ôn theo DOMAIN v0.4 §4.11: sai → hỏi lại ngày mai; đúng → lần sau cách 3 rồi 7 ngày; đúng 3 lần liên tiếp → coi là thuộc, thôi hỏi.
- Khi gặp HĐT giữa bài: hỏi con viết lại HĐT trước ("Em viết giúp cô a² − b² = ?"), rồi mới áp dụng.

## 1. Quy trình rút gọn 6 bước

| Bước | Làm gì | Câu gia sư AI hỏi |
|---|---|---|
| 1 | Ghi ĐKXĐ (đề thường cho sẵn — chép lại) | "Đề cho điều kiện gì của x?" |
| 2 | **Phân tích từng mẫu thành nhân tử** (bảng 0.2) | "Mẫu này có phải hằng đẳng thức không?" |
| 3 | Tìm mẫu chung (MTC) | "Mẫu nào chứa được tất cả các mẫu khác?" |
| 4 | Quy đồng, gộp tử, **mở ngoặc, thu gọn tử** | "Nhân tử phụ của phân số này là gì?" |
| 5 | **Phân tích tử thành nhân tử, rút gọn với mẫu** — làm đến khi không còn nhân tử chung | "Tử còn phân tích được không? Có nhân tử nào giống mẫu không?" |
| 6 | Kết luận: "Vậy P = … với [ĐK]" | "Em đã viết câu kết luận chưa?" |

### 1.1. Kiểm "đã đến tận cùng chưa" (trước khi chốt)
1. Tử đã phân tích thành nhân tử chưa? (tử dạng −3√x − 9 → −3(√x + 3))
2. Tử và mẫu còn nhân tử chung không?
3. Mẫu còn dạng x − a² chưa tách không?
4. Đã có câu kết luận kèm điều kiện chưa?

Gia sư AI **gọi C1** để kiểm: biểu thức con viết bằng biểu thức gốc, và không còn nhân tử chung.

## 3. Câu phụ — hộp công cụ theo yêu cầu đề

| Đề hỏi | Cách làm | Lỗi hay gặp |
|---|---|---|
| Tính P khi x = a | **Kiểm a thỏa ĐK** → tính √a (đưa a về bình phương nếu cần) → thay vào P đã rút gọn | Không kiểm ĐK; viết √(7 − 4√3) = 7 − 2√3 |
| Tìm x để P = k | Giải PT theo √x → **đối chiếu ĐK** → kết luận | Quên loại √x < 0 hoặc x = 9 |
| So sánh P với số k | Xét **hiệu P − k**, xét dấu tử và mẫu theo ĐK | Nhân chéo khi chưa biết dấu mẫu |
| Tìm x nguyên để P nguyên | Lập luận √x phải là số nguyên (nếu không P vô tỉ) → mẫu là ước của tử → đối chiếu ĐK | Bỏ ước âm; quên x ≠ 9; không giải thích vì sao √x nguyên |
| **(2c)** Tìm m để PT P = m có nghiệm | Rút √x theo m → điều kiện √x ≥ 0 và √x ≠ 3 | Quên điều kiện √x ≥ 0 |
| **(2c)** GTNN / GTLN | Tách để dùng **Cô-si** (a + b ≥ 2√(ab), a, b ≥ 0) hoặc đánh giá √x ≥ 0; **chỉ ra dấu bằng xảy ra** | Không chỉ ra dấu bằng; dấu bằng ngoài ĐK |
| **(2c)** x thực để P nguyên | Chặn miền giá trị của P (a < P ≤ b) → liệt kê số nguyên trong khoảng → tìm x | Làm như "x nguyên" |

## 4. Kịch bản gợi ý (H1–H4, theo thang chung)

| Mức | Khi con vướng ở rút gọn | Khi con vướng ở câu phụ |
|---|---|---|
| H1 | "Em xem các mẫu: có mẫu nào là hằng đẳng thức không?" | "Đề hỏi loại gì: tính giá trị, tìm x, so sánh hay GTNN?" |
| H2 | "x − 9 = (… )(… )? Thử coi √x là t." | Hiện các cách trong bảng 3 dưới dạng nút, con chọn |
| H3 | Làm mẫu **một** bước trên bài khác số (vd x − 4) | Chỉ ra bước đầu: "Xét hiệu P − 1, em quy đồng thử" |
| H4 | Bài anh em: cùng cấu trúc, khác số (C3, đáp số kiểm C1) | Bài anh em cùng dạng câu phụ |

Không đưa lời giải bài gốc ở bất kỳ mức nào (luật cứng).
