import express from 'express';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const app = express();
const kubo = 'http://127.0.0.1:5001/api/v0';
const cidPattern = /^bafy[a-z2-7]{55}$/;
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001']);
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  if (req.headers.origin && !origins.has(req.headers.origin)) return res.status(403).json({ error: 'Origin không được phép.' });
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '24kb' }));

async function kuboCall(path, body) {
  const response = await fetch(`${kubo}/${path}`, { method: 'POST', body, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Kubo request failed');
  return response;
}

app.get('/api/health', async (_req, res) => {
  try { await kuboCall('version'); res.json({ ipfs: true }); }
  catch { res.status(503).json({ ipfs: false, error: 'Chưa kết nối IPFS. Chạy pnpm ipfs.' }); }
});

// Same-origin blockchain reads; wallet writes still require MetaMask approval.
const readMethods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getCode', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getBalance', 'eth_getTransactionReceipt', 'eth_getLogs']);
app.post('/api/rpc', async (req, res) => {
  const batch = Array.isArray(req.body) ? req.body : [req.body];
  if (!batch.length || batch.length > 20 || batch.some(call => !call || call.jsonrpc !== '2.0' || !readMethods.has(call.method))) return res.status(400).json({ error: 'Chỉ hỗ trợ RPC đọc dữ liệu.' });
  try {
    const response = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('RPC failed');
    res.json(await response.json());
  } catch { res.status(503).json({ error: 'Chưa kết nối Hardhat. Chạy pnpm chain.' }); }
});

app.post('/api/posts', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!title || title.length > 120 || !content || content.length > 5000) {
    return res.status(400).json({ error: 'Tiêu đề 1–120 ký tự; nội dung 1–5.000 ký tự.' });
  }
  try {
    const form = new FormData();
    form.append('file', new Blob([JSON.stringify({ version: 1, title, content })], { type: 'application/json' }), 'post.json');
    const response = await kuboCall('add?pin=true&cid-version=1&raw-leaves=false&hash=sha2-256', form);
    const data = JSON.parse((await response.text()).trim().split('\n').at(-1));
    if (!cidPattern.test(data.Hash)) throw new Error('Unexpected CID');
    res.status(201).json({ cid: data.Hash });
  } catch { res.status(503).json({ error: 'Không thể lưu lên IPFS. Kiểm tra Kubo đang chạy bằng pnpm ipfs.' }); }
});

app.get('/api/ipfs/:cid', async (req, res) => {
  if (!cidPattern.test(req.params.cid)) return res.status(400).json({ error: 'CID không hợp lệ.' });
  try {
    const response = await kuboCall(`cat?arg=${req.params.cid}&length=24001`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 24000) return res.status(413).json({ error: 'Nội dung quá lớn.' });
    const data = JSON.parse(text);
    if (data.version !== 1 || typeof data.title !== 'string' || typeof data.content !== 'string' || data.title.length > 120 || data.content.length > 5000) {
      return res.status(422).json({ error: 'Định dạng bài viết không được hỗ trợ.' });
    }
    res.json({ title: data.title, content: data.content });
  } catch { res.status(503).json({ error: 'Chưa đọc được nội dung từ IPFS.' }); }
});

if (process.argv.includes('--serve')) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  // Runtime deployment metadata must follow the latest local chain deployment.
  app.get('/deployment.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../public/deployment.json', import.meta.url))));
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Yêu cầu không hợp lệ.' }));
app.listen(3001, '127.0.0.1', () => console.log('Lson API: http://127.0.0.1:3001'));
