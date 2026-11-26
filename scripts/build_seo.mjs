#!/usr/bin/env node
/**
 * 官网 SEO / GEO 构建脚本（零依赖）。
 *
 *   node scripts/build_seo.mjs --stage src    # 构建前：生成 src/faq.md
 *   node scripts/build_seo.mjs --stage dist   # 构建后：写 sitemap / robots / llms.txt / IndexNow key
 *
 * 关键点：sitemap 与 llms.txt 从源 Markdown 自动派生，新增页面不用手改清单。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, sep, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = SITE_ROOT
const DIST = join(SITE_ROOT, '.vitepress', 'dist')

const SITE = {
  name: '点评笔记助手',
  origin: (process.env.WEBSITE_ORIGIN || 'https://dianping-note.aiautotools.com').replace(/\/$/, ''),
  description:
    '点评笔记助手是一款 Windows 桌面应用：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。数据全部保存在本机。',
  sections: [
    { title: '核心能力', prefix: ['index', 'collect', 'erchuang', 'publish', 'screenshots'] },
    { title: '上手与购买', prefix: ['pricing', 'get-started', 'faq', 'online-demo', 'contact'] },
    { title: '使用指南', prefix: ['guides/'] },
    { title: '关于', prefix: ['about'] },
  ],
}

const args = process.argv.slice(2)
const stage = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : 'dist'

/* ---------- 工具 ---------- */

/** 不作为站点页面收录的 Markdown：README 是仓库说明，CLAUDE 是 AI 协作说明 */
const NON_PAGE_MD = new Set(['README.md', 'CLAUDE.md'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'cache' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (name.endsWith('.md') && !NON_PAGE_MD.has(name)) acc.push(full)
  }
  return acc
}

/** 极简 frontmatter 解析：只取 key: value 形式的标量 */
function frontmatter(text) {
  if (!text.startsWith('---')) return {}
  const end = text.indexOf('\n---', 3)
  if (end < 0) return {}
  const out = {}
  for (const line of text.slice(3, end).split('\n')) {
    // Windows 检出是 CRLF，行尾会残留 \r，导致正则匹配失败
    const m = line.replace(/\r$/, '').match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
  }
  return out
}

