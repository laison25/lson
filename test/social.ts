import assert from 'node:assert/strict';
import { network } from 'hardhat';

const { ethers } = await network.create();
const wallets = await ethers.getSigners();
const social: any = await ethers.deployContract('MachSocial');
await social.waitForDeployment();
const token: any = await ethers.getContractAt('MachToken', await social.token());
// Structurally valid CID; content availability is tested separately against Kubo.
const cid = 'bafy' + 'a'.repeat(55);
let passed = 0;
async function check(name: string, fn: () => Promise<void>) { await fn(); ++passed; console.log(`PASS ${name}`); }

await check('chặn CID không hợp lệ và ID không tồn tại', async () => {
  await assert.rejects(social.createPost('https://example.com'), /InvalidCID/);
  await assert.rejects(social.createPost('bafy' + '0'.repeat(55)), /InvalidCID/);
  await assert.rejects(social.getPost(0), /PostNotFound/);
  await assert.rejects(social.likePost(99), /PostNotFound/);
});
await check('đăng bài ghi đúng tác giả, CID và sự kiện', async () => {
  const receipt = await (await social.createPost(cid)).wait();
  const event = receipt.logs.map((log: any) => { try { return social.interface.parseLog(log); } catch { return null; } }).find((item: any) => item?.name === 'PostCreated');
  const post = await social.getPost(1);
  assert.equal(await social.postCount(), 1n);
  assert.equal(post.author, wallets[0].address);
  assert.equal(post.cid, cid);
  assert.equal(event.args.id, 1n);
  assert.equal(post.rewarded, false);
});
await check('tác giả không tự like; mỗi ví chỉ like một lần', async () => {
  await assert.rejects(social.likePost(1), /SelfLike/);
  await (await social.connect(wallets[1]).likePost(1)).wait();
  await assert.rejects(social.connect(wallets[1]).likePost(1), /AlreadyLiked/);
  assert.equal((await social.getPost(1)).likes, 1n);
});
await check('4 like chưa nhận thưởng', async () => {
  for (const wallet of wallets.slice(2, 5)) await (await social.connect(wallet).likePost(1)).wait();
  assert.equal((await social.getPost(1)).likes, 4n);
  assert.equal(await token.balanceOf(wallets[0].address), 0n);
  assert.equal(await social.rewardsEarned(wallets[0].address), 0n);
});
await check('like thứ 5 thưởng đúng 10 LSON và phát sự kiện', async () => {
  const receipt = await (await social.connect(wallets[5]).likePost(1)).wait();
  const event = receipt.logs.map((log: any) => { try { return social.interface.parseLog(log); } catch { return null; } }).find((item: any) => item?.name === 'PostRewarded');
  assert.equal((await social.getPost(1)).rewarded, true);
  assert.equal(await token.balanceOf(wallets[0].address), ethers.parseEther('10'));
  assert.equal(await social.rewardsEarned(wallets[0].address), ethers.parseEther('10'));
  assert.equal(event.args.author, wallets[0].address);
  assert.equal(event.args.amount, ethers.parseEther('10'));
});
await check('like thứ 6 và 7 không thưởng lại; ví ngoài không được mint', async () => {
  for (const wallet of wallets.slice(6, 8)) await (await social.connect(wallet).likePost(1)).wait();
  assert.equal((await social.getPost(1)).likes, 7n);
  assert.equal(await token.totalSupply(), ethers.parseEther('10'));
  await assert.rejects(token.reward(wallets[0].address, 100n), /OnlySocial/);
});
await check('token ERC-20 chuyển được; lịch sử thưởng không thay đổi theo số dư', async () => {
  await (await token.transfer(wallets[9].address, ethers.parseEther('3'))).wait();
  assert.equal(await token.balanceOf(wallets[0].address), ethers.parseEther('7'));
  assert.equal(await social.rewardsEarned(wallets[0].address), ethers.parseEther('10'));
  assert.equal(await token.decimals(), 18n);
  assert.equal(await token.name(), 'Lson Token');
  assert.equal(await token.symbol(), 'LSON');
});
await check('phân trang mới nhất trước và lọc bài theo tác giả', async () => {
  await (await social.connect(wallets[1]).createPost(cid)).wait();
  await (await social.createPost(cid)).wait();
  assert.deepEqual((await social.getPosts(0, 2)).map((p: any) => p.id), [3n, 2n]);
  assert.deepEqual((await social.getPosts(2, 2)).map((p: any) => p.id), [1n]);
  assert.equal((await social.getPosts(3, 10)).length, 0);
  assert.equal(await social.authorPostCount(wallets[0].address), 2n);
  assert.deepEqual((await social.getAuthorPosts(wallets[0].address, 0, 1)).map((p: any) => p.id), [3n]);
  assert.deepEqual((await social.getAuthorPosts(wallets[0].address, 1, 2)).map((p: any) => p.id), [1n]);
  await assert.rejects(social.getPosts(0, 51), /InvalidPage/);
  await assert.rejects(social.getPosts(0, 0), /InvalidPage/);
});
await check('mỗi bài có phần thưởng độc lập', async () => {
  for (const wallet of wallets.slice(1, 6)) await (await social.connect(wallet).likePost(3)).wait();
  assert.equal(await social.rewardsEarned(wallets[0].address), ethers.parseEther('20'));
  assert.equal(await token.totalSupply(), ethers.parseEther('20'));
});
console.log(`\n${passed}/${passed} nhóm kiểm thử smart contract đã đạt.`);
