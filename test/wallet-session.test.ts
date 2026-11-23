import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { WalletSession, WALLET_DISCONNECTED_KEY, type WalletState } from '../src/wallet-session.ts';

const first = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const second = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
class FakeWallet extends EventEmitter {
  accounts = [first];
  nextAccounts = [second];
  rejectSwitch = false;
  rejectRevoke = false;
  calls: { method: string; params?: unknown[] }[] = [];
  deferredAccounts: (() => Promise<string[]>) | null = null;

  async request(args: { method: string; params?: unknown[] }): Promise<any> {
    this.calls.push(args);
    switch (args.method) {
      case 'eth_accounts': return this.deferredAccounts ? this.deferredAccounts() : [...this.accounts];
      case 'eth_chainId': return '0x7a69';
      case 'eth_requestAccounts': return [...this.accounts];
      case 'wallet_requestPermissions':
        if (this.rejectSwitch) throw Object.assign(new Error('User rejected'), { code: 4001 });
        this.accounts = [...this.nextAccounts];
        this.emit('accountsChanged', this.accounts);
        return [{ parentCapability: 'eth_accounts' }];
      case 'wallet_revokePermissions':
        if (this.rejectRevoke) throw Object.assign(new Error('Unsupported'), { code: -32601 });
        this.accounts = [];
        this.emit('accountsChanged', []);
        return null;
      default: throw new Error(`Unexpected method: ${args.method}`);
    }
  }
}
function setup(provider = new FakeWallet(), data = new Map<string, string>()) {
  const states: WalletState[] = [];
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const session = new WalletSession(provider, storage, state => states.push(state));
  session.observe();
  return { session, provider, states, storage, data };
}

test('tài khoản được cấp quyền và mạng thay đổi sẽ cập nhật trạng thái', async () => {
  const { session, provider, states } = setup();
  await session.restore();
  assert.deepEqual(states.at(-1), { account: first, chainId: 31337 });
  provider.accounts = [second];
  provider.emit('accountsChanged', [second]);
  assert.equal(states.at(-1)?.account, second);
  provider.emit('chainChanged', '0x1');
  assert.equal(states.at(-1)?.chainId, 1);
  session.dispose();
});

test('Đổi ví mở yêu cầu cấp quyền rồi dùng đúng ví mới', async () => {
  const { session, provider, states } = setup();
  await session.restore();
  assert.equal((await session.connect(true)).account, second);
  assert.equal(states.at(-1)?.account, second);
  assert.deepEqual(provider.calls.find(call => call.method === 'wallet_requestPermissions')?.params, [{ eth_accounts: {} }]);
  session.dispose();
});

test('hủy chọn ví vẫn giữ tài khoản cũ', async () => {
  const { session, provider, states } = setup();
  await session.restore();
  provider.rejectSwitch = true;
  await assert.rejects(session.connect(true), { code: 4001 });
  assert.equal(states.at(-1)?.account, first);
  session.dispose();
});

test('ngắt ví thu hồi quyền và xóa tài khoản đang hiển thị', async () => {
  const { session, provider, states, data } = setup();
  await session.restore();
  assert.equal(await session.disconnect(), true);
  assert.deepEqual(states.at(-1), { account: '', chainId: 0 });
  assert.equal(data.get(WALLET_DISCONNECTED_KEY), '1');
  assert.deepEqual(provider.calls.find(call => call.method === 'wallet_revokePermissions')?.params, [{ eth_accounts: {} }]);
  session.dispose();
});

test('ví không hỗ trợ revoke vẫn đăng xuất, bỏ qua sự kiện muộn và không tự đăng nhập sau F5', async () => {
  const { session, provider, states, data } = setup();
  await session.restore();
  provider.rejectRevoke = true;
  assert.equal(await session.disconnect(), false);
  provider.emit('accountsChanged', [first]);
  assert.equal(states.at(-1)?.account, '');
  session.dispose();
  const nextPage = setup(provider, data);
  const readsBefore = provider.calls.length;
  await nextPage.session.restore();
  assert.equal(provider.calls.length, readsBefore);
  assert.equal(nextPage.states.length, 0);
  nextPage.session.dispose();
});

test('phản hồi khôi phục đến sau đăng xuất không làm hiện lại ví cũ', async () => {
  const { session, provider, states } = setup();
  let resolveRead!: (accounts: string[]) => void;
  provider.deferredAccounts = () => new Promise(resolve => { resolveRead = resolve; });
  const restoring = session.restore();
  await session.disconnect();
  resolveRead([first]);
  await restoring;
  assert.ok(states.every(state => !state.account));
  session.dispose();
});

test('chủ động kết nối lại xóa trạng thái đăng xuất và tiếp tục theo dõi đổi ví', async () => {
  const { session, provider, states, data } = setup();
  await session.restore();
  await session.disconnect();
  provider.accounts = [first];
  await session.connect();
  assert.equal(data.has(WALLET_DISCONNECTED_KEY), false);
  provider.emit('accountsChanged', [second]);
  assert.equal(states.at(-1)?.account, second);
  session.dispose();
});

test('hủy phiên trong lúc đang kết nối ngăn phản hồi cũ tự đăng nhập lại', async () => {
  const { session, provider, states } = setup();
  await session.restore();
  let resolveRead!: (accounts: string[]) => void;
  let readStarted!: () => void;
  const started = new Promise<void>(resolve => { readStarted = resolve; });
  provider.deferredAccounts = () => new Promise(resolve => { resolveRead = resolve; readStarted(); });
  const connecting = session.connect();
  await started;
  await session.disconnect();
  resolveRead([first]);
  await assert.rejects(connecting, /Yêu cầu kết nối đã kết thúc/);
  assert.equal(states.at(-1)?.account, '');
  session.dispose();
});
