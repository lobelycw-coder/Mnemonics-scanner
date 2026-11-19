import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? './data';
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, 'scanner.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS scanned (
    address   TEXT PRIMARY KEY,
    mnemonic  TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'ok',
    seen_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scanned_status ON scanned(status, seen_at);
  CREATE TABLE IF NOT EXISTS hits (
    address   TEXT PRIMARY KEY,
    mnemonic  TEXT NOT NULL,
    balance   REAL NOT NULL,
    found_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`);

// Prepared once, reused for every wallet. This is the hot path.
const q = {
  has:      db.prepare('SELECT 1 FROM scanned WHERE address = ?'),
  insert:   db.prepare('INSERT OR IGNORE INTO scanned (address, mnemonic, status, seen_at) VALUES (?, ?, ?, ?)'),
  hit:      db.prepare('INSERT OR REPLACE INTO hits (address, mnemonic, balance, found_at) VALUES (?, ?, ?, ?)'),
  markOk:   db.prepare("UPDATE scanned SET status = 'ok' WHERE address = ?"),
  pending:  db.prepare("SELECT address, mnemonic FROM scanned WHERE status = 'unverified' ORDER BY seen_at LIMIT ?"),
  count:    db.prepare('SELECT COUNT(*) AS n FROM scanned'),
  hitCount: db.prepare('SELECT COUNT(*) AS n FROM hits'),
  hits:     db.prepare('SELECT * FROM hits ORDER BY found_at DESC LIMIT ?'),
  recent:   db.prepare('SELECT address, status FROM scanned ORDER BY seen_at DESC LIMIT ?'),
  clearHits:db.prepare('DELETE FROM hits'),
};

export const store = {
  has: (a) => !!q.has.get(a),

  /**
   * Records a scan. status 'unverified' when the balance call failed, so the
   * address stays recoverable by the recheck pass instead of being lost.
   */
  record(address, mnemonic, verified) {
    q.insert.run(address, mnemonic, verified ? 'ok' : 'unverified', Date.now());
  },

  markVerified: (a) => q.markOk.run(a),
  addHit: (h) => q.hit.run(h.address, h.mnemonic, h.balance, Date.now()),
  pending: (limit = 100) => q.pending.all(limit),
  count: () => q.count.get().n,
  hitCount: () => q.hitCount.get().n,
  hits: (limit = 200) => q.hits.all(limit),
  recent: (limit = 100) => q.recent.all(limit),
  clearHits: () => q.clearHits.run(),
  db,
};