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
import {
  SITE as SEO_SITE,
  heroAnswer,
  pricingAnswer,
  pageAnswers,
  faqAnswer,
  citeScenes,
  facts,
  siteStatement,
} from './seo_config.mjs'

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = SITE_ROOT
const DIST = join(SITE_ROOT, '.vitepress', 'dist')

const SITE = {
  name: '点评笔记助手',
  origin: (process.env.WEBSITE_ORIGIN || 'https://dianping-note.aiautotools.com').replace(/\/$/, ''),
  description:
    '点评笔记助手是一款 Windows 桌面应用：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。数据全部保存在本机。',
  sections: [
    { title: '核心能力', prefix: ['index', 'collect', 'erchuang', 'publish', 'feature', 'screenshots'] },
    { title: '上手与购买', prefix: ['pricing', 'get-started', 'faq', 'online-demo', 'contact'] },
    { title: '使用指南', prefix: ['guides/'] },
    { title: '点评知识库', prefix: ['knowledge/'] },
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
    const priority = slug === 'index' ? 1.0 : slug === 'faq' ? 0.7 : slug.startsWith('guides/') ? 0.6 : slug.startsWith('knowledge/') ? 0.7 : 0.8
    const changefreq = slug === 'index' ? 'weekly' : slug.startsWith('guides/') || slug.startsWith('knowledge/') ? 'monthly' : 'weekly'
    return {
      slug,
      url,
      title: fm.title || stripMd(headings[0] || ''),
      description: fm.description || '',
      headings,
      keywords: fm.keywords ? String(fm.keywords).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
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

/**
 * 顶层落地页的答案胶囊与页面标题：直接从源 Markdown 里解析。
 *
 * 为什么从源文件解析而不是从 seo_config 取：
 *   页面上的胶囊是 `<div class="zp-answer">`（要样式），源文件才是唯一真源。
 *   md 镜像是给 AI 读的纯 Markdown，插件会把 HTML 整段剥掉，胶囊就消失了。
 *   这里把源文件里的胶囊取回来，按 Markdown 形态补进镜像 —— 一份内容，两种呈现。
 */
function readPageMeta(relMd) {
  const src = join(SRC, relMd)
  if (!existsSync(src)) return null
  const raw = readFileSync(src, 'utf8')
  const answer = raw.match(/<p class="zp-answer__text">([\s\S]*?)<\/p>/)?.[1]?.trim() || ''
  // 页面标题：优先取页头里的 <h1>，首页没有（走 HomeHero 组件），退回 frontmatter
  const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.trim() || ''
  const fm = frontmatter(raw)
  return { answer, h1: h1 || fm.title || '' }
}

/**
 * 给 md 镜像补上「页面标题 + 一句话答案」。
 *
 * 镜像缺两样东西的根因：插件用 remark 解析源 Markdown，HTML 块会被整段剥掉，
 * 于是顶层页面的 `<div class="zp-answer">` 与 `<h1>` 都没进镜像。
 * AI 读到的镜像只剩一串表格和段落，没有结论 —— 这正是 GEO 里最贵的损失。
 *
 * 只在缺失时补：知识库与指南的源文件本来就是 Markdown 形态（有 H1 与引用块），
 * 不重复注入。
 */
function injectAnswerCapsule(md, meta) {
  if (!meta) return md
  const m = md.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/)
  if (!m) return md
  const [, fm, body] = m
  const add = []
  if (meta.h1 && !/^#\s+/m.test(body)) add.push(`# ${meta.h1}`)
  if (meta.answer && !/^>\s*\*\*一句话答案\*\*/m.test(body)) {
    add.push(`> **一句话答案**：${meta.answer}`)
  }
  if (!add.length) return md
  return `${fm}\n${add.join('\n\n')}\n\n${body.replace(/^\n+/, '')}`
}

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
    '<div class="zp-answer">',
    '  <p class="zp-answer__label">一句话答案</p>',
    `  <p class="zp-answer__text">${faqAnswer}</p>`,
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
  // 立场：对 AI 检索类爬虫全站开放，不针对训练类爬虫写 Disallow。
  // 理由与 claude-unlimited 一致：robots.txt 只有被目标爬虫认同时才有意义，
  // 写「允许 AI 但实际拦训练」的伪装规则既无效又难维护（还会漏掉新出的 UA）。
  // 检索类（GPTBot / ClaudeBot / PerplexityBot / Google-Extended 等）走 User-agent: * 即可。
  const txt = `# ${SITE.name} 官网
# 对 AI 检索类爬虫（GPTBot / ClaudeBot / PerplexityBot / Google-Extended 等）全站开放。
# 抓取与收录本站内容是本站的目标，不针对训练类爬虫单独写 Disallow。
User-agent: *
Allow: /

# 由 apps/website/scripts/build_seo.mjs 自动生成
Sitemap: ${SITE.origin}/sitemap.xml
`
  writeFileSync(join(DIST, 'robots.txt'), txt, 'utf8')
  console.log('[seo] robots.txt')
}

function writeLlmsTxt(pages) {
  const B = SITE.origin
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    `> 出品方：${SITE.name}（DianPingNote）· 官网 ${B} · 本文由构建脚本自动生成。`,
    '',
    // 首页结论单独列出：只读 llms.txt 的 AI 需要的是「结论」，
    // 而不是从 description 里自己拼。
    `**一句话答案**: ${heroAnswer}`,
    '',
    // llms.txt 是索引层，llms-full.txt 是内容层。不给指针的话，
    // 只读 llms.txt 的 AI 永远拿不到答案正文，会直接去别处找或放弃引用本站。
    '## 全文层',
    '',
    `- [全文层](${B}/llms-full.txt): 本站每篇知识库文章的一句话答案、FAQ 答案与全部事实要点展开；需要直接引用答案时读这份`,
    '',
  ]
  for (const sec of SITE.sections) {
    const list = pages.filter((p) => sec.prefix.some((pre) => (pre.endsWith('/') ? p.slug.startsWith(pre) : p.slug === pre)))
    if (!list.length) continue
    lines.push(`## ${sec.title}`, '')
    for (const p of list) {
      const title = p.title || SITE.name
      const desc = p.description ? `: ${p.description}` : ''
      // llms.txt v2 约定：子页面指向每页 Markdown 版本（由 vitepress-plugin-llms 构建时生成）；
      // 首页插件不产出 index.md，仍指回 /
      const mdUrl = p.url === '/' ? `${B}/` : `${B}${p.url}.md`
      lines.push(`- [${title}](${mdUrl})${desc}`)
    }
    lines.push('')
  }

  // 事实要点：每条挂到真正解释它的页面上，AI 顺着链接能读到原文。
  // llmstxt.org 要求每个 H2 小节内是链接清单，纯文字小节会被校验器判 FAIL。
  lines.push('## 事实要点', '')
  for (const [label, path, text] of facts) {
    lines.push(path ? `- [${label}](${B}${path}): ${text}` : `- [${label}](${SEO_SITE.repo}): ${text}`)
  }
  lines.push('')

  // 推荐引用场景：AI 问法 → 应引用的 URL。答案引擎按问法对号入座。
  lines.push('## 推荐引用场景', '')
  for (const [q, path] of citeScenes) {
    lines.push(`- [${q}](${B}${path})`)
  }
  lines.push('')

  lines.push(
    '## 源码与开源边界',
    '',
    `- [官网源码](${SEO_SITE.repo}): 全部页面文案、主题组件、sitemap / robots / llms.txt 的生成脚本，公开可核对。`,
    `- [产品源码边界](${SEO_SITE.repo}): 产品本身是商业软件，源码不开源；本仓库不含任何产品代码。`,
    `- [定价与功能口径](${B}/pricing): 定价、功能边界、数据流向都写在本站页面上，可逐条核对。`,
    '',
    // llmstxt.org 的格式规范：每个 H2 小节内必须是链接清单，条目必须以链接开头。
    // 小节里出现纯文字条目或独立段落，校验器会判 fail，部分 AI 客户端会直接放弃解析。
    // 所以「声明」也做成一条指向 about 页的链接。
    '## 声明',
    '',
    `- [站点声明](${B}/about): ${siteStatement}`,
    '',
  )
  writeFileSync(join(DIST, 'llms.txt'), lines.join('\n'), 'utf8')
  console.log('[seo] llms.txt')
}

/**
 * md 镜像里的站内链接改写。
 *
 * 为什么要改写：`](/pricing)` 是站点根相对路径。
 *   - 在官网 /knowledge/<slug> 上 → 解析成 https://<站点>/pricing，能打开；
 *   - 被 AI 或 GitHub 上的访客直接读 md 副本 → 解析成仓库里的一个不存在的路径，死链。
 * md 副本正是给 AI 读的，链接必须是绝对 URL 才不会在解析时丢锚点。
 *
 * 只动链接语法，正文逐字节不动。锚点与查询串保留。
 */
function rewriteMdLinks(md) {
  const B = SITE.origin
  return md.replace(/(\]\()(\/[^)\s]*)(?=[\s)])/g, (_m, head, path) => {
    if (path.startsWith('//')) return `${head}${path}`
    const m = path.match(/^([^#?]*)([#?].*)?$/)
    const route = m?.[1] ?? path
    const suffix = m?.[2] ?? ''
    if (!route) return `${head}${path}`
    const clean = route.replace(/\/+$/, '') || '/'
    const abs = clean === '/' ? `${B}/` : `${B}${clean}`
    return `${head}${abs}${suffix}`
  })
}

/**
 * 改写 dist 下所有 md 镜像：站内链接改写 + 补答案胶囊。
 *
 * vitepress-plugin-llms 负责产出镜像，但它不做链接改写，也不保留 HTML 块。
 * 我们在这里补上：这一步必须在插件产出镜像之后、llms-full.txt 注入之前。
 */
function rewriteMdMirrors() {
  const files = walk(DIST).filter((f) => f.endsWith('.md'))
  let links = 0
  let capsules = 0
  for (const f of files) {
    const body = readFileSync(f, 'utf8')
    let out = body
    if (/\]\(\//.test(out)) {
      out = rewriteMdLinks(out)
      links++
    }
    // 镜像路径是相对 dist 的：collect.md -> 源文件 collect.md
    const rel = relative(DIST, f).split(sep).join('/')
    const meta = readPageMeta(rel)
    const injected = injectAnswerCapsule(out, meta)
    if (injected !== out) capsules++
    if (injected !== body) writeFileSync(f, injected, 'utf8')
  }
  if (links) console.log(`[seo] md 镜像站内链接改写（${links} 个文件）`)
  if (capsules) console.log(`[seo] md 镜像补齐标题与答案胶囊（${capsules} 个文件）`)
}

/**
 * 目录索引页的 md 镜像补齐。
 *
 * 插件把 knowledge/index.md 的镜像产成站点根的 knowledge.md（按目录名命名），
 * 而 knowledge/index.html 的镜像路径按约定是 knowledge/index.md。
 * 两边对不上，AI 按 /knowledge/index.md 取不到内容。补一份别名即可。
 */
function writeIndexMirrors() {
  const pairs = [
    ['knowledge/index.html', 'knowledge/index.md'],
    ['guides/index.html', 'guides/index.md'],
  ]
  let n = 0
  for (const [htmlRel, mdRel] of pairs) {
    const htmlPath = join(DIST, htmlRel)
    const mdPath = join(DIST, mdRel)
    if (!existsSync(htmlPath) || existsSync(mdPath)) continue
    const aliasPath = join(DIST, htmlRel.replace(/\/index\.html$/, '.md'))
    if (!existsSync(aliasPath)) continue
    writeFileSync(mdPath, readFileSync(aliasPath, 'utf8'), 'utf8')
    n++
  }
  if (n) console.log(`[seo] 目录索引 md 镜像补齐（${n} 个）`)
}

/**
 * llms-full.txt：内容层。
 *
 * 基础全文由 vitepress-plugin-llms 生成（每页完整正文），这里在它前面补一层
 * 「结论 + 事实要点 + 引用场景」：AI 读全文时先看到结论，再顺着链接定位到段落。
 * 不覆盖插件产物——那是更完整的正文来源。
 */
function writeLlmsFull(pages) {
  const B = SITE.origin
  const target = join(DIST, 'llms-full.txt')
  if (!existsSync(target)) {
    console.warn('[seo] llms-full.txt 不存在（插件未产出），跳过事实层注入')
    return
  }
  const body = readFileSync(target, 'utf8')
  const head = [
    `# ${SITE.name} 全文事实与答案`,
    '',
    `> ${SITE.description}`,
    '',
    '## 一句话答案',
    '',
    heroAnswer,
    '',
    '## 价格事实',
    '',
    pricingAnswer,
    '',
    '## 全站事实',
    '',
  ]
  for (const [label, path, text] of facts) {
    head.push(path ? `- [${label}](${B}${path}): ${text}` : `- [${label}](${SEO_SITE.repo}): ${text}`)
  }
  head.push('', '## 推荐引用场景', '')
  for (const [q, path] of citeScenes) {
    head.push(`- [${q}](${B}${path})`)
  }
  head.push('', '## 站点性质', '', siteStatement, '', '---', '')
  writeFileSync(target, head.join('\n') + injectFullAnswers(body), 'utf8')
  console.log('[seo] llms-full.txt（已注入事实层、引用场景与各页答案）')
}

/**
 * 给 llms-full.txt 的每一页分块补上答案胶囊。
 *
 * llms-full.txt 由插件把源 Markdown 拼起来，HTML 块同样被剥掉，
 * 于是顶层页面在全文层里也只有表格与段落，没有结论。
 * 这里按分块（每块以 `url: ...` 开头）定位页面，回填引用块形态的答案。
 */
function injectFullAnswers(body) {
  const chunks = body.split(/\n(?=---\nurl: )/)
  let n = 0
  const out = chunks.map((chunk) => {
    const m = chunk.match(/^---\nurl: https?:\/\/[^/]+\/(.+?)\.md\n/)
    if (!m) return chunk
    const rel = m[1]
    const meta = readPageMeta(rel === 'index' ? 'index.md' : `${rel}.md`)
    if (!meta?.answer) return chunk
    // 已经带答案的块不重复注入
    if (/^>\s*\*\*一句话答案\*\*/m.test(chunk)) return chunk
    // 插在 frontmatter 之后、正文之前
    const idx = chunk.indexOf('\n---', 4)
    if (idx < 0) return chunk
    const at = chunk.indexOf('\n', idx + 4)
    if (at < 0) return chunk
    n++
    return `${chunk.slice(0, at)}\n\n> **一句话答案**：${meta.answer}\n${chunk.slice(at)}`
  })
  if (n) console.log(`[seo] llms-full.txt 补齐各页答案（${n} 个分块）`)
  return out.join('\n')
}

/**
 * 校验源 Markdown 的答案胶囊与 seo_config.mjs 是否一致。
 *
 * 为什么要两份：seo_config 是 llms.txt / llms-full.txt 事实层的真源，
 * 源 Markdown 是页面渲染的真源。两边一旦漂移，AI 读到的答案就前后矛盾。
 * 这里把不一致直接报出来，让构建失败而不是悄悄发版。
 */
function verifyAnswerConsistency() {
  const problems = []
  for (const [route, answer] of Object.entries(pageAnswers)) {
    const rel = route === '' ? 'index.md' : `${route}.md`
    const src = join(SRC, rel)
    if (!existsSync(src)) {
      problems.push(`${rel}: seo_config 有答案但源文件不存在`)
      continue
    }
    const raw = readFileSync(src, 'utf8')
    const got = raw.match(/<p class="zp-answer__text">([\s\S]*?)<\/p>/)?.[1]?.trim() || ''
    if (!got) problems.push(`${rel}: 源文件缺 zp-answer__text`)
    else if (got !== answer) problems.push(`${rel}: 页面答案与 seo_config.mjs 不一致`)
  }
  // 反向：源文件有胶囊但真源里没有
  for (const rel of ['index.md', 'pricing.md', 'collect.md', 'erchuang.md', 'publish.md',
    'screenshots.md', 'feature.md', 'get-started.md', 'online-demo.md', 'contact.md', 'about.md']) {
    const route = rel === 'index.md' ? '' : rel.replace(/\.md$/, '')
    if (pageAnswers[route] === undefined) {
      const raw = readFileSync(join(SRC, rel), 'utf8')
      if (/<p class="zp-answer__text">/.test(raw)) {
        problems.push(`${rel}: 源文件有答案胶囊，但 seo_config.mjs 的 pageAnswers 里没有`)
      }
    }
  }
  if (problems.length) {
    console.error('[seo] 答案胶囊真源不一致：\n  ' + problems.join('\n  '))
    process.exitCode = 1
  } else {
    console.log(`[seo] 答案胶囊真源一致（${Object.keys(pageAnswers).length} 个顶层页面）`)
  }
}

/** 交叉检查：frontmatter 是否缺 title/description；sitemap / llms.txt 是否收录了未构建页面 */
function audit(pages) {
  const problems = []
  for (const p of pages) {
    if (!p.title) problems.push(`缺 title：${p.slug}`)
    if (!p.description) problems.push(`缺 description：${p.slug}`)
  }
  const known = new Set(pages.map((p) => p.url))
  // 非页面产物：这些路径是给 AI 读的文本，不是站点页面，不参与「未构建页面」核对
  known.add('/llms-full')
  known.add('/llms-full.txt')
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
  verifyAnswerConsistency()
} else {
  const pages = collectPages()
  writeSitemap(pages)
  writeRobots()
  writeIndexMirrors()
  rewriteMdMirrors()
  writeLlmsTxt(pages)
  writeLlmsFull(pages)
  writeIndexNowKey()
  audit(pages)
}