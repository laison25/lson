import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from 'ethers';

export const SOCIAL_ABI = [
  'function postCount() view returns (uint256)',
  'function getPosts(uint256 offset, uint256 limit) view returns (tuple(uint256 id,address author,string cid,uint256 createdAt,uint256 likes,bool rewarded)[])',
  'function getAuthorPosts(address author,uint256 offset,uint256 limit) view returns (tuple(uint256 id,address author,string cid,uint256 createdAt,uint256 likes,bool rewarded)[])',
  'function authorPostCount(address author) view returns (uint256)',
  'function hasLiked(uint256,address) view returns (bool)',
  'function rewardsEarned(address) view returns (uint256)',
  'function createPost(string cid) returns (uint256)',
  'function likePost(uint256 id)',
  'error SelfLike()', 'error AlreadyLiked()', 'error PostNotFound()', 'error InvalidCID()',
];
export const TOKEN_ABI = ['function balanceOf(address) view returns (uint256)'];
export const SAMPLE_ONLY = import.meta.env.VITE_SAMPLE_ONLY === 'true';
export const rpc = new JsonRpcProvider(`${location.origin}/api/rpc`, 31337, { staticNetwork: true });

export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  providers?: WalletProvider[];
};
declare global { interface Window { ethereum?: WalletProvider } }
export const walletProvider = () => window.ethereum?.providers?.find(p => p.isMetaMask) ?? window.ethereum;
export type Deployment = { chainId: number; contractAddress: string; tokenAddress: string; blockNumber: number; blockHash: string };
export type Post = { id: number; author: string; cid: string; createdAt: number; likes: number; rewarded: boolean; liked: boolean; title: string; content: string; unavailable?: boolean };
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const tokenAmount = (amount: bigint) => Number(formatEther(amount)).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export async function loadDeployment(): Promise<Deployment> {
  if (SAMPLE_ONLY) throw new Error('Bản online dùng để xem giao diện. Chạy dự án cục bộ theo README để tương tác với blockchain.');
  const response = await fetch('/deployment.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Chưa triển khai hợp đồng. Chạy pnpm deploy.');
  const config = await response.json();
  if (config.chainId !== 31337 || !/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress) || !/^0x[0-9a-fA-F]{40}$/.test(config.tokenAddress)) throw new Error('Cấu hình triển khai không hợp lệ.');
  const [code, block] = await Promise.all([rpc.getCode(config.contractAddress), rpc.getBlock(config.blockNumber)]);
  if (code === '0x' || block?.hash !== config.blockHash) throw new Error('Blockchain đã khởi động lại. Chạy pnpm deploy để cập nhật hợp đồng.');
  return config;
}

const contentCache = new Map<string, { title: string; content: string }>();
export async function readContent(cid: string) {
  if (contentCache.has(cid)) return contentCache.get(cid)!;
  const response = await fetch(`/api/ipfs/${encodeURIComponent(cid)}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Không đọc được IPFS.');
  const data = await response.json();
  if (typeof data.title !== 'string' || typeof data.content !== 'string') throw new Error('Nội dung không hợp lệ.');
  contentCache.set(cid, data);
  return data as { title: string; content: string };
}

export async function hydratePosts(rows: any[], social: Contract, account: string): Promise<Post[]> {
  return Promise.all(rows.map(async row => {
    const [text, liked] = await Promise.all([
      readContent(row.cid).catch(() => ({ title: 'Nội dung IPFS tạm thời chưa khả dụng', content: 'Thông tin bài viết vẫn được xác nhận trên blockchain. Bật IPFS rồi bấm Làm mới để đọc lại.', unavailable: true })),
      account ? social.hasLiked(row.id, account) : false,
    ]);
    return { id: Number(row.id), author: row.author, cid: row.cid, createdAt: Number(row.createdAt), likes: Number(row.likes), rewarded: row.rewarded, liked, ...text };
  }));
}

export async function writer(config: Deployment, account: string) {
  const current = await loadDeployment();
  if (current.blockHash !== config.blockHash || current.contractAddress !== config.contractAddress) throw new Error('Hợp đồng đã thay đổi. Làm mới trang trước khi giao dịch.');
  const injected = walletProvider();
  if (!injected) throw new Error('Cài MetaMask để tiếp tục.');
  const [chainId, accounts] = await Promise.all([injected.request({ method: 'eth_chainId' }), injected.request({ method: 'eth_accounts' })]);
  if (Number(chainId) !== 31337) throw new Error('Chuyển ví sang Hardhat Local trước khi giao dịch.');
  if (!accounts[0] || accounts[0].toLowerCase() !== account.toLowerCase()) throw new Error('Ví đã thay đổi. Kiểm tra tài khoản rồi thử lại.');
  const provider = new BrowserProvider(injected);
  const signer = await provider.getSigner(account);
  return new Contract(config.contractAddress, SOCIAL_ABI, signer);
}

export function friendlyError(error: any): string {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return 'Bạn đã từ chối yêu cầu trong ví. Có thể thử lại khi sẵn sàng.';
  if (error?.code === -32002) return 'Có yêu cầu đang chờ trong MetaMask. Mở ví để xử lý.';
  const text = `${error?.shortMessage ?? ''} ${error?.message ?? ''}`;
  if (/AlreadyLiked/.test(text)) return 'Ví này đã thích bài viết.';
  if (/SelfLike/.test(text)) return 'Bạn không thể thích bài viết của chính mình.';
  if (/insufficient funds/i.test(text)) return 'Ví chưa có ETH thử nghiệm để trả phí. Nhập một tài khoản Hardhat để demo.';
  if (/user rejected|user denied/i.test(text)) return 'Bạn đã từ chối yêu cầu trong ví.';
  if (/fetch|network|connect|ECONNREFUSED/i.test(text)) return 'Chưa kết nối được dịch vụ cục bộ. Kiểm tra Hardhat, IPFS và API.';
  return error?.shortMessage || error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}
