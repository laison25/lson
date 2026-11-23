import type { WalletProvider } from './chain';

export const WALLET_DISCONNECTED_KEY = 'lson-wallet-disconnected';
export type WalletState = { account: string; chainId: number };
type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Keep a local sign-out separate from the wallet's connection to its network. */
export class WalletSession {
  private provider: WalletProvider;
  private storage: SessionStorage;
  private onState: (state: WalletState) => void;
  private state: WalletState = { account: '', chainId: 0 };
  private signedOut: boolean;
  private revision = 0;
  private action = 0;
  private disposed = false;

  constructor(provider: WalletProvider, storage: SessionStorage, onState: (state: WalletState) => void) {
    this.provider = provider;
    this.storage = storage;
    this.onState = onState;
    this.signedOut = storage.getItem(WALLET_DISCONNECTED_KEY) === '1';
  }

  private publish(state: WalletState) {
    if (this.disposed) return;
    if (this.state.account === state.account && this.state.chainId === state.chainId) return;
    this.state = state;
    this.onState({ ...state });
  }

  private accountsChanged = (accounts: string[]) => {
    ++this.revision;
    if (!this.signedOut) this.publish({ ...this.state, account: accounts[0] || '' });
  };
  private chainChanged = (id: string) => {
    ++this.revision;
    if (!this.signedOut) this.publish({ ...this.state, chainId: Number(id) });
  };
  private disconnected = () => {
    ++this.revision;
    this.publish({ account: '', chainId: 0 });
  };

  observe() {
    this.provider.on?.('accountsChanged', this.accountsChanged);
    this.provider.on?.('chainChanged', this.chainChanged);
    this.provider.on?.('disconnect', this.disconnected);
  }

  async restore() {
    if (this.signedOut || this.disposed) return;
    const revision = ++this.revision;
    const [accounts, chain] = await Promise.all([
      this.provider.request({ method: 'eth_accounts' }),
      this.provider.request({ method: 'eth_chainId' }),
    ]);
    if (revision === this.revision && !this.signedOut) this.publish({ account: accounts[0] || '', chainId: Number(chain) });
  }

  async connect(changeAccount = false): Promise<WalletState> {
    const action = ++this.action;
    ++this.revision; // Invalidate a passive restore that may still be in flight.
    if (changeAccount) {
      await this.provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
    } else {
      await this.provider.request({ method: 'eth_requestAccounts' });
    }
    const revision = this.revision;
    const [accounts, chain] = await Promise.all([
      this.provider.request({ method: 'eth_accounts' }),
      this.provider.request({ method: 'eth_chainId' }),
    ]);
    if (action !== this.action || this.disposed) throw new Error('Yêu cầu kết nối đã kết thúc. Vui lòng thử lại.');
    if (!accounts[0]) throw new Error('Chưa có tài khoản được cấp quyền. Chọn ví rồi bấm Kết nối trong MetaMask.');
    this.signedOut = false;
    this.storage.removeItem(WALLET_DISCONNECTED_KEY);
    if (revision === this.revision) this.publish({ account: accounts[0], chainId: Number(chain) });
    else await this.restore();
    return { ...this.state };
  }

  /** Returns whether the provider also revoked its account permission. */
  async disconnect(): Promise<boolean> {
    ++this.action;
    ++this.revision;
    this.signedOut = true;
    this.storage.setItem(WALLET_DISCONNECTED_KEY, '1');
    this.publish({ account: '', chainId: 0 });
    try {
      await this.provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
      return true;
    } catch {
      // Local sign-out still works with providers that do not implement revoke.
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    ++this.revision;
    ++this.action;
    this.provider.removeListener?.('accountsChanged', this.accountsChanged);
    this.provider.removeListener?.('chainChanged', this.chainChanged);
    this.provider.removeListener?.('disconnect', this.disconnected);
  }
}
