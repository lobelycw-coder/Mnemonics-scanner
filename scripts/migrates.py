import { readFileSync, existsSync } from 'node:fs';
import { store } from '../core/store.js';

store.db.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
const done = store.db.prepare(`SELECT v FROM meta WHERE k='imported'`).get();
if (done) process.exit(0);

if (existsSync('scanned.txt')) {
  const insert = store.db.prepare('INSERT OR IGNORE INTO scanned (address) VALUES (?)');
  const rows = readFileSync('scanned.txt', 'utf8').split('\n').filter(Boolean);
  store.db.transaction(() => rows.forEach(a => insert.run(a.trim())))();
  console.log(`imported ${rows.length}`);
}
store.db.prepare(`INSERT INTO meta (k, v) VALUES ('imported', '1')`).run();