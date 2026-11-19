// core/engine.js
import { EventEmitter } from 'node:events';

export class Scanner extends EventEmitter {
  constructor({ provider, store, batchSize = 25, delay = 1000 }) { ... }

  async scanOne() {
    const mnemonic = bip39.generateMnemonic(128);
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
    if (this.store.has(wallet.address)) return;

    const balance = await checkBalance(wallet.address);   // returns null on failure, not 0
    this.scanned++;

    this.emit('scan', { n: this.scanned, address: wallet.address, balance });

    if (balance > 0) {
      this.store.addHit({ address: wallet.address, mnemonic, balance });
      this.emit('hit', { address: wallet.address, mnemonic, balance });
    }
  }
}