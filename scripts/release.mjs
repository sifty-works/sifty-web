#!/usr/bin/env node
// Builds the client, packs dist/ into a versioned archive and writes
// checksums. Run via: npm run release -- <version>
//
// Produces:
//   dist/api.sha256               SHA-256 hex of api/openapi.yaml
//   release/sifty-web-<v>.tar.gz  dist contents (index.html at archive root)
//   release/sifty-web-<v>.sha256  "<hex>  sifty-web-<v>.tar.gz"
import { createHash } from 'node:crypto'
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const version = process.argv[2]
if (!version) {
  console.error('Usage: npm run release -- <version>')
  process.exit(1)
}

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

// Build the client.
execSync('npm run build', { stdio: 'inherit', cwd: root })

// Write dist/api.sha256.
const apiYaml = readFileSync(join(root, 'api/openapi.yaml'))
const apiSha = createHash('sha256').update(apiYaml).digest('hex')
writeFileSync(join(root, 'dist/api.sha256'), apiSha + '\n')

// Pack dist/ into the archive (contents at archive root).
mkdirSync(join(root, 'release'), { recursive: true })
const filename = `sifty-web-${version}.tar.gz`
const tarball = join(root, 'release', filename)
execFileSync('tar', ['-czf', tarball, '-C', join(root, 'dist'), '.'], {
  stdio: 'inherit',
})

// Write the tarball's checksum file.
const tarData = readFileSync(tarball)
const tarSha = createHash('sha256').update(tarData).digest('hex')
const checksumLine = `${tarSha}  ${filename}`
writeFileSync(join(root, 'release', `sifty-web-${version}.sha256`), checksumLine + '\n')

console.log(tarball)
console.log(join(root, 'release', `sifty-web-${version}.sha256`))
console.log(checksumLine)
