#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSS_FILES = ['theme', 'style', 'role', 'polish', 'profile', 'application', 'fonts'].map((n) => `src/${n}.css`)
const GENERATED = 'src/api/schema.gen.ts'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
if (args.some((a) => a !== '--write')) {
  process.stderr.write('Usage: dead-styles.mjs [--write]\n')
  process.exit(2)
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

function sourceFiles() {
  const out = ['index.html']
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel)
    }
  }
  walk('src')
  return out.sort()
}

function skipString(s, i) {
  const q = s[i]
  i++
  while (i < s.length && s[i] !== q) {
    if (s[i] === '\\') i++
    i++
  }
  return i + 1
}

function scanPrelude(s, i) {
  let depth = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '"' || c === "'") { i = skipString(s, i); continue }
    if (c === '/' && s[i + 1] === '*') throw new Error('comment in stylesheet')
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (depth === 0 && (c === '{' || c === ';' || c === '}')) return i
    i++
  }
  return i
}

function skipDeclarations(s, i) {
  let depth = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '"' || c === "'") { i = skipString(s, i); continue }
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && c === '{') throw new Error(`nested block at offset ${i}`)
    else if (depth === 0 && c === '}') return i
    i++
  }
  throw new Error('unterminated block')
}

function parseSheet(s, i, end) {
  const items = []
  while (true) {
    while (i < end && /\s/.test(s[i])) i++
    if (i >= end || s[i] === '}') return { items, next: i }
    const start = i
    const p = scanPrelude(s, i)
    if (s[p] === ';') { i = p + 1; items.push({ kind: 'opaque', start, end: i }); continue }
    if (s[p] !== '{') throw new Error(`unexpected end near offset ${start}`)
    const prelude = s.slice(start, p)
    if (prelude.startsWith('@')) {
      const name = /^@([a-zA-Z-]+)/.exec(prelude)[1]
      if (name === 'media' || name === 'supports') {
        const inner = parseSheet(s, p + 1, end)
        if (s[inner.next] !== '}') throw new Error(`unterminated @${name} at offset ${start}`)
        items.push({ kind: 'at', name, start, end: inner.next + 1, bodyStart: p + 1, bodyEnd: inner.next, children: inner.items })
        i = inner.next + 1
      } else if (name === 'font-face' || name === 'keyframes') {
        let q = p + 1
        if (name === 'keyframes') {
          let d = 1
          while (d > 0) {
            if (s[q] === '"' || s[q] === "'") { q = skipString(s, q); continue }
            if (s[q] === '{') d++
            else if (s[q] === '}') d--
            q++
          }
        } else {
          q = skipDeclarations(s, q) + 1
        }
        items.push({ kind: 'opaque', start, end: q })
        i = q
      } else {
        throw new Error(`unsupported at-rule @${name}`)
      }
      continue
    }
    const close = skipDeclarations(s, p + 1)
    items.push({ kind: 'rule', start, end: close + 1, selStart: start, selEnd: p, selector: prelude })
    i = close + 1
  }
}

function matchParen(s, i) {
  let depth = 0
  for (; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'") { i = skipString(s, i) - 1; continue }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) return i
  }
  throw new Error(`unbalanced parenthesis in ${s}`)
}

function splitTop(s) {
  const parts = []
  const seps = []
  let depth = 0
  let from = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'") { i = skipString(s, i) - 1; continue }
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(s.slice(from, i)); seps.push(','); from = i + 1 }
  }
  parts.push(s.slice(from))
  return { parts, seps }
}

const IDENT_START = /[_a-zA-Z-]/
const IDENT_CHAR = /[\w-]/
const LIST_FUNCS = new Set(['not', 'is', 'where', 'has'])

