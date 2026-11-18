#!/usr/bin/env node
// Checks that src/api/schema.gen.ts is up to date with api/openapi.yaml.
// Exits non-zero when it is stale. Run as part of: npm run check
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const otsBin = join(root, 'node_modules/.bin/openapi-typescript')
const tmp = join(tmpdir(), `schema.gen.${process.pid}.ts`)

try {
  execFileSync(
    otsBin,
    [join(root, 'api/openapi.yaml'), '-o', tmp],
    { stdio: ['ignore', 'ignore', 'inherit'], cwd: root },
  )
  const current = readFileSync(join(root, 'src/api/schema.gen.ts'), 'utf8')
  const generated = readFileSync(tmp, 'utf8')
  if (current !== generated) {
    console.error(
      'src/api/schema.gen.ts is stale against api/openapi.yaml; ' +
      "run 'npm run sync-api -- <path-to-sifty-server>' to regenerate",
    )
    process.exit(1)
  }
} finally {
  try { unlinkSync(tmp) } catch { /* ignore */ }
}