/** 去掉 Markdown 标记，得到可用于摘要 / llms.txt 的纯文本 */
function stripMd(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ORDER = SITE.sections.flatMap((s) => s.prefix.map((p) => p.replace(/\/$/, '')))

/** 收集页面信息 */
function collectPages() {
  const files = walk(SRC).filter((f) => basename(f) !== 'README.md')
  const pages = files.map((file) => {
    const rel = relative(SRC, file).split(sep).join('/')
    const raw = readFileSync(file, 'utf8')
    const fm = frontmatter(raw)
    const slug = rel.replace(/\.md$/, '')
    const url = slug === 'index' ? '/' : `/${slug.replace(/\/index$/, '')}`
    const headings = [...raw.matchAll(/^##\s+(.+)$/gm)].map((m) => stripMd(m[1]))
    const priority = slug === 'index' ? 1.0 : slug === 'faq' ? 0.7 : slug.startsWith('guides/') ? 0.6 : 0.8
    const changefreq = slug === 'index' ? 'weekly' : slug.startsWith('guides/') ? 'monthly' : 'weekly'
    return {
      slug,
      url,
      title: fm.title || stripMd(headings[0] || ''),
      description: fm.description || '',
      headings,
      priority,
      changefreq,
      lastmod: statSync(file).mtime.toISOString().slice(0, 10),
    }
  })
  pages.sort((a, b) => {
    const ia = ORDER.indexOf(a.slug)
    const ib = ORDER.indexOf(b.slug)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.url.localeCompare(b.url)
  })
  return pages
}

/* ---------- 阶段 1：生成 FAQ 页 ---------- */

function renderFaq() {
  const data = JSON.parse(readFileSync(join(SRC, 'data', 'faq.json'), 'utf8'))
  const body = [
    '---',
    'title: 常见问题',
    `description: ${SITE.name}常见问题：采集平台、蓝 V 认领、数据存储、文案生成、定时发布、封号风险、价格与试用、安装包大小、换机。`,
    '---',
    '',
    '<div class="zp-page-head">',
    '  <h1>常见问题</h1>',
    `  <p>关于${SITE.name}被问得最多的问题。找不到答案可以看 <a href="/guides/troubleshooting">故障排查</a>，或 <a href="/get-started#contact">联系销售</a>。</p>`,
    '</div>',
    '',
  ]
  for (const it of data.items) {
    body.push(`## ${it.q}`, '', it.a, '')
  }
  body.push(
    '<div class="zp-band">',
    '  <h2>还有别的问题？</h2>',
    '  <p>开通前想先确认某个功能是否支持，把场景说清楚，我们会让销售和技术一起答复。</p>',
    '  <a class="zp-btn zp-btn--primary" href="/get-started#contact">联系销售开通</a>',
    '</div>',
    '',
  )
  writeFileSync(join(SRC, 'faq.md'), body.join('\n'), 'utf8')
  console.log(`[seo] generated faq.md (${data.items.length} items)`)
}

/* ---------- 阶段 2：dist 产物 ---------- */

function writeSitemap(pages) {
  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${escapeXml(SITE.origin + p.url)}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 由 apps/website/scripts/build_seo.mjs 自动生成，新增页面请改 Markdown，不要手改本文件 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8')
  console.log(`[seo] sitemap.xml (${pages.length} urls)`)
}

function writeRobots() {
  const txt = `# ${SITE.name} 官网
User-agent: *
Allow: /

# 由 apps/website/scripts/build_seo.mjs 自动生成
Sitemap: ${SITE.origin}/sitemap.xml
`
  writeFileSync(join(DIST, 'robots.txt'), txt, 'utf8')
  console.log('[seo] robots.txt')
}

function writeLlmsTxt(pages) {
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    `> 出品方：${SITE.name}（DianPingNote）· 官网 ${SITE.origin} · 本文由构建脚本自动生成。`,
    '',
  ]
  for (const sec of SITE.sections) {
    const list = pages.filter((p) => sec.prefix.some((pre) => (pre.endsWith('/') ? p.slug.startsWith(pre) : p.slug === pre)))
    if (!list.length) continue
    lines.push(`## ${sec.title}`, '')
    for (const p of list) {
      const title = p.title || SITE.name
      const desc = p.description ? `：${p.description}` : ''
      // llms.txt v2 约定：子页面指向每页 Markdown 版本（由 vitepress-plugin-llms 构建时生成）；
      // 首页插件不产出 index.md，仍指回 /
      const mdUrl = p.url === '/' ? `${SITE.origin}/` : `${SITE.origin}${p.url}.md`
      lines.push(`- [${title}](${mdUrl})${desc}`)
      const heads = p.headings.slice(0, 8)
      if (heads.length) lines.push(`  - 小节：${heads.join('；')}`)
    }
    lines.push('')
  }
  lines.push(
    '## 事实速览',
    '',
    '- 文案来源：统一使用官方提供的云端文案 API，不需要自备 Key、本机不部署模型；可切换到自备接口。',
    '- 计费单位：成功发布 1 条 = 1 元；月订阅 ¥25 / ¥50 / ¥120 三档。',
    '- 试用：新用户首次打开自动获得 7 天（7×24 小时）与 10 条额度。',
    '- 运行环境：Windows 10 / 11，安装包约 820 MB，内置 Chrome。',
    '- 数据：笔记、素材、发布状态保存在本机 SQLite；不上传笔记内容。',
    '- 发布目标：仅大众点评经营宝；一条笔记只由一个蓝 V 账号发布。',
    '',
  )
  writeFileSync(join(DIST, 'llms.txt'), lines.join('\n'), 'utf8')
  console.log('[seo] llms.txt')
}

/** 交叉检查：frontmatter 是否缺 title/description；sitemap / llms.txt 是否收录了未构建页面 */
function audit(pages) {
  const problems = []
  for (const p of pages) {
    if (!p.title) problems.push(`缺 title：${p.slug}`)
    if (!p.description) problems.push(`缺 description：${p.slug}`)
  }
  const known = new Set(pages.map((p) => p.url))
  const re = new RegExp(escapeRegExp(SITE.origin) + '(/[\\w/-]*)\\)?', 'g')
  for (const f of ['llms.txt', 'sitemap.xml']) {
    const path = join(DIST, f)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const m of text.matchAll(re)) {
      // llms.txt 里链接的是每页 .md 版本（/foo.md），比对时去掉 .md 与尾斜杠
      const u = (m[1] || '/').replace(/\.md$/, '').replace(/\/$/, '') || '/'
      if (u !== '/' && !known.has(u)) problems.push(`${f} 收录了未构建页面：${u}`)
    }
  }
  if (problems.length) {
    console.warn('[seo] 审计提示：\n  ' + problems.join('\n  '))
  } else {
    console.log('[seo] 审计通过：所有页面都有 title/description，清单与构建一致')
  }
}

function writeIndexNowKey() {
  const key = process.env.INDEXNOW_KEY
  if (!key) return
  writeFileSync(join(DIST, `${key}.txt`), key, 'utf8')
  console.log('[seo] IndexNow key 文件已写入 dist')
}

/* ---------- 入口 ---------- */

mkdirSync(DIST, { recursive: true })

if (stage === 'src') {
  renderFaq()
} else {
  const pages = collectPages()
  writeSitemap(pages)
  writeRobots()
  writeLlmsTxt(pages)
  writeIndexNowKey()
  audit(pages)
}