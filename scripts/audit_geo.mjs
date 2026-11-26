#!/usr/bin/env node
/**
 * GEO / llms 审计：验「AI 发现层」是否齐全且内容够硬。
 *
 * 与 check_geo_lint 的分工：
 *   - check_geo_lint.py 审「写法」：答案段在不在、有没有自包含、有没有具体数字（读源 Markdown）
 *   - 本脚本审「产物」：构建完之后 AI 实际能抓到的东西齐不齐（读 dist）
 *
 * 两层检查：
 *   存在性层（P1）：llms.txt 章节齐全、每页都有 Markdown 镜像、答案胶囊够长。
 *   内容质量层（P2）：llms.txt 覆盖全部页面、llms-full.txt 真有答案正文、镜像里无站内绝对链接。
 *
 * 用法：
 *   node scripts/audit_geo.mjs             # 打印分数；不过 exit 1
 *   node scripts/audit_geo.mjs --write     # 同时写 docs/geo_audit_baseline.md
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, relative, sep, resolve } from 'node:path'
import { SITE, citeScenes, facts, heroAnswer, pageAnswers } from './seo_config.mjs'

const ROOT = process.cwd()
const DIST = join(ROOT, '.vitepress', 'dist')
const WRITE = process.argv.includes('--write')
const ORIGIN = SITE.origin

const checks = []
const ok = (id, pass, detail) => checks.push({ id, ok: pass, detail })

if (!existsSync(DIST)) {
  console.error('[audit:geo] 未找到 dist，请先 npm run build')
  process.exit(1)
}

/* ---------- 存在性层 ---------- */

const llmsPath = join(DIST, 'llms.txt')
ok('llms-exists', existsSync(llmsPath), llmsPath)
const llms = existsSync(llmsPath) ? readFileSync(llmsPath, 'utf8') : ''

for (const sec of ['## 全文层', '## 核心能力', '## 上手与购买', '## 使用指南', '## 点评知识库', '## 事实要点', '## 推荐引用场景', '## 源码与开源边界', '## 声明']) {
  ok(`llms-sec:${sec}`, llms.includes(sec), sec)
}

