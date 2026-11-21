# Thẻ "Hiểu bản chất" — đợt 0 (mẫu để duyệt), 21/11/2026

Thiết kế C (phụ huynh chốt 21/11): **cách giảng** nằm trong hướng dẫn cố định của cô; **nội dung giảng** nằm ở thẻ này, bố mẹ duyệt. App hiện **nguyên văn** thẻ đã duyệt trong một khung riêng; cô chỉ thêm 1–2 câu nối với bài con đang làm.

- Mỗi bài có **2 cách giảng**: cách 1 hiện trước; cách 2 khi con bấm "Giảng lại cách khác". Hết 2 cách → cô đề nghị để dành hỏi thầy.
- Máy chủ đổi sang cách còn lại nếu ví dụ của thẻ **trùng số** với bài con đang làm.
- Dòng `kiểm:` là phép tính máy tính đại số kiểm lại mỗi lần đóng gói kho kiến thức (đã kiểm đợt này bằng SymPy, 21/11).
- Cuối mỗi thẻ chỉ có 2 nút: **"Em hiểu rồi"** · **"Giảng lại cách khác"**.

**Cách duyệt:** mỗi thẻ ghi ✅ (giữ nguyên) hoặc ghi sửa chỗ nào ngay dưới thẻ.

---

## T6.11 · Ước chung, ƯCLN

### Cách 1 — "Chia quà vào túi"

**Ví dụ.** Cô có 12 cái kẹo và 18 cái bánh, muốn chia đều vào các túi sao cho túi nào cũng giống hệt nhau, không thừa cái nào.
- Chia được 1, 2, 3 hoặc 6 túi. Đó là **ước chung** của 12 và 18: ƯC(12, 18) = {1; 2; 3; 6}.
- **Nhiều túi nhất** là 6 túi → **ƯCLN**(12, 18) = 6.

**Vì sao?** Số túi phải chia hết **cả** số kẹo **lẫn** số bánh, nên số túi phải là ước của 12 **và** là ước của 18. ƯCLN là số túi lớn nhất làm được cả hai việc đó.

**Nhìn bằng thừa số nguyên tố.** 12 = 2 · 2 · 3 và 18 = 2 · 3 · 3. Số túi phải "nằm gọn" trong cả hai số, nên chỉ được dùng những thừa số **cả hai cùng có**: một số 2 và một số 3. Lấy thêm số 2 thứ hai thì 18 không chia được; lấy thêm số 3 thứ hai thì 12 không chia được. Vậy ƯCLN = 2 · 3 = 6.

**Quy tắc.** Phân tích ra thừa số nguyên tố → chọn các thừa số **chung** → mỗi thừa số lấy **số mũ nhỏ nhất** → nhân lại.
Muốn tìm ƯC: tìm ƯCLN trước, rồi lấy **các ước của ƯCLN**.

📝 **Mẹo nhớ:** *ƯCLN lấy chung, mũ thấp nhất.*
— Vì: ƯCLN phải chia được **mọi** số, nên chỉ giữ phần **số nào cũng có**, và chỉ giữ ít nhất bằng số "nghèo" nhất.

🔎 **Dấu hiệu trong đề:** "chia đều", "chia thành các nhóm như nhau", "nhiều nhất", "lớn nhất", "cắt thành các đoạn bằng nhau dài nhất" → **ƯCLN**.

`kiểm: gcd(12, 18) = 6; ước chung của 12 và 18 = {1, 2, 3, 6}`

### Cách 2 — "Cắt dây thành đoạn bằng nhau"

**Ví dụ.** Hai sợi dây dài 24 m và 36 m. Cắt cả hai thành các đoạn **bằng nhau**, không thừa, mỗi đoạn **dài nhất** là bao nhiêu?
- Độ dài mỗi đoạn phải đo vừa khít cả 24 lẫn 36 → là ước chung của 24 và 36.
- Dài nhất là 12 m (sợi 24 m được 2 đoạn, sợi 36 m được 3 đoạn) → ƯCLN(24, 36) = 12.

**Vì sao?** Hãy coi mỗi số là một "túi thừa số": 24 = 2 · 2 · 2 · 3 và 36 = 2 · 2 · 3 · 3. Phần **giống nhau** của hai túi là 2 · 2 · 3 = 12. Đó là số lớn nhất "chui vừa" cả hai túi.

**Viết gọn bằng lũy thừa.** 24 = 2³ · 3, 36 = 2² · 3². Thừa số chung là 2 và 3. Số 2: mũ 3 và mũ 2 → lấy 2. Số 3: mũ 1 và mũ 2 → lấy 1. ƯCLN = 2² · 3 = 12.
Các ước chung là các ước của 12: {1; 2; 3; 4; 6; 12}.