function parseCompound(s) {
  const nodes = []
  let text = ''
  const flush = () => { if (text) { nodes.push({ t: 'text', s: text }); text = '' } }
  for (let i = 0; i < s.length;) {
    const c = s[i]
    if (c === '\\') throw new Error(`escape in selector ${s}`)
    if (c === '"' || c === "'") { const e = skipString(s, i); text += s.slice(i, e); i = e; continue }
    if (c === '[') {
      let j = i
      let depth = 0
      for (; j < s.length; j++) {
        if (s[j] === '"' || s[j] === "'") { j = skipString(s, j) - 1; continue }
        if (s[j] === '[') depth++
        else if (s[j] === ']' && --depth === 0) break
      }
      text += s.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (c === '.' && IDENT_START.test(s[i + 1] ?? '')) {
      let j = i + 1
      while (j < s.length && IDENT_CHAR.test(s[j])) j++
      flush()
      nodes.push({ t: 'class', name: s.slice(i + 1, j) })
      i = j
      continue
    }
    if (c === ':') {
      let j = i + 1
      if (s[j] === ':') j++
      const nameStart = j
      while (j < s.length && IDENT_CHAR.test(s[j])) j++
      const name = s.slice(nameStart, j)
      if (s[j] === '(') {
        const close = matchParen(s, j)
        const inner = s.slice(j + 1, close)
        if (LIST_FUNCS.has(name) && s[i + 1] !== ':') {
          flush()
          nodes.push({ t: 'fn', name, args: splitTop(inner).parts.map(parseCompound), raw: s.slice(i, close + 1) })
        } else {
          if (/\.[_a-zA-Z-]/.test(inner.replace(/(["'])(?:\\.|(?!\1).)*\1/g, ''))) throw new Error(`class inside :${name}() is not handled`)
          text += s.slice(i, close + 1)
        }
        i = close + 1
        continue
      }
      text += s.slice(i, j)
      i = j
      continue
    }
    text += c
    i++
  }
  flush()
  return nodes
}

function classesOf(nodes, acc = []) {
  for (const n of nodes) {
    if (n.t === 'class') acc.push(n.name)
    else if (n.t === 'fn') n.args.forEach((a) => classesOf(a, acc))
  }
  return acc
}

function transform(nodes, live) {
  let dead = false
  let out = ''
  let changed = false
  for (const n of nodes) {
    if (n.t === 'text') out += n.s
    else if (n.t === 'class') {
      if (!live(n.name)) dead = true
      out += `.${n.name}`
    } else {
      const results = n.args.map((a) => transform(a, live))
      const kept = results.filter((r) => !r.dead)
      if (n.name === 'not') {
        if (kept.length === 0) { changed = true; continue }
        if (kept.length !== results.length || results.some((r) => r.changed)) changed = true
        out += `:not(${kept.map((r) => r.out).join(',')})`
      } else {
        if (kept.length === 0) { dead = true; out += n.raw; continue }
        if (kept.length !== results.length || results.some((r) => r.changed)) changed = true
        out += `:${n.name}(${kept.map((r) => r.out).join(',')})`
      }
    }
  }
  return { dead, out, changed }
}

function specificity(nodes) {
  let a = 0
  let b = 0
  let c = 0
  for (const n of nodes) {
    if (n.t === 'class') b++
    else if (n.t === 'fn') {
      if (n.name === 'where') continue
      let best = [0, 0, 0]
      for (const arg of n.args) {
        const sp = specificity(arg)
        if (sp[0] > best[0] || (sp[0] === best[0] && (sp[1] > best[1] || (sp[1] === best[1] && sp[2] > best[2])))) best = sp
      }
      a += best[0]; b += best[1]; c += best[2]
    } else {
      const t = n.s
      a += (t.match(/#[\w-]+/g) ?? []).length
      b += (t.match(/\[[^\]]*\]/g) ?? []).length
      const noAttr = t.replace(/\[[^\]]*\]/g, '')
      c += (noAttr.match(/::[\w-]+(\([^)]*\))?/g) ?? []).length
      const noEl = noAttr.replace(/::[\w-]+(\([^)]*\))?/g, '')
      b += (noEl.match(/:[\w-]+(\([^)]*\))?/g) ?? []).length
      const bare = noEl.replace(/:[\w-]+(\([^)]*\))?/g, '').replace(/#[\w-]+/g, '')
      c += (bare.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length
    }
  }
  return [a, b, c]
}

function walkRules(items, fn) {
  for (const it of items) {
    if (it.kind === 'rule') fn(it)
    else if (it.kind === 'at') walkRules(it.children, fn)
  }
}

function splitSelectorList(prelude) {
  const lead = /^\s*/.exec(prelude)[0]
  const trail = /\s*$/.exec(prelude)[0]
  const core = prelude.slice(lead.length, prelude.length - trail.length)
  const { parts } = splitTop(core)
  return { lead, trail, parts }
}

function loadCss(rel) {
  const src = read(rel)
  const sheet = parseSheet(src, 0, src.length)
  if (sheet.next !== src.length) throw new Error(`${rel}: parse stopped at offset ${sheet.next}`)
  walkRules(sheet.items, (r) => {
    const { parts } = splitSelectorList(r.selector)
    r.list = parts.map((p) => ({ raw: p, tree: parseCompound(p) }))
  })
  return { rel, src, items: sheet.items }
}

function wordRe(name) {
  return new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
}

const SITES = [
  {
    step: 3,
    site: 'ProfileDetails skill level',
    file: 'src/views/ProfileDetails.tsx',
    needle: "`profile-skill level-${level || 'none'}`",
    names: (src) => {
      const block = /SKILL_LEVEL_TIPS[^{]*\{([^}]*)\}/.exec(src)[1]
      const keys = [...block.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1])
      return [...keys, 'none'].map((k) => `level-${k}`)
    },
  },
  {
    step: 3,
    site: 'FitScore bucket token',
    file: 'src/views/BandTiles.tsx',
    needle: '`band-fit ${token}`',
    names: () => ['strong', 'partial', 'weak', 'none'],
    unconfirmed: 'bucket text is supplied by the server and cannot be enumerated from the client; these are the names the stylesheet pairs with band-fit',
  },
  {
    step: 3,
    site: 'BandTiles card verdict',
    file: 'src/views/BandTiles.tsx',
    needle: '`band-card ${tone}`',
    names: (src) => {
      const fn = /function verdictMod[\s\S]*?\n}/.exec(src)[0]
      return [...[...fn.matchAll(/return '([a-z]+)'/g)].map((m) => m[1]), 'never', 'unwanted']
    },
  },
  {
    step: 3,
    site: 'BandTiles mark verdict',
    file: 'src/views/BandTiles.tsx',
    needle: '`band-mark ${tone}`',
    names: (src) => {
      const fn = /function verdictMod[\s\S]*?\n}/.exec(src)[0]
      return [...[...fn.matchAll(/return '([a-z]+)'/g)].map((m) => m[1]), 'never', 'unwanted']
    },
  },
  {
    step: 3,
    site: 'GoalsTable goal-cell',
    file: 'src/views/GoalsTable.tsx',
    needle: '`goal-cell ${zone}',
    names: () => ['preferred', 'possible', 'unwanted', 'never', 'neutral'],
  },
  {
    step: 3,
    site: 'GoalsTable goal-chip',
    file: 'src/views/GoalsTable.tsx',
    needle: '`goal-chip ${zone}',
    names: () => ['preferred', 'possible', 'unwanted', 'never', 'neutral'],
  },
  {
    step: 3,
    site: 'GoalsTable goal-col',
    file: 'src/views/GoalsTable.tsx',
    needle: '`goal-col ${z}',
    names: () => ['preferred', 'possible', 'unwanted', 'never', 'neutral'],
  },
  {
    step: 3,
    site: 'GoalsTable goal-dot',
    file: 'src/views/GoalsTable.tsx',
    needle: '`goal-dot ${z}',
    names: () => ['preferred', 'possible', 'unwanted', 'never', 'neutral'],
  },
  {
    step: 3,
    site: 'StatusBar tone',
    file: 'src/views/StatusBar.tsx',
    needle: '`status-bar ${line.tone}`',
    names: (src) => [.../type Tone = ([^\n]*)/.exec(src)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]),
  },
  {
    step: 3,
    site: 'Messages shape',
    file: 'src/views/Messages.tsx',
    needle: "visual ?? (note.kind === 'failure' ? 'retry' : 'info')",
    names: () => ['retry', 'info'],
  },
  {
    step: 3,
    site: 'WhatTheyAsk button kind',
    file: 'src/views/WhatTheyAsk.tsx',
    needle: 'className={kind}',
    names: () => ['add', 'dismiss'],
  },
  {
    step: 3,
    site: 'WhatTheyAsk row verdict',
    file: 'src/views/WhatTheyAsk.tsx',
    needle: '`ask-row ${rowCls}',
    names: (src) => {
      const line = /const rowCls = .*/.exec(src)[0]
      return [...line.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).filter((v) => !['✓', '✕'].includes(v))
    },
  },
  {
    step: 3,
    site: 'ProfilePage what-box variant',
    file: 'src/views/ProfilePage.tsx',
    needle: "`profile-what-box${variant ? ` ${variant}` : ''}`",
    names: () => ['roles', 'any', 'all'],
  },
  {
    step: 3,
    site: 'ProfileSearch inherited marker',
    file: 'src/views/ProfileSearch.tsx',
    needle: 'profile-read-line${inheritedClass(',
    names: (src) => [/return inherited\.has\(fieldName\) \? ' ([\w-]+)' : ''/.exec(src)[1]],
  },
  {
    step: 3,
    site: 'VacancyRow row classes',
    file: 'src/views/VacancyRow.tsx',
    needle: "decidedTo === 'dismissed' ? 'session-no' : ''",
    names: (src) => {
      const a = /const classes = \[([\s\S]*?)\]\.filter/.exec(src)[1]
      const b = /const scoreClasses = \[([\s\S]*?)\]\.filter/.exec(src)[1]
      return [...(a + b).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).filter((v) => v !== 'dismissed')
    },
  },
  {
    step: 3,
    site: 'VacancyPage action table',
    file: 'src/views/VacancyPage.tsx',
    needle: 'className={cls}',
    names: (src) => {
      const table = /export const ACTIONS[\s\S]*?\n}/.exec(src)[0]
      return [...table.matchAll(/cls: '([^']*)'/g)].flatMap((m) => m[1].split(/\s+/))
    },
  },
  {
    step: 3,
    site: 'ListResizer body class',
    file: 'src/views/ListResizer.tsx',
    needle: "document.body.classList.add('resizing-list')",
    names: () => ['resizing-list'],
  },
]

