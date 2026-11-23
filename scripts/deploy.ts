import { network, artifacts } from 'hardhat';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { ethers } = await network.create();
const chain = await ethers.provider.getNetwork();
if (chain.chainId !== 31337n) throw new Error('Script demo chỉ triển khai trên Hardhat local (31337).');
const social = await ethers.deployContract('MachSocial');
await social.waitForDeployment();
const receipt = await social.deploymentTransaction()!.wait();
const deployment = {
  chainId: Number(chain.chainId),
  contractAddress: await social.getAddress(),
  tokenAddress: await social.token(),
  blockNumber: receipt!.blockNumber,
  blockHash: receipt!.blockHash,
  deployedAt: new Date().toISOString(),
};
await mkdir('public', { recursive: true });
try {
  const previous = JSON.parse(await readFile('public/deployment.json', 'utf8'));
  if (/^0x[0-9a-fA-F]{40}$/.test(previous.contractAddress)) {
    await mkdir('.local/deployments', { recursive: true });
    await writeFile(`.local/deployments/${previous.contractAddress}.json`, JSON.stringify(previous, null, 2));
  }
} catch (error: any) { if (error.code !== 'ENOENT') throw error; }
await writeFile('public/deployment.json', JSON.stringify(deployment, null, 2));
// Exported ABI is useful for the report and external integrations.
await mkdir('abi', { recursive: true });
for (const name of ['MachSocial', 'MachToken']) {
  const artifact = await artifacts.readArtifact(name);
  await writeFile(`abi/${name}.json`, JSON.stringify(artifact.abi, null, 2));
}
console.log('Đã triển khai:', deployment);