**Quy tắc.** Thừa số **chung**, số mũ **nhỏ nhất**. ƯC = ước của ƯCLN.

📝 **Mẹo nhớ:** *ƯCLN lấy chung, mũ thấp nhất.*
— Vì: lấy mũ cao hơn thì sẽ có một số không chia hết (như lấy 2³ thì 36 không chia hết cho 8).

🔎 **Dấu hiệu trong đề:** "dài nhất", "nhiều nhất", "chia đều" → ƯCLN.

`kiểm: gcd(24, 36) = 12; 24/12 = 2; 36/12 = 3; ước của 12 = {1, 2, 3, 4, 6, 12}; 36 % 8 ≠ 0`

---

## T6.12 · Bội chung, BCNN

### Cách 1 — "Chiếc hộp đựng vừa"

**Ví dụ.** Tìm số nhỏ nhất (khác 0) chia hết cho cả 12 và 18.

**Vì sao?** Em hãy tưởng tượng BCNN là **một chiếc hộp** phải đựng vừa cả số 12 lẫn số 18.
- 12 = 2 · 2 · 3 → hộp phải có ít nhất **hai số 2** và **một số 3**.
- 18 = 2 · 3 · 3 → hộp phải có ít nhất **một số 2** và **hai số 3**.

Muốn đựng vừa cả hai, hộp cần **hai số 2** (vì 12 cần hai) và **hai số 3** (vì 18 cần hai): 2 · 2 · 3 · 3 = **36**. Thiếu bất kỳ số nào thì một trong hai số không "vào" được hộp, tức là không chia hết.

**Viết gọn bằng lũy thừa.** 12 = 2² · 3, 18 = 2 · 3² → BCNN = 2² · 3² = 36.
Các bội chung là các bội của 36: 36, 72, 108, …

**Quy tắc.** Lấy **tất cả** thừa số (chung và riêng) → mỗi thừa số lấy **số mũ lớn nhất** → nhân lại. BC = bội của BCNN.

📝 **Mẹo nhớ:** *BCNN gom hết, mũ cao nhất.*
— Vì: hộp phải đựng vừa **mọi** số, nên số nào cần bao nhiêu thừa số thì hộp phải có đủ bấy nhiêu.

🔎 **Dấu hiệu trong đề:** "cùng lặp lại", "lại cùng nhau", "ít nhất bao lâu", "số nhỏ nhất chia hết cho…", "xếp hàng 2, hàng 3… đều vừa đủ" → **BCNN**.

`kiểm: lcm(12, 18) = 36; bội chung đầu tiên: 36, 72, 108`

### Cách 2 — "Hai đèn nhấp nháy"

**Ví dụ.** Đèn xanh cứ 4 giây nháy một lần, đèn đỏ cứ 6 giây nháy một lần. Lúc đầu hai đèn cùng nháy. Sau ít nhất bao nhiêu giây chúng lại cùng nháy?
- Đèn xanh nháy ở giây: 4, 8, **12**, 16, 20, **24**, …
- Đèn đỏ nháy ở giây: 6, **12**, 18, **24**, …
- Cùng nháy ở các giây 12, 24, … (bội chung). Sớm nhất là 12 → BCNN(4, 6) = 12.

**Vì sao?** Thời điểm cùng nháy phải là bội của 4 **và** bội của 6. "Ít nhất" nên ta lấy bội chung **nhỏ nhất**.
Nhìn bằng thừa số: 4 = 2 · 2, 6 = 2 · 3. Số cần tìm phải chứa đủ "hai số 2" của 4 và "số 3" của 6 → 2 · 2 · 3 = 12.

**Quy tắc.** Thừa số chung **và** riêng, số mũ **lớn nhất**. Số nhỏ thì có thể liệt kê bội như trên; số lớn thì phân tích thừa số cho nhanh.

📝 **Mẹo nhớ:** *BCNN gom hết, mũ cao nhất.*
— Vì: thiếu một thừa số của số nào thì số đó không chia hết.

🔎 **Dấu hiệu trong đề:** "cùng lúc lại", "ít nhất", "lần tiếp theo cùng" → BCNN. "Trong khoảng từ … đến …" → tìm BCNN rồi chọn bội nằm trong khoảng.

`kiểm: lcm(4, 6) = 12; bội của 4 ∩ bội của 6 (≤ 24) = {12, 24}`

---

## T9.9 · Rút gọn biểu thức chứa căn