const HAND_DEAD = {
  assessment: 'only in prose ("detailed assessment") inside description props; no className carries it',
  description: 'a prop name of SectionShell, TagInput and Field; the text is rendered into <p className="muted">',
  error: "a status string ('error'), a prop name and body.error; the only Message className is profile-avatar-error",
  evidence: "the property item.evidence (its text goes into className=\"ask-evidence\") and prose",
  import: 'the TypeScript keyword',
  page: "a state variable, aria-current='page' and prose; settings-page is a different token",
}

const HAND_LIVE = {
  broken: 'a value of the Visual prop of Message, which the component offers and no caller passes yet',
  decide: 'a value of the Visual prop of Message, which the component offers and no caller passes yet',
}

const PREFIX_KEEPS = [
  { step: 5, prefix: 'rdp-', reason: 'react-day-picker renders its own rdp-* classes', file: 'src/views/DateInputs.tsx', needle: "from 'react-day-picker'" },
]

function inventoryNonLiteralClassNames(files) {
  const rows = []
  for (const f of files) {
    if (f.rel === GENERATED || !f.rel.endsWith('x') && !f.rel.endsWith('.ts')) continue
    const lines = f.src.split('\n')
    lines.forEach((line, idx) => {
      for (const m of line.matchAll(/(className|classList\.\w+)\s*(=|\()\s*(.*)/g)) {
        const rest = m[3]
        if (/^"[^"]*"/.test(rest) || /^'[^']*'\s*\)/.test(rest) || /^\{'[^']*'\}/.test(rest)) continue
        rows.push({ file: f.rel, line: idx + 1, text: line.trim().slice(0, 140) })
      }
    })
  }
  return rows
}

function main() {
  const files = sourceFiles().map((rel) => ({ rel, src: read(rel) }))
  const nameHits = (name) => {
    const re = wordRe(name)
    return files.filter((f) => re.test(f.src)).map((f) => f.rel)
  }

  const sheets = CSS_FILES.map(loadCss)

  const keepNames = new Map()
  const siteReport = []
  for (const site of SITES) {
    const src = read(site.file)
    const at = src.indexOf(site.needle)
    if (at < 0) throw new Error(`composition site not found: ${site.site} (${site.file})`)
    const line = src.slice(0, at).split('\n').length
    const names = site.names(src)
    if (names.length === 0) throw new Error(`no names derived for ${site.site}`)
    siteReport.push({ ...site, line, derived: names })
    for (const n of names) {
      if (!keepNames.has(n)) keepNames.set(n, [])
      keepNames.get(n).push({ step: site.step, why: `${site.site} (${site.file.replace('src/views/', '')}:${line})`, unconfirmed: site.unconfirmed })
    }
  }
  for (const p of PREFIX_KEEPS) {
    if (!read(p.file).includes(p.needle)) throw new Error(`dependency site not found: ${p.file}`)
  }

  const classLiterals = classContextLiterals(files)
  for (const name of Object.keys(HAND_DEAD)) {
    const re = wordRe(name)
    if (classLiterals.some((t) => re.test(t)) || keepNames.has(name)) throw new Error(`${name} is declared unreachable but a className or a composition site now carries it`)
  }

  const prefixKeep = (name) => PREFIX_KEEPS.find((p) => name.startsWith(p.prefix))

  const nameCache = new Map()
  const byName = (name) => {
    if (!nameCache.has(name)) nameCache.set(name, nameHits(name))
    return nameCache.get(name)
  }
  const liveReason = (name) => {
    if (Object.hasOwn(HAND_DEAD, name)) return null
    const hits = byName(name)
    if (hits.length) return { by: 'name', hits }
    if (keepNames.has(name)) return { by: 'composition', keeps: keepNames.get(name) }
    const pk = prefixKeep(name)
    if (pk) return { by: 'dependency', keeps: [{ step: pk.step, why: pk.reason }] }
    return null
  }
  const isLive = (name) => liveReason(name) !== null

  const allDefined = (list) => {
    const set = new Set()
    for (const sh of list) walkRules(sh.items, (r) => r.list.forEach((s) => classesOf(s.tree).forEach((c) => set.add(c))))
    return set
  }

  const sizes = Object.fromEntries(sheets.map((sh) => [sh.rel, { bytes: Buffer.byteLength(sh.src), lines: sh.src.split('\n').length - (sh.src.endsWith('\n') ? 1 : 0) }]))

  console.log('# Non-literal class channels found in the sources (review against the composition sites below)')
  const inv = inventoryNonLiteralClassNames(files)
  for (const r of inv) console.log(`${r.file}:${r.line}  ${r.text}`)
  console.log('')
  console.log('# Composition sites (step 3) and the names fed in as live')
  for (const s of siteReport) console.log(`${s.file}:${s.line}  ${s.site}: ${s.derived.join(' ')}${s.unconfirmed ? '  [UNCONFIRMED: ' + s.unconfirmed + ']' : ''}`)
  console.log(`dependency (step 5): names starting with ${PREFIX_KEEPS.map((p) => p.prefix).join(', ')}`)
  console.log('')

  let pass = 0
  let removedTotals = {}
  const firstReport = []
  let state = sheets
  while (true) {
    pass++
    const defined = allDefined(state)
    const dead = [...defined].filter((n) => !isLive(n)).sort()
    firstReport.push({ pass, defined: defined.size, dead })
    const perFile = []
    const edits = new Map()
    let changedAny = false
    for (const sh of state) {
      const fileDefined = new Set()
      walkRules(sh.items, (r) => r.list.forEach((s) => classesOf(s.tree).forEach((c) => fileDefined.add(c))))
      const fileDead = [...fileDefined].filter((n) => !isLive(n)).sort()
      const stat = { rel: sh.rel, defined: fileDefined.size, byName: 0, composition: 0, dependency: 0, dead: fileDead, rules: 0, rulesRemoved: 0, rulesEdited: 0, specChanges: [] }
      for (const n of fileDefined) {
        const r = liveReason(n)
        if (r) stat[r.by === 'name' ? 'byName' : r.by]++
      }
      const decide = (items) => {
        const results = []
        for (const it of items) {
          if (it.kind === 'rule') {
            stat.rules++
            const { lead, trail, parts } = splitSelectorList(it.selector)
            const seps = splitTop(it.selector.slice(lead.length, it.selector.length - trail.length)).seps
            const tr = it.list.map((s) => transform(s.tree, isLive))
            const survivors = tr.map((t, i) => (t.dead ? -1 : i)).filter((i) => i >= 0)
            if (survivors.length === 0) {
              stat.rulesRemoved++
              results.push({ it, remove: true, selector: it.selector.trim() })
              continue
            }
            const anyChange = survivors.length !== tr.length || survivors.some((i) => tr[i].changed)
            if (anyChange) {
              let out = ''
              survivors.forEach((i, k) => {
                if (k > 0) out += seps[survivors[k - 1]] ?? ','
                out += tr[i].changed ? tr[i].out : parts[i]
              })
              const newSel = lead + out + trail
              stat.rulesEdited++
              for (const i of survivors) {
                if (tr[i].changed) {
                  const before = specificity(it.list[i].tree)
                  const after = specificity(parseCompound(tr[i].out))
                  if (before.join() !== after.join()) stat.specChanges.push({ selector: parts[i].trim(), after: tr[i].out.trim(), before: before.join(','), afterSpec: after.join(',') })
                }
              }
              results.push({ it, edit: newSel, from: it.selector.trim() })
            } else results.push({ it })
          } else if (it.kind === 'at') {
            const sub = decide(it.children)
            const removedAll = sub.every((r) => r.remove) && it.children.every((c) => c.kind !== 'opaque')
            results.push({ it, sub, remove: removedAll })
          } else results.push({ it })
        }
        return results
      }
      const plan = decide(sh.items)
      const collect = (res, out) => {
        for (const r of res) {
          if (r.remove) { out.push({ start: r.it.start, end: r.it.end, repl: null }); continue }
          if (r.sub) collect(r.sub, out)
          else if (r.edit !== undefined) out.push({ start: r.it.selStart, end: r.it.selEnd, repl: r.edit })
        }
      }
      const list2 = []
      collect(plan, list2)
      edits.set(sh.rel, list2)
      if (list2.length) changedAny = true
      perFile.push(stat)
      sh.plan = plan
    }

    console.log(`## Pass ${pass}: ${defined.size} distinct class names defined across the stylesheets, ${dead.length} dead`)
    for (const st of perFile) {
      console.log(`${st.rel}: ${st.defined} defined, ${st.byName} live by name, ${st.composition} kept by composition (not found by name), ${st.dependency} kept by dependency (not found by name), ${st.dead.length} dead; ${st.rules} rules, ${st.rulesRemoved} to remove, ${st.rulesEdited} to edit`)
      if (st.dead.length) console.log(`  dead: ${st.dead.join(' ')}`)
      for (const c of st.specChanges) console.log(`  specificity ${c.before} -> ${c.afterSpec}: ${c.selector}  =>  ${c.after}`)
    }
    const report = (res, rel, depth) => {
      for (const r of res) {
        if (r.remove && r.it.kind === 'rule') console.log(`  - ${rel}: ${r.selector.replace(/\s+/g, ' ').slice(0, 150)}`)
        else if (r.remove && r.it.kind === 'at') console.log(`  - ${rel}: whole @media block emptied`)
        else if (r.sub) report(r.sub, rel, depth + 1)
        else if (r.edit !== undefined) console.log(`  ~ ${rel}: ${r.from.replace(/\s+/g, ' ').slice(0, 110)}  =>  ${r.edit.trim().replace(/\s+/g, ' ').slice(0, 110)}`)
      }
    }
    console.log('Rules to remove (-) and selectors to edit (~):')
    for (const sh of state) report(sh.plan, sh.rel, 0)

    if (!changedAny) break
    if (!WRITE) {
      console.log('\n(dry run: no files written; run with --write to apply and re-measure until stable)')
      process.exitCode = dead.length ? 1 : 0
      return finish(files, sheets, state, siteReport, isLive, liveReason, nameHits, byName)
    }
    const next = []
    for (const sh of state) {
      const list2 = edits.get(sh.rel)
      let src = sh.src
      for (const e of [...list2].sort((a, b) => b.start - a.start)) src = applyEdit(src, e)
      writeFileSync(join(ROOT, sh.rel), src)
      removedTotals[sh.rel] = { before: sizes[sh.rel], after: { bytes: Buffer.byteLength(src), lines: src.split('\n').length - (src.endsWith('\n') ? 1 : 0) } }
      next.push(loadCss(sh.rel))
    }
    state = next
    if (pass > 10) throw new Error('did not converge')
  }
  console.log('')
  console.log(`Stable after ${pass} pass(es).`)
  if (WRITE) {
    console.log('Size change per file (lines, bytes):')
    for (const [rel, v] of Object.entries(removedTotals)) console.log(`${rel}: lines ${v.before.lines} -> ${v.after.lines}, bytes ${v.before.bytes} -> ${v.after.bytes}`)
  }
  const last = firstReport[firstReport.length - 1]
  process.exitCode = last.dead.length ? 1 : 0
  finish(files, sheets, state, siteReport, isLive, liveReason, nameHits, byName)
}

function finish(files, original, state, siteReport, isLive, liveReason, nameHits, byName) {
  const defined = new Set()
  for (const sh of state) walkRules(sh.items, (r) => r.list.forEach((s) => classesOf(s.tree).forEach((c) => defined.add(c))))
  console.log('')
  console.log('# Settled by hand')
  for (const [n, why] of Object.entries(HAND_DEAD)) console.log(`${n}: unreachable, rules removed — ${why}`)
  for (const [n, why] of Object.entries(HAND_LIVE)) console.log(`${n}: kept — ${why}`)
  console.log('')
  console.log('# Names still defined that step 2 did not find (kept by step 3 or step 5)')
  const kept = [...defined].filter((n) => liveReason(n)?.by !== 'name').sort()
  for (const n of kept) {
    const r = liveReason(n)
    if (r) console.log(`${n}: step ${[...new Set(r.keeps.map((k) => k.step))].join('+')} — ${r.keeps.map((k) => k.why + (k.unconfirmed ? ' [UNCONFIRMED]' : '')).join('; ')}`)
    else console.log(`${n}: DEAD`)
  }
  console.log('')
  console.log('# Step 3 names that step 2 also finds (redundant, listed for completeness)')
  const redundant = [...defined].filter((n) => liveReason(n)?.by === 'name' && siteReport.some((s) => s.derived.includes(n)))
  console.log(redundant.sort().join(' '))
  console.log('')
  console.log('# Informational: live by name only through src/api/schema.gen.ts')
  const onlyGen = [...defined].filter((n) => {
    const h = byName(n)
    return h.length > 0 && h.every((f) => f === GENERATED)
  }).sort()
  console.log(onlyGen.join(' ') || '(none)')
  console.log('')
  console.log('# Informational: live by name, but the word is in no className attribute, no classList call and no step 3 name')
  const literalText = classContextLiterals(files)
  const outsideClassContext = [...defined].filter((n) => {
    const h = byName(n)
    if (!h.length || h.every((f) => f === GENERATED)) return false
    if (siteReport.some((s) => s.derived.includes(n))) return false
    const re = wordRe(n)
    return !literalText.some((t) => re.test(t))
  }).sort()
  console.log(outsideClassContext.join(' ') || '(none)')
}

function classContextLiterals(files) {
  const req = createRequire(import.meta.url)
  const ts = req(join(ROOT, 'node_modules/openapi-typescript/node_modules/typescript'))
  const literalText = []
  const collect = (node, sink) => {
    const k = node.kind
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || k === ts.SyntaxKind.TemplateHead || k === ts.SyntaxKind.TemplateMiddle || k === ts.SyntaxKind.TemplateTail) sink.push(node.text ?? '')
    node.forEachChild((c) => collect(c, sink))
  }
  for (const f of files) {
    if (f.rel === GENERATED || f.rel === 'index.html') continue
    const sf = ts.createSourceFile(f.rel, f.src, ts.ScriptTarget.Latest, true, f.rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.JsxAttribute && node.name.getText(sf) === 'className' && node.initializer) collect(node.initializer, literalText)
      if (node.kind === ts.SyntaxKind.CallExpression && /classList/.test(node.expression.getText(sf))) node.arguments.forEach((a) => collect(a, literalText))
      node.forEachChild(visit)
    }
    visit(sf)
  }
  return literalText
}

function applyEdit(src, e) {
  if (e.repl !== null) return src.slice(0, e.start) + e.repl + src.slice(e.end)
  let a = e.start
  let b = e.end
  const lineStart = src.lastIndexOf('\n', a - 1) + 1
  const nl = src.indexOf('\n', b)
  const lineEnd = nl < 0 ? src.length : nl
  if (/^[ \t]*$/.test(src.slice(lineStart, a)) && /^[ \t]*$/.test(src.slice(b, lineEnd))) {
    a = lineStart
    b = nl < 0 ? src.length : nl + 1
    const prevBlank = a === 0 || src[a - 2] === '\n'
    if (prevBlank && src[b] === '\n') b++
  }
  return src.slice(0, a) + src.slice(b)
}

main()
