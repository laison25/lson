import { useCallback, useEffect, useRef, useState } from 'react';
import { Contract } from 'ethers';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, CircleHelp, Coins, Copy, ExternalLink, Feather, FileText, Globe2, Heart, Home, Info, Link2, LoaderCircle, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, Wallet, X } from 'lucide-react';
import { SAMPLE_ONLY, SOCIAL_ABI, TOKEN_ABI, friendlyError, hydratePosts, loadDeployment, rpc, shortAddress, tokenAmount, walletProvider, writer, type Deployment, type Post } from './chain';
import { samples } from './samples';
import WalletPanel from './WalletPanel';
import { WalletSession, type WalletState } from './wallet-session';

type Page = 'home' | 'write' | 'profile';
const getPage = (): Page => location.hash.startsWith('#/write') ? 'write' : location.hash.startsWith('#/profile') ? 'profile' : 'home';
const pageTitle = { home: 'Bảng tin cộng đồng', write: 'Viết một điều mới', profile: 'Góc của bạn' };

function Avatar({ address, large = false }: { address: string; large?: boolean }) {
  const palette = ['#d9eab4', '#e6ddfa', '#f8daca', '#d7e9ef', '#f2e9bb'];
  const color = palette[parseInt(address.slice(-2) || '0', 16) % palette.length];
  return <div className={`avatar ${large ? 'large' : ''}`} style={{ background: color }} aria-hidden="true"><span>{address.slice(2, 4).toUpperCase()}</span><i /></div>;
}

