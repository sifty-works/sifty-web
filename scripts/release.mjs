#!/usr/bin/env node

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

execSync('npm run build', { stdio: 'inherit', cwd: root })

const apiYaml = readFileSync(join(root, 'api/openapi.yaml'))
const apiSha = createHash('sha256').update(apiYaml).digest('hex')
writeFileSync(join(root, 'dist/api.sha256'), apiSha + '\n')

mkdirSync(join(root, 'release'), { recursive: true })
const filename = `sifty-web-${version}.tar.gz`
const tarball = join(root, 'release', filename)
execFileSync('tar', ['-czf', tarball, '-C', join(root, 'dist'), '.'], {
  stdio: 'inherit',
})

const tarData = readFileSync(tarball)
const tarSha = createHash('sha256').update(tarData).digest('hex')
const checksumLine = `${tarSha}  ${filename}`
writeFileSync(join(root, 'release', `sifty-web-${version}.sha256`), checksumLine + '\n')

console.log(tarball)
console.log(join(root, 'release', `sifty-web-${version}.sha256`))
console.log(checksumLine)
