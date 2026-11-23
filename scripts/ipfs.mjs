import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = fileURLToPath(new URL(`../.tools/kubo/${process.platform === 'win32' ? 'ipfs.exe' : 'ipfs'}`, import.meta.url));
if (!existsSync(binary)) { console.error('Chạy pnpm ipfs:install trước.'); process.exit(1); }
const env = { ...process.env, IPFS_PATH: `${root}.ipfs` };
const run = args => execFileSync(binary, args, { env, stdio: 'inherit', windowsHide: true });
if (!existsSync(`${root}.ipfs/config`)) run(['init', '--profile=server']);
// All administrative and gateway endpoints stay on loopback; no public RPC.
run(['config', 'Addresses.API', '/ip4/127.0.0.1/tcp/5001']);
run(['config', 'Addresses.Gateway', '/ip4/127.0.0.1/tcp/8080']);
const child = spawn(binary, ['daemon'], { env, stdio: 'inherit', windowsHide: true });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => process.exit(code ?? 0));
