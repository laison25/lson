import { spawn, execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else child.kill('SIGTERM');
    } catch {}
  }
  process.exit(code);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function service(file, args = []) {
  const child = spawn(process.execPath, [file, ...args], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let recent = '';
  child.stdout.on('data', data => { recent = (recent + data).slice(-4000); });
  child.stderr.on('data', data => { recent = (recent + data).slice(-4000); });
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) { console.error(`Dịch vụ ${file} đã dừng (${code}).\n${recent}`); stop(1); } });
}
const run = args => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
function checkPort(port) { return new Promise((resolve, reject) => { const socket = net.createConnection({ host: '127.0.0.1', port }); socket.on('connect', () => { socket.destroy(); resolve(true); }); socket.on('error', () => resolve(false)); socket.setTimeout(700, () => { socket.destroy(); resolve(false); }); }); }
async function wait(url, init) {
  for (let attempt = 0; attempt < 80; ++attempt) {
    try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(1500) }); if (r.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Dịch vụ chưa sẵn sàng: ${url}`);
}
try {
  for (const port of [3001, 5001, 8080, 8545]) if (await checkPort(port)) throw new Error(`Cổng ${port} đang được sử dụng. Dừng dịch vụ cũ hoặc dùng cách chạy từng terminal trong README.`);
  try { await access('.tools/kubo/' + (process.platform === 'win32' ? 'ipfs.exe' : 'ipfs')); }
  catch { run(['scripts/install-ipfs.mjs']); }
  console.log('Đang biên dịch Lson…');
  run(['node_modules/typescript/bin/tsc', '--noEmit']);
  run(['node_modules/vite/bin/vite.js', 'build']);
  console.log('Đang khởi động IPFS, Hardhat và API trên localhost…');
  service('scripts/ipfs.mjs');
  service('node_modules/hardhat/dist/src/cli.js', ['node', '--hostname', '127.0.0.1']);
  service('server/index.mjs', ['--serve']);
  await Promise.all([
    wait('http://127.0.0.1:3001/api/health'),
    wait('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) }),
  ]);
  run(['node_modules/hardhat/dist/src/cli.js', 'run', 'scripts/deploy.ts', '--network', 'localhost']);
  run(['node_modules/hardhat/dist/src/cli.js', 'run', 'scripts/seed.ts', '--network', 'localhost']);
  console.log('\nLson sẵn sàng: http://127.0.0.1:3001\nHardhat Local: http://127.0.0.1:8545 · chain ID 31337\nWindows: chạy .\\start-demo.cmd accounts ở terminal khác để xem tài khoản thử nghiệm.\nGiữ terminal này mở. Nhấn Ctrl+C để dừng các dịch vụ demo.');
} catch (error) { console.error(error.message); stop(1); }
