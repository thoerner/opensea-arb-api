import Wallet from 'ethereumjs-wallet'
import fs from 'fs'

const wallet = Wallet.default.generate();

const privateKey = wallet.getPrivateKey();
const publicKey = wallet.getPublicKey();

console.log('Private Key: ' + privateKey.toString('hex'));
console.log('Public Key: ' + publicKey.toString('hex'));

const checksumAddress = wallet.getChecksumAddressString();
console.log(`Checksum Address: ${checksumAddress}`);


// save private and public keys to a single file in keys/ folder as {address}.key
fs.writeFileSync(`keys/${checksumAddress}.key`, 'Private Key: ' + privateKey.toString('hex') + '\n' + 'Public Key: ' + publicKey.toString('hex'));
