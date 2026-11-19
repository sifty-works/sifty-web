#!/usr/bin/env node

import { copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverPath = process.argv[2]
if (!serverPath) {
  console.error('Usage: npm run sync-api -- <path-to-sifty-server>')
  process.exit(1)
}

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const src = resolve(serverPath, 'api/openapi.yaml')
const dst = join(root, 'api/openapi.yaml')

copyFileSync(src, dst)
console.log(`Copied api/openapi.yaml from ${serverPath}`)

const otsBin = join(root, 'node_modules/.bin/openapi-typescript')
execFileSync(otsBin, [join(root, 'api/openapi.yaml'), '-o', join(root, 'src/api/schema.gen.ts')], {
  stdio: 'inherit',
  cwd: root,
})
console.log('Regenerated src/api/schema.gen.ts')
