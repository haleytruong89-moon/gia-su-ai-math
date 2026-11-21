# Thẻ "Đọc đề" — đợt 0 (mẫu để duyệt), 21/11/2026

Thẻ "Đọc đề" dạy con **dịch đề đời thường sang ngôn ngữ toán**. Mỗi dạng bài thực tế có 2 cách giảng, bố mẹ duyệt trước, giống thẻ "Hiểu bản chất". Ví dụ trong thẻ **luôn khác số** với bài con đang làm. Vì là bài khác, thẻ được giải trọn để con thấy cả đường đi.

Mỗi thẻ đi theo 5 bước, giống nhau cho cả 2 con:
**① Kể lại** · **② Đề hỏi gì** · **③ Thử tay với số nhỏ** · **④ Dịch từ khóa → toán** · **⑤ Kiểm tra hợp lý**

Cuối thẻ có 2 nút: **"Em hiểu rồi"** · **"Giảng lại cách khác"**.

---

## D6.1 · Lớp 6 · "Chia đều — nhiều nhất" → ƯCLN

### Cách 1 — "Chia tổ"

**Đề:** Lớp có 20 bạn nam và 30 bạn nữ, chia thành các tổ sao cho mỗi tổ có số nam như nhau và số nữ như nhau. Chia được nhiều nhất bao nhiêu tổ?

**① Kể lại.** Chia cả lớp thành các tổ "giống hệt nhau", không bạn nào bị lẻ ra.
**② Đề hỏi gì?** **Số tổ**, và phải là số **nhiều nhất**.
**③ Thử tay.**
- 2 tổ: mỗi tổ 10 nam, 15 nữ ✓.
- 3 tổ: 20 nam chia 3 bị lẻ ✗, có bạn nam không vào được tổ nào.
→ Số tổ phải **chia hết cả 20 lẫn 30**, tức là **ước chung** của 20 và 30.
**④ Dịch từ khóa.** "như nhau, không thừa" → **chia hết** → ước chung. "nhiều nhất" → **lớn nhất** → **ƯCLN**(20, 30) = 10.
Vậy chia được nhiều nhất 10 tổ, mỗi tổ 2 nam và 3 nữ.
**⑤ Kiểm tra hợp lý.** Số tổ **không thể lớn hơn** 20 và 30 (vì không có tổ nào trống). ƯCLN luôn **nhỏ hơn hoặc bằng** các số đã cho ✓.

🔎 Ghi vào vở: *"chia đều", "như nhau", "không thừa" + "nhiều nhất / lớn nhất" → ƯCLN.*

`kiểm: gcd(20, 30) = 10; 20/10 = 2; 30/10 = 3; 20 % 3 ≠ 0`

### Cách 2 — "Viết lại câu hỏi thành câu toán"

**Đề:** Có 48 quyển vở và 36 cái bút, chia đều vào các phần quà sao cho số vở và số bút ở mỗi phần như nhau. Làm được nhiều nhất bao nhiêu phần quà?

**Mẹo đọc:** em **viết lại câu hỏi** bằng một câu toán, bỏ hết chuyện vở, bút.
- "Chia đều 48 vở vào các phần" → số phần **chia hết 48**.
- "Chia đều 36 bút vào các phần" → số phần **chia hết 36**.
- "Nhiều nhất" → số **lớn nhất**.
→ Câu toán: **"Tìm số lớn nhất chia hết cả 48 và 36"** → ƯCLN(48, 36) = 12.
Vậy làm được 12 phần quà, mỗi phần 4 quyển vở và 3 cái bút.

**Kiểm tra hợp lý:** 12 phần × 4 vở = 48 ✓; 12 phần × 3 bút = 36 ✓.

🔎 Phân biệt nhanh: đáp số **nhỏ hơn** các số đã cho → thường là **ƯCLN**. Đáp số **lớn hơn** → thường là **BCNN**.

`kiểm: gcd(48, 36) = 12; 48/12 = 4; 36/12 = 3`

---

## D6.2 · Lớp 6 · "Cùng lặp lại — ít nhất" và "trong khoảng" → BCNN, BC

### Cách 1 — "Lịch đi bơi"

**Đề:** Bạn Lan cứ 6 ngày đi bơi một lần, bạn Mai cứ 8 ngày đi bơi một lần. Hôm nay hai bạn cùng đi bơi. Sau ít nhất bao nhiêu ngày hai bạn lại cùng đi bơi?

**① Kể lại.** Hai bạn đi bơi theo "nhịp" riêng. Hỏi lần sớm nhất hai nhịp trùng nhau.
**② Đề hỏi gì?** **Số ngày**, và phải **ít nhất**.
**③ Thử tay.**
- Lan bơi vào ngày: 6, 12, 18, **24**, 30, …
- Mai bơi vào ngày: 8, 16, **24**, 32, …
→ Ngày cùng bơi phải là **bội của 6** và **bội của 8**, tức là **bội chung**.
**④ Dịch từ khóa.** "cứ … ngày một lần" → bội. "lại cùng" → bội **chung**. "ít nhất" → **nhỏ nhất** → **BCNN**(6, 8) = 24.
**⑤ Kiểm tra hợp lý.** Đáp số phải **lớn hơn hoặc bằng** 6 và 8 (chưa qua 6 ngày thì Lan chưa bơi lần nào) ✓.

🔎 Ghi vào vở: *"cứ … một lần", "lại cùng", "trùng nhau" + "ít nhất / sớm nhất" → BCNN.*

`kiểm: lcm(6, 8) = 24; bội của 6 ∩ bội của 8 (≤ 30) = {24}`

### Cách 2 — "Xếp hàng vừa đủ, trong khoảng"

