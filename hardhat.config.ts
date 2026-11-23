import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: '0.8.28', path: require.resolve('solc/soljson.js'),
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    default: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
    localhost: { type: 'http', chainType: 'l1', url: 'http://127.0.0.1:8545', chainId: 31337 },
  },
});
