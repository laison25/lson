import { useEffect, useRef } from 'react';
import { ArrowLeftRight, Copy, LoaderCircle, LogOut, Wallet, X } from 'lucide-react';

type Props = { account: string; chainId: number; busy: boolean; onClose: () => void; onChange: () => void; onDisconnect: () => void; onCopy: () => void };

export default function WalletPanel({ account, chainId, busy, onClose, onChange, onDisconnect, onCopy }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [busy, onClose]);

  return <div className="modal-overlay" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="modal wallet-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="wallet-panel-title">
      <button className="modal-close icon-button" aria-label="Đóng quản lý ví" disabled={busy} onClick={onClose}><X size={20} /></button>
      <div className="modal-icon"><Wallet size={26} /></div>
      <h2 id="wallet-panel-title">Ví đang kết nối</h2>
      <p>Đây là tài khoản đang được cấp quyền sử dụng trên Lson.</p>
      <button className="wallet-panel-address" onClick={onCopy} title="Sao chép địa chỉ ví"><span>{account}</span><Copy size={16} /></button>
      <div className="wallet-panel-network"><span />{chainId === 31337 ? 'Hardhat Local · Chain ID 31337' : `Mạng hiện tại · Chain ID ${chainId}`}</div>
      <button className="primary" onClick={onChange} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowLeftRight size={17} />}Đổi ví trong MetaMask</button>
      <button className="secondary wallet-sign-out" onClick={onDisconnect} disabled={busy}><LogOut size={17} />Ngắt kết nối ví</button>
      <p className="modal-footnote">Khi đổi ví, hãy chọn tài khoản muốn dùng và cấp quyền trong MetaMask. Bài viết và token vẫn thuộc địa chỉ ví đã tạo hoặc nhận chúng.</p>
    </div>
  </div>;
}
