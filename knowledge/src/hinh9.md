# Hộp công cụ chứng minh hình học · lớp 9 · v0.2
> Nguồn: hub `HOP_CONG_CU_HINH_9_v0.2.md` (bản sạch cho repo công khai; sinh bằng scripts/knowledge/sanitize.ts).

## 0. Ba bước khi "không biết bắt đầu"

1. **Đọc hình:** đánh dấu lên hình mọi giả thiết (góc vuông □, đoạn bằng nhau ‖, song song ↗↗, trung điểm). Tìm tam giác vuông, cặp tam giác có chung góc, các điểm nằm trên đường tròn.
2. **Phân tích ngược:** viết điều phải chứng minh ở dưới cùng. Hỏi: "Muốn có điều này, theo hộp công cụ có những cách nào?" → chọn cách mà **"cần có gì"** gần với giả thiết nhất → điều cần có trở thành mục tiêu mới → lặp lại đến khi chạm giả thiết hoặc kết quả câu trước.
3. **Viết xuôi:** đi ngược lại chuỗi vừa tìm, mỗi bước một dòng, có căn cứ trong ngoặc.

Câu hỏi gia sư AI dùng: *"Câu a, b đã cho em điều gì dùng được?"* · *"Muốn chứng minh [X], em biết những cách nào?"* · *"Cách nào cần thứ mà hình đã có?"*

## 1. Hộp công cụ theo điều phải chứng minh

### 1.1. Hai đoạn thẳng bằng nhau
| Cách | Cần có gì | Học ở |
|---|---|---|
| Hai tam giác bằng nhau (c.g.c, g.c.g, c.c.c, cạnh huyền – góc nhọn…) | Hai tam giác chứa hai đoạn đó | 7 |
| Tam giác cân | Hai góc ở đáy bằng nhau | 7 |
| Cùng bằng đoạn thứ ba / trung điểm chia đôi | Một đoạn trung gian | 6–7 |
| Tính chất hình bình hành, chữ nhật, thoi, vuông | Tứ giác đặc biệt | 8 |
| Trung tuyến ứng với cạnh huyền = ½ cạnh huyền | Tam giác vuông + trung điểm cạnh huyền | 8 |
| Tỉ số bằng 1 (Thales, đồng dạng) | Hai tỉ số có chung đoạn, đoạn kia bằng nhau | 8 |
| Hai tiếp tuyến cắt nhau tại một điểm → hai đoạn tiếp tuyến bằng nhau | Hai tiếp tuyến từ một điểm | 9 |
| Bán kính cùng một đường tròn | Hai đầu cùng nằm trên đường tròn, một đầu là tâm | 9 |

### 1.2. Một điểm là trung điểm
| Cách | Cần có gì | Học ở |
|---|---|---|
| **Đường trung bình:** đường qua trung điểm một cạnh, song song cạnh thứ hai thì đi qua trung điểm cạnh thứ ba | Một trung điểm đã biết + một cặp song song | 8 |
| Hai đoạn bằng nhau và ba điểm thẳng hàng | Xem 1.1 | 7 |
| Giao điểm hai đường chéo hình bình hành | Hình bình hành | 8 |
| Đường kính vuông góc với dây thì đi qua trung điểm dây | Đường tròn + vuông góc | 9 |
| Tỉ số Thales bằng 1 | Song song + một trung điểm khác | 8 |

### 1.3. Hai đường thẳng song song
| Cách | Cần có gì | Học ở |
|---|---|---|
| **Cùng vuông góc với đường thứ ba** | Hai góc vuông với cùng một đường | 7 |
| Cặp góc so le trong / đồng vị bằng nhau | Một cát tuyến + góc bằng nhau | 7 |
| Đường trung bình của tam giác / hình thang | Hai trung điểm | 8 |
| Thales đảo (tỉ số bằng nhau) | Hai tỉ số đoạn thẳng bằng nhau | 8 |
| Cạnh đối của hình bình hành | Hình bình hành | 8 |

### 1.4. Hai đường thẳng vuông góc
| Cách | Cần có gì | Học ở |
|---|---|---|
| **Trực tâm:** hai đường cao cắt nhau tại H thì đường thẳng qua H và đỉnh thứ ba vuông góc với cạnh còn lại | Hai đường vuông góc đã có trong cùng một tam giác | 7 |
| Song song với một đường vuông góc | Một cặp song song + một góc vuông | 7 |
| Tiếp tuyến vuông góc với bán kính tại tiếp điểm | Tiếp tuyến | 9 |
| Đường kính đi qua trung điểm dây (không qua tâm) thì vuông góc với dây | Trung điểm dây | 9 |
| Góc nội tiếp chắn nửa đường tròn = 90° **(HK II)** | Điểm trên đường tròn + đường kính | 9 |
| Pythagore đảo; tổng hai góc nhọn = 90° | Độ dài ba cạnh / hai góc phụ nhau | 7–8 |

