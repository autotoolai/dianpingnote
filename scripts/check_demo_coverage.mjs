#!/usr/bin/env node
/**
 * 检查产品前端用的接口，演示站的 mock 层是不是都实现了。
 *
 *   node scripts/check_demo_coverage.mjs
 *
 * 为什么需要：
 *   演示站的界面和产品是同一套代码（构建时复制），产品前端改了接口，
 *   演示站的假数据层如果没跟上，那个页面就会显示空数据或弹错误。
 *   这个脚本在构建前把这类「漏实现」揪出来，避免漏到线上。
 *
 * 判定分两级：
 *   硬错误（退出码 1）：接口没实现 —— 用户一点就报错
 *   提示（退出码 0）：读接口走通用兜底 —— 页面能开但数据是空的
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = resolve(here, '..')
const REPO_ROOT = resolve(SITE_ROOT, '..', '..')
const APP_JS = resolve(REPO_ROOT, 'packages', 'admin', 'static', 'js', 'app.js')

const APP_SRC = readFileSync(APP_JS, 'utf8')

/* ------------------------------------------------------------------ */
/* 1. 从产品代码里抽出所有 /api 调用                                    */
/* ------------------------------------------------------------------ */

/** 各资源的真实样例 id，用来把路径里的占位符换成能命中 mock 的值 */
const SAMPLES = {
  note: '01KXZMSBBKN5N3Y44X960ZEJDM',
  account: '1',
  target: '1',
  task: '3',
  crawlRun: '3',
  publishRun: '01MDEMO0001',
  taskRun: '12',
  session: '1',
  platform: 'dianping',
}

/** 名字像查询串的插值，走在路径末尾时按查询串处理，不当路径段 */
const QUERY_VARS = /^(q|qs|query|params|search|filter|qsStr)$/

/**
 * 把一个接口字面量整理成路径模板。
 *   '/api/notes/${encodeURIComponent(noteId)}' -> '/api/notes/{id}'
 *   '/api/crawl/retry-failed-enrichs${q}'       -> '/api/crawl/retry-failed-enrichs'
 */
function normalizePath(raw) {
  // 先切掉字面量里的查询串
  let p = raw.split('?')[0]
  // 再去掉末尾的拼接尾巴（' + q 之类）
  p = p.split('+')[0]
  // 处理末尾的模板插值
  p = p.replace(/\$\{([^}]*)\}/g, (m, expr) => {
    const name = expr.trim().split(/[(.[]/)[0]
    return QUERY_VARS.test(name) ? '' : '{id}'
  })
  p = p.replace(/[)'"`,]+$/, '')
  return p.startsWith('/api/') ? p : null
}

/** 从 openParenIdx 处找到配对的右括号，返回这段调用文本 */
function callBody(src, openIdx) {
  let depth = 0
  let quote = null
  for (let i = openIdx; i < src.length && i < openIdx + 2000; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx, i + 1)
    }
  }
  return src.slice(openIdx, openIdx + 2000)
}

/**
 * 抽出 api('/api/...') 与 fetch('/api/...') 调用，带上各自的 method。
 * method 只在本次调用的括号范围内找，不会串到下一句。
 */