### Cách 1 — "Nhận ra hằng đẳng thức trong căn"

**Ví dụ.** Rút gọn C = 1/(√x − 4) − 8/(x − 16).

**Rút gọn là gì?** Viết biểu thức cho **gọn nhất** mà **giá trị không đổi** với mọi x hợp lệ. Thử x = 9: biểu thức ban đầu bằng 1/7, và biểu thức sau khi rút gọn cũng phải ra 1/7.

**Bước 1 — ĐKXĐ (vì sao phải có?).** Căn của số âm không có nghĩa, và không được chia cho 0. Nên x ≥ 0; √x − 4 ≠ 0 → x ≠ 16; x − 16 ≠ 0 → x ≠ 16. **ĐKXĐ: x ≥ 0, x ≠ 16.**

**Bước 2 — Nhìn ra "bí mật" của mẫu.** Khi x ≥ 0 thì x = (√x)². Nên x − 16 = (√x)² − 4² = (√x − 4)(√x + 4). Đây chính là hằng đẳng thức a² − b² = (a − b)(a + b) của lớp 8, chỉ là a = √x.

**Bước 3 — Quy đồng.** Mẫu chung là (√x − 4)(√x + 4):
C = (√x + 4 − 8) / ((√x − 4)(√x + 4)) = (√x − 4) / ((√x − 4)(√x + 4)).

**Bước 4 — Rút gọn đến tận cùng.** Tử và mẫu cùng có (√x − 4) → gạch đi: **C = 1/(√x + 4)** với x ≥ 0, x ≠ 16.
Kiểm lại với x = 9: 1/(3 + 4) = 1/7 ✓.

📝 **Mẹo nhớ:** *Thấy "x trừ số chính phương" → nghĩ ngay (√x − a)(√x + a).*
— Vì: với x ≥ 0 thì x = (√x)², nên x − a² là hiệu hai bình phương.

🔎 **Thói quen tự soát (checklist):** ① Viết ĐKXĐ trước. ② Phân tích mẫu. ③ Thu gọn tử. ④ Tử và mẫu còn nhân tử chung không? ⑤ Thử một giá trị x để kiểm.

`kiểm: simplify(1/(sqrt(x)-4) - 8/(x-16) - 1/(sqrt(x)+4)) = 0 (x ≥ 0); x - 16 = (sqrt(x)-4)(sqrt(x)+4); C(9) = 1/7`

### Cách 2 — "Đặt t = √x: bài căn thành bài phân thức lớp 8"

**Ví dụ.** Vẫn là C = 1/(√x − 4) − 8/(x − 16).

**Vì sao làm được?** Căn chỉ là "lớp áo" bên ngoài. Đặt **t = √x** (nhớ t ≥ 0). Vì x = t² nên:
C = 1/(t − 4) − 8/(t² − 16).
Giờ nó là **phân thức đại số lớp 8** em đã quen!

**Làm như lớp 8.** t² − 16 = (t − 4)(t + 4).
C = (t + 4 − 8) / ((t − 4)(t + 4)) = (t − 4) / ((t − 4)(t + 4)) = 1/(t + 4) (với t ≠ 4).

**Mặc lại "lớp áo".** Thay t = √x: **C = 1/(√x + 4)**. Điều kiện t ≥ 0, t ≠ 4 nghĩa là x ≥ 0, x ≠ 16.

📝 **Mẹo nhớ:** *Rối vì căn → đặt t = √x (t ≥ 0) → làm như phân thức lớp 8 → thay lại.*
— Vì: x = t² khi t = √x ≥ 0, nên mọi "x" đều viết được theo t.

🔎 **Khi nào dùng:** biểu thức có cả √x và x (như x − 16, x + 4√x + 4, x − 2√x). Nếu thấy hằng đẳng thức ngay thì không cần đặt t.

`kiểm: simplify(1/(t-4) - 8/(t**2-16) - 1/(t+4)) = 0 (t ≥ 0)`

---

## Câu hỏi cho bố mẹ khi duyệt

1. Giọng văn (xưng "cô – em", hình ảnh chiếc hộp, túi quà, đèn nháy) đã đủ thân thiện và dễ hiểu chưa?
2. Độ dài: lớp 6 khoảng 12–15 dòng mỗi thẻ, lớp 9 khoảng 15–20 dòng. Ngắn hơn hay giữ nguyên?
3. Lớp 6 viết cả dạng 2 · 2 · 3 **và** dạng lũy thừa 2² · 3 (SGK Kết nối tri thức dạy lũy thừa trước bài phân tích thừa số). Giữ cả hai?
