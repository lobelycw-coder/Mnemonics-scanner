// core/store.js
import Database from 'better-sqlite3';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? './data';
mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(join(DATA_DIR, 'scanner.db'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');