function extractCalls(src) {
  const out = []
  const re = /\b(?:api|apiWithTimeout|fetch)\s*\(/g
  let m
  while ((m = re.exec(src))) {
    const openIdx = m.index + m[0].length - 1
    const body = callBody(src, openIdx)
    // 第一个字符串参数
    const lm = body.match(/^\s*\(\s*([`'"])([^`'"]*\/api\/[^`'"]*)\1/)
    if (!lm) continue
    const path = normalizePath(lm[2])
    if (!path) continue
    const mm = body.match(/method\s*:\s*['"]([A-Z]+)['"]/i)
    out.push({ method: mm ? mm[1].toUpperCase() : 'GET', path })
  }
  return out
}

/**
 * 产品代码里所有 /api 字面量。
 * 有些调用把地址先存进变量再传给 api()，那种抓不到调用点，
 * 但字面量还在，这里兜住，避免漏检。
 */
function extractAllLiterals(src) {
  const out = new Set()
  const re = /['"`]([^'"`]*\/api\/[^'"`]*)['"`]/g
  let m
  while ((m = re.exec(src))) {
    const p = normalizePath(m[1])
    if (p) out.add(p)
  }
  return out
}

/** 把路径里的占位符换成真实样例 id */
function concretize(path) {
  return path.replace(/\{id\}/g, (m, offset) => {
    const p = path.slice(0, offset)
    if (p.startsWith('/api/notes/')) return SAMPLES.note
    if (p.startsWith('/api/accounts/merchant-sessions/')) return SAMPLES.session
    if (p.startsWith('/api/accounts/blue-v/')) return SAMPLES.account
    if (p.startsWith('/api/accounts/')) return SAMPLES.account
    if (p.startsWith('/api/crawl-targets/')) return SAMPLES.target
    if (p.startsWith('/api/crawl/runs/')) return SAMPLES.crawlRun
    if (p.startsWith('/api/publish/runs/')) return SAMPLES.publishRun
    if (p.startsWith('/api/publish/task-runs/')) return SAMPLES.taskRun
    if (p.startsWith('/api/tasks/')) return SAMPLES.task
    if (p.includes('/platforms/')) return SAMPLES.platform
    return SAMPLES.note
  })
}

/* ------------------------------------------------------------------ */
/* 2. 用一个最小的 window 桩把 demo 的 fetch 拦截层装起来             */
/* ------------------------------------------------------------------ */

function makeWindowStub() {
  return {
    location: { href: 'https://example.test/demo/', origin: 'https://example.test', pathname: '/demo/' },
    fetch: async () => new Response('{}', { status: 200 }),
    addEventListener() {},
    document: {
      currentScript: null,
      documentElement: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener() {},
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  }
}

async function loadMock() {
  const mod = await import(pathToFileURL(resolve(SITE_ROOT, 'demo', 'src', 'api.js')).href)
  const win = makeWindowStub()
  globalThis.window = win
  globalThis.document = win.document
  globalThis.location = win.location
  // demo 里用的是全局 MutationObserver（浏览器里是 window.MutationObserver）
  globalThis.MutationObserver = win.MutationObserver
  mod.installDemo()
  return win
}

/* ------------------------------------------------------------------ */
/* 3. 逐个调用，把结果归类                                             */
/* ------------------------------------------------------------------ */

async function main() {
  const calls = extractCalls(APP_SRC)
  const literals = extractAllLiterals(APP_SRC)

  // method 已知的最可信；只有字面量没有调用点的，按 GET 试
  const wanted = new Map()
  for (const c of calls) {
    const key = `${c.method} ${c.path}`
    if (!wanted.has(key)) wanted.set(key, c)
  }
  const unknownMethod = []
  for (const p of literals) {
    const known = [...wanted.values()].some((c) => c.path === p)
    if (!known) unknownMethod.push(p)
  }

  const win = await loadMock()

  const hardMiss = []
  const softMiss = []
  let okCount = 0

  /** 探一个接口，返回状态和解析后的 body */
  async function probe(method, path) {
    const concrete = concretize(path)
    try {
      const res = await win.fetch(`https://example.test${concrete}`, { method })
      const body = await res.text()
      let parsed = null
      try {
        parsed = JSON.parse(body)
      } catch (_) {
        parsed = null
      }
      return { status: res.status, parsed, body }
    } catch (e) {
      return { status: 0, parsed: null, body: '', error: e.message }
    }
  }

  /** 判断这次探测算不算「实现好了」 */
  function verdict(r) {
    if (r.error) return { kind: 'error', why: `调用抛异常：${r.error}` }
    if (r.status >= 400) return { kind: 'error', why: `HTTP ${r.status} ${r.parsed?.detail || ''}`.trim() }
    if (r.parsed && r.parsed.demo === true && r.parsed.path) {
      return { kind: 'soft', why: '走通用兜底，页面数据会是空的' }
    }
    return { kind: 'ok' }
  }

  for (const { method, path } of wanted.values()) {
    const r = await probe(method, path)
    const v = verdict(r)
    if (v.kind === 'error') hardMiss.push({ method, path, why: v.why })
    else if (v.kind === 'soft') softMiss.push({ method, path, why: v.why })
    else okCount++
  }

  // 只抓到字面量、没抓到调用点的：把常见方法都试一遍，只要有一个通就算实现了
  for (const path of unknownMethod) {
    const tried = []
    let anyOk = false
    let anySoft = false
    let lastWhy = ''
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await probe(method, path)
      const v = verdict(r)
      tried.push(`${method}:${v.kind}`)
      if (v.kind === 'ok') { anyOk = true; break }
      if (v.kind === 'soft') anySoft = true
      else lastWhy = v.why
    }
    if (anyOk) {
      okCount++
      continue
    }
    if (anySoft) {
      softMiss.push({ method: 'GET', path, why: '走通用兜底，页面数据会是空的' })
      continue
    }
    hardMiss.push({ method: '?', path, why: `${lastWhy}（试过 ${tried.join(' ')}）` })
  }

  console.log(`[demo-coverage] 产品接口 ${wanted.size} 个（调用点 ${calls.length} 处，字面量 ${literals.size} 个）`)
  console.log(`  已实现：${okCount}`)
  console.log(`  兜底（数据空）：${softMiss.length}`)
  console.log(`  未实现（会报错）：${hardMiss.length}`)

  if (softMiss.length) {
    console.log('\n兜底接口（在 demo/src/api.js 里补一条即可）：')
    for (const m of softMiss) console.log(`  - ${m.method} ${m.path}  ${m.why}`)
  }
  if (hardMiss.length) {
    console.log('\n未实现接口（在 demo/src/api.js 里补一条即可）：')
    for (const m of hardMiss) console.log(`  - ${m.method} ${m.path}  ${m.why}`)
  }
  if (unknownMethod.length) {
    console.log('\n仅按字面量检出、没抓到调用点（需人工确认调用方式）：')
    for (const p of unknownMethod) console.log(`  - ${p}`)
  }

  if (hardMiss.length) {
    console.log('\n✗ 有接口没实现，演示站上点了会报错')
    if (process.env.SKIP_DEMO_CHECK === '1') {
      console.log('  （SKIP_DEMO_CHECK=1，跳过失败）')
      process.exit(0)
    }
    process.exit(1)
  }
  console.log('\n✓ 没有会报错的接口')
}

main().catch((e) => {
  console.error('[demo-coverage] 检查失败：', e)
  process.exit(2)
})
