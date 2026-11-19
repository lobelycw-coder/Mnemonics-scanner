import { ethers } from 'ethers';

const URLS = [
  process.env.RPC_PRIMARY,
  process.env.RPC_FALLBACK_1,
  process.env.RPC_FALLBACK_2,
].filter(Boolean);

if (!URLS.length) {
  URLS.push(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
}

// staticNetwork skips a chainId round-trip on every call.
export const pool = URLS.map(
  (url) => new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true }),
);

let cursor = 0;
const next = () => pool[cursor++ % pool.length];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RpcError extends Error {}

/**
 * Returns balance in ETH as a number, or null when the call could not be
 * completed. null means "unknown" — never treat it as zero.
 */
export async function getBalance(address, { attempts = 4 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await next().getBalance(address);
      return Number(ethers.formatEther(raw));
    } catch (err) {
      lastErr = err;
      // Jittered exponential backoff: 400, 800, 1600, 3200ms (+/- 40%)
      const base = 400 * 2 ** i;
      await sleep(base + base * (Math.random() * 0.8 - 0.4));
    }
  }
  throw new RpcError(lastErr?.shortMessage ?? lastErr?.message ?? 'rpc failed');
}