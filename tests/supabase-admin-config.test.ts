/**
 * Unit tests for the fail-closed server Supabase client config. Fully offline
 * (creating a supabase-js client does not open a connection). Run with:
 *   node --import tsx --test tests/supabase-admin-config.test.ts
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAKE_URL = 'https://unit-test-project.supabase.co';
const FAKE_KEY = 'unit-test-service-role-key-not-real';

let mod: typeof import('../api/_lib/supabaseAdmin.ts');

before(async () => {
  // The module validates process.env at import time, so provide fake values first.
  process.env.SUPABASE_URL = FAKE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_KEY;
  mod = await import('../api/_lib/supabaseAdmin.ts');
});

test('accepts exactly SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY', () => {
  const cfg = mod.getSupabaseServerConfig({ SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY });
  assert.deepEqual(cfg, { url: FAKE_URL, serviceRoleKey: FAKE_KEY });
  assert.ok(mod.supabaseAdmin, 'shared client is created when both are present');
});

test('throws when SUPABASE_URL is missing or blank', () => {
  for (const url of [undefined, '', '   ']) {
    assert.throws(
      () => mod.getSupabaseServerConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
      /Missing required environment variable\(s\): SUPABASE_URL\./
    );
  }
});

test('throws when SUPABASE_SERVICE_ROLE_KEY is missing or blank', () => {
  for (const key of [undefined, '', '   ']) {
    assert.throws(
      () => mod.getSupabaseServerConfig({ SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: key }),
      /Missing required environment variable\(s\): SUPABASE_SERVICE_ROLE_KEY\./
    );
  }
});

test('does NOT accept alternative names or public (VITE_/NEXT_PUBLIC_) variables', () => {
  const aliasesOnly = {
    VITE_SUPABASE_URL: FAKE_URL,
    NEXT_PUBLIC_SUPABASE_URL: FAKE_URL,
    SUPABASE_KEY: FAKE_KEY,
    SERVICE_ROLE_KEY: FAKE_KEY,
    SUPABASE_SECRET_KEY: FAKE_KEY,
    SUPABASE_SERVICE_KEY: FAKE_KEY,
    VITE_SUPABASE_ANON_KEY: FAKE_KEY,
  };
  assert.throws(
    () => mod.getSupabaseServerConfig(aliasesOnly),
    /Missing required environment variable\(s\): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\./
  );
});

test('rejects an invalid or non-https SUPABASE_URL', () => {
  assert.throws(
    () => mod.getSupabaseServerConfig({ SUPABASE_URL: 'not a url', SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
    /not a valid URL/
  );
  assert.throws(
    () => mod.getSupabaseServerConfig({ SUPABASE_URL: 'http://evil.example.com', SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY }),
    /must use https/
  );
});

test('error messages never contain the secret value', () => {
  try {
    mod.getSupabaseServerConfig({ SUPABASE_URL: 'not a url', SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY });
    assert.fail('expected throw');
  } catch (e: any) {
    assert.ok(!String(e.message).includes(FAKE_KEY));
  }
});

test('api/ contains no hardcoded Supabase URL/JWT and only one createClient', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(fileURLToPath(new URL('../api', import.meta.url)));
  const createClientFiles: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(src), `hardcoded JWT-looking key in ${f}`);
    assert.ok(!/https:\/\/[a-z0-9-]+\.supabase\.co/.test(src), `hardcoded Supabase URL in ${f}`);
    assert.ok(!/\.vercel\.app/.test(src), `hardcoded vercel.app URL in ${f}`);
    if (/\bcreateClient\s*\(/.test(src)) createClientFiles.push(f);
  }
  assert.equal(createClientFiles.length, 1, `createClient used in: ${createClientFiles.join(', ')}`);
  assert.ok(createClientFiles[0].endsWith(join('api', '_lib', 'supabaseAdmin.ts')));
});