**Đề:** Số học sinh của một trường khi xếp hàng 3, hàng 4 hay hàng 5 đều vừa đủ. Biết số học sinh trong khoảng từ 100 đến 150. Tìm số học sinh.

**Mẹo đọc: dịch từng câu một.**
- "Xếp hàng 3 vừa đủ" → số học sinh **chia hết cho 3**.
- "hàng 4", "hàng 5" cũng vừa đủ → **chia hết cho 4** và **cho 5**.
→ Số học sinh là **bội chung** của 3, 4, 5. Các bội chung là bội của BCNN(3, 4, 5) = 60: 60, 120, 180, …
- "Trong khoảng 100 đến 150" → chọn **120**.

**Kiểm tra hợp lý:** 120 : 3 = 40, 120 : 4 = 30, 120 : 5 = 24, đều vừa đủ ✓. Lỗi hay gặp: dừng ở 60, **quên điều kiện khoảng**.

🔎 Ghi vào vở: *"vừa đủ, không thừa ai" → chia hết. Có "trong khoảng" → tìm BCNN rồi chọn bội nằm trong khoảng.*

`kiểm: lcm(3, 4, 5) = 60; bội của 60 trong [100, 150] = {120}`

---

## D9.1 · Lớp 9 · "Làm chung — làm riêng" (vòi nước, hai đội) → hệ phương trình

### Cách 1 — "Bảng 3 cột"

**Đề:** Hai vòi nước cùng chảy vào một bể cạn thì sau 6 giờ đầy bể. Nếu mở vòi I trong 2 giờ, rồi mở vòi II trong 3 giờ thì được 2/5 bể. Hỏi mỗi vòi chảy một mình thì sau bao lâu đầy bể?

**① Kể lại.** Hai vòi chảy nhanh chậm khác nhau. Biết lúc chảy chung, và một lần chảy "lệch giờ". Hỏi thời gian của từng vòi.
**② Đề hỏi gì?** Thời gian vòi I chảy một mình, thời gian vòi II chảy một mình → **2 ẩn**.
**③ Chọn ẩn.** Vòi I một mình đầy bể sau **x** giờ, vòi II sau **y** giờ (x > 6, y > 6, vì một vòi chảy chậm hơn hai vòi cùng chảy).
**④ Lập bảng** (coi cả bể là 1):

| | Thời gian đầy bể | 1 giờ chảy được |
|---|---|---|
| Vòi I | x giờ | 1/x bể |
| Vòi II | y giờ | 1/y bể |
| Cả hai | 6 giờ | 1/6 bể |

**Vì sao cộng được?** Trong 1 giờ, nước của vòi I và vòi II **cùng đổ vào một bể**, nên phần bể của mỗi vòi **cộng lại**: 1/x + 1/y = 1/6.
**Thời gian thì không cộng được.** Không phải x + y = 6. Hai vòi cùng chảy thì phải **nhanh hơn**, nên mất ít giờ hơn mỗi vòi.
Câu "vòi I chảy 2 giờ, vòi II chảy 3 giờ được 2/5 bể": 2 · (1/x) + 3 · (1/y) = 2/5.

**Hệ phương trình:** 1/x + 1/y = 1/6 và 2/x + 3/y = 2/5. Đặt u = 1/x, v = 1/y thì thành hệ bậc nhất quen thuộc.
Giải ra x = 10, y = 15.
**⑤ Kiểm tra hợp lý.** 10 > 6 và 15 > 6 ✓. 1/10 + 1/15 = 1/6 ✓.

🔎 Ghi vào vở: *Làm chung → coi cả công việc là 1 → **cộng phần việc mỗi giờ (năng suất)**, không cộng thời gian.*

`kiểm: solve(1/x + 1/y = 1/6, 2/x + 3/y = 2/5; x, y > 0) = (10, 15)`

### Cách 2 — "Coi công việc là một chiếc bánh"

**Đề:** Hai đội cùng làm một con đường thì 12 ngày xong. Nếu đội I làm 4 ngày, rồi đội II làm tiếp 9 ngày thì được một nửa con đường. Hỏi mỗi đội làm một mình thì bao lâu xong?

**Hình dung:** cả con đường là **một chiếc bánh**. Đội I làm một mình hết x ngày, nên **mỗi ngày "ăn" 1/x chiếc bánh**. Đội II hết y ngày, mỗi ngày ăn 1/y chiếc bánh.
- Hai đội cùng làm 12 ngày hết bánh → mỗi ngày cả hai ăn 1/12 chiếc → **1/x + 1/y = 1/12**.
- Đội I ăn 4 ngày, đội II ăn 9 ngày, được nửa chiếc → **4/x + 9/y = 1/2**.

Giải hệ (đặt u = 1/x, v = 1/y) được x = 20, y = 30.
**Kiểm tra hợp lý:** cả hai đội đều lâu hơn 12 ngày ✓. 4/20 + 9/30 = 1/5 + 3/10 = 1/2 ✓.

🔎 Dấu hiệu dạng này: "cùng làm … thì xong", "làm một mình thì bao lâu", "vòi nước", "hai đội, hai người, hai máy".

`kiểm: solve(1/x + 1/y = 1/12, 4/x + 9/y = 1/2; x, y > 0) = (20, 30)`

---

## Dạng bài chưa có thẻ

Danh sách dạng bổ sung khi gia sư báo thiếu thẻ (phụ huynh chốt 21/11):
- **Lớp 6:** phân số của một số · tỉ số, phần trăm · chu vi, diện tích thực tế · chuyển động đơn giản · tính tiền.
- **Lớp 9:** chuyển động · xuôi, ngược dòng · năng suất · số có hai chữ số · phần trăm tăng giảm · bài hình học có lời văn · hình học thực tế.