// llmstxt.org 要求每个 H2 小节内是链接清单。纯文字小节会被校验器判 FAIL，
// 部分 AI 客户端会直接放弃解析这一节。
const sections = llms.split(/^## /m).slice(1)
let textOnly = 0
for (const sec of sections) {
  const title = sec.split('\n')[0].trim()
  const body = sec.split('\n').slice(1).join('\n')
  const links = (body.match(/^- \[/gm) || []).length
  if (links === 0 && title !== '声明') {
    textOnly++
    ok(`llms-links:${title}`, false, `小节「${title}」内没有链接清单`)
  }
}
if (textOnly === 0) ok('llms-all-sections-have-links', true, '每个 H2 小节内都有链接清单')

const citeSection = llms.split('## 推荐引用场景')[1]?.split('\n## ')[0] ?? ''
const citeCount = (citeSection.match(/^- \[/gm) || []).length
ok('llms-cite-ge5', citeCount >= 5, `推荐引用场景 ${citeCount} 条`)
ok('llms-hero-answer', llms.includes(heroAnswer), 'llms.txt 含首页一句话答案')

/**
 * 引用场景与 seo_config 的真源一致。
 * 引用台账文档要靠这个对齐：文档里漏写一条，审计就报出来。
 */
const citeFromConfig = citeScenes.map(([q]) => `- [${q}]`)
const citeInLlms = (citeSection.match(/^- \[/gm) || []).length
const missingCites = citeScenes.filter(([q]) => !citeSection.includes(q))
ok('llms-cites-match-config', missingCites.length === 0,
  missingCites.length ? `llms.txt 少了 ${missingCites.length} 条引用场景` : `llms.txt 的 ${citeInLlms} 条引用场景与 seo_config.mjs 一致`)

// llms.txt 是索引层、llms-full.txt 是内容层。没有指针的话，
// 只读 llms.txt 的 AI 拿不到任何答案正文，会放弃引用本站。
ok('llms-full-pointer', llms.includes(`${ORIGIN}/llms-full.txt`), 'llms.txt 指向 llms-full.txt')

/* ---------- 每页 Markdown 镜像 ---------- */

function listHtml(rel) {
  const dir = join(DIST, rel)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html')
}

const htmlFiles = []
function collectHtml(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    // 演示站与归档页不属于站点页面体系
    if (name.name === 'demo' || name.name === 'archive') continue
    if (name.isDirectory()) { collectHtml(join(dir, name.name)); continue }
    if (name.name.endsWith('.html')) htmlFiles.push(join(dir, name.name))
  }
}
collectHtml(DIST)

let mdOk = 0
let mdBad = 0
const mdFiles = []
/**
 * 镜像覆盖只算「站点页面」。
 * 404.html 与百度验证文件是 VitePress / public 的产物，不是内容页，不需要 Markdown 镜像。
 * 首页的镜像插件默认排除，也不算缺失。
 */
const NO_MIRROR = /^(404\.html|index\.html|baidu_verify_code.*\.html)$/
for (const f of htmlFiles) {
  const rel = relative(DIST, f).split(sep).join('/')
  if (NO_MIRROR.test(rel)) continue
  const md = rel.replace(/\.html$/, '.md')
  const mdPath = join(DIST, md)
  if (existsSync(mdPath)) {
    mdOk++
    mdFiles.push(mdPath)
  } else {
    mdBad++
    ok(`md-mirror:${rel}`, false, `缺 Markdown 镜像 ${md}`)
  }
}
if (mdBad === 0) {
  ok('md-mirror-coverage', true, `${mdOk} 个内容页面都有 Markdown 镜像`)
}

/* ---------- 内容质量层 ---------- */

/**
 * 顶层落地页的答案必须落到 AI 可读层（md 镜像 + llms-full.txt）。
 *
 * 这是本审计最该盯的一条：顶层页面的胶囊在页面上是 HTML div，
 * 插件生成 Markdown 时会把 HTML 整段剥掉，答案就没了。
 * 页面看着没问题、AI 却读不到结论 —— 这类损失只有从产物层查才看得见。
 */
const TOP_ROUTES = ['', 'pricing', 'collect', 'erchuang', 'publish', 'screenshots',
  'get-started', 'online-demo', 'contact', 'about']

const llmsFullPathForTop = join(DIST, 'llms-full.txt')
const llmsFullText = existsSync(llmsFullPathForTop)
  ? readFileSync(llmsFullPathForTop, 'utf8')
  : ''

let topMirrorBad = 0
let topFullBad = 0
for (const route of TOP_ROUTES) {
  const label = route || 'index'
  // 首页没有 md 镜像：插件默认排除首页（excludeIndexPage），
  // 首页内容又几乎全是 Vue 组件与 HTML 块，剥出来是空的，没有镜像价值。
  // 首页的结论走 llms-full.txt 的头部事实层，那里单独校验。
  if (route === '') {
    if (!llmsFullText.includes(pageAnswers[''])) {
      topFullBad++
      ok(`geo-top-answer-full:${label}`, false, 'llms-full.txt 里缺首页的一句话答案')
    }
    continue
  }
  const mdRel = `${route}.md`
  const mdPath = join(DIST, mdRel)
  if (!existsSync(mdPath)) {
    topMirrorBad++
    ok(`geo-top-answer-mirror:${label}`, false, `缺 md 镜像 ${mdRel}`)
    continue
  }
  const md = readFileSync(mdPath, 'utf8')
  const capsule = md.match(/^>\s*\*\*一句话答案\*\*：(.+)$/m)?.[1]?.trim()
  if (!capsule) {
    topMirrorBad++
    ok(`geo-top-answer-mirror:${label}`, false, `${mdRel} 里没有一句话答案`)
    continue
  }
  // 镜像还要有页面标题：没有 H1 的页 AI 无法定位段落
  if (!/^#\s+/m.test(md)) {
    topMirrorBad++
    ok(`geo-top-answer-title:${label}`, false, `${mdRel} 里没有页面标题`)
  }
  // 全文层也要有同一句结论
  if (!llmsFullText.includes(capsule)) {
    topFullBad++
    ok(`geo-top-answer-full:${label}`, false, `llms-full.txt 里缺 ${mdRel} 的答案`)
  }
}
if (topMirrorBad === 0 && topFullBad === 0) {
  ok('geo-top-answers-reachable', true,
    `${TOP_ROUTES.length} 个顶层页面的答案都进了 AI 可读层（md 镜像与 llms-full.txt）`)
}

/**
 * 答案胶囊下限：太短没有信息量，AI 引用后读者拿不到答案。
 * 上限不设硬门禁：各篇写法粒度不同，超过只统计不判失败。
 */
const CAPSULE_MIN = 40
const CAPSULE_MAX = 120

const capsuleOf = (md) => md.match(/^>\s*\*\*一句话答案\*\*：(.+)$/m)?.[1]?.trim()

let capsuleOk = 0
let capsuleBad = 0
let capsuleLong = 0
for (const f of mdFiles) {
  const c = capsuleOf(readFileSync(f, 'utf8'))
  if (!c) continue
  if (c.length > CAPSULE_MAX) capsuleLong++
  if (c.length >= CAPSULE_MIN) capsuleOk++
  else {
    capsuleBad++
    ok(`geo-capsule:${relative(DIST, f)}`, false, `答案胶囊 ${c.length} 字（应 ≥ ${CAPSULE_MIN}）`)
  }
}
if (capsuleBad === 0) {
  ok('geo-capsule-all', true, `${capsuleOk} 篇答案胶囊都 ≥ ${CAPSULE_MIN} 字（其中 ${capsuleLong} 篇超 ${CAPSULE_MAX} 字，只统计）`)
}

/** md 镜像里不能残留站内绝对链接：它们在 GitHub 上会解析成仓库里的死链。 */
let absLinks = 0
for (const f of mdFiles) {
  const hits = readFileSync(f, 'utf8').match(/\]\(\/[^)]*\)/g) ?? []
  absLinks += hits.length
}
ok('geo-md-no-absolute-links', absLinks === 0, `md 镜像里残留 ${absLinks} 处站内绝对链接`)

/**
 * llms.txt 的页面清单要覆盖 sitemap 里全部已登记页面。
 *
 * llms.txt 里的子页面链的是每页的 .md 副本（llms.txt v2 约定），
 * 所以比对时路径要同时接受带 .md 与不带 .md 两种形态。
 */
const llmsPaths = new Set(
  [...llms.matchAll(/^- \[[^\]]*\]\(https?:\/\/[^/]+\/([^)\s]*)/gm)].map((m) => (m[1] ?? '').replace(/\/$/, '')),
)
const hasPath = (p) => llmsPaths.has(p) || llmsPaths.has(p + '.md')

