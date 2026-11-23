import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = { cwd: root, env: { ...process.env, VITE_SAMPLE_ONLY: 'true' }, stdio: 'inherit', windowsHide: true };
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], options);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'out'], options);
// Local deployment metadata is excluded from the hosted sample build.
await rm(fileURLToPath(new URL('../out/deployment.json', import.meta.url)), { force: true });
