import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const version = '0.39.0';
const platform = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
if (!platform || !arch) throw new Error('Hãy cài Kubo thủ công: https://docs.ipfs.tech/install/command-line/');
const root = fileURLToPath(new URL('../.tools/', import.meta.url));
const binary = join(root, 'kubo', process.platform === 'win32' ? 'ipfs.exe' : 'ipfs');
try { await access(binary); console.log('Kubo đã được cài tại', binary); process.exit(0); } catch {}
await mkdir(root, { recursive: true });
const extension = process.platform === 'win32' ? 'zip' : 'tar.gz';
const name = `kubo_v${version}_${platform}-${arch}.${extension}`;
const url = `https://github.com/ipfs/kubo/releases/download/v${version}/${name}`;
console.log(`Đang tải Kubo ${version} từ bản phát hành chính thức github.com/ipfs/kubo…`);
const archivePath = join(root, name);
const checksum = await fetch(`${url}.sha512`, { signal: AbortSignal.timeout(30000) });
if (!checksum.ok) throw new Error('Không tải được checksum Kubo. Kiểm tra kết nối mạng.');
let bytes;
try { bytes = await readFile(archivePath); }
catch {
  const archive = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!archive.ok) throw new Error('Không tải được Kubo. Kiểm tra kết nối mạng.');
  bytes = Buffer.from(await archive.arrayBuffer());
}
const expected = (await checksum.text()).trim().split(/\s+/)[0].toLowerCase();
if (createHash('sha512').update(bytes).digest('hex') !== expected) throw new Error('SHA-512 không khớp. Dừng cài đặt.');
await writeFile(archivePath, bytes);
if (process.platform === 'win32') {
  // Arguments passed through env avoid interpolating filesystem paths into PowerShell code.
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:MACH_ARCHIVE, $env:MACH_TOOLS)'], {
    env: { ...process.env, MACH_ARCHIVE: archivePath, MACH_TOOLS: root }, stdio: 'inherit', windowsHide: true,
  });
} else execFileSync('tar', ['-xzf', archivePath, '-C', root], { stdio: 'inherit' });
await access(binary);
console.log('Đã xác minh SHA-512 và cài Kubo. Chạy pnpm ipfs.');
