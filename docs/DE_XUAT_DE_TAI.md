# Đề xuất đề tài đồ án

**Tên đề tài:** Xây dựng mạng xã hội phi tập trung tích hợp Smart Contract thưởng token cho bài viết.

## Mô tả

Xây dựng website mạng xã hội đơn giản ứng dụng công nghệ Blockchain, cho phép người dùng kết nối ví MetaMask, đăng bài, xem và thích bài viết. Tiêu đề và nội dung bài được lưu trữ trên IPFS; smart contract Solidity lưu mã CID, địa chỉ tác giả, thời điểm đăng, lượt thích và trạng thái nhận thưởng. Khi một bài viết đạt 5 lượt thích hợp lệ từ các địa chỉ ví khác nhau, hợp đồng tự động cấp 10 token LSON thử nghiệm cho tác giả. Địa chỉ ví được sử dụng làm định danh tài khoản trong hệ thống.

## Mục tiêu

Triển khai được luồng hoàn chỉnh: kết nối ví → lưu nội dung lên IPFS → đăng bài bằng giao dịch blockchain → like bài → nhận token thử nghiệm tự động. Thể hiện sự phối hợp giữa giao diện web, ví điện tử, smart contract và lưu trữ theo địa chỉ nội dung.

## Phạm vi chức năng

| Chức năng | Kết quả dự kiến |
| --- | --- |
| Kết nối MetaMask | Hiển thị địa chỉ ví; nhận biết thay đổi tài khoản và mạng |
| Đăng bài | Nhập tiêu đề, nội dung; lưu JSON trên IPFS và ghi CID vào hợp đồng |
| Xem bài viết | Hiển thị danh sách bài viết cộng đồng và nội dung truy xuất từ IPFS |
| Like bài viết | Một địa chỉ chỉ like mỗi bài một lần; tác giả không tự like |
| Thưởng token | Like hợp lệ thứ 5 tự động cấp 10 LSON; mỗi bài chỉ thưởng một lần |

## Giao diện

1. **Trang chủ:** danh sách bài viết, thông tin tác giả, số like, trạng thái thưởng và nút Like.
2. **Trang đăng bài:** nhập tiêu đề/nội dung, xem trước, lưu bản nháp và xác nhận đăng qua MetaMask.
3. **Trang cá nhân:** địa chỉ ví, bài viết do ví đăng, tổng token đã được thưởng và số dư hiện tại.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Giao diện | React, TypeScript, Vite |
| Giao tiếp blockchain | ethers.js |
| Hợp đồng | Solidity, OpenZeppelin ERC-20 |
| Môi trường blockchain | Hardhat Local |
| Lưu nội dung | IPFS Kubo |
| Ví | MetaMask |
| API hỗ trợ IPFS | Node.js, Express |

## Tiêu chí nghiệm thu

- Ví kết nối được và hệ thống nhận đúng địa chỉ tài khoản đang chọn.
- Bài đăng có CID truy xuất được đúng nội dung trên IPFS; địa chỉ tác giả đúng với người gửi giao dịch.
- Ví tác giả tự like và ví like trùng đều bị smart contract từ chối.
- Tác giả chưa nhận thưởng ở 4 like; nhận chính xác 10 LSON ở like thứ 5.
- Like thứ 6 trở đi không phát sinh thưởng lần hai cho cùng bài.
- Trang cá nhân cập nhật bài đăng và số dư từ blockchain.
- Có kiểm thử hợp đồng, kiểm thử tích hợp và hướng dẫn chạy demo.

## Giới hạn

Kết nối MetaMask và chữ ký giao dịch xác nhận quyền sử dụng ví, không xác minh danh tính thật. Quy tắc theo địa chỉ ví chưa ngăn một người tạo nhiều ví để tự tạo tương tác. Token dùng cho thử nghiệm, không có giá trị tiền tệ. IPFS cần pin và node hoạt động để đảm bảo truy xuất. Bản đồ án chưa có Lens Protocol, SIWE, xác minh danh tính, sửa/xóa bài hoặc cơ chế quản trị nội dung.

Nếu giảng viên yêu cầu Lens Protocol hoặc xác minh danh tính thật, cần xác nhận thêm tiêu chí và mở rộng thiết kế, kế hoạch triển khai và kiểm thử cho các phần đó.

## Sản phẩm bàn giao

Mã nguồn ba trang web, smart contract và token ERC-20; bộ kiểm thử; dữ liệu seed; hướng dẫn khởi động; kịch bản trình diễn. Phạm vi được giới hạn để phù hợp đồ án sinh viên và tập trung vào luồng Blockchain có thể kiểm chứng.
