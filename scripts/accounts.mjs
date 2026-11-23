import { HDNodeWallet } from 'ethers';

// Hardhat's public development mnemonic. Never use these keys on a real network.
const mnemonic = 'test test test test test test test test test test test junk';
console.log('CHỈ DÙNG CHO HARDHAT LOCAL. Các khóa dưới đây là khóa thử nghiệm công khai. KHÔNG nhận hoặc giữ tiền thật.\n');
for (let i = 0; i < 6; i++) {
  const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`);
  console.log(`Tài khoản #${i}\nĐịa chỉ: ${wallet.address}\nPrivate key thử nghiệm: ${wallet.privateKey}\n`);
}
