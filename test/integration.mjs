import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Contract, ContractFactory, JsonRpcProvider, parseEther } from 'ethers';

const rpc = new JsonRpcProvider('http://127.0.0.1:8545');
assert.equal((await rpc.getNetwork()).chainId, 31337n, 'Chỉ kiểm thử mạng local');
const base = 'http://127.0.0.1:3001';
const post = { title: 'Kiểm thử IPFS → blockchain → token', content: 'Một bài viết có nội dung thật, lưu trên IPFS và được thưởng bằng smart contract.' };
const upload = await fetch(`${base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) });
assert.equal(upload.status, 201);
const { cid } = await upload.json();
assert.match(cid, /^bafy[a-z2-7]{55}$/);
const download = await fetch(`${base}/api/ipfs/${cid}`);
assert.equal(download.status, 200);
assert.deepEqual(await download.json(), post);
console.log('PASS nội dung tiếng Việt lưu và đọc lại từ IPFS thật');

// Use a separate contract so the demo's four-like post remains available for presentation.
const artifact = JSON.parse(await readFile('artifacts/contracts/MachSocial.sol/MachSocial.json', 'utf8'));
const author = await rpc.getSigner(0);
const social = await new ContractFactory(artifact.abi, artifact.bytecode, author).deploy();
await social.waitForDeployment();
await (await social.createPost(cid)).wait();
assert.equal((await social.getPost(1)).cid, cid);
const token = new Contract(await social.token(), ['function balanceOf(address) view returns(uint256)'], rpc);
for (let i = 1; i <= 4; i++) await (await social.connect(await rpc.getSigner(i)).getFunction('likePost')(1)).wait();
assert.equal(await token.balanceOf(await author.getAddress()), 0n);
await (await social.connect(await rpc.getSigner(5)).getFunction('likePost')(1)).wait();
assert.equal(await token.balanceOf(await author.getAddress()), parseEther('10'));
assert.equal((await social.getPost(1)).rewarded, true);
console.log('PASS CID lên blockchain và like thứ 5 tự thưởng 10 LSON');

const invalid = await fetch(`${base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: ' ', content: 'x' }) });
assert.equal(invalid.status, 400);
const foreign = await fetch(`${base}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: JSON.stringify(post) });
assert.equal(foreign.status, 403);
const invalidCid = await fetch(`${base}/api/ipfs/not-a-cid`);
assert.equal(invalidCid.status, 400);
const readRpc = await fetch(`${base}/api/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
assert.equal((await readRpc.json()).result, '0x7a69');
const blockedRpc = await fetch(`${base}/api/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendTransaction', params: [] }) });
assert.equal(blockedRpc.status, 400);
console.log('PASS API kiểm tra nội dung, CID, origin và chỉ proxy RPC đọc dữ liệu');
console.log('Tất cả kiểm thử tích hợp đã đạt. Bài seed #1 vẫn giữ 4 like.');
await rpc.destroy();
