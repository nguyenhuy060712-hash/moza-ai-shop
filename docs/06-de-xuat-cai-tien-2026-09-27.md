# Đề xuất cải tiến Moza AI Shop

*27/9/2026. Chỉ đọc mã và suy nghĩ, chưa sửa gì. Có 41 đề xuất, mỗi cái được chấm qua 4 góc nhìn: kỹ thuật, pháp lý và niềm tin, giá trị bán hàng, công nghệ mới nhất. Số cạnh tên là điểm trung bình trên thang 5. P42, P43, P44 do các góc nhìn nêu thêm nên chưa được chấm. Ví dụ tiền dùng cài đặt thật (ship 10.000đ, miễn ship từ 200.000đ), còn giá áo 159.000đ là giá ví dụ. MOZA chưa live thật buổi nào (chỉ có 4 buổi diễn tập). Vì vậy mọi chỗ nói "rơi đơn" dưới đây là suy ra từ đọc mã, chưa đo.*

## 1. Tóm tắt

Phần khó nhất MOZA đã làm xong: AI dẫn live bằng giọng, Bộ kiểm tra chặn số bịa, giữ hàng không bán quá số có.

Theo đọc mã, đơn dự kiến rơi nhiều nhất ở **khoảng từ lúc khách gõ "chốt" tới lúc khách bấm Xác nhận**:
- Tin nhắn riêng đầu tiên do AI viết nên chậm.
- Người chốt không thấy tin thì không ai nhắc.
- Đơn đủ thông tin mà khách quên bấm thì tự hủy, không báo ai.

Vá khoảng này tốn ít, và dự kiến ra đơn nhanh hơn mọi tính năng hào nhoáng. Để thu hút khách, nên dồn sức vào kiểu **người thật mặc thử, còn Mai lo giá, size và gọi tên khách**. Không nên bỏ tiền vào người mẫu hay video do AI tạo.

Các đề xuất về tin nhắn dựa trên một điều Meta chưa ghi rõ: có nhắn riêng được người bình luận **trong live** không, và tin rơi vào hộp nào. Khả năng được là cao, vì Harasocial, Sapo, Pancake đang làm việc này. Dù vậy vẫn cần một buổi thử trên Facebook thật (Bước 0). Trong lúc chờ, làm song song được các việc không phụ thuộc Facebook thật: P06, P11, P14, P35.

**5 việc đáng làm nhất:**
1. **Bước 0: buổi thử Facebook thật** (gần như không tốn tiền AI), để biết nên đi đường nào.
2. **P22:** tin nhắn riêng đầu tiên thành thẻ có ảnh và nút, MOZA tự soạn trong 1–2 giây.
3. **P06 + P24a:** nhắc khách chưa xác nhận đơn (tối đa 2 lần), báo khách khi đơn bị hủy, giữ hàng hai mức thời gian.
4. **P01 + P42:** nhắc người chốt mở mục Tin nhắn chờ, nhận bình luận "ib"; không để công tắc chi phí tắt luôn phần chốt đơn giữa live.
5. **P13 + P11:** tư vấn size gọi đúng tên người hỏi; thẻ nhắc người dẫn khi khách xin "xoay lưng", "soi vải".

**Phải xong trước khi live với khách thật.** Thiếu một việc là không bán được hoặc vướng luật; chi tiết ở mục 8 và 9.
- Page bán hàng đủ điều kiện phát live.
- Ứng dụng Meta riêng đã qua xét duyệt, doanh nghiệp đã xác minh. Chưa duyệt thì MOZA không nhắn được khách thật nào.
- Người livestream đã xác thực danh tính (Luật TMĐT 122/2025).
- Nhãn "Trợ lý AI" trên hình (P35), và giá gạch chỉ hiện khi có bằng chứng (P34a).
- Khóa AI riêng của shop đã bật trả tiền, và có trang chính sách quyền riêng tư.
- Luật sư đã trả lời về chuyện đưa dữ liệu khách ra nước ngoài và bán hàng từ xa.

## 2. Hiện trạng

**Đang mạnh ở:**
- Bộ kiểm tra K1–K10: giá, tồn, ship, tổng tiền đều lấy từ dữ liệu MOZA. Giữ hàng chạy trọn một lượt nên không bán quá số có.
- Có ba chế độ trên sóng và chế độ Radio. Director (AI điều phối) đọc bình luận. Màn hình sản phẩm do Mai điều khiển.
- Chốt đơn từ bình luận đã chạy trong diễn tập: đọc cú pháp chốt, đọc tên, nhắn riêng, thẻ đơn có nút Xác nhận / Sửa, tin báo "đơn đã gửi".
- Chạy trên một laptop. Có Phòng diễn tập và Facebook giả để tập mà không tốn tiền.
- Lợi thế riêng: trong các nguồn đã đọc, Pancake, Harasocial, Sapo chỉ có AI trả lời bằng chữ. Chưa thấy phần mềm Việt nào có AI dẫn live bằng giọng.

**Chỗ dự kiến rơi khách, rơi đơn** (đối chiếu với mã, chưa đo):
- Người chốt không thấy tin nhắn riêng thì không ai nhắc. Câu nhắc cách chốt đã viết nhưng chỉ chạy trong bài kiểm tra. Theo Vpage, khách chờ 3–7 phút không ai trả lời là bỏ đi.
- Tin nhắn riêng đầu tiên là cơ hội duy nhất với người chốt, nhưng lại do AI viết: chậm, tốn tiền, có thể bị Bộ kiểm tra chặn.
- Đơn đủ thông tin mà khách quên bấm Xác nhận thì tự hủy khi hết giờ giữ, không báo khách.
- Câu hỏi "12 đen M còn ko" không được mời giữ hàng. Bình luận chốt trên video xem lại bị bỏ hẳn.
- Hàng được giữ 24 giờ cho cả người không bao giờ trả lời.
- Vượt trần chi phí thì "Dừng mọi tự động" tự bật và không tự tắt. Nhắn riêng dừng giữa live mà người dẫn không hay.
- Màn hình sản phẩm hiện giá gạch bất cứ khi nào giá gốc cao hơn giá bán, không cần bằng chứng từng bán ở giá đó. Đây là rủi ro pháp lý đang có.
- Trước live không có gì hướng ra khách. Sau khi gửi hàng không còn lần nào hỏi thăm.

## 3. Tầng 1: làm ngay, nhỏ, rẻ, lợi lớn

**Bước 0: buổi thử Facebook thật, làm trước khi viết mã nhóm chốt đơn.** Mất khoảng một buổi, gần như không tốn tiền AI. Cần hai điều kiện để làm được:
- Cần một Page **phát live được**: từ 100 người theo dõi, tài khoản dùng từ 60 ngày. Page mới lập không live được. Thực tế là thử trên Page bán hàng khi đã đủ điều kiện, hoặc trên một Page sẵn có đủ điều kiện.
- Ứng dụng Meta chưa duyệt chỉ nhắn được người có vai trò trong ứng dụng. Vì vậy tài khoản cá nhân chưa từng nhắn Page phải được thêm làm "người thử". Kết quả với người thử (nhất là chuyện tin rơi vào Tin nhắn chờ) có thể khác với khách lạ. Phải kiểm lại ở buổi live thật đầu tiên sau khi được duyệt.

Buổi thử trả lời 8 câu **chưa kiểm chứng**:
1. Có nhắn riêng được người bình luận trong live không?
2. Tin rơi vào hộp chính hay mục Tin nhắn chờ?
3. Thẻ có ảnh và nút có gửi được không, và khách bấm nút thì MOZA có nhận được không? Ảnh được lấy từ laptop qua Quick Tunnel (đường nối tạm để Facebook gửi tin về laptop, đổi địa chỉ mỗi lần mở máy), nên có thể mất khi tắt máy. Thử luôn cách tải ảnh lên Facebook trước để có địa chỉ cố định.
4. Có gửi được tin thứ hai trước khi khách trả lời không? Hai trang tài liệu của Meta nói ngược nhau.
5. Facebook có thể gọi một buổi live bằng hai số hiệu: số "buổi live" và số "video". Nếu MOZA so nhầm, một bình luận có thể bị cả phòng live lẫn Hộp thư xử lý, và khách bị nhắn trùng.
6. Bình luận để lại lúc xem lại video có kèm mốc giây không?
7. Số người xem đọc ra được gì?
8. Tin báo đơn (Utility, tức tin báo trạng thái gửi được ngoài 24 giờ) có gửi được không? Danh sách quyền MOZA xin hiện còn thiếu quyền này.

Làm kèm một lượt thử dồn tải trong Phòng diễn tập: 30–50 người chốt trong 1 phút, thẻ phải ra trong vài giây. Nếu không nhắn riêng được người bình luận trong live, đường chính đổi sang link mở Messenger và bình luận công khai (phần 4 của P01).

**Các việc nền làm kèm** (thiếu thì các đề xuất dưới đây dẫm chân nhau):
- **Đánh dấu lượt nhắn riêng:** ghi "bình luận này đã dùng lượt nhắn riêng" trước khi AI điều phối xử lý, để khách không bị nhắn trùng hay bị bỏ sót.
- **Một bộ đọc nút dùng chung,** để mọi nút bấm chạy giống nhau, dễ bàn giao.
- **Một Hook giới hạn liên hệ** (Hook là luật tự động chạy trước mỗi lần gửi), để khách không thấy phiền và Page không bị báo spam:
  - mỗi đơn tối đa 1 lần gọi tên kiểu nhắc trên sóng và 2 tin nhắc;
  - tin mời chào tối đa 1 tin mỗi ngày, trong khung 7h–22h;
  - khách nói "thôi", "dừng" là ngừng hẳn;
  - Page bị hạn chế nhắn tin thì dừng mọi tin nhắc.