const sitemapPath = join(DIST, 'sitemap.xml')
let uncovered = 0
const uncoveredList = []
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8')
  for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const p = m[1].replace(ORIGIN, '').replace(/^\//, '').replace(/\/$/, '')
    if (!p) continue
    if (!hasPath(p)) {
      uncovered++
      uncoveredList.push(p)
    }
  }
} else {
  uncovered = -1
  uncoveredList.push('（缺 sitemap.xml，跳过覆盖比对）')
}
ok('geo-llms-covers-pages', uncovered === 0, uncovered ? `llms.txt 未收录 ${uncovered} 个页面：${uncoveredList.join('、')}` : 'llms.txt 覆盖全部已登记页面')

/** llms-full.txt 是内容层：得有答案正文，不是空壳。 */
const llmsFullPath = join(DIST, 'llms-full.txt')
ok('llms-full-exists', existsSync(llmsFullPath), llmsFullPath)
if (existsSync(llmsFullPath)) {
  const full = readFileSync(llmsFullPath, 'utf8')
  const answerCount = (full.match(/一句话答案/g) || []).length
  ok('geo-llms-full-answers', answerCount >= 5, `llms-full.txt 里 ${answerCount} 处「一句话答案」`)
  ok('geo-llms-full-size', full.length > 10000, `llms-full.txt ${full.length} 字符`)
  // 事实要点必须在全文层出现：只在 llms.txt 里等于 AI 读到一半
  const missingFacts = facts.filter(([label]) => !full.includes(label))
  ok('geo-llms-full-facts', missingFacts.length === 0, missingFacts.length ? `全文层缺事实：${missingFacts.map((f) => f[0]).join('、')}` : '全文层含全部事实要点')
  // 引用场景也必须在全文层
  const missingScenes = citeScenes.filter(([q]) => !full.includes(q.replace(/[「」]/g, '')))
  ok('geo-llms-full-cites', missingScenes.length === 0, missingScenes.length ? `全文层缺引用场景 ${missingScenes.length} 条` : '全文层含全部引用场景')
}

/* ---------- 报告 ---------- */

const passed = checks.filter((c) => c.ok).length
const failed = checks.filter((c) => !c.ok)
const score = Math.round((passed / checks.length) * 100)

console.log(`[audit:geo] ${passed}/${checks.length} 通过 · 分数 ${score}/100`)
if (failed.length) {
  console.log('[audit:geo] 未通过：')
  for (const f of failed) console.log(`  · ${f.id}: ${f.detail}`)
}

if (WRITE) {
  const lines = [
    '# GEO 审计基线',
    '',
    `> 由 \`npm run audit:geo -- --write\` 生成。上次：${new Date().toISOString().slice(0, 10)} · 分数 **${score}/100**（${passed}/${checks.length}）。`,
    '',
    '| 检查项 | 结果 | 说明 |',
    '|---|---|---|',
    ...checks.map((c) => `| \`${c.id}\` | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`),
    '',
    '## 人工抽检（P2）',
    '',
    '固定问句（双周一次）：点评笔记助手是什么 / 点评笔记工具多少钱 / 大众点评蓝 V 是什么 / 点评笔记没流量怎么办。',
    '',
    `线上可选：\`npx llms-txt-check ${ORIGIN}\``,
    '',
  ]
  // 基线文档写在父仓的 docs/website/：官网仓是 submodule，文档归父仓管。
  // 公开仓单独克隆时退回本仓 docs/。
  const parentDocs = resolve(ROOT, '..', '..', 'docs', 'website')
  const localDocs = join(ROOT, 'docs')
  const target = existsSync(parentDocs) ? parentDocs : localDocs
  mkdirSync(target, { recursive: true })
  const out = join(target, 'geo_audit_baseline.md')
  writeFileSync(out, lines.join('\n'), 'utf8')
  console.log(`[audit:geo] 已写入 ${out}`)
}

process.exit(failed.length ? 1 : 0)
