import { network } from 'hardhat';
import { readFile } from 'node:fs/promises';

const { ethers } = await network.create();
const { contractAddress, chainId } = JSON.parse(await readFile('public/deployment.json', 'utf8'));
if (chainId !== 31337 || (await ethers.provider.getNetwork()).chainId !== 31337n) throw new Error('Chỉ dùng cho demo local.');
const social = await ethers.getContractAt('MachSocial', contractAddress);
if (await social.postCount() > 0n) { console.log('Đã có bài viết. Bỏ qua seed để không tạo trùng.'); process.exit(0); }
const wallets = await ethers.getSigners();
const samples = [
  { title: 'Xin chào Lson. Một không gian mới cho những ý tưởng.', content: 'Mình tin rằng những điều có giá trị xứng đáng được lan tỏa. Một bài viết, một góc nhìn, một cuộc kết nối — tất cả bắt đầu từ việc chia sẻ.\n\nĐây là bài viết đầu tiên trên Lson. Nội dung được lưu trên IPFS, còn quyền tác giả và lượt thích được ghi nhận bằng smart contract. Chào mừng bạn đến với một góc nhỏ của Web3!', likes: 4 },
  { title: 'IPFS lưu một bài viết như thế nào?', content: 'Thay vì hỏi “tệp nằm ở máy chủ nào?”, IPFS hỏi “nội dung này là gì?”. Mỗi bài viết có một mã CID được tạo từ nội dung. Thay đổi một chữ, CID cũng thay đổi.\n\nTrong đồ án này, tiêu đề và nội dung nằm trong một tệp JSON trên IPFS. Smart contract chỉ lưu CID cùng địa chỉ tác giả. Nhẹ hơn cho blockchain và dễ kiểm tra hơn cho mọi người.\n\nLưu ý: cần pin nội dung và giữ node hoạt động để đảm bảo khả năng truy xuất.', likes: 5 },
  { title: '5 lượt thích. Một lời cảm ơn từ cộng đồng.', content: 'Điều mình thích ở dự án này là phần thưởng đến trực tiếp từ những tương tác của cộng đồng. Khi một bài viết chạm mốc 5 lượt thích hợp lệ, tác giả nhận 10 LSON thử nghiệm.\n\nMỗi ví chỉ được thích một lần và không thể tự thích bài của chính mình. Đây là quy tắc theo địa chỉ ví, chưa ngăn được một người tạo nhiều ví — một giới hạn cần nói rõ khi thuyết trình.', likes: 2 },
];
for (let i = 0; i < samples.length; ++i) {
  const { title, content, likes } = samples[i];
  const response = await fetch('http://127.0.0.1:3001/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  await (await social.connect(wallets[i]).getFunction('createPost')(data.cid)).wait();
  for (let j = 0; j < likes; ++j) await (await social.connect(wallets[j + 6]).getFunction('likePost')(i + 1)).wait();
}
console.log('Đã thêm 3 bài lên IPFS + blockchain. Bài #1 có 4 like để demo like thứ 5; bài #2 đã nhận 10 LSON.');
