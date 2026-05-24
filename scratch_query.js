import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath2 = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7374fef25ccac9ec6b58abb7cb382bb3da92c78f756d4d4484cde648ac3d59cf.sqlite');
const db2 = new DatabaseSync(dbPath2);

console.log('--- DB 2 Orders ---');
try {
  console.log(db2.prepare("SELECT * FROM orders").all());
} catch (e) {
  console.error(e.message);
}
