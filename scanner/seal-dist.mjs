import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { deriveKey, seal, CHECK } from '../js/seal.js';

const pass = process.env.SITE_KEY;
const dist = process.argv[2] || 'dist';
if (!pass) { console.log('no SITE_KEY, leaving files unlocked'); process.exit(0); }
const key = await deriveKey(pass);
const files = [];
for (const f of await readdir(`${dist}/data`)) if (f.endsWith('.json')) files.push(`data/${f}`);
for (const f of ['assets/agents/phoenix.json', 'assets/agents/phoenix.png', 'assets/specter.json', 'assets/specter.png']) if (existsSync(`${dist}/${f}`)) files.push(f);
for (const f of files) {
  const enc = await seal(key, await readFile(`${dist}/${f}`));
  await writeFile(`${dist}/${f}.enc`, enc);
  await rm(`${dist}/${f}`);
}
const check = Buffer.from(await seal(key, new TextEncoder().encode(CHECK))).toString('base64');
await writeFile(`${dist}/lock.json`, JSON.stringify({ check, files }));
console.log('sealed', files.length, 'files');
