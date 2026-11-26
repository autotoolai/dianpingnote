#!/usr/bin/env node
/**
 * 死链检查：扫 dist 下所有 .html 的 href/src，找出指向站内但产物不存在的链接。
 * 外链只统计不请求。
 *
 * llms.txt 与 llms-full.txt 是给 AI 读的索引，里面的站内绝对 URL 也必须是活页。
 * 只扫 HTML 的话，llms.txt 里写错的路径 AI 读到的就是 404 —— 这道门禁盯着它。
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'

const DIST = join(process.cwd(), '.vitepress', 'dist')

if (!existsSync(DIST)) {
  console.error('[links] 未找到 dist，请先 npm run build')
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []
  })
}

/** 产物文件 -> 站点路由（用于报错显示） */
function siteRoute(relPath) {
  const r = relPath.split(sep).join('/')
  if (r === 'index.html') return '/'
  if (r.endsWith('/index.html')) return '/' + r.slice(0, -'index.html'.length).replace(/\/$/, '')
  return '/' + r.replace(/\.html$/, '')
}

/** 站点路由 -> 产物文件候选 */
function targetFor(route) {
  const rel = route.replace(/^\//, '').split('/').join(sep)
  if (!rel) return [join(DIST, 'index.html')]
  return [
    join(DIST, rel + '.html'),
    join(DIST, rel, 'index.html'),
    join(DIST, rel),
  ]
}

/**
 * 把 href 解析成站点内的产物路径。
 *
 * 规则：
 *   - 以 / 开头 = 站点根相对（VitePress 内部链接都是这种）
 *   - 其它 = 相对于当前页面所在目录（演示站的 app.css、js/app.js 是这种）
 *   - 以 . 开头 = 同样相对，但要处理 ../ 上跳
 *   - 以协议、mailto、# 开头 = 外链或锚点，跳过
 */
function resolveTarget(href, fromFile) {
  const hrefPath = href.split('#')[0].split('?')[0]
  if (!hrefPath) return null

  if (hrefPath.startsWith('/')) {
    return targetFor(hrefPath)
  }

  // 相对路径：从当前文件所在目录起算
  const base = dirname(fromFile).split(sep).filter((s) => s && s !== '.')
  for (const seg of hrefPath.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') base.pop()
    else base.push(seg)
  }
  const route = '/' + base.join('/')
  return targetFor(route)
}

const files = walk(DIST)
const attrRe = /(?:href|src)="([^"]+)"/g
let broken = 0
let checked = 0

/**
 * 演示站产物在公开仓构建里不存在（产品前端是私有源码）。
 * 页面里指向 /demo/ 的链接在公开仓 CI 里必然「死链」，那是环境差异不是缺陷。
 * 完整仓库构建时产物存在，这些链接照常校验。
 */
const HAS_DEMO = existsSync(join(DIST, 'demo', 'index.html'))

for (const file of files) {
  const html = readFileSync(file, 'utf8')
  const relFile = relative(DIST, file)
  const from = siteRoute(relFile)
  let m
  while ((m = attrRe.exec(html))) {
    const href = m[1]
    // 未被渲染的模板表达式也算死链
    if (/\{\{.*\}\}/.test(href)) {
      console.error(`[links] 未渲染的模板表达式: ${from} -> ${href}`)
      broken++
      continue
    }
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(href)) continue
    checked++
    const targets = resolveTarget(href, relFile)
    if (!targets) continue
    if (!targets.some(existsSync)) {
      if (!HAS_DEMO && href.startsWith('/demo')) continue
      console.error(`[links] 死链: ${from} -> ${href}`)
      broken++
    }
  }
}

/* llms.txt / llms-full.txt 里的站内绝对 URL 也要是活页 */
const ORIGIN = (process.env.WEBSITE_ORIGIN || 'https://dianping-note.aiautotools.com').replace(/\/+$/, '')
let txtChecked = 0
for (const name of ['llms.txt', 'llms-full.txt']) {
  const abs = join(DIST, name)
  if (!existsSync(abs)) continue
  const txt = readFileSync(abs, 'utf8')
  // 路径在空白、英文括号、中英文标点处截断
  const re = new RegExp(
    ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/[^)\\s\\u3000-\\u303F\\uFF00-\\uFFEF]*)?',
    'g',
  )
  let m
  while ((m = re.exec(txt))) {
    const route = (m[1] || '/').split('#')[0].split('?')[0]
    if (!route || route === '/') continue
    // .md 副本是给 AI 的 Markdown 镜像，路径对应同名的 HTML 页
    const target = route.endsWith('.md') ? route.slice(0, -3) : route
    txtChecked++
    if (!targetFor(target).some(existsSync)) {
      console.error(`[links] 死链: ${name} -> ${route}`)
      broken++
    }
  }
}

console.log(
  `[links] 检查 ${files.length} 个页面，${checked} 条站内链接，${txtChecked} 条 llms.txt 链接，死链 ${broken} 条`,
)
process.exit(broken ? 1 : 0)