- **Trần số câu chen của Đội AI mỗi buổi.** Mỗi câu tốn 1 lượt giọng Google. Mỗi máy đọc được 100 lượt/ngày và 8 lượt/phút. MOZA có 2 máy 3.8 và 1 máy dự phòng 3.1; máy dự phòng dùng giọng có sẵn, không phải giọng Mai. Hạn mức này đang dùng chung với bản tuyển dụng.
- **Lưu giờ bắt đầu live do Facebook trả về.** Hiện MOZA ghi giờ nó phát hiện ra live, lệch 10–30 giây. Cần giờ đúng để biết phút nào trong video đang bán món nào.
- **Thêm quyền gửi tin báo đơn** vào danh sách xin quyền. Thiếu quyền này thì tin "đơn đã gửi" (#89, thẻ đơn có nút Xác nhận / Sửa) có thể hỏng khi nối Page thật.
- **Cập nhật bảng giá model:** ghi mốc giá gấp đôi từ 1/1/2027 của Gemini 3.8 Live (bản giọng nói trực tiếp của Google) và thêm giá phần hình, để mức trần chi phí không tính thiếu.

**P22: Tin nhắn riêng đầu tiên thành thẻ giữ hàng có ảnh và nút** · 5,0 · vừa · gần 0, còn bớt 1 lượt AI cho mỗi người chốt
- **Khách thấy:** 2 giây sau khi gõ "chốt 12 đen M", Messenger hiện ảnh đúng màu, dòng "Áo 12 Đen/M · 159.000đ · giữ tới 21:15", ba nút [Giữ, lên đơn] [Đổi] [Không lấy], và dòng nhỏ "Tin tự động từ trợ lý AI của shop".
- **Vì sao:** mỗi bình luận chỉ được nhắn riêng 1 tin. Khách chưa bấm thì không gửi thêm được gì, nên mọi thứ phải gọn trong một thẻ. Khách chưa ghi màu thì gửi lưới 2–6 ảnh để chạm chọn. UPOS và Harasocial đã làm kiểu này.
- **Cách làm:** gửi qua đường có Hook kiểm. Phải giữ câu tự nhận là AI (Luật AI Điều 11). Câu này hiện do Tư vấn viên viết, chuyển sang mã soạn thì dễ mất. Nếu không nhắn riêng được thì lùi về bình luận gom tên công khai.
- **Rủi ro về ảnh:** thẻ có ảnh cần địa chỉ ảnh công khai, mà địa chỉ Quick Tunnel chết khi tắt máy hoặc mở lại máy. Đường lùi: thẻ chữ có nút, không có ảnh. Hoặc tải ảnh lên Facebook, nếu Bước 0 cho thấy cách này dùng được.
- **Cần quyết:** đổi Luồng 3 (cách chốt đơn từ bình luận) trong SPEC.

**P06: Nhắc đơn chưa xác nhận, báo khách khi đơn tự hủy** · 4,8 · vừa · gần 0
- **Khách thấy:** chị Mai Anh gửi địa chỉ rồi đi nấu cơm. 20 phút sau chị nhận "Đơn DH-0042 · 169.000đ đang chờ chị xác nhận, shop giữ tới 21:15" kèm [Xác nhận] [Sửa] [Không lấy].
- **Vì sao:** hiện chỉ đơn còn thiếu thông tin mới được nhắc. Dự kiến đây là chỗ mất đơn lớn mà MOZA tự sửa được hoàn toàn, thử được ngay bằng Facebook giả.
- **Cách làm:**
  - Mỗi đơn tối đa 3 tin: 2 lần nhắc và 1 tin báo hủy. Tin do mã soạn, không gửi trong khung 22h–7h.
  - Lần nhắc gần hạn giữ dễ rơi ra ngoài 24 giờ. Nên thử cho Meta duyệt mẫu Utility "đơn đang chờ chị xác nhận" có nút (Meta duyệt trong vài giây). Nếu Meta xếp mẫu này vào loại tiếp thị thì bỏ lần nhắc đó.
  - Nút [Đặt lại] chỉ có trong 24 giờ. Quá 24 giờ thì tin báo hủy chỉ có thông tin.
  - Đơn đã đủ số điện thoại và địa chỉ mà hết giờ giữ thì không tự hủy, mà chuyển vào danh sách "Gọi xác nhận" để người quyết.
  - Sửa lỗi đang có: việc "Gọi khách" được tạo cả khi đơn chưa có số điện thoại. Đơn không có số và đã ngoài 24 giờ thì chỉ ghi "chưa liên lạc được".
- **Cần quyết:** đổi F-32 (luật nhắc đơn) từ "nhắc một lần" thành "tối đa 2 lần".

**P24a: Giờ giữ hàng hai mức** (phần đầu của P24, 3,5) · nhỏ · 0
- **Khách thấy:** thẻ ghi rõ "chưa bấm Giữ thì shop giữ tới hết buổi + N giờ". Ai đã bấm nút hoặc gửi địa chỉ thì vẫn được giữ đủ giờ như cũ.
- **Vì sao:** giữ mặc định 24 giờ làm hàng đang chạy bị treo cho người không trả lời. Ô giờ giữ đã có trong Cài đặt, chỉ cần thêm mức ngắn và tự kéo dài khi khách bấm.
- **Cần quyết:** đổi #64 (luật giữ hàng 24 giờ) và chọn số N. Nên làm sau P01, vì khách "im lặng" nhiều khi chỉ do tin nằm trong Tin nhắn chờ.

**P01: Nhắc người chốt mở tin, nhận bình luận "ib"** · 4,8 · phần 1–3 nhỏ, phần 4 vừa · gần 0 (riêng Đội AI tốn lượt giọng)
- **Khách thấy:** chị Hoa chốt xong thì nghe "Hoa, Trâm vừa chốt, shop đã nhắn riêng, mở mục Tin nhắn chờ giúp shop". Chị chưa thấy tin thì gõ "ib" là nhận lại.
- **Vì sao:** SPEC hứa "Mai nhắc mở tin nhắn chờ" nhưng mã chạy thật chưa làm. Shop thật làm việc này hằng ngày.
- **Cách làm:**
  - Câu nhắc trung tính, không bao giờ nói "chưa trả lời" hay "chưa mở". Mỗi lượt đọc tối đa 3 tên, mỗi người chỉ bị gọi tên kiểu nhắc 1 lần. Ai gõ "ẩn tên" thì cả buổi không đọc tên người đó.
  - Nhắc cách chốt theo tình huống: có người mới vào, hoặc hỏi nhiều mà ít chốt.
  - Bắt các câu "ib", "check ib", "inbox" trước khi Director xử lý. Người chưa có đơn mà gõ "ib" hay "giá sao" thì được nhắn 1 thẻ món đang nói.
  - "ib" chỉ là lưới phụ: nếu tin đầu vào Tin nhắn chờ thì tin sau cũng vào đó.
  - Phần 4 (link mở Messenger có gắn mã buổi live) để sau Bước 0. Người mới phải bấm nút "Bắt đầu", vài máy Android làm mất mã, và vẫn phải hỏi lại khách bằng nút [Đúng] [Không phải].

**P42: Công tắc chi phí không được tắt phần chốt đơn** (góc bán hàng nêu thêm, chưa chấm) · nhỏ · 0
- **Khách thấy:** chi phí AI chạm trần giữa live, người chốt vẫn nhận thẻ giữ hàng như thường. Người dẫn thấy dải vàng cảnh báo từ lúc chạm 80% trần.
- **Vì sao:**
  - Vượt trần thì "Dừng mọi tự động" chặn cả việc nhắn riêng.
  - Có hai mức trần mặc định: 8 USD/giờ và 15 USD/ngày. Miệng mặc định GPT Live 1 tốn khoảng 3 USD/giờ, nên một ngày live 3–4 tiếng cộng buổi tập dễ chạm trần ngày.
  - Thẻ giữ hàng, việc giữ hàng và bình luận gom tên công khai chạy bằng mã, không tốn tiền AI.
  - Đọc tên trên sóng thì có tốn: chế độ Đội AI tốn lượt giọng Google, chế độ Mai dẫn tính tiền theo phút.
- **Cần quyết:** tách hai mức. "Dừng AI" tự bật khi vượt trần: dừng giọng và đọc tên, thẻ vẫn chạy. "Dừng mọi thứ" chỉ bật khi người bấm nút đỏ. Đồng thời chọn mức trần ngày cho ngày có live.

**P34a: Giá gạch chỉ hiện khi có bằng chứng** (phần đầu của P34, 3,3) · nhỏ · 0
- **Khách thấy:** giá gạch chỉ hiện khi shop từng có đơn giao thật ở giá đó gần đây. Không có thì chỉ hiện giá bán.
- **Vì sao:** đây là rủi ro đang có (Luật TMĐT Điều 24), dù chọn cách nào ở mục 6.1. Shop mới chưa có lịch sử bán thì sẽ chưa hiện giá gạch.
- **Cần quyết:** tạm tắt giá gạch ngay, hay làm luôn phần kiểm bằng chứng.

**P07: Bảng "Sẵn sàng lên sóng"** · 4,5 · nhỏ · 0
- **Khách thấy:** bình luận ghim "Chốt: số + màu + size, ví dụ chốt 12 đen M. Trợ lý AI của shop nhắn riêng, xem cả Tin nhắn chờ. Shop chỉ nhận tiền vào TK tên … qua Messenger của Page". Không bình luận chốt nào bị ẩn.
- **Vì sao:** chế độ Thảo luận của Facebook chỉ hiện bình luận dài từ 100 ký tự, lỡ bật là mất hết câu chốt. Phần mềm không tự ghim được bình luận, nên MOZA soạn câu, người dán vào Live Producer (trang tạo live của Facebook).
- **Cách làm:**
  - Chỉ hiện dòng đỏ, vàng khi máy tự kiểm thấy lỗi: tự động đang tắt, quyền Facebook hết hạn hoặc thiếu, ứng dụng chưa được duyệt, Page bị hạn chế, phí ship trống, món trong phiên hết hàng hoặc thiếu ảnh.
  - Thay các ô tự tích bằng một phép thử thật: đầu buổi dùng tài khoản cá nhân bình luận "chốt test", MOZA báo "đã nhận".
  - Chỉ giữ vài ô người tự tích: đã tắt chế độ Thảo luận, đã tắt "Bình luận → tin nhắn" và Business AI, đã dán câu ghim.
  - Không khóa nút Bắt đầu.

**P11: Thẻ nhắc khi khách xin "xoay lưng, soi vải, mặc màu khác"** · 4,5 · nhỏ · 0
- **Khách thấy:** chị Hằng gõ "quay lưng cho xem với", người mẫu xoay ngay, Đội AI nói "Hằng muốn xem mặt sau nè".
- **Vì sao:** đây là loại bình luận rất hay gặp trong live quần áo, người dẫn một mình hay bỏ sót. Theo Q&Me 2026, 53% khách thích xem trình diễn thật hơn xem ảnh.
- **Cách làm:**
  - Nhận bằng từ khóa như "soi vải", "zoom", "đứng xa", "lên form", không gọi AI.
  - Gom yêu cầu trong 60 giây. Mỗi lúc chỉ 1 thẻ chữ to, tự tắt sau 60 giây.
  - Khách xin màu khác hay xem cận vải thì chỉ chiếu ảnh, video **quay thật**. 14 video trong máy hiện chỉ là ảnh chuyển động chậm do Claude dựng thử. Chiếu chúng như video quay thật là gây nhầm lẫn về chất lượng.

**P02: Khách hỏi có ý mua thì mời giữ hàng một chạm** · 4,0 · nhỏ nếu làm sau P22 · 0
- **Khách thấy:** anh Tuấn hỏi "12 đen M còn ko shop". Mai trả lời trên sóng như cũ, còn Messenger của anh hiện thẻ ảnh "Áo 12 Đen/M · 159.000đ · còn 4" kèm [Giữ cho mình] [Xem màu khác].
- **Vì sao:** đây là tín hiệu muốn mua rõ nhất. Theo Q&Me 2026, 47% khách đã nhắm món trước khi vào live.
- **Cách làm:**
  - Phần đọc chốt hiện gạt câu hỏi ra trước khi tìm món. Phải tách phần tìm số, màu, size thành phần dùng chung, rồi chạy lại 105 câu kiểm tra.
  - Chỉ gửi khi câu ghi đủ màu và size. Mỗi người 1 thẻ cho mỗi món trong một buổi. Không gửi nếu vừa nhắn người đó vài phút trước.
  - Không tự giữ hàng khi khách chưa bấm.

**P35: Nhãn "Trợ lý AI" và tên người phụ trách trên hình** · 3,3 nhưng **bắt buộc** · nhỏ · 0
- **Khách thấy:** góc hình luôn có "Trợ lý AI · Phụ trách: chị Lan". MOZA soạn sẵn câu "Có sử dụng trợ lý AI" để chủ shop chép vào mô tả buổi live, vì MOZA không có quyền đăng hay sửa bài.
- **Vì sao:** Luật AI 134/2025 Điều 11 yêu cầu khách biết mình đang nói với AI. Thanh chữ và Màn hình sản phẩm hiện chưa có nhãn nào.
- **Cách làm:** nhãn nhỏ ở góc, không có nút tắt, hiện ở mọi cảnh khi giọng AI đang nói. Thêm lựa chọn cách xưng hô, chọn từ danh sách. Nhờ luật sư xem câu chữ của nhãn.

**P43: Chống kẻ gian giả làm shop** (góc pháp lý nêu thêm, chưa chấm) · nhỏ · 0
- **Khách thấy:** bình luận có số tài khoản hay đường link của người không phải Page bị ẩn ngay. Câu ghim và thẻ đơn ghi "Shop chỉ nhận tiền vào TK tên … và chỉ gửi mã QR trong Messenger của Page".
- **Vì sao:** giả làm shop để xin chuyển khoản là kiểu lừa hay gặp trong live. MOZA đã ẩn được bình luận có số điện thoại (#19), mở rộng thêm là việc nhỏ.

**P14 bước 1: Số người chốt thật do máy đếm** · 3,8 · nhỏ · 0
- **Khách thấy:** Thanh chữ hiện "Áo 12 · 14 người chốt tối nay", cuối buổi chạy dòng cảm ơn tên những người đã chốt.
- **Cách làm:**
  - Đếm số người khác nhau, không tính buổi tập, chỉ hiện khi từ 5 người trở lên.
  - Nói "người chốt", không nói "đã bán". Bỏ tên người xin ẩn.
  - Sửa số 5 đang viết cứng trên Màn hình sản phẩm cho khớp ngưỡng "sắp hết" trong Cài đặt (mặc định là 3).
  - Bước 2 (hiện "X/Y khách nói vừa") để sau P27, và chỉ hiện khi có từ 10 phản hồi.

**P31: Điền nốt thông tin shop bằng lời** · 3,5 · nhỏ · khoảng 0,02 USD
- Thêm 2 công cụ vào "Nói với Mai", không làm màn hỏi mới. Dữ liệu đã có phí ship 10.000đ, miễn ship từ 200.000đ và 6 mục Sổ tay.
- Trang Tổng quan kiểm 8 mục và chỉ liệt kê mục còn trống. 8 mục gồm: phí ship, mức miễn ship, giờ giữ, chính sách đổi size, tài khoản nhận tiền, giờ nghe máy, cách xưng hô, thông tin người bán.
- Con số luôn hiện ra để soát lại. Có lợi nhất lúc bàn giao cho một shop mới.

**P04: Nhận đúng lỗi "Page bị Meta tạm khóa nhắn tin"** · 3,3 · nhỏ · 0
- **Khách thấy:** Page bị khóa gửi tin giữa live. Bình luận công khai báo "shop giữ hàng cho mọi người rồi, Messenger đang trục trặc, shop nhắn ngay khi mở lại", thay vì mời khách "nhắn cho Page".
- **Cách làm:**
  - MOZA hiện báo nhầm lỗi này (mã 10/1893063 trong trang mã lỗi của Meta) thành "Thiếu quyền". Phải báo đỏ đúng lỗi và tự dừng mọi tin nhắc.
  - Không tự gia hạn giữ hàng 48 giờ. Đơn hỏng vì lỗi này vào danh sách "nhắn bù khi mở lại" để người quyết. Nhắn bù rải dần, trong hạn 7 ngày tính từ lúc khách bình luận.
  - MOZA tự hỏi Page Integrity (mục Meta báo Page có bị hạn chế không) lúc mở phiên và mỗi giờ.

**P05 bản nhỏ: Trả lời khách sau 24 giờ** · 2,8 · nhỏ · 0
- Hộp thư hiện "Quá 24 giờ, trả lời bằng Meta Business Suite trên điện thoại" kèm nút mở đúng cuộc trò chuyện. Cần kiểm Business Suite có cho trả lời tới 7 ngày không.
- Cách trả lời ngay trong MOZA (thẻ HUMAN_AGENT, cho người thật trả lời tới 7 ngày) để sau. Gần như chắc phải qua xét duyệt và xác minh doanh nghiệp (nguồn là bên thứ ba, Meta không ghi rõ).

## 4. Tầng 2: nâng cấp chính

**P13: Tư vấn size gọi đúng tên người hỏi** · 4,5 (tác động bán hàng 5) · vừa · 0
- **Khách thấy:** chị Lan hỏi "1m58 50kg mặc áo 12 size gì". Màn hình sáng dòng M, Mai nói "Chị Lan theo bảng size của shop lấy M, bạn mẫu 1m60 đang mặc S". Góc hình luôn có dòng "Mẫu: 1m60 · mặc S".
- **Vì sao:** đây là câu hỏi hàng đầu của live quần áo. Lệch size là một trong hai lý do hoàn hàng hay gặp của đồ nữ (cùng với "khác ảnh"). Làm tốt thì tăng cả số đơn giao thành công.
- **Cách làm:**
  - Phần dò bảng size phải trả mọi dòng khớp (hiện chỉ lấy dòng đầu). Số đo nằm giữa hai size thì nói cả hai, kèm độ ôm.
  - Số đo người mẫu nhập bằng lời ("Mai ơi mẫu cao 1m60 mặc S"), không thêm ô. Thêm nguồn "người mẫu" để Bộ kiểm tra cho phép nói số này.
  - Không đọc lại số đo của khách trên sóng.
  - Người mẫu ký giấy đồng ý, được quyền bỏ phần cân nặng.

**P03: Nhận bình luận chốt trên video xem lại, tới 7 ngày** · 4,0 · nhỏ đến vừa · như một đơn thường
- **Khách thấy:** 23 giờ chị Thảo xem lại, gõ "chốt 7 trắng L". Sáng hôm sau MOZA mở máy và nhắn chị thẻ giữ hàng ghi "giá hiện tại".
- **Vì sao:** hiện bình luận kiểu này bị bỏ hẳn. Facebook giữ video 30 ngày và cho nhắn riêng trong 7 ngày. Harasocial cho chốt sau live tới 6 ngày.
- **Cách làm:**
  - Lúc khách xem lại thì laptop thường đã tắt. Vì vậy MOZA tự hỏi Facebook bình luận của các buổi live trong 7 ngày qua, lúc khởi động và 10 phút một lần.
  - Bản đầu chỉ nhận bình luận có ghi số món. Không có số thì hỏi lại khách bằng thẻ.
  - Người xem lại không được hưởng giá live đã hết.
  - Kèm một bình luận "mục lục" đăng sau live: từng món, phút xuất hiện trong video, cú pháp chốt.

**P09 bước 1: Lịch live cố định, bài báo trước do AI soạn** · 4,0 (tác động 5) · nhỏ đến vừa · khoảng 0,01 USD mỗi bộ bài
- **Khách thấy:** thứ Ba chị Hoa thấy bài "Tối thứ Năm 20h live 12 mẫu linen mới", ảnh ghép 4 món, và nút "Nhắc tôi" của Sự kiện live.
- **Vì sao:** theo Whatnot 2026, người live 3–4 buổi mỗi tuần thu gấp 40–70 lần người live mỗi tháng một buổi. Theo Q&Me, 44% khách chốt vì "gặp đúng lúc đang live".
- **Cách làm:**
  - Chọn lịch từ danh sách.
  - AI soạn mô tả sự kiện, bài nhá hàng và câu cho Reels, có qua Bộ kiểm tra, không dùng ô "AI đoán" chưa được người xác nhận. Có nút Chép, chủ shop tự đăng.
  - Thêm nút "Chép lời mời + link live" để dán vào nhóm Zalo khách quen.
  - Nhắc hai lựa chọn tốn tiền quảng cáo, chủ shop tự quyết: bật quảng cáo live trong 10–15 phút đầu; hoặc chạy quảng cáo bấm để nhắn Messenger "Nhắn GIỮ CHỖ" trong ngày live (xem 6.3).
  - Bỏ bước 2 (xem 6.5).

**P12: Gỡ lưỡng lự bằng bằng chứng thật** · 4,0 · nhỏ đến vừa · dưới 0,01 USD mỗi giờ
- **Khách thấy:** vài người gõ "sợ không vừa", "vải mỏng không". Mai nói "shop cho đổi size trong 3 ngày nếu chưa giặt", màn hình chiếu bảng size rồi chiếu video cận vải quay thật.
- **Vì sao:** câu lưỡng lự không phải câu hỏi, nên hiện chỉ đến tay người dẫn và không bao giờ tới miệng Mai.
- **Cách làm:**
  - Director đánh dấu thêm loại "lưỡng lự". Có từ 2 người cùng kiểu thì giao cho Co-host (AI phụ trả lời) dùng một Skill mới "gỡ lưỡng lự" (Skill là bộ hướng dẫn nghề cho AI).
  - Mỗi kiểu lưỡng lự gắn với một nguồn thật. Không có nguồn thì im.
  - Cấm tự giảm giá, cấm so với shop khác. Được nói cả nhược điểm có thật của món.
  - Dùng chung kiểu thẻ với P11, và cũng chỉ chiếu video quay thật.
  - Muốn đưa thẳng vào miệng Mai thì phải kiểm trước: cách đưa thêm thông tin mà không cắt lời (#81) có chạy với miệng mặc định GPT Live 1 không.

**P19: Messenger một chạm** · 4,0 · vừa · gần 0
- **Khách thấy:** chạm một nút là điền xong số điện thoại, do Messenger lấy sẵn từ hồ sơ. Khách cũ chạm [Như đơn trước]. Ai ngại gõ thì bấm [Gọi shop].
- **Cách làm:**
  - Nút trả lời nhanh chỉ dùng được trong 24 giờ.
  - "Gọi shop" là nút gọi số điện thoại thường nằm trong thẻ, vì menu cố định của Messenger không nhận nút gọi.
  - Menu gồm: Đơn của tôi, Gặp người thật, Xóa dữ liệu của tôi.
  - Số điện thoại khách lỡ ghi trong bình luận chỉ thành nút gợi ý cho đúng đơn đó, xóa khi đơn xong.

**P23: "Thêm X nữa là miễn ship", gộp đơn giữa hai buổi** · 4,0 · vừa · 0
- **Khách thấy:** thẻ đơn áo 159.000đ ghi "Thêm 41.000đ nữa là miễn ship", kèm 1 món phối còn hàng và nút [Thêm vào đơn]. Chốt thêm ở buổi sau thì được hỏi [Gộp] [Tách].
- **Cách làm:**
  - Dòng này chỉ nằm ở thẻ đơn khi đã đủ thông tin. Chỉ gợi ý 1 lần, trong 24 giờ. Số tiền còn thiếu do mã tính.
  - Gộp vào đơn đã xác nhận thì đưa đơn về trạng thái chờ xác nhận và gửi thẻ mới.
  - Mức miễn ship ghi công khai trong Sổ tay và phần giới thiệu Page.

**P21 bước 1: Mã QR chuyển khoản ghi sẵn đúng số tiền, đúng mã đơn** · 4,3 · nhỏ · 0đ
- **Khách thấy:** thẻ đơn có hai nút [Nhận hàng trả tiền] [Chuyển khoản]. Chọn chuyển khoản thì nhận ảnh QR ghi sẵn 169.000đ, nội dung DH0042.
- **Cách làm:**
  - Không ép mọi khách chuyển khoản.
  - Thêm 3 ô: ngân hàng (chọn từ danh sách), số tài khoản, tên chủ tài khoản.
  - Dịch vụ tạo ảnh VietQR không cam kết luôn chạy, nên phải có đường lùi về tin chữ.
  - Người vẫn tự bấm "Đã nhận tiền". MOZA chỉ gửi đi số tài khoản của shop, số tiền và mã đơn, không có dữ liệu của khách.
- **Trước khi gửi QR cho khách thật** (đụng tới tiền):
  - Viết chính sách hoàn tiền khi khách đã chuyển mà shop hết hàng hoặc hủy đơn.
  - Khai tài khoản nhận tiền bán hàng với cơ quan thuế (NĐ 68/2026, mẫu 01/BK-STK). Nhờ kế toán xem.

**P27: Hỏi thăm sau khi khách nhận hàng** · 3,8 · nhỏ đến vừa · 0
- **Khách thấy:** 4 ngày sau khi shop gửi hàng, chị Lan nhận "Mặc thấy sao chị?" kèm [Vừa lắm] [Hơi chật] [Hơi rộng].
- **Cách làm:**
  - Dùng mẫu tin báo có nút (thử cho Meta duyệt trước). Không dựa vào mẫu khảo sát của Meta vì còn "đang phát triển".
  - Khách bấm "Hơi chật" thì AI trả lời theo chính sách đổi trong Sổ tay và tạo việc cho chủ shop. Chưa làm đơn đổi hàng tự động.
  - Không mời mua thêm trong tin này, không tặng quà để đổi lấy lời khen.

**P16: Dòng số liệu và dòng "Tiếp theo" cho người dẫn** · 3,5 · nhỏ đến vừa · 0
- **Khách thấy:** dòng "Tiếp theo: váy 15" và nghe "ở lại chút, món sau là váy 15". Người dẫn liếc thấy "23 chốt · 17 đã trả lời · 9 xác nhận".
- **Cách làm:** chỉ làm dòng số liệu, dòng Tiếp theo và tối đa 1 gợi ý, dùng chung ô gợi ý đang có. Máy không tự chuyển món.

**P20: Nhận ra khách quen, nhớ size vừa** · 3,5 · vừa · 0
- **Khách thấy:** chị chốt mà quên ghi size thì thẻ hỏi "Lấy M như lần trước?" kèm nút. Chỉ người dẫn thấy nhãn "khách quen · hay mặc M".
- **Cách làm:**
  - Trên sóng không nói "khách quen" hay "quay lại rồi", vì câu đó ngầm lộ việc chị từng mua.
  - Size quen lấy từ các đơn đã giao mà không bị hoàn.
  - Không gom lịch sử bình luận vào hồ sơ khách, chỉ dùng lịch sử đơn.
  - Chiều cao, cân nặng chỉ lưu khi khách bấm đồng ý, và có nút xóa.
- **Giới hạn:** chỉ nối được người bình luận với hồ sơ khách sau khi đã nhắn riêng thành công. Lúc đó MOZA mới có mã khách của Messenger.

**P24 bước 2: Danh sách chờ** · 3,5 · vừa · 0
- **Khách thấy:** áo hết, chị Nga nhận "chị đứng số 1 trong danh sách chờ" kèm nút [Vẫn chờ]. Người chốt trước bấm "Không lấy" hoặc hết giờ giữ ngắn thì chị nhận lời mời giữ hàng.
- **Cách làm:**
  - Nút [Vẫn chờ] là bắt buộc. Khách không bấm thì không mở được khung 24 giờ để shop báo sau.
  - Chỉ nhường suất theo đúng luật đã ghi trên thẻ.
  - Quá 24 giờ thì thôi.

**P32: Tổng kết sau live** · 3,5 · vừa · dưới 0,05 USD mỗi buổi
- **Chủ shop thấy:** phễu đơn do máy đếm (chốt → trả lời → xác nhận → gửi → giao → hoàn), món bán chạy, món hỏi nhiều mà ít chốt, và tối đa 3 gợi ý do AI viết.
- Chỉ gửi số liệu gộp cho AI, không gửi tên hay số điện thoại. Không tự sắp lại kịch bản.
- Đây là chỗ đo xem P01, P06, P22 có hiệu quả không, và cũng là lần đầu biết đơn thật sự rơi ở đâu. Nên có ngay từ buổi live thật đầu tiên.

**P15 phần rẻ: Nhật ký buổi live, và luật "Mai không tự nói con số"** · 3,8 · nhỏ đến vừa · 0
- Khi có khách khiếu nại kiểu "live bảo giá 150k", chủ shop mở nhật ký để đối chiếu. Nhật ký chỉ lưu chữ: lời AI nói, lời người dẫn, màn hình đang hiện gì, các bình luận chốt đã gắn đơn.
- Dặn miệng Live (phần AI nói trực tiếp) không tự nói con số. Con số đi bằng câu mẫu hoặc hiện trên màn hình.
- Nhờ luật sư xem nên lưu nhật ký bao lâu.

**Các việc nhỏ đi kèm:**
- **P17 cách A** (3,3): Mai mở bình chọn "A be, B đen", máy đếm bình luận, tối đa 2 lần mỗi buổi. Có kết quả thì người mẫu mặc ngay. Không kèm quà, vì quay số có thưởng phải đăng ký khuyến mại.
- **P26** (3,3): đơn của khách mới, trả tiền khi nhận, giá trị lớn, hoặc của khách từng hoàn hàng, nhận tin "Shop chuẩn bị gửi đơn, chị nhận trong tuần này được không?" kèm [Gửi đi] [Hẹn ngày khác]. Chỉ dùng lịch sử đơn của chính shop. Khách không bao giờ thấy chữ "rủi ro". Máy chỉ đánh dấu, người quyết.
- **P34, phần danh sách từ cấm K11** (3,3): chặn các câu như "dáng Zara", "hàng xuất khẩu", "Quảng Châu loại 1", "kháng khuẩn", "số 1" khi shop không có giấy tờ chứng minh.
- **P08 bản đơn giản** (3,0, cần luật sư): trang Báo cáo ghi mốc thời gian từng món kèm chú thích có cú pháp chốt, và nhắc bấm "hoãn xóa video 6 tháng". Khi cắt clip thì tránh đoạn có tên khách và không ghi giá.
- **P28** (2,8, làm sau cùng, cần luật sư): chỉ dùng ảnh khách tự gửi. Xin phép bằng nút, rút lại được, mặc định che mặt.

## 5. Tầng 3: thử nghiệm AI, báo chi phí trước

**P15 bản đầy đủ: Kiểm lời Mai ngay trên sóng và đính chính** · 3,8 (chung điểm với P15) · công sức lớn
- **Khách thấy:** Mai lỡ nói "còn 5 chiếc" khi kho chỉ còn 2. Vài giây sau Thanh chữ hiện số đúng và Mai nói lại.
- **Cách làm:**
  - Phải viết một cách kiểm riêng, vì Bộ kiểm tra hiện có đòi mỗi con số phải kèm nguồn trích dẫn.
  - Tiếng nói đi thẳng ra loa, nên thực tế là đính chính sau khi câu sai đã phát 1–2 giây.
  - Đơn chốt trong khoảng thời gian nói sai được đánh dấu. Mặc định bán theo giá có lợi cho khách, hoặc hỏi khách chọn.
- **Phép thử:** một buổi tập 30 phút với miệng Live thật, ước khoảng 0,7 USD (Gemini 3.8 Live) đến 1,5 USD (GPT Live 1).

**P38: MOZA nhìn qua OBS, chỉ gợi ý chuyển món** · 2,8 · vừa · ước 0,1–0,3 USD mỗi giờ, CHƯA ĐO
- **Người dẫn thấy:** đang cầm áo 7 thì màn hình hỏi "Đang cầm áo 7? [Chuyển]". Máy không bao giờ tự đổi món, vì nhận nhầm hai áo cùng kiểu khác màu sẽ gắn nhầm đơn (đây là lý do góc bán hàng bác).
- **Cách thử:**
  - Cứ 2–3 giây lấy một ảnh nhỏ từ OBS. gpt-6-luna (model rẻ của OpenAI) chọn trong tối đa 10 món của phiên. Cách này chạy được với cả hai loại miệng AI.
  - Phải thử lại, vì lỗi đọc ảnh của gpt-6-luna mới được sửa ngày 25/9/2026.
  - Không lưu ảnh, không nhận diện khuôn mặt.

**P44: Dạy phần nghe người dẫn các từ riêng của shop** (góc công nghệ nêu thêm, chưa chấm) · nhỏ · vài cent mỗi buổi thử (ước tính)
- Gemini 3.5 Transcribe (ra ngày 26/8/2026) cho nạp sẵn danh sách từ riêng như tên món, giá, size, và nghe số chính xác hơn. Nhờ vậy các lệnh "Mai ơi mẫu mặc S", "áo 12 đen" ít bị nghe nhầm.
- Kèm theo: đối chiếu lại giá bản nghe trực tiếp trong bảng giá của MOZA với trang giá. Bảng giá MOZA ghi 3,5 / 21 USD cho 1 triệu token, trang giá ghi bản thường 2 / 12. Token là đơn vị tính tiền AI, cỡ vài chữ.

## 6. Các mục đang "Ngoài phạm vi" nên bàn lại

**6.1 Giá riêng buổi live, giờ vàng** (P18, cộng phần giá gốc của P34)

Theo Q&Me, 82% khách mua vì giá, 43% bị hút bởi ưu đãi chỉ có trong live. NĐ 239/2026 bỏ giới hạn 120 ngày giảm giá. Giảm giá không phải báo Sở Công Thương, nhưng cần luật sư xác nhận phải công bố những gì.
- **A. Giữ ngoài phạm vi.** Không thêm rủi ro, nhưng bỏ lỡ đòn bẩy lớn nhất.
- **B. "Giá live tới hết buổi" cho từng món, không có đồng hồ.** Một ô không bắt buộc, AI gợi ý mức giá. Giá ghi vào đơn ngay lúc giữ hàng. Giá gạch chỉ hiện khi đã có đơn giao thật ở giá đó trong 30 ngày qua. Người xem lại không được hưởng. Công sức vừa.
- **C. Giờ vàng có đồng hồ đếm ngược.** Hối thúc mạnh hơn, nhưng công sức lớn. Hình live trễ khoảng 15 giây nên dễ cãi nhau với khách chốt phút chót. Lỗi tính giá là mất tiền thật.
- **Khuyến nghị: B**, sau khi luật sư trả lời. Dùng thưa, không nói "chỉ hôm nay". Dù chọn cách nào, P34a vẫn làm ngay.

**6.2 Tự xác nhận tiền chuyển khoản** (P21 bước 2)
- **A. Chỉ gửi mã QR, người tự bấm "Đã nhận tiền".** 0 đồng, không đụng dữ liệu nhạy cảm, nhưng vẫn phải mở app ngân hàng để đối chiếu.
- **B. payOS.** Miễn phí từ 23/1/2026, mở tài khoản Kiên Long Bank online, MOZA tự hỏi trạng thái. Nhược điểm: phải mở thêm một tài khoản ngân hàng.
- **C. SePay.** Giữ được ngân hàng đang dùng. Gói miễn phí 50 giao dịch mỗi tháng, gói STARTUP 120.000đ mỗi tháng.
- **Khuyến nghị: làm A ngay.** Chọn B hoặc C (tùy ngân hàng đang dùng) khi đối chiếu tay thành gánh nặng. Chỉ lưu "đã nhận, số tiền, giờ, mã tham chiếu". Không lưu tên và số tài khoản người chuyển, vì NĐ 356 xếp tài khoản ngân hàng vào nhóm dữ liệu nhạy cảm. Thử chuyển 1.000đ trước và nhờ người rành tài chính xem.

**6.3 Nhắn mời khách cũ** (P10)

Luật 91/2025 Điều 28 yêu cầu có đồng ý riêng mới được nhắn mời chào. Meta đã tắt tính năng nhắc định kỳ. Tin quảng cáo trên Messenger chỉ mở qua các nhà cung cấp được Meta duyệt, nên phần mềm tự viết như MOZA gần như không dùng được.
- **A. Không nhắn.** Kéo khách bằng bài báo lịch, Sự kiện live, chia link vào nhóm Zalo. 0 đồng, 0 rủi ro.
- **B. Xin đồng ý cho từng buổi, trong 24 giờ.** Dưới bài báo lịch, hỏi "Shop gửi chị 1 tin trước giờ live được không?" kèm [Báo em buổi này] [Thôi]. Lưu nguyên văn câu hỏi và giờ khách bấm. Tin gửi đi có dòng "gõ DỪNG để không nhận". Hợp luật nhất, hiệu quả vừa phải.
- **C. Danh sách khách lâu dài qua Zalo OA.** Phải có Zalo OA đã xác thực (chưa rõ hộ kinh doanh có đủ điều kiện không), và luật sư duyệt câu xin đồng ý.
- **Cách nền tảng làm sẵn, có tốn tiền:** chạy quảng cáo bấm để nhắn Messenger (Click-to-Messenger) kiểu "Nhắn GIỮ CHỖ" ngay trong ngày live. Khách nhắn là mở khung 24 giờ, nên lúc lên sóng shop nhắn báo một cách hợp lệ. Chủ shop tự quyết tiền quảng cáo.
- **Khuyến nghị: A + B**, thêm quảng cáo nhắn tin nếu muốn chi tiền. C để sau. Phần xử lý "dừng nhận tin" và "xóa dữ liệu" nên làm luôn, vì đó là nghĩa vụ theo luật.

**6.4 Nối hãng vận chuyển** (P29, P25)
- **A. Giữ như cũ, dán mã vận đơn bằng tay.**
- **B. Xuất file đúng mẫu nhập đơn hàng loạt của hãng đang dùng.** Tải lên một lần là có vận đơn. Công sức nhỏ.
- **C. Nối thẳng vào hệ thống của hãng** (ví dụ GHTK). Tạo vận đơn một chạm, trạng thái tự về 30 phút một lần. Nhờ đó gửi được tin "Hôm nay giao, chị để ý điện thoại". Nhược điểm: công sức lớn, và tiền thu hộ sai là mất tiền thật.
- **Khuyến nghị: B trước**, C khi số đơn mỗi ngày đủ lớn. Bộ tin theo trạng thái (P25) chỉ làm cùng C. Chuẩn hóa địa chỉ (P30) để tới lúc làm C, dùng danh mục chính thức theo Quyết định 19/2025/QĐ-TTg (34 tỉnh, 3.321 xã).

**6.5 MOZA tự lên lịch live, tự bấm phát** (P09 bước 2)
- **A. Giữ làm tay:** dán khóa phát một lần vào OBS.
- **B. Chỉ lên lịch qua Facebook,** để MOZA biết trước mã buổi live. Cần thêm quyền đăng bài, chưa kiểm có phải xin duyệt không.
- **C. Tự bấm phát.** Đụng thẳng mục ngoài phạm vi.
- **Khuyến nghị: A.**

## 7. Không nên làm

**Bị bác (từ 2 phiếu "bỏ" trở lên):**
- **P39: đổi Tư vấn viên sang model rẻ.** Khách không thấy gì khác. Model yếu hơn dễ bị Bộ kiểm tra chặn, trả lời chậm hơn. Lại trái luật của dự án là "không tinh chỉnh model tới khi phần mềm xong". Xem lại khi có số chi phí thật.

**Chưa nên làm.** Mỗi mục dưới đây chỉ có 1 phiếu bác; các góc khác muốn sửa lại chứ không bác. Xếp vào đây vì điểm trung bình thấp (1,8–3,0) và vì các lý do sau:
- **P37 (người mẫu AI), P40 (video AI người mẫu xoay người).** "Khác ảnh" là một lý do hoàn hàng hay gặp của đồ nữ. Hình AI làm khách kỳ vọng sai, phải gắn nhãn, và người phải duyệt từng cái. Nên thay bằng ảnh thật trên hai dáng người kèm số đo, và video quay điện thoại 15 giây mỗi màu.
- **P41 (live giờ vắng với nhân vật hoạt hình).** Luật buộc phải dừng ngay khi nói sai, không người trực thì không ai dừng. Tốn 1,4–3 USD mỗi giờ, lại dễ hết lượt giọng Google giữa chừng.
- **P36 (che số điện thoại trước khi gửi AI).**
  - Góc kỹ thuật và bán hàng lo làm sai số điện thoại trong đơn, và che số không giải hết chuyện dữ liệu ra nước ngoài.
  - Nhưng góc pháp lý chấm 4 điểm và khuyên đổi #18 (đang gửi nguyên số điện thoại, địa chỉ khách cho AI) trước khi live thật với khách lạ.
  - Cách xử lý: chờ luật sư trả lời câu hỏi về Điều 20 (mục 9). Nếu phải che thì làm cách đơn giản: mã tự bắt số điện thoại trong tin khách và ghi thẳng vào đơn, AI chỉ thấy "[đã nhận SĐT]".
- **P33 (doanh thu năm so với mốc 1 tỷ).** Không bán thêm được đơn nào. Khi kê khai thì xuất danh sách đơn ra file và hỏi kế toán.
- **P30 (chuẩn hóa địa chỉ ngay bây giờ).** GHN nhận cả địa chỉ cũ lẫn mới, GHTK không bắt buộc ô quận/huyện, và thẻ đơn đã đọc lại địa chỉ cho khách soát. Làm cùng mục 6.4 cách C.

**Các phần đã cắt khỏi những đề xuất vẫn giữ:** ô tích "ý đã nói"; câu "quay lại rồi" trên sóng; câu "chưa mở tin" khi gọi tên; tự gia hạn giữ hàng 48 giờ; tự đổi món theo camera; khung bình chọn qua Facebook (P17 cách B); gửi chữ trước, ảnh sau.

**Đã loại ở bước gộp:** giọng riêng qua ElevenLabs; hình đại diện người thật; tự đăng Reels; tệp quảng cáo từ số điện thoại khách; tin quảng cáo hàng loạt; **chia sẻ danh sách khách bom hàng giữa các shop (trái Luật 91/2025)**; coi bình luận là đã mở khung 24 giờ (chỉ thử ở Bước 0, không dựa vào).

## 8. Việc anh/chị cần làm hoặc quyết

**Việc cần làm:**
1. **Lập Page bán hàng riêng, có từ 100 người theo dõi, tài khoản đã dùng từ 60 ngày.** Đây là điều kiện của Meta để được phát live, và cũng cần cho Bước 0.
2. **Cho biết shop đã có giấy đăng ký hộ kinh doanh chưa.**
   - Muốn MOZA nhắn được khách thật, ứng dụng phải có quyền nhắn tin ở mức nâng cao. Muốn có quyền này thì phải qua xét duyệt và thuộc doanh nghiệp đã xác minh (Meta áp dụng từ 1/2/2023). Không có giấy thì gần như không xác minh được.
   - Đường lùi khi chưa có giấy: MOZA chỉ còn bình luận công khai (cũng phải kiểm quyền), còn chủ shop tự trả lời tin nhắn trong Meta Business Suite.
   - Giấy này còn quyết chuyện Zalo OA và thẻ trả lời sau 24 giờ.
3. **Lập ứng dụng Meta RIÊNG cho bản bán hàng,** không dùng chung với bản tuyển dụng. Rồi nộp MỘT lần xét duyệt, gom đủ các quyền. Claude Code sẽ viết hướng dẫn. Việc này có thể mất vài ngày tới vài tuần.
4. **Xác thực danh tính người livestream** theo Luật TMĐT 122/2025. Chỉ làm một lần.
5. **Dùng khóa AI riêng của shop (Google và OpenAI), đã bật trả tiền, tự dán vào file `.env`** (không dán vào chat).
   - Lý do chính: tách khỏi bản tuyển dụng. Hiện hai bản dùng chung hạn mức, chung hóa đơn, và dữ liệu khách của shop đi qua tài khoản của dự án khác.
   - Khóa Google hiện nhiều khả năng đã trả tiền: lỗi Google trả về có ghi "Tier 1", là gói đã gắn thanh toán. Vẫn nên kiểm lại cả hai khóa, vì với gói miễn phí, người của Google có thể đọc dữ liệu.
6. **Chọn chỗ đặt trang chính sách quyền riêng tư có địa chỉ cố định.** Meta và luật đều đòi.
7. **Chuẩn bị Bước 0:** một Page đủ điều kiện live; một tài khoản cá nhân chưa từng nhắn Page, được thêm làm "người thử" trong ứng dụng; và `cloudflared` (công cụ tạo Quick Tunnel).
8. **Tắt tự động "Bình luận → tin nhắn" và Business AI** trong Meta Business Suite. Nếu để bật, chúng dùng mất lượt nhắn riêng duy nhất của mỗi bình luận.
9. **Chọn lịch live cố định mỗi tuần.**
10. **Quay video thật 15 giây mỗi màu, chụp ảnh thật trên hai dáng người.** 14 video hiện có là ảnh chuyển động chậm do Claude dựng thử. Chỉ dùng chúng để tập, không chiếu cho khách như video quay thật.
11. **Xin giấy đồng ý của người lên hình:** cho live, clip, Reels và số đo công khai.
12. **Điền thông tin shop còn thiếu và chuẩn bị giấy tờ:**
    - chính sách đổi size, giờ nghe máy, tài khoản ngân hàng riêng, người phụ trách buổi live;
    - giấy tờ nguồn gốc hàng (Luật TMĐT Điều 23);
    - ghi thông tin người bán và chính sách đổi trả trên Page.
13. **Cho biết hãng vận chuyển đang dùng.**
14. **Hỏi kế toán:** khai tài khoản nhận tiền bán hàng với cơ quan thuế (NĐ 68/2026, mẫu 01/BK-STK), và mốc doanh thu 1 tỷ.
15. **Tìm luật sư** cho các câu hỏi ở mục 9.

**Việc cần quyết:**

| Việc cần quyết | Khuyến nghị | Khi nào |
|---|---|---|
| Luồng 3 (cách chốt đơn từ bình luận): tin đầu thành thẻ do mã soạn (P22) | Đồng ý | Trước khi code nhóm chốt đơn |
| F-32 (luật nhắc đơn): tối đa 2 lần nhắc và 1 tin báo hủy (P06) | Đồng ý | Cùng lúc |
| #64 (giữ hàng 24 giờ): đổi thành hai mức, chọn N (P24a) | Đồng ý, N vài giờ | Sau P01 |
| Câu gọi tên người chốt trên sóng (P01) | Câu trung tính, mỗi người 1 lần | Trước khi code |
| Tách "Dừng AI" và "Dừng mọi thứ", chọn mức trần ngày có live (P42) | Đồng ý | Trước live thật |
| Giá gạch (P34a) | Tạm tắt tới khi có bằng chứng | Trước live thật |
| #18 (gửi nguyên số điện thoại, địa chỉ cho AI) | Chờ luật sư | Trước live thật |
| Hạn mức giọng Google: nâng gói hay giới hạn câu chen | Giới hạn câu chen trước | Trước live thật |
| 6.1 Giá live | B | Sau khi luật sư trả lời |
| 6.2 Chuyển khoản | A | Khi làm P21 |
| 6.3 Mời khách cũ | A + B | Khi làm P09 |
| 6.4 Vận chuyển | B | Khi biết hãng |
| 6.5 Lên lịch live | A | Không gấp |

## 9. Phần cần luật sư hoặc chuyên gia xem

**Trước khi live thật:**
- **Chuyển dữ liệu ra nước ngoài** (Luật 91/2025 Điều 20). Quyết định #18 đang gửi nguyên số điện thoại và địa chỉ khách cho OpenAI và Google. Cần hỏi: hộ kinh doanh có được miễn lập hồ sơ không, hồ sơ gồm gì, có phải che số điện thoại (P36) không. Mức phạt có thể tới 5% doanh thu.
- **Chính sách quyền riêng tư**, ghi rõ các bên nhận dữ liệu. Nếu sau này bán MOZA cho shop khác, xem thêm nghĩa vụ của bên cung cấp theo NĐ 142/2026.
- **Câu chữ của nhãn AI** (Luật AI 134/2025 Điều 11).
- **Giá gạch đang hiện trên màn hình** (Luật TMĐT Điều 24): giá gốc phải chứng minh thế nào.
- **Nghĩa vụ của người livestream và người bán:** xác thực danh tính (Luật TMĐT 122/2025), giấy tờ nguồn gốc hàng (Điều 23), thông tin người bán và chính sách đổi trả trên Page.
- **Bán hàng từ xa** (Luật 19/2023, NĐ 55/2024, **chưa tra**): thẻ đơn cần có những thông tin gì.

**Khi làm tới tính năng tương ứng:**
- Giá live, các chữ "nhất", "số 1"; số "người chốt" hiện trên màn hình (căn cứ là Điều 6 Luật TMĐT, cấm lừa dối).
- Câu xin đồng ý nhận tin theo NĐ 330/2026. Hai nguồn ghi mức phạt khác nhau (30–50 triệu và 10–20 triệu), cần đọc văn bản gốc.
- Số đo cơ thể có phải dữ liệu nhạy cảm không (NĐ 356/2025).
- Gắn lịch sử bình luận vào hồ sơ khách có bị coi là "dữ liệu theo dõi hành vi trên mạng" (nhóm nhạy cảm) không (P20).
- Mẫu giấy đồng ý dùng hình ảnh người mẫu và ảnh khách (Luật Quảng cáo Điều 8, Bộ luật Dân sự Điều 32).
- Nhật ký buổi live lưu bao lâu thì hợp lệ.
- Việc tự chấm mức rủi ro của khách.

**Chuyên gia khác:**
- Kế toán: khai tài khoản nhận tiền, mốc 1 tỷ.
- Người rành thanh toán: thử mã QR, chính sách hoàn tiền, việc tự xác nhận tiền.

## 10. Thông tin công nghệ đã tra (27/9/2026)

**Những điểm làm đổi cách làm:**
1. **Mỗi bình luận chỉ được nhắn riêng 1 tin, trong 7 ngày.** Tin đó dùng được mọi loại, kể cả thẻ có ảnh và nút. Vì vậy tin đầu phải là một thẻ trọn vẹn do mã soạn (P22).
2. **Meta đã tắt nhắc định kỳ (10/2/2026), và tin quảng cáo chỉ mở qua nhà cung cấp được duyệt.** Chỉ còn cách mời khách bằng bài đăng, Sự kiện live, xin đồng ý trong 24 giờ, hoặc quảng cáo bấm để nhắn.
3. **Quick Tunnel đổi địa chỉ mỗi lần mở máy.** MOZA nên tự hỏi Facebook định kỳ, không chỉ chờ Facebook gửi về. Ảnh trong thẻ cũng không nên phụ thuộc địa chỉ này.
4. **Quyền nhắn tin ở mức nâng cao cần xét duyệt và doanh nghiệp đã xác minh.** Luật này không mới, nhưng nó biến giấy đăng ký hộ kinh doanh thành cổng chặn cho cả luồng chốt đơn (mục 8, việc 2).

**Đã tra, chưa dùng được:**
- **Meta Live Shopping Tools:** ghim sản phẩm lên live, giỏ hàng, trả tiền ngay trong Messenger, khách không cần nhớ cú pháp chốt. Đây đúng là loại cái mới có thể đổi phương pháp. Nhưng ở Việt Nam tính năng này chỉ mở qua đối tác của Meta như Haravan, vẫn đang thử nghiệm, và Meta phải cấp quyền. MOZA tự viết, không phải đối tác, nên chưa dùng được. Sẽ theo dõi.
- **Marketing Messages:** chỉ mở qua nhà cung cấp được Meta duyệt.
- **Mẫu khảo sát khách và Instant form:** Meta ghi còn đang phát triển.

**Những điểm cần chú ý:**
- **Giá Gemini gấp đôi từ 1/1/2027** (3.8 Live, 3.8 Flash, TTS). Bảng giá trong MOZA đã có mốc này cho Flash và TTS, còn thiếu cho 3.8 Live, và chưa có giá phần hình.
- **Gemini 3.8 Live nhận thêm thông tin mà không cắt ngang lời đang nói** (tài liệu cập nhật 18/9/2026). MOZA đã dùng cách này từ #81. Nhưng miệng mặc định hiện là GPT Live 1. Phải kiểm cách này có chạy với GPT Live 1 không, trước khi đưa phần gỡ lưỡng lự và tư vấn size thẳng vào miệng Mai. Con số thì luôn đi bằng câu mẫu.
- **Gemini 3.5 Transcribe** (26/8/2026) nhận danh sách từ riêng (P44).
- **Messenger:** thẻ có ảnh cho tối đa 3 nút, lưới ảnh cho 2–6 tấm, có nút tự điền số điện thoại. Mẫu tin báo đơn được duyệt trong vài giây và phải có quyền riêng. Trang của Meta không ghi giá, nên chữ "miễn phí" **chưa khẳng định**.
- **Facebook Live:**
  - Video giữ 30 ngày.
  - Chế độ Thảo luận ẩn bình luận dưới 100 ký tự.
  - Không có cách tự ghim bình luận bằng phần mềm.
  - Đọc được số người xem.
  - MOZA đang dùng Graph v26 (bản giao tiếp với Facebook). Bản v20 đã ngừng ngày 24/9/2026, không ảnh hưởng.
- **OpenAI:** lỗi đọc ảnh của gpt-6-luna được sửa ngày 25/9/2026. GPT Live 1 không nhận hình. Sora 2 đã đóng ngày 24/9/2026.
- **Việt Nam:** payOS miễn phí; SePay có gói 50 giao dịch miễn phí mỗi tháng. GHTK không bắt ghi quận/huyện. Zalo ZBS khoảng 200–300đ mỗi tin.

**Còn chưa kiểm chứng:**
- 8 câu hỏi ở Bước 0.
- Kết quả với khách lạ sau khi ứng dụng được duyệt.
- Business Suite có cho trả lời tới 7 ngày không.
- Quyền đăng bài có cần xin duyệt không.
- Hộ kinh doanh có đủ điều kiện mở Zalo OA không.

---

## Phụ lục: nguồn đã đọc trong vòng nghiên cứu (tra 27/9/2026)

Mỗi dòng: phát hiện (mức tin cậy) — nguồn. Mức tin cậy do trợ lý nghiên cứu tự chấm; "thấp" là chưa kiểm chứng.

### Cách live bán hàng hiệu quả (VN, Trung Quốc)

- Thị trường 2025–2026: thời trang lớn nhất và tăng mạnh, nhưng khách chi tiêu thận trọng, rất nhạy giá (cao, Metric 2025/Q1-2026; YouNet ECI 10/8/2026) — <https://metric.vn/insights/cong-bo-bao-cao-thuong-mai-dien-tu-viet-nam-2025/> · <https://metric.vn/insights/bao-cao-thuong-mai-dientu-viet-nam-q1-2026/> · <https://www.younetgroup.com/vi/bao-cao-toan-canh-tmdt-viet-nam-nua-dau-nam-2026> · <https://vnexpress.net/doanh-so-tren-tiktok-shop-tang-66-5102594.html>
- Vì sao khách xem và chốt trong live (Q&Me 2026): giá, ưu đãi chỉ có trong live, được hỏi trực tiếp, xem hàng thật (vua, khoảng 04/2026) — <https://qandme.net/en/report/vietnam-live-commerce-market-trends-and-buyer-behavior.html> · <https://www.linkedin.com/posts/namvu10139_vietnam-live-commerce-popularity-2026-q-activity-7452551775728848896-SQT3> · <https://danviet.vn/nguoi-dung-viet-khong-con-qua-tin-kol-khi-mua-hang-livestream-d1424840.html>
- Niềm tin vào live bán hàng Việt Nam giảm mạnh sau bê bối 2025: khách chuyển sang mua lý trí, ghét thổi phồng (vua, 10/2025 – 01/2026) — <https://tuoitre.vn/nld/livestream-ban-hang-ngay-cang-bap-benh-196251014223612664.htm> · <https://tuoitre.vn/sau-loat-be-boi-nguoi-tieu-dung-ho-hung-voi-livestream-20251115080227423.htm> · <https://ngoisao.vn/theo-dong-su-kien/kien-thuc/livestream-ban-hang-nam-2026-ai-con-song-duoc-va-song-bang-dieu-gi-d477312.html>
- Luật mới Việt Nam từ 1/7/2026: xác thực danh tính người livestream, cấm thông tin sai lệch, áp dụng cả mạng xã hội có hoạt động TMĐT (cao, 01–09/2026) — <https://doanhnghiephoinhap.vn/5-quy-dinh-moi-khong-the-bo-qua-khi-livestream-ban-hang-tu-172026-134275.html> · <https://dantri.com.vn/kinh-doanh/san-thuong-mai-dien-tu-phai-kiem-soat-chat-nguoi-livestream-ban-hang-20260705182024919.htm> · <https://congthuong.vn/livestream-ban-hang-phai-tuan-thu-loat-quy-dinh-moi-tu-ngay-1-7-463723.html> · <https://cafef.vn/het-thoi-ban-hang-online-vo-danh-188260912083809737.chn> · <https://thuongtruong.com.vn/news/luat-thuong-mai-dien-tu-2025-va-cuoc-thanh-loc-toan-dien-hoat-dong-livestream-ban-hang-158887.html> · <https://nghiencuu.tapchikinhtetaichinh.vn/luat-thuong-mai-dien-tu-2025-khung-phap-ly-moi-cho-livestream-ban-hang-va-tiep-thi-lien-ket-157230.html>
- Trung Quốc 2026: bắt gắn nhãn AI liên tục; Douyin cấm câu hối thúc không kiểm chứng được, chỉ cho nói 'số lượng giới hạn' khi hiện tồn kho thật (vua, Quy định: 1/2/2026; Douyin: 17/4/2026 (nguồn thứ cấp)) — <https://www.elawcn.com/rule/2026/0110/1721.html> · <https://bo.meideng.net/school/%E8%A1%8C%E4%B8%9A%E6%94%BF%E7%AD%96/%E6%8A%96%E9%9F%B3417%E6%96%B0%E8%A7%84> · <https://www.chanmama.com/yunyingquan/article/1330.html>
- Kết quả thật của người dẫn AI ở Trung Quốc: bản AI La Vĩnh Hạo (Baidu), Baidu Yi Jing, JD — hiệu quả lớn nhưng có điều kiện (cao, 15/6/2025; 23/4/2026; 13/5/2026) — <https://technode.com/2025/06/17/luo-yonghaos-digital-avatar-draws-over-13-million-viewers-in-ai-powered-baidu-live-commerce-debut/> · <https://www.geekpark.net/news/350612> · <http://m.eeo.com.cn/2026/0513/874878.shtml> · <https://www.163.com/dy/article/KR6EUT6U05118VBB.html> · <https://www.sohu.com/a/1013317012_121752158>
- Mô hình thắng là 'người + AI': AI lo giờ vắng và phần thông tin, người thật lo giờ cao điểm và cảm xúc (vua, 2024–2026) — <https://www.163.com/dy/article/KR6EUT6U05118VBB.html> · <https://insight.xiaoduoai.com/commerce-knowledge/douyin-information/douyin-ai-anchor-helps-you-sell-goods-in-the-middle-of-the-night-the-real-person-not-violating-rules-gameplay-of-digital-human-live-streaming-in-2026.html> · <https://m.cls.cn/detail/1707754> · <https://pmc.ncbi.nlm.nih.gov/articles/PMC12530592/>
- Kỹ thuật giữ người xem và kích mua cho shop quần áo (Việt Nam + Douyin) (vua, 2025–2026) — <https://insight.xiaoduoai.com/commerce-knowledge/douyin-information/douyin-sales-women-clothing-whether-easy-how-to-carry-goods-of-douyin-women-clothing-practical-guide-from-entry-to-explosion-order.html> · <https://seller-us.tiktok.com/university/essay?knowledge_id=3175988075644686&lang=en> · <https://www.sapo.vn/blog/cach-livestream-ban-quan-ao-dep-va-hieu-qua> · <https://vpage.nhanh.vn/blog/top-7-mau-kich-ban-livestream-ban-quan-ao-chot-don-nhanh-nhu-chop-a255.html> · <https://www.kiotviet.vn/8-sai-lam-khi-livestream-ban-hang-khien-cac-shop-mat-khach/> · <https://bemomentiq.com/blog/how-run-tiktok-shop-flash-sales-during-lives-urgency-framework>
- Thước đo chuẩn của một buổi live (TikTok chính thức + Douyin) — Moza đang thiếu phía người xem (cao, 05/2026) — <https://seller-us.tiktok.com/university/essay?knowledge_id=8418309721360171&lang=en> · <https://seller-us.tiktok.com/university/essay?knowledge_id=3175988075644686&lang=en> · <https://www.jizhil.com/dydata/13081.html>
- Điều khách ghét và gốc rễ mất đơn: hàng khác ảnh, hoàn hàng cao, bom hàng COD, không ai chăm sau live (vua, 2024–2025) — <https://www.digitaling.com/articles/1225328.html> · <https://www.woshipm.com/share/6057238.html> · <https://cafef.vn/gia-tang-boom-hang-188251118084816142.chn> · <https://tuoitre.vn/khoc-rong-voi-khach-bom-hang-mua-online-20250611084935056.htm> · <https://www.kiotviet.vn/8-sai-lam-khi-livestream-ban-hang-khien-cac-shop-mat-khach/>
- Mặt bằng công cụ chốt đơn live Facebook ở Việt Nam (đối thủ) — những thứ khách hàng coi là mặc định (vua, 2026) — <https://www.haravan.com/pages/phan-mem-ban-hang-livestream> · <https://fptshop.com.vn/tin-tuc/for-gamers/phan-mem-quet-don-livestream-tot-nhat-2026-204663>
- Chuyển khoản tự xác nhận bằng VietQR động: cách rẻ để chốt đơn liền mạch và giảm bom hàng (vua, 2026 (trang hãng)) — <https://payos.vn/thanh-toan-bang-cach-quet-ma-qr/> · <https://sepay.vn/>
- Facebook: Live Video Ads mở toàn cầu (17/6/2026) — trả tiền để đẩy buổi live tới người chưa theo dõi (vua, 17/6/2026) — <https://www.socialmediatoday.com/news/meta-updates-its-livestream-shopping-tools/823223/> · <https://creators.facebook.com/tools/live/>
- Shop tự live (店播) thắng người nổi tiếng: bài học vận hành cho shop nhỏ (cao, 02–03/2025) — <https://news.qq.com/rain/a/20250225A07WUY00> · <https://www.cbndata.com/information/293730> · <https://vietnamnet.vn/cong-xuong-livestream-cua-smes-top-dau-nganh-thoi-trang-tren-tiktok-shop-2526623.html>
- Sau live: cắt tự động đoạn giới thiệu từng sản phẩm thành video ngắn, dùng bảng nhắc lời theo sản phẩm (thap, 04/2026) — <https://www.163.com/dy/article/KR6EUT6U05118VBB.html>
- Tâm lý khách trong live: tương tác thật, cảm giác gần gũi, khan hiếm, giải trí — và cả mệt mỏi vì quá tải (vua, 2025) — <https://journal.access-bg.org/issue-6-2-2025/a_systematic_literature_review_on_live-streaming_commerce-trends> · <https://pmc.ncbi.nlm.nih.gov/articles/PMC12530592/>

### Nền tảng Meta (Facebook, Messenger)

- Live Shopping Tools (ghim sản phẩm trong live) đã có lại trong Live Producer — ở Việt Nam chưa rõ có dùng được không (vua) — <https://www.facebook.com/business/help/1737830097171282> · <https://www.facebook.com/business/help/975194481036128> · <https://www.facebook.com/business/help/1238620417625756> · <https://www.techwyse.com/news/platform-updates/meta-live-video-ads-instagram-virtual-card-checkout-affiliate-cannes-2026> · <https://www.switcherstudio.com/whats-new/facebook-instagram-turn-livestreams-into-paid-ad-units>
- Quảng cáo live (Live Video Ads): khi đang phát chỉ hiện ở Bảng tin và Reels; nên lên lịch quảng cáo trước (cao) — <https://www.facebook.com/business/help/326071075057677> · <https://www.facebook.com/business/help/1737830097171282> · <https://socialbee.com/blog/facebook-updates/> · <https://www.switcherstudio.com/whats-new/facebook-instagram-turn-livestreams-into-paid-ad-units>
- API cho live (v26): bình luận theo luồng trực tiếp, cảm xúc, webhook trạng thái live, các trường mới trên bình luận (cao) — <https://developers.facebook.com/documentation/live-video-api/interact-with-viewers.md> · <https://developers.facebook.com/docs/graph-api/reference/live-video/comments/> · <https://developers.facebook.com/docs/graph-api/reference/comment/> · <https://developers.facebook.com/docs/graph-api/webhooks/reference/page/> · <https://developers.facebook.com/documentation/live-video-api/reference> · <https://developers.facebook.com/documentation/live-video-api>
- API bình chọn trong live — Moza chưa dùng, là cách rẻ để tăng tương tác (cao) — <https://developers.facebook.com/documentation/live-video-api/polls.md> · <https://www.facebook.com/business/help/103887130554612> · <https://developers.facebook.com/documentation/live-video-api/reference>
- Lên lịch live và nhắc người theo dõi: lên lịch thường thì KHÔNG có thông báo, muốn nhắc phải tạo 'Sự kiện live' (cao) — <https://www.facebook.com/business/help/2087325741287572> · <https://www.facebook.com/business/help/184100780068012> · <https://developers.facebook.com/documentation/live-video-api/guides/scheduling.md>
- Ghim bình luận và cài đặt khung chat: có 'bình luận ghim sẵn'; tránh các chế độ làm mất bình luận 'chốt' (cao) — <https://www.facebook.com/business/help/264202154221971> · <https://www.facebook.com/business/help/2661398657407223>
- Video live tự xóa sau 30 ngày — dùng Clip/Reels để tái sử dụng (cao) — <https://about.fb.com/news/2025/02/updating-our-facebook-live-video-storage-policy/> · <https://www.facebook.com/business/help/2967863099960249>
- Nhắn riêng từ bình luận: được gửi thẻ có nút; hạn 7 ngày; mỗi bình luận chỉ 1 tin (cao) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/private-replies> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting.md>
- Messenger 2026: các loại tin mới giúp khách ít phải gõ khi lên đơn (cao) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog/> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/template/image-grid.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/quick-replies.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/persistent-menu.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/reference/messenger-profile-api/ice-breakers.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/template/coupon.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/templates/customer-feedback-template.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/template/product.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events/send_cart.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/templates/instant-form-template.md>
- Thẻ gửi tin ngoài 24 giờ và mẫu Utility: 3 thẻ đã bỏ, HUMAN_AGENT còn; mẫu Page tự tạo được duyệt 'trong vài giây' (cao) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/utility-messages> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy.md>
- Marketing Messages trên Messenger: có Việt Nam, nhưng chỉ cho 'nhà cung cấp công nghệ' đã qua xét duyệt, tính tiền theo tin, giá Việt Nam chưa công bố (vua) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/faq.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/grow-marketing-messages-audience.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/send-messages.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/get-started.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog/> · <https://www.facebook.com/business/help/1321849029608125>
- API gọi điện qua Messenger (ra chính thức 11/2/2026): Việt Nam có trong danh sách — dùng được để xác nhận đơn bằng giọng nói (vua) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/calling> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/calling/biz2consumer/check-permissions> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog.md>
- Meta Business Agent (3/6/2026): miễn phí trên Messenger nhưng vẫn KHÔNG nối được kho của Moza; nối API riêng hiện chỉ có trên WhatsApp (vua) — <https://about.fb.com/news/2026/06/meta-business-agent/> · <https://developers.facebook.com/documentation/meta-business-agent/overview.md> · <https://developers.facebook.com/documentation/meta-business-agent/get-started.md> · <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages> · <https://www.techtimes.com/articles/320787/20260716/meta-business-agent-billing-starts-aug-1-free-test-window-ends-days.htm> · <https://theaiagentindex.com/agents/meta-business-agent> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/conversation-routing.md>
- Instagram: live qua OBS còn hạn chế; bình luận live và nhắn riêng CHỈ trong lúc đang phát (vua) — <https://about.instagram.com/blog/tips-and-tricks/instagram-live-producer> · <https://streamyard.com/blog/streaming-software-for-instagram-live> · <https://developers.facebook.com/documentation/instagram-platform/webhooks> · <https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies/> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting.md>
- Thanh toán và đơn hàng trên nền tảng Meta: không có gì mới cho Việt Nam; API quản lý đơn Commerce đã khai tử (cao) — <https://developers.facebook.com/docs/graph-api/changelog/version26.0/> · <https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/> · <https://www.techwyse.com/news/platform-updates/meta-live-video-ads-instagram-virtual-card-checkout-affiliate-cannes-2026> · <https://almcorp.com/news/meta-livestream-shopping-features-facebook-instagram-ai-ads/>
- Chính sách khuyến mãi trên Page: KHÔNG được yêu cầu hay thưởng cho việc chia sẻ, đăng lại, gắn thẻ (cao) — <https://www.facebook.com/policies_center/pages_groups_events>
- Nhãn AI và thông báo cho khách khi dùng giọng AI (vua) — <https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/> · <https://transparency.meta.com/governance/tracking-impact/labeling-ai-content/> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages> · <https://socialbee.com/blog/facebook-updates/>
- Quảng cáo Click-to-Messenger: có chuỗi tin chào sẵn và giữ quyền trả lời tới 30 ngày; khách nhắn qua quảng cáo tự vào danh sách tiếp thị (cao) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/ads/ads-welcome-message-flows.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/grow-marketing-messages-audience.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages>
- Theo dõi sức khỏe Page: Page Integrity API và mã lỗi Page bị tạm cấm nhắn tin (vua) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog.md> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog/> · <https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting.md>

### Công nghệ AI mới nhất

- Mai nhìn camera nhận sản phẩm: Gemini 3.8 Live nhận hình với giá rất rẻ, còn GPT-Live-1 không nhận hình (cao, 15/9/2026 (model); bảng giá tra 27/9/2026) — <https://ai.google.dev/gemini-api/docs/pricing> · <https://ai.google.dev/gemini-api/docs/live-api/capabilities> · <https://ai.google.dev/gemini-api/docs/live-session> · <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live> · <https://developers.openai.com/api/docs/models/gpt-live-1> · <https://choosely.ai/ai-radar/gemini-3-8-live-avatar-explained>
- Gemini 3.8 Live with Live Avatar: đã chính thức nhưng chỉ cho doanh nghiệp (Mỹ, châu Âu), khoảng 0,39 USD mỗi phút avatar nói (vua, 24–25/9/2026) — <https://cloud.google.com/blog/products/ai-machine-learning/gemini-3-8-live-with-live-avatar-is-now-generally-available> · <https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-live-with-live-avatar/> · <https://www.unite.ai/google-brings-live-avatar-visual-presence-to-gemini-3-8-live/> · <https://choosely.ai/ai-radar/gemini-3-8-live-avatar-explained> · <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live>
- Cách đổi phương pháp cho 'Mai có hình' ngay bây giờ: HeyGen LiveAvatar chế độ Lite (tự đưa tiếng vào) khoảng 0,10 USD/phút, hoặc Tavus 0,32–0,37 USD/phút (vua, Giá tháng 6–7/2026, trang liveavatar.com tra 27/9/2026) — <https://www.liveavatar.com/> · <https://realtimeavatar.ai/blog/heygen-api-pricing-explained> · <https://help.heygen.com/en/articles/12758516-introducing-liveavatar> · <https://www.tavus.io/pricing>
- Phương án rẻ và an toàn pháp lý hơn: nhân vật hoạt hình 2D khớp môi theo tiếng Gemini Live, chạy trong trình duyệt (vua, Luật AI hiệu lực 1/3/2026; Nghị định 142/2026 hiệu lực 1/5/2026) — <https://docs.mascot.bot/libraries/gemini-live-api-avatar> · <https://luatvietnam.vn/tin-van-ban-moi/2-truong-hop-noi-dung-do-ai-tao-ra-bat-buoc-phai-gan-nhan-tu-01-5-2026-186-108836-article.html> · <https://tuoitre.vn/plo/ai-phai-gan-nhan-nhan-biet-noi-dung-do-ai-tao-ra-post907652.html>
- Bài học từ người dẫn ảo bán hàng ở Trung Quốc: hiệu quả nhất ở giờ vắng hoặc ban đêm và khi dữ liệu sản phẩm tốt; khách vẫn tin người thật hơn (vua, 12/1/2026, 16/1/2026) — <https://m.eeo.com.cn/2026/0116/779796.shtml> · <https://stellagent.ai/insights/jdcom-digital-humans-livestream> · <https://finance.sina.com.cn/tech/roll/2026-01-12/doc-inhfzukv4639221.shtml>
- Thử đồ ảo: Google Virtual Try-On chính thức từ 23/1/2026 (khoảng 0,06 USD/ảnh), Kling khoảng 0,07 USD/ảnh; rủi ro dữ liệu cá nhân cao (vua, GA 23/1/2026; bài so sánh 21/9/2026) — <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes> · <https://genlook.app/blog/qwen-image-2-1-virtual-try-on> · <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/vto/virtual-try-on-001> · <https://piapi.ai/docs/kling-api/virtual-try-on-api>
- Ảnh người mẫu AI và phối đồ bằng model ảnh chung: Nano Banana 2 khoảng 0,067 USD/ảnh, GPT Image 2.5 từ 0,013–0,053 USD/ảnh (cao, 26/2/2026, 30/6/2026, 8/9/2026) — <https://ai.google.dev/gemini-api/docs/pricing> · <https://www.digitalapplied.com/blog/nano-banana-2-lite-gemini-omni-flash-2026> · <https://docs.kanaries.net/articles/gpt-image-2-5> · <https://developers.openai.com/api/docs/changelog> · <https://developers.openai.com/api/docs/deprecations> · <https://ai.google.dev/gemini-api/docs/models>
- Video sản phẩm từ ảnh: đổi sang Gemini Omni 1.1 Flash (đã chính thức, khung dọc 9:16, khoảng 0,034–0,10 USD/giây); Sora 2 API đã đóng, Veo 4 chưa có (cao, 27/8/2026 (Omni 1.1); Sora đóng 24/9/2026) — <https://ai.google.dev/gemini-api/docs/omni> · <https://ai.google.dev/gemini-api/docs/changelog> · <https://www.eesel.ai/blog/gemini-omni-1-1-flash-pricing> · <https://ai.google.dev/gemini-api/docs/pricing> · <https://developers.openai.com/api/docs/deprecations> · <https://www.eesel.ai/blog/kling-ai-pricing> · <https://evolink.ai/seedance-2-5> · <https://queststudio.io/blog/when-is-veo-4-coming-out>
- Cắt clip nổi bật thành Reels: Gemini xem video kiểu agent (1/9/2026) tiết kiệm tới 88% token; buổi live 2 giờ tốn dưới khoảng 0,5 USD (vua, 1/9/2026) — <https://ai.google.dev/gemini-api/docs/video-understanding> · <https://ai.google.dev/gemini-api/docs/changelog> · <https://ai.google.dev/gemini-api/docs/pricing> · <https://www.eesel.ai/blog/opusclip-pricing>
- Giọng tiếng Việt: Gemini 3.8 Flash TTS đứng top tiếng Việt và MOZA đã dùng; chỗ trống là miệng Live chưa dùng được giọng tự tạo (cao, 22–24/9/2026) — <https://ai.google.dev/gemini-api/docs/speech-generation> · <https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-8-text-to-speech/> · <https://www.androidauthority.com/gemini-3-8-flash-text-to-speech-rolling-out-3714915/> · <https://ai.google.dev/gemini-api/docs/pricing> · <https://elevenlabs.io/docs/overview/models> · <https://datanorth.ai/news/openai-launches-gpt-live-1-in-the-api> · <https://vbee.vn/blog/compare/vbee-aivoice-vs-elevenlabs/>
- Model rẻ nhất để đọc bình luận số lượng lớn: gpt-6-luna vẫn rẻ nhất; đủ rẻ để AI đọc hết bình luận chứ không chỉ câu chốt (cao, 22/9/2026 (gpt-6-luna)) — <https://developers.openai.com/api/docs/models/gpt-6-luna> · <https://developers.openai.com/api/docs/pricing> · <https://ai.google.dev/gemini-api/docs/pricing> · <https://ai.google.dev/gemini-api/docs/changelog> · <https://platform.claude.com/docs/en/about-claude/models/overview>
- Hệ sinh thái agent mới (tháng 8–9/2026): không đổi quyết định #85, vài ý nhỏ nên mượn (cao, 3/9 – 22/9/2026) — <https://developers.openai.com/api/docs/changelog> · <https://developers.openai.com/api/docs/guides/agents> · <https://releasebot.io/updates/anthropic/claude-developer-platform> · <https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview> · <https://ai.google.dev/gemini-api/docs/models>
- Meta Business AI trên Messenger đã có tại Việt Nam (8/4/2026) và có số liệu thị trường ủng hộ hướng live cộng nhắn tin (vua, 28/1/2026, 8/4/2026, 3/6/2026) — <https://vovworld.vn/news/meta-unveils-ai-business-suite-in-vietnam-to-drive-social-commerce-2426183.vov5> · <https://about.fb.com/news/2026/06/meta-business-agent/> · <https://en.vietnamplus.vn/meta-outlines-vietnams-five-defining-social-media-trends-for-2026-post338966.vnp> · <https://vietnamnews.vn/economy/1764644/ai-messaging-to-shape-viet-nam-s-social-commerce-in-2026.html>
- Danh sách theo dõi: nhạc Lyria, Qwen Omni thời gian thực giá rất rẻ, dịch tiếng Reels (thap, 3/9/2026, 18/9/2026) — <https://ai.google.dev/gemini-api/docs/music-generation> · <https://ai.google.dev/gemini-api/docs/pricing> · <https://ai.google.dev/gemini-api/docs/changelog> · <https://www.aroged.com/2026/09/19/alibaba-releases-qwen3-8-omni-flash-omnivorous-model-with-context-of-1-million-tokens/>

### Chốt đơn, thanh toán, giao hàng, sau mua

- Khách Việt vẫn chuộng COD, nhưng thói quen quét QR tăng rất nhanh (cao, 15/6/2025; 17/12/2025) — <https://vietnambiz.vn/nghich-ly-tmdt-viet-nam-775-nguoi-tieu-dung-van-chon-thanh-toan-bang-tien-mat-khi-nhan-hang-2025615192910833.htm> · <https://nghiencuu.tapchikinhtetaichinh.vn/thanh-toan-trong-thuong-mai-dien-tu-tai-viet-nam-xu-huong-chuyen-dich-thuan-loi-rui-ro-va-ham-y-chinh-sach-huong-toi-giai-doan-2026-2030-131998.html> · <https://tgmresearch.vn/vietnam-e-commerce-insights-2025.html> · <https://goship.io/blog/khach-hang-chon-phuong-thuc-thanh-toan-online-nao/>
- payOS: miễn phí không giới hạn từ 23/01/2026, có link thanh toán, QR theo đơn và webhook (cao, 23/01/2026 (trang chương trình); tài liệu API xem ngày 27/9/2026) — <https://payos.vn/> · <https://payos.vn/cong-thanh-toan-mien-phi-2026/> · <https://payos.vn/docs/api/> · <https://payos.vn/docs/du-lieu-tra-ve/webhook/> · <https://payos.vn/docs/cau-hoi-thuong-gap/>
- SePay: nối thẳng tài khoản ngân hàng đang dùng, có webhook và API tự hỏi giao dịch (cao, trang giá không ghi ngày; changelog đến 6/2026) — <https://sepay.vn/bang-gia.html> · <https://docs.sepay.vn/tich-hop-webhooks.html> · <https://docs.sepay.vn/api-giao-dich.html> · <https://sepay.vn/ngan-hang-hop-tac.html> · <https://sepay.vn/changelog.html> · <https://sepay.vn/lap-trinh-cong-thanh-toan.html>
- Casso: phương án thứ ba, gói miễn phí gắn với ngân hàng đối tác (vua, 8/11/2024) — <https://casso.vn/casso-flow-sap-co-goi-mien-phi-giao-dich-khong-gioi-han/> · <https://casso.vn/flow/bang-gia/> · <https://api.casso.vn/pricing-table>
- VietQR Quick Link: tạo ảnh QR có sẵn số tiền và mã đơn, không cần tích hợp gì (cao, xem ngày 27/9/2026) — <https://www.vietqr.io/en/danh-sach-api/link-tao-ma-nhanh/> · <https://payos.vn/vietqr-la-gi/>
- Thuế hộ kinh doanh 2026 buộc tách tài khoản nhận tiền bán hàng (cao, 7/3/2026) — <https://baochinhphu.vn/tu-2026-ho-kinh-doanh-phai-bao-co-quan-thue-cac-tai-khoan-nhan-tien-102260307185152112.htm>
- Bom hàng: tỷ lệ hoàn đơn COD 15–20%, cao nhất ở thời trang; cảnh báo miễn phí của GHN (vua, 18/11/2025) — <https://tuoitre.vn/nld/gia-tang-boom-hang-196251117213408858.htm> · <https://ghn.vn/blogs/tin-tuc-ghn/ghn-ra-mat-phien-ban-app-web-moi-100-shop-deu-co-the-su-dung-mien-phi-tinh-nang-canh-bao-bom-hang> · <https://goship.io/blog/khach-hang-chon-phuong-thuc-thanh-toan-online-nao/>
- Không nên lập hoặc dùng chung 'danh sách số bom hàng' giữa các shop: rủi ro pháp lý năm 2026 (vua, 31/12/2025; bài về NĐ 330/2026 đăng khoảng 8/2026) — <https://baochinhphu.vn/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-tu-ngay-mai-1-1-2026-102251231155609721.htm> · <https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-356-huong-dan-luat-bao-ve-du-lieu-ca-nhan-2025-186-106267-article.html> · <https://luatvietnam.vn/tin-van-ban-moi/goi-dien-nhan-tin-quang-cao-khi-chua-duoc-dong-y-bi-phat-den-40-trieu-dong-186-111778-article.html> · <https://bocongan.gov.vn/tin-tuc-su-kien/xam-pham-du-lieu-ca-nhan-co-the-bi-phat-toi-da-den-5-doanh-thu-nam-lien-ke-d17-t45899.html>
- Luồng xác nhận COD: mức rào cản đi theo mức rủi ro (thap, không ghi ngày) — <https://koder.ai/vi/blog/luong-xac-nhan-cod-giam-gian-lan-rto> · <https://v9.com.vn/zalo-zns-xac-nhan-don-hang/>
- GHTK OpenAPI: tự lấy token, có môi trường thử, địa chỉ 2 cấp dùng được ngay, có webhook trạng thái (cao, 9/5/2026 (blog); tài liệu API ghi © 2025) — <https://api.ghtk.vn/docs/submit-order/submit-order-express/> · <https://api.ghtk.vn/docs/submit-order/logistic-overview/> · <https://api.ghtk.vn/docs/submit-order/webhook/> · <https://ghtk.vn/blog/ban-do-viet-nam-sau-sap-nhap/> · <https://goship.io/blog/so-sanh-phi-ship-toan-quoc/>
- GHN: nhận cả địa chỉ cũ và mới từ 1/7/2025, API tính phí và tạo đơn đầy đủ, có cảnh báo bom hàng (vua, khoảng 7/2025) — <https://ghn.vn/blogs/tin-tuc-ghn/giaohangnhanh-huong-dan-khach-hang-tao-don-hang-khi-ap-dung-don-vi-hanh-chinh-moi-vao-dia-chi-lay-giao-tra> · <https://api.ghn.vn/home/docs/detail?id=95> · <https://api.ghn.vn/home/docs/detail?id=84> · <https://goship.io/blog/so-sanh-phi-ship-toan-quoc/>
- Viettel Post và các hãng khác: Viettel Post phải liên hệ kinh doanh mới có tài khoản API (vua, 2025) — <https://partner2.viettelpost.vn/document> · <https://goship.io/blog/so-sanh-phi-ship-toan-quoc/>
- Goship: một lần nối được hơn 10 hãng, so giá tự động, nhưng tài liệu vẫn theo địa chỉ 3 cấp (vua, không rõ (ví dụ trong tài liệu có ngày 21/8/2024)) — <https://goship.io/> · <https://doc.goship.io/getting-started/introduction> · <https://doc.goship.io/api/shipment/webhooks> · <https://goship.io/integrations/jt-express/>
- Địa chỉ sau sáp nhập: 34 tỉnh, 3.321 xã, bỏ cấp huyện; có dữ liệu miễn phí để AI chuẩn hóa (cao, 6–7/2025) — <https://github.com/vietmap-company/vietnam_administrative_address> · <https://viblo.asia/p/chuyen-doi-dia-chi-hanh-chinh-co-san-qua-dinh-dang-moi-sau-17-thach-thuc-va-giai-phap-AoJe8wlp41j> · <https://goong.io/goong-thong-bao-cap-nhat-du-lieu-ban-do-theo-sap-nhap-dia-gioi-hanh-chinh/> · <https://ghtk.vn/blog/ban-do-viet-nam-sau-sap-nhap/>
- Messenger ngoài 24 giờ năm 2026: thẻ tag cũ đã bị khóa, tin đơn hàng dùng Utility template (miễn phí) (cao, changelog 6/3/2026 và 27/3/2026; tài liệu xem ngày 27/9/2026) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages> · <https://developers.facebook.com/docs/messenger-platform/changelog/> · <https://developers.facebook.com/docs/messenger-platform/send-messages/utility-messages> · <https://developers.facebook.com/docs/marketing-messages-on-messenger/> · <https://developers.facebook.com/docs/messenger-platform/discovery/private-replies/>
- Messenger Marketing Messages: có ở Việt Nam nhưng tính phí và phải qua duyệt quyền (vua, FAQ xem ngày 27/9/2026; bài báo 8/2/2026) — <https://developers.facebook.com/docs/marketing-messages-on-messenger/faq/> · <https://developers.facebook.com/docs/marketing-messages-on-messenger/> · <https://www.socialmediatoday.com/news/metas-recurring-marketing-messages-api-will-end-this-week/811668/>
- Zalo ZBS Template Message (thay ZNS từ 1/1/2026): nhắn theo số điện thoại, 200–300đ mỗi tin (vua, 1/1/2026 (ZBS); 1/6/2026 (gói OA)) — <https://zalo.solutions/zns/pricing> · <https://zalo.solutions/business-message/pricing> · <https://zalo.solutions/news/thong-bao-ra-mat-zbs-template-message-giai-phap-tin-nhan-doanh-nghiep-theo-mau/cp1zx4bq8mzhhszgz0br1ocd> · <https://oa.zalo.me/home/documents/guides/zbs-template-message> · <https://www.oazns.vn/bang-gia-zns/> · <https://oa.zalo.me/home/resources/news/chinh-thuc-quyen-loi-va-bieu-phi-cac-goi-dien-vu-zalo-oa-moi-tu-162026-_5100578039811031184> · <https://v9.com.vn/bang-gia-zalo-oa-2026/> · <https://oa.zalo.me/home/resources/news/thong-bao-chinh-sach-gui-tin-va-quy-dinh-phi-gui-tin_1433049880779375099>
- SMS brandname: đắt hơn Zalo và thủ tục nhiều, chỉ nên làm phương án dự phòng (vua, 2026 (trang không ghi ngày cụ thể)) — <https://speedsms.vn/bang-gia-dich-vu-tin-nhan-thuong-hieu-cskh/> · <https://stringeex.com/vi/blog/post/bao-gia-sms-brandname>
- Tăng giá trị đơn: gom đơn trong một buổi live, thanh 'còn X đồng là miễn ship', gợi ý phối đồ (thap, MISA/GHN 2024–2025; blog AOV 2026) — <https://www.haravan.com/pages/phuong-thuc-chot-don-tu-dong-livestream-facebook-cua-harasocial-live> · <https://www.misaeshop.vn/4712/phan-mem-tu-dong-chot-don-livestream/> · <https://ghn.vn/blogs/tip-ban-hang/phan-mem-chot-don-livestream> · <https://www.digitalapplied.com/blog/free-shipping-threshold-strategy-2026-ecommerce-playbook>
- Cứu đơn chốt rồi im lặng: nhắc trong 5 phút vàng, tối đa 2–3 lần, nội dung theo đúng đơn (thap, 2025–2026) — <https://www.ai-indeed.com/encyclopedia/25572.html> · <https://www.ai-indeed.com/encyclopedia/20017.html> · <https://www.zipchat.ai/blog/abandoned-cart-recovery-guide>
- Sau mua: ảnh khách mặc rất có giá trị, nhưng không được tặng quà để đổi lấy đánh giá tốt (vua, PowerReviews khoảng 2024–2025; TechCrunch 21/6/2022) — <https://www.powerreviews.com/research/ugc-visual-content-shopper-behavior-survey/how-user-generated-visual-content-impacts-purchase-behavior/> · <https://techcrunch.com/2022/06/21/meta-cracking-down-fake-irrelevant-reviews-facebook>
- Luật Thương mại điện tử 2025 (hiệu lực 1/7/2026) quản livestream bán hàng (vua, 4/5/2026; 26/5/2026) — <https://nghiencuu.tapchikinhtetaichinh.vn/luat-thuong-mai-dien-tu-2025-khung-phap-ly-moi-cho-livestream-ban-hang-va-tiep-thi-lien-ket-157230.html> · <https://doanhnghiephoinhap.vn/5-quy-dinh-moi-khong-the-bo-qua-khi-livestream-ban-hang-tu-172026-134275.html> · <https://thuongtruong.com.vn/news/luat-thuong-mai-dien-tu-2025-va-cuoc-thanh-loc-toan-dien-hoat-dong-livestream-ban-hang-158887.html>

### Đối thủ và công cụ tương tự

- Meta Live Shopping Tools ở Việt Nam: ghim sản phẩm lên live Facebook, khách tự bỏ giỏ và thanh toán trong Messenger (qua đối tác Meta) (vua, 4/10/2024 (sự kiện Meta); các trang hướng dẫn không ghi ngày) — <https://www.haravan.com/blogs/su-kien/haravan-tai-su-kien-meta-live-in-action> · <https://www.haravan.com/blogs/su-kien/kham-pha-4-tinh-nang-moi-ho-tro-khach-hang-haravan-ban-hang-livestream-hieu-qua-tai-su-kien-meta-live-in-action> · <https://help.haravan.com/docs/social/content-comments/huong-dan-thiet-lap-tinh-nang-live-shopping-gio-hang-tren-livestream-facebook/> · <https://www.haravan.com/pages/facebook-live-shopping-haravan> · <https://www.sapo.vn/blog/facebook-live-shopping> · <https://docs.pancake.biz/pos/st-f10/st-p2/st-s6?lang=vi> · <https://docs.pos.pages.fm/pos/tinh-nang-nang-cao/kham-pha-san-pham-tren-messenger-2024/5.-mot-so-cau-hoi-thuong-gap>
- Meta 6/2026: quảng cáo video trực tiếp (Live Video Ads) mở cho mọi quốc gia trên Facebook, kèm tab sản phẩm ngay trong buổi live (cao, 17–18/6/2026) — <https://www.socialmediatoday.com/news/meta-updates-its-livestream-shopping-tools/823223/> · <https://www.techwyse.com/news/platform-updates/meta-live-video-ads-instagram-virtual-card-checkout-affiliate-cannes-2026> · <https://hocvien.haravan.com/blogs/facebook/meta-cong-bo-huong-dan-chinh-thuc-ve-dieu-kien-cho-fanpage-chay-quang-cao-livestream>
- Marketing Messages trên Messenger đã có ở Việt Nam: nhắc lịch live và mời khách quay lại đúng luật Meta (cao, FAQ Meta (không ghi ngày); ChatbotX 2026) — <https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/faq> · <https://chatbotx.io/blog/facebook-recurring-notifications-meta-marketing-messages-the-complete-2026-guide-for-businesses/> · <https://docs.pancake.biz/botcake/st-f5/st-p11?lang=vi>
- Nhắn riêng cho người bình luận trên live: công cụ Việt Nam nào cũng làm, Meta giới hạn 1 tin cho mỗi bình luận, trong 7 ngày (vua, Harasocial 15/4/2024; tài liệu Meta không ghi ngày) — <https://developers.facebook.com/docs/messenger-platform/discovery/private-replies/> · <https://hocvien.haravan.com/blogs/livestream/harasocial-cap-nhat-tinh-nang-moi-cua-giai-phap-chot-don-livestream> · <https://www.sapo.vn/blog/cach-tao-don-hang-tu-dong-cho-livestream-ban-hang-tren-facebook> · <https://help.upos.vn/kenh-ban-hang/facebook/cau-hinh-cac-cong-cu-ban-hang-fanpage/kich-ban-gio-hang> · <https://ahachat.com/help/docs/chatbot-chot-don-livestream>
- Giỏ hàng một chạm và trang theo dõi đơn (UPOS, Harasocial, Vpage, CommentSold) (cao, Harasocial 4/2024; các trang khác không ghi ngày) — <https://help.upos.vn/kenh-ban-hang/facebook/cau-hinh-cac-cong-cu-ban-hang-fanpage/kich-ban-gio-hang> · <https://hocvien.haravan.com/blogs/livestream/harasocial-cap-nhat-tinh-nang-moi-cua-giai-phap-chot-don-livestream> · <https://www.haravan.com/pages/phuong-thuc-chot-don-tu-dong-livestream-facebook-cua-harasocial-live> · <https://dangky.nhanh.vn/chot-don-livestream-facebook> · <https://try.commentsold.com/features/comment-selling/>
- Danh sách chờ khi hết hàng và tự giữ hàng khi nhập về (CommentSold) (cao, Trendsi 19/2/2024; trang CommentSold không ghi ngày) — <https://try.commentsold.com/features/comment-selling/> · <https://www.trendsi.com/blog/business-tips/how-does-commentsold-work/> · <https://www.capterra.com/p/177331/CommentSold/>
- Công cụ tạo 'cơn sốt' trong live: flash sale đếm ngược, phiếu giảm giá chỉ trong live, tặng quà (TikTok Shop, Shopee, Whatnot, Terrific) (cao, TikTok và Whatnot 2026; Shopee bài cập nhật 2026) — <https://seller-us.tiktok.com/university/essay?knowledge_id=6810061071615758&lang=en> · <https://seller-sg.tiktok.com/university/essay?knowledge_id=8301325390120705&default_language=en> · <https://shopee.vn/blog/cach-livestream-tren-shopee/> · <https://sellertivity.com/blogs/news/whatnot-launches-live-analytics-and-new-tools-for-sellers> · <https://selleracademy.whatnot.com/guide> · <https://getstream.io/blog/live-selling-platforms/> · <https://www.terrificlive.com/enterprise>
- Giá riêng cho từng buổi live (Pancake) (vua, không ghi ngày) — <https://docs.pancake.biz/pos/st-f11/st-p9?lang=vi> · <https://help.upos.vn/kenh-ban-hang/facebook/cau-hinh-cac-cong-cu-ban-hang-fanpage/kich-ban-livestream> · <https://hocvien.haravan.com/blogs/livestream/harasocial-cap-nhat-tinh-nang-moi-cua-giai-phap-chot-don-livestream>
- Mini game và vòng quay trong live của các công cụ Việt Nam (chotdon.vn, GoStream, Livestream Pro) (vua, GHN cập nhật 30/3/2026; chotdon không ghi ngày) — <https://chotdon.vn/tinh-nang-tao-mini-game> · <https://ghn.vn/blogs/tip-ban-hang/phan-mem-chot-don-livestream> · <https://vpage.nhanh.vn/blog/top-9-phan-mem-chot-don-livestream-tu-dong-tot-nhat-a94.html>
- Tự cắt clip nổi bật sau live và bán tiếp trên video phát lại (TikTok Shop, Shopee, Harasocial, Sapo) (vua, TikTok 2026; Harasocial không ghi ngày) — <https://almcorp.com/blog/tiktok-shop-ai-seller-tools-chatbot-live-stream-automation/> · <https://help.haravan.com/docs/livestream/order-methods/phuong-thuc-chot-don-sau-phien-live/> · <https://www.sapo.vn/blog/cach-tao-don-hang-tu-dong-cho-livestream-ban-hang-tren-facebook> · <https://www.terrificlive.com/post/live-shopping-2026-guide-for-ecommerce-brands> · <https://software-listing.com/blog/ai-livestream-commerce-sea-sellers-2026>
- Nhận ra khách quen / khách mới và bảng số liệu ngay trong lúc live (Whatnot 9/2026, CommentSold, Sapo) (cao, 9/2026 (Whatnot)) — <https://sellertivity.com/blogs/news/whatnot-launches-live-analytics-and-new-tools-for-sellers> · <https://www.trendsi.com/blog/business-tips/how-does-commentsold-work/> · <https://www.sapo.vn/phan-mem-ban-hang-livestream.html>
- Điểm thưởng khi xem và 'Jumbotron' vinh danh tên người mua (Whatnot), Xu cho người xem (Shopee) (vua, 9/2026) — <https://sellertivity.com/blogs/news/whatnot-launches-live-analytics-and-new-tools-for-sellers> · <https://shopee.vn/blog/cach-livestream-tren-shopee/>
- Live đều đặn quan trọng nhất: số liệu báo cáo Whatnot 2026 và lời khuyên lên lịch trước 1 tuần (cao, 2026) — <https://blog.teamwhatnot.com/unitedstates/2026livesellingreport> · <https://selleracademy.whatnot.com/guide>
- AI dẫn live ở Trung Quốc và Đông Nam Á: AI dẫn khung giờ vắng, người thật dẫn giờ vàng, phải có nhãn AI và người trực (vua, 3–6/2026) — <https://insight.xiaoduoai.com/e-commerce-information/douyin-information/douyin-ai-anchor-helps-you-sell-goods-in-the-middle-of-the-night-the-real-person-not-violating-rules-gameplay-of-digital-human-live-streaming-in-2026.html> · <https://www.flowpixai.com/tutorials/ai-digital-human-livestream-advanced-2026.html> · <https://genpio.com/platforms/shopee> · <https://soha.vn/tu-2200-dong-phut-ai-streamer-ao-dang-vat-kiet-18-tieng-traffic-chet-de-doa-nhan-su-nghe-livestream-198260325203949731.htm> · <https://finance.yahoo.com/news/sea-tests-ai-celebrity-live-191350855.html>
- Trợ lý nhắc bài cho người dẫn (Terrific Host Buddy) và công cụ điều khiển live kiểu Trung Quốc (tự bật sản phẩm, tự bình luận) (vua, Vpage 28/8/2024; Terrific 2026) — <https://www.terrificlive.com/enterprise> · <https://getstream.io/blog/live-selling-platforms/> · <https://github.com/qiutongxue/oba-live-tool> · <https://nhanh.vn/nang-cap-vpage-dieu-khien-chot-don-tren-livestream-an822.html>
- Nối hãng vận chuyển và in ấn là chuẩn chung ở Việt Nam (Sapo, Pancake, Harasocial, KiotViet, UPOS) (cao, Sapo 5/3/2025; Pancake 24/6/2026) — <https://www.sapo.vn/blog/tinh-nang-ho-tro-livestream-tren-sapo-go> · <https://www.sapo.vn/phan-mem-ban-hang-livestream.html> · <https://tanhungha.com.vn/pancake-pos-la-gi-n2250.html> · <https://www.haravan.com/pages/phan-mem-ban-hang-livestream> · <https://ghn.vn/blogs/tip-ban-hang/phan-mem-chot-don-livestream>
- Thanh toán: mã QR chuyển khoản trong giỏ và đối soát (Vpage, Sapo, Harasocial) (vua, không ghi ngày) — <https://dangky.nhanh.vn/vpage-nhanhvn> · <https://dangky.nhanh.vn/chot-don-livestream-facebook> · <https://help.sapo.vn/tao-kich-ban-chot-don-livestream> · <https://www.haravan.com/pages/phuong-thuc-chot-don-tu-dong-livestream-facebook-cua-harasocial-live>
- AI chat của đối thủ: Botcake AI Agent, Sapo OmniAI, Smax, Harasocial AI 24/7, TikTok Seller Assistant và CRM (cao, TikTok 19/1/2026; Botcake và Sapo không ghi ngày) — <https://botcake.io/features/botcake-ai-agent> · <https://docs.pancake.biz/botcake/st-f4/st-p5/st-s1/st-ss2?lang=vi> · <https://www.sapo.vn/omniai.html> · <https://smax.ai/vi/Pricing/> · <https://www.mediapost.com/publications/article/412106/tiktok-shop-offers-merchants-more-ai-powered-tools.html> · <https://almcorp.com/blog/tiktok-shop-ai-seller-tools-chatbot-live-stream-automation/>
- Chống spam, bảo vệ dữ liệu và chống trùng trên bình luận live (KiotViet, Sapo, UPOS, Harasocial) và điều cần tránh (Fchat) (vua, Harasocial 15/4/2024; GHN cập nhật 30/3/2026) — <https://ghn.vn/blogs/tip-ban-hang/phan-mem-chot-don-livestream> · <https://www.sapo.vn/phan-mem-ban-hang-livestream.html> · <https://hocvien.haravan.com/blogs/livestream/harasocial-cap-nhat-tinh-nang-moi-cua-giai-phap-chot-don-livestream> · <https://help.upos.vn/kenh-ban-hang/facebook/cau-hinh-cac-cong-cu-ban-hang-fanpage/kich-ban-livestream>
- Phản hồi người dùng thật: nhanh và ổn định quan trọng hơn nhiều tính năng (vua, Vpage 13/3/2026; Capterra 2026) — <https://www.capterra.com/p/177331/CommentSold/> · <https://apps.apple.com/vn/app/sapo-chat-omniai/id6743422741?l=vi> · <https://vpage.nhanh.vn/blog/livestream-nhieu-nguoi-hoi-1-san-pham-chot-sao-cho-nhanh--a453.html>
- Bảng giá tham khảo các công cụ chốt đơn live (để định vị nếu Moza bán cho shop khác) (vua, 2024–2026) — <https://www.sapo.vn/phan-mem-ban-hang-livestream.html> · <https://tanhungha.com.vn/pancake-pos-la-gi-n2250.html> · <https://www.haravan.com/pages/phuong-thuc-chot-don-tu-dong-livestream-facebook-cua-harasocial-live> · <https://ghn.vn/blogs/tip-ban-hang/phan-mem-chot-don-livestream> · <https://smax.ai/vi/Pricing/> · <https://www.capterra.com/p/177331/CommentSold/>
- BẢNG KHOẢNG TRỐNG: tính năng đối thủ có mà Moza chưa có, và chỗ Moza mạnh hơn (vua, tổng hợp tới 27/9/2026) — <https://blog.teamwhatnot.com/unitedstates/2026livesellingreport> · <https://seller-us.tiktok.com/university/essay?knowledge_id=6810061071615758&lang=en> · <https://help.haravan.com/docs/social/content-comments/huong-dan-thiet-lap-tinh-nang-live-shopping-gio-hang-tren-livestream-facebook/> · <https://try.commentsold.com/features/comment-selling/> · <https://www.sapo.vn/blog/tinh-nang-ho-tro-livestream-tren-sapo-go> · <https://sellertivity.com/blogs/news/whatnot-launches-live-analytics-and-new-tools-for-sellers> · <https://chotdon.vn/tinh-nang-tao-mini-game> · <https://docs.pancake.biz/pos/st-f11/st-p9?lang=vi>

### Pháp lý Việt Nam 2026

- Luật TMĐT 122/2025/QH15 áp dụng cho livestream trên Facebook; chủ shop là 'người bán', người lên sóng là 'người livestream bán hàng' (cao) — <https://luatvietnam.vn/thuong-mai/luat-thuong-mai-dien-tu-cua-quoc-hoi-so-122-2025-qh15-423356-d1.html> · <https://b-company.jp/vietnams-new-e-commerce-law-122-2025-qh15-key-provisions-and-implications/> · <https://baochinhphu.vn/phai-cong-khai-quy-che-livestream-ban-hang-tren-nen-tang-thuong-mai-dien-tu-10226070417072736.htm> · <https://luatvietnam.vn/tin-van-ban-moi/shopee-tiktok-phai-ban-hanh-quy-che-rieng-ve-livestream-ban-hang-186-110113-article.html> · <https://baotintuc.vn/chinh-sach-va-cuoc-song/phai-cong-khai-quy-che-livestream-ban-hang-tren-nen-tang-thuong-mai-dien-tu-20260704215331279.htm> · <https://www.vietnam.vn/xac-thuc-danh-tinh-nguoi-ban-siet-chat-quan-ly-livestream>
- Điều 23 và 24: người livestream chịu trách nhiệm về lời nói trên sóng, kể cả khi AI nói (cao, 14/01/2026; 02/06/2026; 27/07/2026) — <https://tapchikinhtetaichinh.vn/bay-trach-nhiem-cua-nguoi-livestream-ban-hang-tu-ngay-172026-157729.html> · <https://lsvn.vn/trach-nhiem-nguoi-livestream-ban-hang-phai-tuan-thu-a168346.html> · <https://luatvietnam.vn/linh-vuc-khac/tu-2026-nguoi-livestream-ban-hang-tren-mang-can-luu-y-nhung-gi-883-106747-article.html> · <https://diendandoanhnghiep.vn/livestream-ban-hang-luat-da-truy-trach-nhiem-den-tung-mat-xich-10182512.html> · <https://dantri.com.vn/phap-luat/siet-livestream-ban-hang-chan-tai-khoan-ao-va-quang-cao-sai-su-that-20260727000532892.htm>
- Lưu trữ buổi live: Facebook phải giữ ít nhất 1 năm; shop nên tự giữ nhật ký làm bằng chứng (cao) — <https://luatvietnam.vn/thuong-mai/luat-thuong-mai-dien-tu-cua-quoc-hoi-so-122-2025-qh15-423356-d1.html> · <https://luatvietnam.vn/linh-vuc-khac/tu-2026-nguoi-livestream-ban-hang-tren-mang-can-luu-y-nhung-gi-883-106747-article.html> · <https://b-company.jp/vietnams-new-e-commerce-law-122-2025-qh15-key-provisions-and-implications/>
- Người dẫn là AI hoặc người ảo: luật TMĐT chưa có điều riêng, đây là vùng xám cần luật sư (vua) — <https://nghiencuu.tapchikinhtetaichinh.vn/luat-thuong-mai-dien-tu-2025-khung-phap-ly-moi-cho-livestream-ban-hang-va-tiep-thi-lien-ket-157230.html> · <https://b-company.jp/vietnams-new-e-commerce-law-122-2025-qh15-key-provisions-and-implications/> · <https://baotintuc.vn/chinh-sach-va-cuoc-song/phai-cong-khai-quy-che-livestream-ban-hang-tren-nen-tang-thuong-mai-dien-tu-20260704215331279.htm>
- Luật Trí tuệ nhân tạo 134/2025/QH15 (hiệu lực 1/3/2026): phải cho người dùng biết đang nói chuyện với AI; cấm deepfake lừa dối (cao, 21/11/2025 (dự thảo); 04/01/2026; 12/02/2026) — <https://www.allenandgledhill.com/vn/publication/articles/32667/s-new-law-on-artificial-intelligence-risk-based-regulatory-framework-in-force-1-march-2026> · <https://xaydungchinhsach.chinhphu.vn/nhung-noi-dung-dang-chu-y-cua-luat-tri-tue-nhan-tao-119260212091614393.htm> · <https://luatvietnam.vn/linh-vuc-khac/tai-luat-tri-tue-nhan-tao-2025-so-134-2025-qh15-186-106136-article.html> · <https://vietbao.vn/luu-y-4-diem-khong-the-bo-qua-cua-luat-tri-tue-nhan-tao-sap-co-hieu-luc-578375.html> · <https://tuoitre.vn/lan-dau-trinh-quoc-hoi-luat-ve-tri-tue-nhan-tao-phat-toi-da-2-ti-dong-hanh-vi-vi-pham-ve-ai-20251121085727822.htm>
- Nghị định 142/2026/NĐ-CP (30/4/2026, hiệu lực 1/5/2026): mức rủi ro trung bình, gắn nhãn nội dung mô phỏng người thật, báo cáo sự cố (vua, 30/04/2026 (ban hành); 11/05/2026; 28/05/2026) — <https://vanban.chinhphu.vn/?pageid=27160&docid=218029> · <https://www.aplawjapan.com/en/newsletter/20260528-2> · <https://luatvietan.vn/nghi-dinh-142-2026-nd-cp-huong-dan-luat-tri-tue-nhan-tao.html> · <https://luatvietnam.vn/tin-van-ban-moi/2-truong-hop-noi-dung-do-ai-tao-ra-bat-buoc-phai-gan-nhan-tu-01-5-2026-186-108836-article.html> · <https://luatvietnam.vn/tin-van-ban-moi/tu-01-5-2026-noi-dung-ai-gia-giong-noi-hinh-anh-nguoi-that-phai-gan-nhan-186-108844-article.html> · <https://tuoitre.vn/plo/ai-phai-gan-nhan-nhan-biet-noi-dung-do-ai-tao-ra-post907652.html> · <https://khpl.moj.gov.vn/portal/tin-tuc/chi-tiet/gioi-thieu-nghi-inh-so-1422026n-cp-quy-inh-chi-tiet-mot-so-ieu-va-bien-phap-thi-hanh-luat-tri-tue-nhan-tao-th2pbneb5f.html> · <https://thanhtra.com.vn/chuyen-doi-so-DFC98D38D/nhung-diem-moi-dang-chu-y-cua-nghi-dinh-142-huong-dan-thi-hanh-luat-tri-tue-nhan-tao-5c80c26df.html>
- Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025 (hiệu lực 1/1/2026): xin địa chỉ để giao hàng được, nhắn tiếp thị lại phải xin đồng ý riêng (cao, 08/02/2026 (VOH); 03/2026 (EY)) — <https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html> · <https://gvlawyers.com.vn/luat-bao-ve-du-lieu-ca-nhan-2026/> · <https://mps.gov.vn/chinh-sach-phap-luat/bai-viet/mot-so-quy-dinh-dang-chu-y-trong-luat-bao-ve-du-lieu-ca-nhan-2025-1753847906> · <https://voh.com.vn/phap-luat/co-duoc-su-dung-du-lieu-khach-hang-de-quang-cao-tiep-thi-lai-khong-645977.html> · <https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-so-356-2025-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-va-bien-phap-thi-hanh-luat-bao-ve-du-lieu-ca-nhan>
- Dữ liệu nhạy cảm theo Nghị định 356 có 'hành vi trên không gian mạng'; hộ kinh doanh được miễn hồ sơ đánh giá tác động nhưng có ngoại lệ (vua) — <https://doanhnghiephoinhap.vn/13-nhom-du-lieu-ca-nhan-nhay-cam-phai-duoc-bao-ve-tu-nam-2026-149766.html> · <https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html> · <https://luatvietnam.vn/linh-vuc-khac/doanh-nghiep-nao-khong-phai-danh-gia-tac-dong-xu-ly-du-lieu-ca-nhan-883-106494-article.html> · <https://luatvietnam.vn/doanh-nghiep/doanh-nghiep-can-biet-gi-ve-bao-ve-du-lieu-ca-nhan-tai-nghi-dinh-356-2025-nd-cp-561-109567-article.html> · <https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-so-356-2025-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-va-bien-phap-thi-hanh-luat-bao-ve-du-lieu-ca-nhan>
- Gửi dữ liệu khách cho OpenAI/Google ở nước ngoài có thể là 'chuyển dữ liệu xuyên biên giới', phải lập hồ sơ trong 60 ngày (vua) — <https://lsvn.vn/dieu-kien-chuyen-du-lieu-ca-nhan-xuyen-bien-gioi-tu-2026-a162689.html> · <https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html> · <https://gvlawyers.com.vn/luat-bao-ve-du-lieu-ca-nhan-2026/>
- Thử đồ ảo và dùng ảnh hoặc giọng người thật: cần đồng ý và gắn nhãn (vua) — <https://luatvietnam.vn/tin-van-ban-moi/2-truong-hop-noi-dung-do-ai-tao-ra-bat-buoc-phai-gan-nhan-tu-01-5-2026-186-108836-article.html> · <https://vietbao.vn/luu-y-4-diem-khong-the-bo-qua-cua-luat-tri-tue-nhan-tao-sap-co-hieu-luc-578375.html> · <https://lsvn.vn/dieu-kien-chuyen-du-lieu-ca-nhan-xuyen-bien-gioi-tu-2026-a162689.html>
- Khuyến mại: Nghị định 239/2026 (26/6/2026) nới lỏng giảm giá; quay số trúng thưởng gắn mua hàng vẫn phải đăng ký (vua, 26/06/2026 (Nghị định 239); 27/06/2026; 07/2026 (KPMG)) — <https://kpmg.com/vn/vi/insights/2026/07/decree-239-on-sales-promotion.html> · <https://luatvietnam.vn/doanh-nghiep/diem-moi-ve-xuc-tien-thuong-mai-tai-nghi-dinh-239-2026-nd-cp-561-111132-article.html> · <https://baophapluat.vn/sua-doi-bo-sung-mot-so-quy-dinh-ve-hoat-dong-khuyen-mai.html> · <https://phapluatplus.baophapluat.vn/chinh-phu-sua-quy-dinh-ve-khuyen-mai-cho-phep-quay-so-trung-thuong-truc-tuyen.html> · <https://www.vietnamplus.vn/sua-doi-bo-sung-mot-so-quy-dinh-ve-hoat-dong-khuyen-mai-post1120746.vnp> · <https://luatvietan.vn/nghi-dinh-128-2024-nd-cp-cap-nhat-quy-dinh-moi-ve-hoat-dong-khuyen-mai.html> · <https://luatvietnam.vn/linh-vuc-khac/diem-moi-cua-nghi-dinh-128-2024-nd-cp-ve-hoat-dong-khuyen-mai-883-99501-article.html> · <https://luatvietan.vn/thu-tuc-dang-ky-khuyen-mai-tai-so-cong-thuong.html> · <https://luatvietnam.vn/linh-vuc-khac/khuyen-mai-duoi-100-trieu-co-phai-dang-ky-khong-883-97383-article.html> · <https://ltvlaw.com/tin-tuc/dang-ky-khuyen-mai>
- Khan hiếm giả, đếm ngược, giá gốc ảo: bị cấm vì là thông tin gây nhầm lẫn về giá và khuyến mại (cao, 14/05/2026; 02/06/2026) — <https://tapchikinhtetaichinh.vn/bay-trach-nhiem-cua-nguoi-livestream-ban-hang-tu-ngay-172026-157729.html> · <https://luatvietnam.vn/thuong-mai/luat-thuong-mai-dien-tu-cua-quoc-hoi-so-122-2025-qh15-423356-d1.html> · <https://tapchitoaan.vn/mot-so-diem-moi-dang-chu-y-cua-luat-quang-cao-sua-doi-bo-sung-nam-202515012.html> · <https://congan.tayninh.gov.vn/vi/chi-tiet-tin-tuc?Id=268537>
- Quảng cáo và KOL/tiếp thị liên kết: Luật Quảng cáo 75/2025/QH15 (hiệu lực 1/1/2026) (vua) — <https://tapchitoaan.vn/mot-so-diem-moi-dang-chu-y-cua-luat-quang-cao-sua-doi-bo-sung-nam-202515012.html> · <https://vietnamnet.vn/en/from-2026-influencers-must-verify-products-before-promoting-2468764.html> · <https://www.vietnam.vn/xac-thuc-danh-tinh-nguoi-ban-siet-chat-quan-ly-livestream>
- Gọi điện và nhắn tin quảng cáo: Nghị định 330/2026 (hiệu lực 19/8/2026); dự thảo mới (9/2026) muốn áp dụng cho ứng dụng OTT (vua, 19/08/2026 (hiệu lực Nghị định 330); 09/09/2026 và 22/09/2026 (dự thảo)) — <https://luatvietnam.vn/tin-van-ban-moi/tu-19-8-2026-phat-den-100-trieu-dong-neu-goi-dien-quang-cao-ngoai-khung-8h-17h-186-111899-article.html> · <https://doanhnghiephoinhap.vn/du-thao-nghi-dinh-chong-tin-nhan-rac-cuoc-goi-rac-nhung-diem-moi-doanh-nghiep-va-nguoi-dan-can-luu-y-149589.html> · <https://xaydungchinhsach.chinhphu.vn/de-xuat-cac-bien-phap-chong-ngan-chan-tin-nhan-rac-thu-dien-tu-rac-cuoc-goi-rac-119260909163123265.htm>
- Thuế 2026: bỏ thuế khoán; không phải nộp GTGT, TNCN nếu doanh thu dưới 1 tỷ/năm; vượt 1 tỷ phải dùng hóa đơn điện tử; bán qua Facebook thì tự kê khai (cao, 11/12/2025 (VnExpress); 29/04/2026 và 04/05/2026 (Nghị định 141)) — <https://baochinhphu.vn/chinh-thuc-nang-nguong-chiu-thue-voi-ho-kinh-doanh-len-01-ty-dong-nam-ap-dung-tu-1-1-2026-102260429185517215.htm> · <https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-so-141-2026-nd-cp-nang-nguong-doanh-thu-khong-phai-chiu-thue-len-1-ty-dong-119260504154326455.htm> · <https://vnexpress.net/bo-thue-khoan-ho-kinh-doanh-tinh-thue-the-nao-tu-2026-4992081.html> · <https://vnexpress.net/tu-2026-ban-hang-online-tren-san-phai-nop-thue-the-nao-4996139.html> · <https://vietnamnet.vn/ho-kinh-doanh-su-dung-hoa-don-dien-tu-ke-khai-thue-ra-sao-tu-nam-2026-2470000.html>