function PostCard({ post, account, busy, onLike, onCopy }: { post: Post; account: string; busy: string; onLike: (post: Post) => void; onCopy: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => { if (!expanded) setOverflow(element.scrollHeight > element.clientHeight + 2); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, post.content]);
  const own = !!account && post.author.toLowerCase() === account.toLowerCase();
  return <article className="post-card" id={`post-${post.id}`}>
    <div className="post-meta"><Avatar address={post.author} /><div><strong title={post.author}>{shortAddress(post.author)} {own && <span className="you">bạn</span>}</strong><span>{post.createdAt ? new Date(post.createdAt * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Bài viết minh họa'} <b>·</b> <Globe2 size={11} /> Công khai</span></div><span className="post-number">#{String(post.id).padStart(3, '0')}</span></div>
    <h2>{post.title}</h2>
    <div ref={textRef} className={`post-content ${expanded ? 'expanded' : ''}`}>{post.content}</div>
    {(overflow || expanded) && <button className="text-button read-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu gọn' : 'Đọc tiếp'} <ChevronRight size={14} /></button>}
    {post.rewarded ? <div className="earned-line"><ShieldCheck size={15} /> Đã nhận <strong>10 LSON</strong><span>từ cộng đồng</span></div> : <div className="progress-line"><div className="dots" aria-label={`${Math.min(post.likes, 5)} trên 5 lượt thích`}>{Array.from({ length: 5 }, (_, i) => <i className={i < post.likes ? 'filled' : ''} key={i} />)}</div><span><strong>{post.likes}/5</strong> lượt thích để nhận thưởng</span>{post.likes === 4 && <span className="almost">Sắp chạm mốc!</span>}</div>}
    <div className="post-actions"><button className={`like-button ${post.liked ? 'liked' : ''}`} disabled={!!busy || own || post.liked} title={own ? 'Không thể tự like' : post.liked ? 'Mỗi ví chỉ like một lần' : 'Thích bài viết'} onClick={() => onLike(post)}>{busy === `like-${post.id}` ? <LoaderCircle className="spin" size={17} /> : <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />}<span>{post.liked ? 'Đã thích' : 'Thích'}</span><b>{post.likes}</b></button><div className="post-links">{post.cid && <a href={`http://127.0.0.1:8080/ipfs/${post.cid}`} target="_blank" rel="noreferrer" title={post.cid}><Link2 size={14} /> IPFS <ArrowUpRight size={12} /></a>}<button title="Sao chép liên kết bài viết" aria-label="Sao chép liên kết bài viết" onClick={() => onCopy(`${location.origin}/#/post/${post.id}`)}><Copy size={16} /></button></div></div>
  </article>;
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(0);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [modal, setModal] = useState<'setup' | 'wallet' | 'rules' | null>(null);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [config, setConfig] = useState<Deployment | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postScope, setPostScope] = useState('');
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState('0');
  const [earned, setEarned] = useState('0');
  const [status, setStatus] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [limit, setLimit] = useState(12);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState(() => localStorage.getItem('mach-draft-title') || '');
  const [content, setContent] = useState(() => localStorage.getItem('mach-draft-content') || '');
  const [preview, setPreview] = useState(false);
  const [stage, setStage] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const walletSession = useRef<WalletSession | null>(null);
  const displayedAccount = useRef('');
  const closeWalletPanel = useCallback(() => setWalletPanelOpen(false), []);
  const receiveWalletState = useCallback((state: WalletState) => {
    if (displayedAccount.current !== state.account) {
      displayedAccount.current = state.account;
      setBalance('0'); setEarned('0'); setPosts([]); setTotal(0); setLoading(true);
    }
    setAccount(state.account);
    setChainId(state.chainId);
    setRefreshNonce(n => n + 1);
  }, []);
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  const refresh = () => setRefreshNonce(n => n + 1);
  const navigate = (next: Page) => { location.hash = next === 'home' ? '/' : `/${next}`; setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  useEffect(() => { const changed = () => { setPage(getPage()); setLimit(12); setPosts([]); setTotal(0); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.error ? 10000 : 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { localStorage.setItem('mach-draft-title', title); localStorage.setItem('mach-draft-content', content); }, [title, content]);
  useEffect(() => { const interval = setInterval(() => setRefreshNonce(n => n + 1), 15000); return () => clearInterval(interval); }, []);

  useEffect(() => {
    if (SAMPLE_ONLY) return;
    const injected = walletProvider();
    if (!injected) return;
    const session = new WalletSession(injected, localStorage, receiveWalletState);
    walletSession.current = session;
    session.observe();
    void session.restore().catch(() => {});
    return () => { session.dispose(); if (walletSession.current === session) walletSession.current = null; };
  }, [receiveWalletState]);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const deployment = await loadDeployment();
        const social = new Contract(deployment.contractAddress, SOCIAL_ABI, rpc);
        const personal = page === 'profile';
        const [count, firstPage, reward, tokenBalance] = await Promise.all([
          personal ? (account ? social.authorPostCount(account) : 0n) : social.postCount(),
          personal ? (account ? social.getAuthorPosts(account, 0, Math.min(limit, 50)) : []) : social.getPosts(0, Math.min(limit, 50)),
          account ? social.rewardsEarned(account) : 0n,
          account ? new Contract(deployment.tokenAddress, TOKEN_ABI, rpc).balanceOf(account) : 0n,
        ]);
        const rows = Array.from(firstPage);
        // Pages beyond 50 retain bounded individual contract reads.
        if (limit > 50) for (let offset = 50; offset < Math.min(limit, Number(count)); offset += 50) {
          rows.push(...(personal ? await social.getAuthorPosts(account, offset, Math.min(50, limit - offset)) : await social.getPosts(offset, Math.min(50, limit - offset))));
        }
        const hydrated = await hydratePosts(Array.from(rows), social, account);
        if (!cancelled) { setConfig(deployment); setLive(true); setPosts(hydrated); setPostScope(`${page}-${account}`); setTotal(Number(count)); setEarned(tokenAmount(reward)); setBalance(tokenAmount(tokenBalance)); setStatus(''); }
      } catch (error) {
        if (!cancelled) { setLive(false); setConfig(null); setPosts([]); setTotal(0); setBalance('0'); setEarned('0'); setStatus(friendlyError(error)); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void update();
    return () => { cancelled = true; };
  }, [account, page, refreshNonce, limit]);

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => modalRef.current?.querySelector<HTMLElement>('button, a')?.focus(), 0);
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
      if (event.key === 'Tab') {
        const controls = modalRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', listener);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', listener); previous?.focus(); };
  }, [modal]);

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); notify('Đã sao chép vào bộ nhớ tạm.'); } catch { notify('Trình duyệt không cho phép sao chép.', true); } };

  async function connect() {
    if (SAMPLE_ONLY) { setModal('setup'); return; }
    const session = walletSession.current;
    if (!session) { setModal('wallet'); return; }
    setBusy('connect');
    try {
      const state = await session.connect();
      if (state.account) { setModal(null); notify('Đã kết nối ví. Chào mừng bạn đến với Lson!'); }
    } catch (error) { notify(friendlyError(error), true); }
    finally { setBusy(''); }
  }

  async function changeWallet() {
    const session = walletSession.current;
    if (!session) return connect();
    setBusy('change-wallet');
    try {
      const state = await session.connect(true);
      setWalletPanelOpen(false);
      notify(`Lson đang sử dụng ví ${shortAddress(state.account)}.`);
    } catch (error: any) {
      notify(error?.code === -32601 ? 'Ví chưa hỗ trợ chọn tài khoản từ web. Chọn ví trong MetaMask và bấm Kết nối cho Lson.' : friendlyError(error), true);
    } finally { setBusy(''); }
  }

  async function disconnectWallet() {
    const session = walletSession.current;
    if (!session) return;
    setBusy('disconnect');
    setWalletPanelOpen(false);
    try {
      const revoked = await session.disconnect();
      notify(revoked ? 'Đã ngắt kết nối ví với Lson.' : 'Đã đăng xuất khỏi Lson. Bạn có thể ngắt quyền kết nối còn lại trong MetaMask.');
    } finally { setBusy(''); }
  }

  async function switchNetwork() {
    const injected = walletProvider(); if (!injected) return connect();
    setBusy('network');
    try {
      try { await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] }); }
      catch (error: any) {
        if (error.code !== 4902 && error?.data?.originalError?.code !== 4902) throw error;
        await injected.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x7a69', chainName: 'Hardhat Local', rpcUrls: ['http://127.0.0.1:8545'], nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 } }] });
      }
      setChainId(Number(await injected.request({ method: 'eth_chainId' }))); refresh();
    } catch (error) { notify(friendlyError(error), true); }
    finally { setBusy(''); }
  }

  async function like(post: Post) {
    if (!live || !config) { setModal('setup'); return; }
    if (!account) return connect();
    if (chainId !== 31337) return switchNetwork();
    setBusy(`like-${post.id}`);
    try {
      const contract = await writer(config, account);
      const transaction = await contract.likePost(post.id);
      notify('Đã gửi lượt thích. Đang chờ blockchain xác nhận…');
      await transaction.wait(); refresh();
      notify(post.likes === 4 ? 'Đã thích! Tác giả vừa được thưởng 10 LSON.' : 'Lượt thích đã được ghi nhận trên blockchain.');
    } catch (error) { notify(friendlyError(error), true); refresh(); }
    finally { setBusy(''); }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!live || !config) { setModal('setup'); return; }
    if (!account) return connect();
    if (chainId !== 31337) return switchNetwork();
    if (!title.trim() || !content.trim()) { notify('Điền tiêu đề và nội dung trước khi đăng.', true); return; }
    setBusy('publish'); setStage('Đang lưu nội dung lên IPFS…');
    try {
      const response = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }), signal: AbortSignal.timeout(18000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể lưu lên IPFS.');
      setStage('Xác nhận đăng bài trong MetaMask…');
      const contract = await writer(config, account);
      const transaction = await contract.createPost(data.cid);
      setStage('Đang chờ blockchain xác nhận…');
      await transaction.wait();
      setTitle(''); setContent(''); setPreview(false); navigate('home'); refresh();
      notify('Bài viết đã được đăng. Ý tưởng của bạn đã lên Lson!');
    } catch (error) { notify(friendlyError(error), true); }
    finally { setBusy(''); setStage(''); }
  }

  const scopedPosts = postScope === `${page}-${account}` ? posts : [];
  const shown = (live ? scopedPosts : page === 'profile' ? [] : samples).filter(p => (filter !== 'rewarded' || p.rewarded) && `${p.title} ${p.content} ${p.author}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const selectedId = /^#\/post\/(\d+)$/.exec(location.hash)?.[1];
  const visible = selectedId ? shown.filter(p => p.id === Number(selectedId)) : shown;
  const wrongNetwork = !!account && chainId !== 31337;

  return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <a className="brand" href="#/" aria-label="Lson, trang chủ"><span className="brand-icon"><span>L</span></span>Lson<span className="brand-dot">.</span></a>
        <div className="workspace-tag"><span /> KHÔNG GIAN PHI TẬP TRUNG</div>
        <nav aria-label="Điều hướng chính">
          <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={19} />Trang chủ{page === 'home' && <span className="nav-indicator" />}</button>
          <button className={page === 'write' ? 'active' : ''} onClick={() => navigate('write')}><Feather size={19} />Đăng bài{page === 'write' && <span className="nav-indicator" />}</button>
          <button className={page === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><UserRound size={19} />Trang cá nhân{page === 'profile' && <span className="nav-indicator" />}</button>
        </nav>
        <button className="primary write-nav" onClick={() => navigate('write')}><Plus size={18} /> Viết bài mới</button>
        <div className="sidebar-bottom"><div className="small-note"><div className="note-icon"><Sparkles size={19} /></div><strong>Chia sẻ có giá trị.<br />Nhận lại xứng đáng.</strong><p>Ý tưởng của bạn làm nên<br />một cộng đồng tốt hơn.</p></div><button className="help-link" onClick={() => setModal('rules')}><CircleHelp size={16} /> Lson hoạt động thế nào?<ArrowUpRight size={13} /></button><div className="sidebar-footer">Được kết nối bởi blockchain.<br /><span>Được xây dựng bởi chúng ta.</span></div></div>
      </aside>
      <div className="main-shell">
        <header className="topbar"><div className="topbar-title"><button className="mobile-toggle" aria-label="Mở menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={21} /> : <Menu size={21} />}</button><span className="topbar-brand">Lson</span><span className="slash">/</span>{pageTitle[page]}</div><div className="topbar-actions"><span className={`network-pill ${live ? 'connected' : ''}`}><i />{live ? 'Hardhat Local' : 'Bản xem mẫu'}</span><button className="wallet-button" disabled={!!busy} onClick={account ? () => setWalletPanelOpen(true) : connect}>{busy === 'connect' ? <LoaderCircle className="spin" size={16} /> : <Wallet size={16} />}<span>{account ? shortAddress(account) : 'Kết nối ví'}</span>{account && <span className="wallet-connected" />}</button>{account && <button className="icon-button wallet-logout" title="Ngắt kết nối ví" aria-label="Ngắt kết nối ví" disabled={!!busy} onClick={disconnectWallet}><LogOut size={16} /></button>}</div></header>
        <main id="main-content">
          {wrongNetwork && <div className="network-warning"><Info size={16} />Ví đang ở mạng khác. Chuyển sang Hardhat Local để đăng bài và like.<button disabled={!!busy} onClick={switchNetwork}>Chuyển mạng <ArrowRight size={14} /></button></div>}
          {page === 'home' && <>
            <section className="hero"><div className="hero-copy"><div className="eyebrow"><span /> MỘT GÓC NHỎ CỦA WEB3</div><h1>Ý tưởng của bạn.<br />Giá trị của <span>cộng đồng.</span></h1><p>Chia sẻ câu chuyện, kết nối những góc nhìn.<br />Để mỗi đóng góp đều được ghi nhận.</p><button onClick={() => navigate('write')}>Bắt đầu chia sẻ <ArrowUpRight size={17} /></button></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="float-card float-like"><Heart size={19} fill="currentColor" /><span>+1 kết nối</span></div><div className="chain-shape"><span /><span /></div><div className="float-card float-token"><span className="mini-coin">L</span><div><strong>+10 LSON</strong><small>ý tưởng tạo giá trị</small></div><Sparkles size={15} /></div><span className="art-star">✳</span><i className="art-dot" /></div></section>
            <div className="content-columns"><section className="feed-column" aria-label="Bài viết cộng đồng"><div className="feed-heading"><div><h2>Dòng chảy ý tưởng <span>{live ? total : samples.length}</span></h2><p>Những chia sẻ mới từ cộng đồng Lson.</p></div><button className="icon-button" title="Làm mới dữ liệu" aria-label="Làm mới dữ liệu" onClick={refresh}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
              <button className="composer-prompt" onClick={() => navigate('write')}>{account ? <Avatar address={account} /> : <div className="prompt-avatar"><Feather size={20} /></div>}<span>Hôm nay, bạn muốn chia sẻ điều gì?</span><span className="prompt-plus"><Plus size={19} /></span></button>
              <div className="feed-toolbar"><div className="tabs"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Mới nhất</button><button className={filter === 'rewarded' ? 'selected' : ''} onClick={() => setFilter('rewarded')}><Coins size={14} /> Đã nhận thưởng</button></div><div className="search-wrap"><Search size={15} /><input aria-label="Tìm trong bài viết đã tải" placeholder="Tìm bài viết…" value={query} onChange={e => setQuery(e.target.value)} /></div></div>
              {!live && !loading && <div className="sample-banner"><Info size={15} /><span>Đang xem nội dung minh họa. <button onClick={() => setModal('setup')}>Kết nối bản demo thật <ArrowUpRight size={12} /></button></span></div>}
              {loading ? <div className="empty-state"><LoaderCircle className="spin" size={25} /><p>Đang kết nối với Lson…</p></div> : visible.length ? visible.map(post => <PostCard key={`${live}-${post.id}`} {...{ post, account, busy, onLike: like, onCopy: copy }} />) : <div className="empty-state"><Feather size={28} /><h3>{selectedId ? 'Chưa tìm thấy bài viết này' : query || filter !== 'all' ? 'Chưa có bài viết phù hợp' : 'Dòng chảy bắt đầu từ bạn'}</h3><p>{selectedId ? 'Bài có thể nằm ở trang tiếp theo. Tải thêm hoặc về bảng tin.' : 'Một câu chuyện hay đang chờ được chia sẻ.'}</p><button className="secondary" onClick={() => selectedId ? navigate('home') : navigate('write')}>{selectedId ? 'Về bảng tin' : 'Viết bài đầu tiên'}<ArrowRight size={15} /></button></div>}
              {live && posts.length < total && <button className="load-more secondary" onClick={() => setLimit(n => n + 12)}>Xem thêm bài viết <ArrowDown size={16} /></button>}
              {visible.length > 0 && <div className="feed-end"><span />Bạn đã bắt kịp {live && posts.length < total ? 'các bài viết đã tải' : 'dòng chảy'}<span /></div>}
            </section><RightRail {...{ live, account, balance, config, connect, setModal, navigate, copy }} /></div>
          </>}
          {page === 'write' && <div className="content-columns inner-page"><section className="feed-column"><button className="back-link" onClick={() => navigate('home')}><ArrowLeft size={15} />Trở về dòng chảy</button><div className="page-heading"><div className="eyebrow">GÓC NHÌN CỦA BẠN CÓ GIÁ TRỊ</div><h1>Một ý tưởng. Nhiều kết nối.</h1><p>Viết điều bạn quan tâm. Để cộng đồng cùng lắng nghe.</p></div><form className="editor-card" onSubmit={publish}><div className="editor-header"><div>{account ? <Avatar address={account} /> : <div className="prompt-avatar"><UserRound size={20} /></div>}<div><strong>{account ? shortAddress(account) : 'Câu chuyện của bạn'}</strong><span><Globe2 size={12} /> Bài viết công khai</span></div></div><div className="editor-tabs"><button type="button" className={!preview ? 'selected' : ''} onClick={() => setPreview(false)}>Viết</button><button type="button" className={preview ? 'selected' : ''} onClick={() => setPreview(true)}>Xem trước</button></div></div>{preview ? <div className="draft-preview"><h2>{title || 'Tiêu đề của bạn'}</h2><p>{content || 'Nội dung câu chuyện sẽ hiển thị ở đây…'}</p></div> : <div className="editor-fields"><label htmlFor="post-title">Tiêu đề<span>{title.length}/120</span></label><input id="post-title" placeholder="Bắt đầu bằng một tiêu đề…" maxLength={120} required value={title} disabled={busy === 'publish'} onChange={e => setTitle(e.target.value)} /><label htmlFor="post-content">Nội dung<span>{content.length.toLocaleString('vi-VN')}/5.000</span></label><textarea id="post-content" placeholder={'Một điều vừa học được, một ý tưởng mới,\nhay câu chuyện bạn muốn kể…'} maxLength={5000} required value={content} disabled={busy === 'publish'} onChange={e => setContent(e.target.value)} /></div>}<div className="editor-info"><ShieldCheck size={16} /><span>Nội dung lưu trên IPFS. Quyền tác giả ghi nhận trên blockchain.</span></div><div className="editor-footer"><span>{busy === 'publish' ? stage : 'Bản nháp tự lưu trên trình duyệt'}</span><button className="primary" disabled={!!busy || !title.trim() || !content.trim()} type="submit">{busy === 'publish' ? <LoaderCircle size={16} className="spin" /> : <Feather size={16} />}{busy === 'publish' ? 'Đang đăng…' : 'Đăng bài viết'}{busy !== 'publish' && <ArrowUpRight size={16} />}</button></div></form><p className="public-note"><Info size={14} />Bài viết và địa chỉ ví đều công khai. Hãy cân nhắc trước khi chia sẻ thông tin cá nhân. Bài đã đăng không thể sửa hoặc xóa trong phiên bản này.</p></section><RightRail {...{ live, account, balance, config, connect, setModal, navigate, copy }} /></div>}
          {page === 'profile' && <div className="content-columns inner-page"><section className="feed-column"><div className="page-heading"><div className="eyebrow">DẤU ẤN TRÊN LSON</div><h1>Góc của bạn.</h1><p>Những ý tưởng đã chia sẻ. Những giá trị đã nhận lại.</p></div>{!account ? <div className="connect-card"><div className="connect-illustration"><Wallet size={34} /></div><h2>Bắt đầu từ chiếc ví của bạn</h2><p>Kết nối MetaMask để xem bài viết và token thưởng.<br />Không cần tạo thêm tài khoản.</p><button className="primary" onClick={connect} disabled={!!busy}><Wallet size={17} />Kết nối ví MetaMask <ArrowUpRight size={16} /></button><span>Chỉ yêu cầu địa chỉ ví. Không yêu cầu khóa bí mật.</span></div> : <><div className="profile-card"><div className="profile-cover"><span /><i /><b>YOUR IDEAS. YOUR SPACE.</b></div><div className="profile-body"><Avatar address={account} large /><span className="profile-badge"><span /> Đã kết nối ví</span><h2>{shortAddress(account)}</h2><button className="full-address" onClick={() => copy(account)}>{account}<Copy size={14} /></button><p>Mỗi chia sẻ là một dấu ấn của riêng bạn.</p><div className="profile-wallet-actions"><button className="secondary" disabled={!!busy} onClick={changeWallet}><RefreshCw size={14} />Đổi ví</button><button className="secondary" disabled={!!busy} onClick={disconnectWallet}><LogOut size={14} />Ngắt kết nối</button></div><div className="profile-stats"><div><span>Bài viết đã đăng</span><strong>{live ? total : '—'}<FileText size={18} /></strong></div><div><span>Tổng token đã thưởng</span><strong>{live ? earned : '—'}<small>LSON</small></strong></div><div><span>Số dư hiện tại</span><strong>{live ? balance : '—'}<small>LSON</small></strong></div></div></div></div><div className="feed-heading profile-feed-heading"><h2>Bài viết của bạn <span>{live ? total : 0}</span></h2><button className="text-button" onClick={() => navigate('write')}><Plus size={15} />Viết bài mới</button></div>{!live && <div className="sample-banner"><Info size={15} /><span>Chưa có kết nối blockchain. <button onClick={() => setModal('setup')}>Hướng dẫn khởi động</button></span></div>}{loading ? <div className="empty-state"><LoaderCircle className="spin" /></div> : posts.length ? posts.map(post => <PostCard key={post.id} {...{ post, account, busy, onLike: like, onCopy: copy }} />) : <div className="empty-state"><Feather size={28} /><h3>Trang đầu tiên còn đang chờ bạn</h3><p>Chia sẻ câu chuyện đầu tiên của mình trên Lson.</p><button className="secondary" onClick={() => navigate('write')}>Bắt đầu viết <ArrowRight size={15} /></button></div>}{live && posts.length < total && <button className="load-more secondary" onClick={() => setLimit(n => n + 12)}>Xem thêm bài viết <ArrowDown size={16} /></button>}</>}</section><RightRail {...{ live, account, balance, config, connect, setModal, navigate, copy }} /></div>}
          <footer className="page-footer"><span>Lson<span className="brand-dot">.</span></span><p>Một không gian mở. Nhiều góc nhìn mới.</p><span>Đồ án Blockchain · Token thử nghiệm</span></footer>
        </main>
      </div>
    </div>
    {walletPanelOpen && account && <WalletPanel account={account} chainId={chainId} busy={!!busy} onClose={closeWalletPanel} onChange={changeWallet} onDisconnect={disconnectWallet} onCopy={() => { void copy(account); }} />}
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <Info size={19} /> : <CheckCheck size={19} />}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={17} /></button></div>}
    {modal && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Đóng"><X size={20} /></button><div className="modal-icon">{modal === 'wallet' ? <Wallet size={26} /> : modal === 'setup' ? <Link2 size={26} /> : <Sparkles size={26} />}</div><h2 id="modal-title">{modal === 'wallet' ? 'Kết nối với MetaMask' : modal === 'setup' ? 'Bật dòng chảy blockchain' : 'Chia sẻ. Kết nối. Nhận thưởng.'}</h2>{modal === 'wallet' ? <><p>Cài tiện ích MetaMask trên trình duyệt, tạo ví thử nghiệm rồi tải lại trang để kết nối.</p><a className="primary" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Tải MetaMask <ExternalLink size={16} /></a><p className="modal-footnote">Chỉ dùng tài khoản và ETH thử nghiệm khi demo. Không chia sẻ seed phrase hoặc private key.</p></> : modal === 'setup' ? <><p>Giao diện đang hiển thị bài minh họa. Để đăng bài, like và nhận token thật trên mạng thử nghiệm, mở các dịch vụ trong thư mục dự án:</p><ol className="setup-list"><li><strong>Khởi động IPFS</strong><code>pnpm ipfs:install<br />pnpm ipfs</code></li><li><strong>Mở hai terminal khác</strong><code>pnpm api<br />pnpm chain</code></li><li><strong>Triển khai và thêm bài mẫu</strong><code>pnpm deploy<br />pnpm seed</code></li></ol><p className="modal-footnote">{status || 'Kết nối MetaMask với Hardhat Local, chain ID 31337.'} Xem README để nhập tài khoản Hardhat và chạy demo.</p><button className="primary" onClick={() => { refresh(); setModal(null); }}><RefreshCw size={16} />Kiểm tra lại kết nối</button></> : <><p>Lson là mạng xã hội phi tập trung tối giản, nơi đóng góp được ghi nhận một cách minh bạch.</p><div className="rules-list"><div><span>01</span><p><strong>Chiếc ví là tài khoản</strong>Kết nối MetaMask để sử dụng địa chỉ ví của bạn.</p></div><div><span>02</span><p><strong>Ý tưởng được lưu trên IPFS</strong>Nội dung lưu trên IPFS; smart contract lưu CID, tác giả và tương tác.</p></div><div><span>03</span><p><strong>5 lượt thích → 10 LSON</strong>Mỗi ví like một lần, không tự like. Thưởng tự động một lần cho mỗi bài.</p></div></div><div className="modal-caveat"><Info size={16} /><p>Ví không xác minh danh tính thật. Một người có thể tạo nhiều ví. LSON là token thử nghiệm, không có giá trị quy đổi. Lens Protocol chưa thuộc phạm vi triển khai.</p></div><button className="primary" onClick={() => { setModal(null); navigate('write'); }}>Chia sẻ ý tưởng đầu tiên <ArrowRight size={16} /></button></>}</div></div>}
  </>;
}

type RailProps = { live: boolean; account: string; balance: string; config: Deployment | null; connect: () => Promise<void>; setModal: (modal: 'rules' | 'setup') => void; navigate: (page: Page) => void; copy: (text: string) => Promise<void> };
function RightRail({ live, account, balance, config, connect, setModal, navigate, copy }: RailProps) {
  return <aside className="right-rail"><section className="reward-card"><div className="rail-eyebrow"><span className="mini-coin">L</span> VIẾT HAY, NHẬN THƯỞNG<ArrowUpRight size={16} /></div><h2>Ý tưởng tốt<br />xứng đáng được <em>ghi nhận.</em></h2><div className="reward-equation"><div><Heart size={18} /><strong>5</strong><span>lượt thích hợp lệ</span></div><ArrowRight size={20} /><div><Coins size={20} /><strong>10</strong><span>token LSON</span></div></div><p>Thưởng tự động từ smart contract.<br />Minh bạch. Trực tiếp. Dành cho bạn.</p><button onClick={() => setModal('rules')}>Tìm hiểu cách nhận thưởng<ArrowRight size={15} /></button></section>
    <section className="rail-card wallet-summary"><div className="rail-title"><h3>Ví của bạn</h3><Wallet size={17} /></div>{account ? <><button className="rail-address" onClick={() => copy(account)}><Avatar address={account} />{shortAddress(account)}<Copy size={14} /></button><span className="balance-label">SỐ DƯ TOKEN</span><div className="balance">{live ? balance : '—'}<span>LSON</span></div><button className="rail-link" onClick={() => navigate('profile')}>Xem trang cá nhân<ArrowUpRight size={14} /></button></> : <><div className="wallet-empty"><div><Wallet size={23} /></div><p>Kết nối ví để bắt đầu hành trình<br />và theo dõi token của bạn.</p></div><button className="secondary" onClick={connect}>Kết nối MetaMask <ArrowUpRight size={15} /></button></>}</section>
    <section className="rail-card how-card"><div className="rail-title"><h3>Từ ý tưởng đến giá trị</h3><Sparkles size={17} /></div><div className="step"><span>1</span><div><strong>Kết nối ví</strong><p>Chiếc ví, danh tính Web3 của bạn.</p></div></div><div className="step"><span>2</span><div><strong>Chia sẻ góc nhìn</strong><p>Nội dung được lưu trên IPFS.</p></div></div><div className="step"><span>3</span><div><strong>Đón nhận kết nối</strong><p>Đủ 5 like, nhận 10 LSON.</p></div></div></section>
    <div className="network-status"><span className={live ? 'live-dot' : 'sample-dot'} /><div><strong>{live ? 'Đang kết nối Hardhat Local' : 'Đang ở chế độ xem mẫu'}</strong><span>{live ? 'Chain ID 31337 · Mạng thử nghiệm' : 'Bật dịch vụ cục bộ để tương tác'}</span></div>{live ? <ShieldCheck size={16} /> : <button aria-label="Hướng dẫn bật dịch vụ" onClick={() => setModal('setup')}><ArrowUpRight size={16} /></button>}</div>{config && <button className="contract-link" title={config.contractAddress} onClick={() => copy(config.contractAddress)}>Hợp đồng {shortAddress(config.contractAddress)}<Copy size={11} /></button>}
    <div className="rail-footnote"><ShieldCheck size={13} /><span>Kết nối ví xác nhận quyền sử dụng ví,<br />chưa xác minh danh tính thật.</span></div>
  </aside>;
}
