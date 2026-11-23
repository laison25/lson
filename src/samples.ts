import type { Post } from './chain';

// Visual examples only: these are never passed to a contract or treated as live data.
export const samples: Post[] = [
  { id: 3, author: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', cid: '', createdAt: 0, likes: 2, rewarded: false, liked: false,
    title: '5 lượt thích. Một lời cảm ơn từ cộng đồng.',
    content: 'Một ý tưởng hay có thể bắt đầu từ bất kỳ ai. Và đôi khi, một lượt thích là tất cả những gì cần để ý tưởng ấy đi xa hơn.\n\nTrên Lson, bài viết đạt 5 lượt thích hợp lệ sẽ nhận 10 LSON thử nghiệm. Cùng chia sẻ điều bạn biết, điều bạn nghĩ, hay một điều nhỏ vừa khiến bạn tò mò.' },
  { id: 2, author: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', cid: '', createdAt: 0, likes: 5, rewarded: true, liked: false,
    title: 'Điều gì xảy ra khi bài viết thuộc về chính bạn?',
    content: 'Không cần một tài khoản mới. Chỉ cần chiếc ví của bạn.\n\nNội dung nằm trên IPFS. Quyền tác giả được ghi nhận trên blockchain. Một cách khác để chúng ta cùng viết nên internet — cởi mở hơn, minh bạch hơn, và bắt đầu từ những kết nối thật.' },
  { id: 1, author: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', cid: '', createdAt: 0, likes: 4, rewarded: false, liked: false,
    title: 'Xin chào Lson. Hãy bắt đầu từ một điều bạn muốn chia sẻ.',
    content: 'Một góc nhìn mới. Một điều vừa học được. Hay câu chuyện bạn vẫn muốn kể.\n\nĐây là không gian dành cho những ý tưởng được nuôi lớn bởi cộng đồng. Chào mừng bạn đến với Lson.' },
];