### 1.5. Hai góc bằng nhau
| Cách | Cần có gì | Học ở |
|---|---|---|
| Hai tam giác bằng nhau / đồng dạng | Hai tam giác chứa hai góc | 7–8 |
| Cùng phụ hoặc cùng bù với một góc | Một góc trung gian | 6–7 |
| So le trong, đồng vị (có song song) | Song song | 7 |
| Tam giác cân | Hai cạnh bằng nhau | 7 |
| tan (hoặc sin, cos) của hai góc nhọn bằng nhau | Hai tam giác vuông, tỉ số cạnh bằng nhau | 9 |
| Góc nội tiếp cùng chắn một cung **(HK II)** | Bốn điểm trên một đường tròn | 9 |
| Tứ giác nội tiếp: góc ngoài bằng góc trong đối **(HK II)** | Tứ giác nội tiếp | 9 |

### 1.6. Ba điểm thẳng hàng
| Cách | Cần có gì | Học ở |
|---|---|---|
| Tổng hai góc kề = 180° | Các góc tại điểm giữa | 6–7 |
| Hai đường thẳng qua một điểm cùng song song (hoặc cùng vuông góc) với một đường → trùng nhau | Song song / vuông góc | 7 |
| **Hai điểm trùng nhau:** gọi điểm phụ là giao của hai đường, chứng minh nó trùng với điểm đề cho | Một tính chất xác định duy nhất điểm (vd trung điểm) | 7–9 |
| Hai góc bằng nhau ở cùng một phía (so tan, so góc) | Góc so sánh được | 9 |
| Điểm nằm trên đường đặc biệt (đường kính, trung tuyến, trung trực) | Đường đặc biệt | 7–9 |

### 1.7. Đẳng thức tích (AB·CD = EF·GH, AC² = CH·BC)
| Cách | Cần có gì | Học ở |
|---|---|---|
| **Hai tam giác đồng dạng** → tỉ số → nhân chéo | Hai tam giác có cạnh là các đoạn trong đẳng thức | 8 |
| Hệ thức lượng trong tam giác vuông | Tam giác vuông + đường cao | 9 |
| Qua đại lượng trung gian (A = M và B = M) | Hai đẳng thức đã có | 8–9 |

Mẹo chọn tam giác: viết đẳng thức thành tỉ số AC/BC = CH/AC → các đoạn **trên tử** thuộc một tam giác, **dưới mẫu** thuộc tam giác kia.

### 1.8. Tiếp tuyến
| Cách | Cần có gì | Học ở |
|---|---|---|
| Vuông góc với bán kính tại một điểm thuộc đường tròn | Điểm thuộc đường tròn + góc vuông | 9 |
| Khoảng cách từ tâm đến đường thẳng bằng bán kính | Độ dài | 9 |

### 1.9. Bốn điểm cùng thuộc một đường tròn / tứ giác nội tiếp
| Cách | Cần có gì | Học ở |
|---|---|---|
| Bốn điểm cách đều một điểm | Các đoạn bằng nhau | 9 |
| Hai đỉnh cùng nhìn một đoạn dưới góc vuông → cùng nằm trên đường tròn đường kính đó | Hai góc vuông chung cạnh huyền | 9 |
| Tổng hai góc đối bằng 180° **(HK II)** | Góc của tứ giác | 9 |
| Hai đỉnh kề cùng nhìn cạnh nối hai đỉnh còn lại dưới hai góc bằng nhau **(HK II)** | Hai góc bằng nhau | 9 |

### 1.10. Hai tam giác đồng dạng — "xương sống"

Đồng dạng vừa là **mục tiêu** (đề hỏi chứng minh hai tam giác đồng dạng) vừa là **công cụ** để có góc bằng nhau (1.5), đẳng thức tích (1.7), đoạn bằng nhau qua tỉ số (1.1).

