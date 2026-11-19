import { EventEmitter } from 'node:events';
import bip39 from 'bip39';
import { ethers } from 'ethers';
import { getBalance, sleep } from './providers.js';
import { isExcluded } from './exclusions.js';
import { store } from './store.js';

export class Engine extends EventEmitter {
  #state = 'idle';          // idle | running | paused | stopped
  #inflight = 0;
  #scanned = 0;
  #hits = 0;
  #errors = 0;
  #errorWindow = 0;
  #stamps = [];
  #lastStats = 0;
  #concurrency = Number(process.env.CONCURRENCY ?? 8);
  #baseDelay = Number(process.env.BASE_DELAY_MS ?? 250);
  #delay = this.#baseDelay;
  #stopAfter = process.env.STOP_AFTER ? Number(process.env.STOP_AFTER) : null;

  get running() { return this.#state === 'running'; }

  start() {
    if (this.#state === 'running') return;
    this.#state = 'running';
    this.emit('state', this.#state);
    this.#pump();
  }

  pause() {
    if (this.#state !== 'running') return;
    this.#state = 'paused';
    this.emit('state', this.#state);
  }

  stop() {
    this.#state = 'stopped';
    this.emit('state', this.#state);
  }

  snapshot() {
    return {
      state: this.#state,
      scanned: this.#scanned,
      hits: this.#hits,
      errors: this.#errors,
      rate: this.#rate(),
      concurrency: this.#concurrency,
      dbScanned: store.count(),
      dbHits: store.hitCount(),
    };
  }

  #rate() {
    const cutoff = Date.now() - 10_000;
    this.#stamps = this.#stamps.filter((t) => t > cutoff);
    return Math.round((this.#stamps.length / 10) * 60);
  }

  async #pump() {
    while (this.running) {
      if (this.#stopAfter !== null && this.#scanned >= this.#stopAfter) {
        this.stop();
        break;
      }

      const slots = this.#concurrency - this.#inflight;
      for (let i = 0; i < slots && this.running; i++) {
        this.#inflight++;
        this.#scanOne().finally(() => this.#inflight--);
      }

      await sleep(this.#delay);
      this.#tune();
      this.#emitStats();
    }
  }

  // Adapts pacing to the observed error rate instead of a fixed sleep.
  #tune() {
    if (this.#errorWindow > this.#concurrency) {
      this.#delay = Math.min(this.#delay * 2, 8000);
      this.#errorWindow = 0;
    } else if (this.#delay > this.#baseDelay) {
      this.#delay = Math.max(this.#delay * 0.85, this.#baseDelay);
    }
  }

  #emitStats() {
    const now = Date.now();
    if (now - this.#lastStats < 500) return;
    this.#lastStats = now;
    this.emit('stats', this.snapshot());
  }

  async #scanOne() {
    try {
      const mnemonic = bip39.generateMnemonic(128);
      const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);

      if (store.has(wallet.address) || isExcluded(wallet.address)) return;

      let balance;
      try {
        balance = await getBalance(wallet.address);
      } catch {
        this.#errors++;
        this.#errorWindow++;
        store.record(wallet.address, mnemonic, false);
        this.emit('scan', { address: wallet.address, balance: null, verified: false });
        return;
      }

      this.#scanned++;
      this.#stamps.push(Date.now());
      store.record(wallet.address, mnemonic, true);

      if (balance > 0) {
        this.#hits++;
        store.addHit({ address: wallet.address, mnemonic, balance });
        this.emit('hit', { address: wallet.address, mnemonic, balance });
      }

      this.emit('scan', { n: this.#scanned, address: wallet.address, balance, verified: true });
    } catch (err) {
      this.emit('error', err.message);
    }
  }

  // Re-checks addresses whose balance call failed. Run at a low rate.
  async recheck(limit = 100) {
    const rows = store.pending(limit);
    let ok = 0;
    for (const { address, mnemonic } of rows) {
      try {
        const balance = await getBalance(address, { attempts: 3 });
        store.markVerified(address);
        if (balance > 0) {
          store.addHit({ address, mnemonic, balance });
          this.emit('hit', { address, mnemonic, balance });
        }
        ok++;
      } catch { /* stays unverified for the next pass */ }
      await sleep(500);
    }
    return { checked: rows.length, recovered: ok };
  }
}

export const engine = new Engine();