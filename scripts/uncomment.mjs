#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const req = createRequire(import.meta.url)
const ts = req(resolve(fileURLToPath(new URL('.', import.meta.url)), '../node_modules/openapi-typescript/node_modules/typescript'))

const args = process.argv.slice(2)
if (args.length < 1 || (args[0] !== '-l' && args[0] !== '-w')) {
  process.stderr.write('Usage: uncomment.mjs -l|-w <file...>\n')
  process.exit(2)
}

const mode = args[0]
const files = args.slice(1)
let totalFound = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const ext = file.match(/\.([^./]+)$/)?.[1] ?? ''
  if (ext === 'ts' || ext === 'tsx' || ext === 'mjs') {
    totalFound += processTS(file, src, ext)
  } else if (ext === 'css') {
    totalFound += processCSS(file, src)
  } else if (ext === 'sh') {
    totalFound += processSH(file, src)
  } else if (ext === 'html') {
    totalFound += processHTML(file, src)
  }
}

if (mode === '-l' && totalFound > 0) process.exit(1)

function processTS(file, src, ext) {
  const isTSX = ext === 'tsx'
  const scriptKind = isTSX ? ts.ScriptKind.TSX : (ext === 'mjs' ? ts.ScriptKind.JS : ts.ScriptKind.TS)
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, scriptKind)

  const jsxContainerRanges = []
  if (isTSX) {
    function walkForJSX(node) {
      if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
        jsxContainerRanges.push([node.getStart(sf), node.getEnd()])
      }
      node.forEachChild(walkForJSX)
    }
    walkForJSX(sf)
  }

  const ranges = new Map()

  function walkAllTokens(node) {
    const count = node.getChildCount(sf)
    if (count === 0) {
      const leading = ts.getLeadingCommentRanges(src, node.getFullStart())
      if (leading) {
        for (const r of leading) {
          const text = src.slice(r.pos, r.end)
          if (text.startsWith('/// <reference')) continue
          let inside = false
          for (const [cPos, cEnd] of jsxContainerRanges) {
            if (r.pos >= cPos && r.end <= cEnd) { inside = true; break }
          }
          if (!inside && !ranges.has(r.pos)) ranges.set(r.pos, r.end)
        }
      }
      const trailing = ts.getTrailingCommentRanges(src, node.getEnd())
      if (trailing) {
        for (const r of trailing) {
          const text = src.slice(r.pos, r.end)
          if (text.startsWith('/// <reference')) continue
          let inside = false
          for (const [cPos, cEnd] of jsxContainerRanges) {
            if (r.pos >= cPos && r.end <= cEnd) { inside = true; break }
          }
          if (!inside && !ranges.has(r.pos)) ranges.set(r.pos, r.end)
        }
      }
      return
    }
    for (let i = 0; i < count; i++) walkAllTokens(node.getChildAt(i, sf))
  }
  walkAllTokens(sf)

  for (const [pos, end] of jsxContainerRanges) {
    ranges.set(pos, end)
  }

  if (ranges.size === 0) return 0

  if (mode === '-l') {
    for (const [pos] of [...ranges.entries()].sort((a, b) => a[0] - b[0])) {
      process.stdout.write(`${file}:${src.slice(0, pos).split('\n').length}\n`)
    }
    return ranges.size
  }

  let result = src
  for (const [pos, end] of [...ranges.entries()].sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, pos) + result.slice(end)
  }

  result = normalizeBlankLines(result, isTSX)
  if (result !== src) writeFileSync(file, result)
  return ranges.size
}

function processCSS(file, src) {
  const ranges = []
  let i = 0
  let state = 'normal'
  let commentStart = -1

  while (i < src.length) {
    const ch = src[i]
    if (state === 'normal') {
      if (ch === "'") { state = 'str1'; i++; continue }
      if (ch === '"') { state = 'str2'; i++; continue }
      if (ch === '/' && src[i + 1] === '*') { commentStart = i; state = 'comment'; i += 2; continue }
    } else if (state === 'str1') {
      if (ch === '\\') { i += 2; continue }
      if (ch === "'") state = 'normal'
    } else if (state === 'str2') {
      if (ch === '\\') { i += 2; continue }
      if (ch === '"') state = 'normal'
    } else if (state === 'comment') {
      if (ch === '*' && src[i + 1] === '/') { ranges.push([commentStart, i + 2]); state = 'normal'; i += 2; continue }
    }
    i++
  }

  if (ranges.length === 0) return 0

  if (mode === '-l') {
    for (const [pos] of ranges) {
      process.stdout.write(`${file}:${src.slice(0, pos).split('\n').length}\n`)
    }
    return ranges.length
  }

  let result = src
  for (let j = ranges.length - 1; j >= 0; j--) {
    const [pos, end] = ranges[j]
    result = result.slice(0, pos) + result.slice(end)
  }

  result = normalizeBlankLines(result, false)
  if (result !== src) writeFileSync(file, result)
  return ranges.length
}

function processSH(file, src) {
  const lines = src.split('\n')
  const commentIdxs = []
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i].startsWith('#!')) continue
    if (lines[i].trimStart().startsWith('#')) commentIdxs.push(i)
  }

  if (commentIdxs.length === 0) return 0

  if (mode === '-l') {
    for (const i of commentIdxs) process.stdout.write(`${file}:${i + 1}\n`)
    return commentIdxs.length
  }

  const skip = new Set(commentIdxs)
  let result = lines.filter((_, i) => !skip.has(i)).join('\n')
  result = normalizeBlankLines(result, false)
  if (result !== src) writeFileSync(file, result)
  return commentIdxs.length
}

function processHTML(file, src) {
  const ranges = []
  let i = 0
  while (i < src.length) {
    const start = src.indexOf('<!--', i)
    if (start === -1) break
    const end = src.indexOf('-->', start + 4)
    if (end === -1) break
    ranges.push([start, end + 3])
    i = end + 3
  }

  if (ranges.length === 0) return 0

  if (mode === '-l') {
    for (const [pos] of ranges) {
      process.stdout.write(`${file}:${src.slice(0, pos).split('\n').length}\n`)
    }
    return ranges.length
  }

  let result = src
  for (let j = ranges.length - 1; j >= 0; j--) {
    const [pos, end] = ranges[j]
    result = result.slice(0, pos) + result.slice(end)
  }

  result = normalizeBlankLines(result, false)
  if (result !== src) writeFileSync(file, result)
  return ranges.length
}

function normalizeBlankLines(text, isTSX) {
  const endsWithNewline = text.endsWith('\n')
  const lines = text.split('\n')
  const count = endsWithNewline ? lines.length - 1 : lines.length
  const out = []

  for (let i = 0; i < count; i++) {
    const line = lines[i]
    const isBlank = line.trim() === ''

    if (!isBlank) {
      out.push(line)
      continue
    }

    if (out.length === 0) continue

    if (out[out.length - 1].trim() === '') continue

    let prevIdx = out.length - 1
    while (prevIdx >= 0 && out[prevIdx].trim() === '') prevIdx--
    if (prevIdx < 0) continue

    const prevLine = out[prevIdx].trimEnd()

    if (prevLine.endsWith('{') || prevLine.endsWith('(')) continue

    if (isTSX && prevLine.endsWith('>') && !prevLine.endsWith('/>') && !/<\/\w/.test(prevLine)) continue

    out.push('')
  }

  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()

  return out.join('\n') + (endsWithNewline ? '\n' : '')
}