**a) Cách chứng minh hai tam giác đồng dạng**
| Cách | Cần có gì | Học ở |
|---|---|---|
| **g.g:** hai cặp góc bằng nhau | Thường là **chung một góc** + một cặp góc bằng (hay gặp: hai góc vuông) | 8 |
| **c.g.c:** hai cặp cạnh tỉ lệ + góc **xen giữa** bằng nhau | Một đẳng thức tích đã có (vd từ câu trước) + chung góc | 8 |
| c.c.c: ba cặp cạnh tỉ lệ | Biết độ dài ba cạnh | 8 |
| Tam giác vuông: thêm **một cặp góc nhọn** bằng nhau | Hai tam giác vuông | 8 |
| Tam giác vuông: cạnh huyền và cạnh góc vuông tỉ lệ | Độ dài | 8 |
| Đường thẳng song song với một cạnh, cắt hai cạnh kia → tam giác mới đồng dạng tam giác ban đầu | Một cặp song song | 8 |

**b) Có đồng dạng rồi thì được gì**
| Suy ra | Dùng để |
|---|---|
| Các góc tương ứng bằng nhau | 1.5 hai góc bằng nhau; rồi 1.3, 1.9 |
| Tỉ số các cạnh tương ứng bằng nhau → nhân chéo | 1.7 đẳng thức tích |
| Tỉ số chu vi = k, tỉ số diện tích = k² | Bài tính |

**c) Mẫu hình hay gặp — khi đọc hình, tìm ngay**
| Thấy trên hình | Cặp đồng dạng | Học ở |
|---|---|---|
| Tam giác vuông có **đường cao** ứng với cạnh huyền | Ba tam giác vuông đồng dạng với nhau → AB² = BH·BC, AC² = CH·BC, AH² = HB·HC | 8–9 |
| Tam giác có **hai đường cao** BE, CF | ΔAEB ∽ ΔAFC (g.g, chung góc A, hai góc vuông) → AE·AC = AF·AB → ΔAEF ∽ ΔABC (c.g.c) | 8 |
| Hai tam giác **chung một góc** + một cặp góc bằng | g.g | 8 |
| Một đường **song song** với một cạnh | Tam giác nhỏ ∽ tam giác lớn | 8 |
| Hai cát tuyến / tiếp tuyến từ một điểm ngoài đường tròn **(HK II)** | MA·MB = MC·MD, MT² = MA·MB | 9 |

**d) Viết cho đúng — lỗi hay mất điểm**
- **Thứ tự đỉnh phải tương ứng:** ΔAEB ∽ ΔAFC nghĩa là A↔A, E↔F, B↔C. Mẹo: đánh dấu các góc bằng nhau cùng ký hiệu, rồi viết đỉnh theo đúng ký hiệu đó.
- c.g.c: góc phải **xen giữa** hai cặp cạnh tỉ lệ.
- Lập tỉ số: lấy các cạnh **tương ứng** theo thứ tự đỉnh đã viết (AE/AF = AB/AC = EB/FC).
- Mỗi bước ghi căn cứ: (g.g), (c.g.c), (chung góc A), (cùng bằng 90°).

## 2. Phân tích ngược

### 2.3. Ví dụ đồng dạng (soạn mới, không phải đề của trường)
Đề: Tam giác nhọn ABC, các đường cao BE, CF. a) Chứng minh AE·AC = AF·AB. b) Chứng minh góc AEF = góc ABC.

```text
MỤC TIÊU a): AE·AC = AF·AB
  ↑ hộp 1.7: viết thành tỉ số AE/AF = AB/AC → tử AE, AB thuộc ΔAEB; mẫu AF, AC thuộc ΔAFC
MỤC TIÊU MỚI: ΔAEB ∽ ΔAFC
  ↑ hộp 1.10a g.g: chung góc A ✔; góc AEB = góc AFC = 90° (đường cao ✔) → CHẠM GIẢ THIẾT

MỤC TIÊU b): góc AEF = góc ABC
  ↑ hộp 1.5: cần ΔAEF ∽ ΔABC
  ↑ hộp 1.10a c.g.c: chung góc A ✔; cần AE/AB = AF/AC
  ↑ biến đổi từ kết quả câu a (AE·AC = AF·AB) ✔ — "dùng câu trước"
```
(Đã kiểm bằng toạ độ với SymPy, 14/11/2026.)

**Gia sư AI dùng như sau:**
- H1: "Muốn chứng minh đẳng thức tích, em biết cách nào?" → nút: *Tam giác đồng dạng · Hệ thức lượng · Qua đại lượng trung gian*
- H2: "Viết đẳng thức thành tỉ số. Các đoạn trên tử nằm trong tam giác nào?"
- H3: "Hai tam giác đó có góc nào chung? Còn cặp góc nào bằng nhau?"
- H4: bài anh em cùng mẫu "hai đường cao" trên tam giác khác.
- Ý b: hỏi "Câu a cho em đẳng thức gì? Viết lại thành tỉ số thử."
