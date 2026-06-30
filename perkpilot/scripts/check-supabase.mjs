// Verifies a real Supabase backend is reachable and seeded. Reads
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY from the environment
// or from perkpilot/.env. Run: node scripts/check-supabase.mjs
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    const text = readFileSync(new URL('../.env', import.meta.url).pathname, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env — rely on process.env */
  }
  return env;
}

async function table(url, key, name, select = 'id') {
  const res = await fetch(`${url}/rest/v1/${name}?select=${select}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${name}: HTTP ${res.status} — ${body.slice(0, 180)}`);
  }
  const range = res.headers.get('content-range'); // e.g. "0-24/25"
  const count = range?.split('/')[1] ?? '?';
  return Number(count);
}

const env = loadEnv();
const url = (env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error('✗ Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('  Copy .env.example to .env and fill them in, then re-run.');
  process.exit(1);
}

console.log(`→ Checking ${url} …`);
try {
  const cards = await table(url, key, 'card_catalog');
  const programs = await table(url, key, 'program_reference', 'program');
  console.log(`✓ Reachable. card_catalog: ${cards} rows, program_reference: ${programs} rows.`);
  if (cards === 0) {
    console.log('⚠ Catalog is empty — paste supabase/bootstrap.sql into the SQL editor to seed it.');
    process.exit(2);
  }
  console.log('✓ Backend looks ready. Set EXPO_PUBLIC_USE_MOCK_DATA=false and run `npx expo start`.');
} catch (e) {
  console.error(`✗ ${e.message}`);
  console.error('  401/403 → wrong anon key. 404/relation missing → run supabase/bootstrap.sql first.');
  process.exit(1);
}
