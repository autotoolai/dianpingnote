#!/usr/bin/env node
/**
 * 构建官网时同步「在线体验」演示站。
 *
 *   node scripts/build_demo.mjs
 *
 * 做什么：
 *  1. 把 packages/admin/static/ 原样复制到 apps/website/public/demo/
 *     —— 演示站用的就是产品真实界面，只多一个顶部横幅和一份 mock 数据层。
 *  2. 注入 demo.js / demo.css 与横幅（不改产品源码，只改复制出来的副本）。
 *  3. 用 esbuild 把 demo/src/*.js 打成 public/demo/demo.js。
 *
 * 产物（public/demo/）不入库，随构建生成。
 *
 * 两种运行环境：
 *  - 完整仓库（本机）：产品在 apps/website 的同级上层，能读到 packages/admin/static，
 *    构建出带演示站的完整站点。
 *  - 公开仓库（GitHub CI / 访客克隆）：产品源码不在仓库里，读不到产品前端。
 *    这时跳过演示站，站点照常构建，只是没有 /demo/ 目录。
 *    演示站的界面本身就是产品界面，对外可见的是线上站点的 /demo/，
 *    那个页面由本机完整仓库构建后部署，与本仓库是否开源无关。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = resolve(here, '..')
const REPO_ROOT = resolve(SITE_ROOT, '..', '..')

const ADMIN_STATIC = process.env.DIANPING_PRODUCT_STATIC
  ? resolve(process.env.DIANPING_PRODUCT_STATIC)
  : join(REPO_ROOT, 'packages', 'admin', 'static')
const DEMO_SRC = join(SITE_ROOT, 'demo', 'src')
const DEMO_MEDIA = join(SITE_ROOT, 'demo', 'media')
const OUT_DIR = join(SITE_ROOT, 'public', 'demo')

if (!existsSync(ADMIN_STATIC)) {
  // 公开仓库里没有产品源码，跳过演示站，站点其余部分照常构建。
  console.log(`[demo] 未找到产品静态目录（${ADMIN_STATIC}），跳过演示站构建。`)
  console.log('[demo] 公开仓库不包含产品源码，这是预期行为。')
  process.exit(0)
}

/* ---------- 1. 清空并复制产品界面 ---------- */

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
cpSync(ADMIN_STATIC, OUT_DIR, { recursive: true })

/* ---------- 2. 注入演示横幅与脚本 ---------- */

const indexPath = join(OUT_DIR, 'index.html')
let html = readFileSync(indexPath, 'utf8')

const banner = `<!-- 演示站横幅：仅在官网副本里注入，产品源码不受影响 -->
<div id="demoBanner" class="demo-banner">
  <span class="demo-banner-tag">演示</span>
  <span class="demo-banner-text">这是可交互的界面演示：数据为示例内容，不会真的采集、生成或发布。</span>
  <a class="demo-banner-link" href="/">回到官网</a>
</div>
`

if (!html.includes('id="demoBanner"')) {
  html = html.replace('</body>', `${banner}</body>`)
}

// 演示脚本必须先于 app.js 加载：app.js 一启动就会发 /api/health，
// 拦截器要先把 fetch 换掉，否则首批请求会打到真实后端。
const appScript = '<script src="js/app.js?v=20261102-page-load-perf"></script>'
if (!html.includes(appScript)) {
  console.error('[demo] index.html 里找不到 app.js 引用，注入中止')
  process.exit(1)
}
html = html.replace(
  appScript,
  `<link rel="stylesheet" href="demo.css" />\n  <script src="demo.js"></script>\n  ${appScript}`,
)
writeFileSync(indexPath, html, 'utf8')

// 帮助页回退链接指向演示站内的精简说明
const guidePath = join(OUT_DIR, 'operator-guide.html')
if (existsSync(guidePath)) {
  let guide = readFileSync(guidePath, 'utf8')
  // 演示站在 /demo/ 子目录下，产品里的绝对路径要改成相对路径，否则会跳出演示站
  guide = guide.replace('href="/"', 'href="./index.html"')
  writeFileSync(guidePath, guide, 'utf8')
}

/* ---------- 3. 修正副本里的绝对路径 ---------- */

// 产品界面里写死了 "/operator-guide.html"，在 /demo/ 下会 404，改成同目录相对路径
html = html.replace('href="/operator-guide.html"', 'href="operator-guide.html"')
writeFileSync(indexPath, html, 'utf8')

/* ---------- 3. 打包 mock 数据层 ---------- */

await build({
  entryPoints: [join(DEMO_SRC, 'main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: join(OUT_DIR, 'demo.js'),
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
})

// 样式与演示媒体直接复制
cpSync(join(SITE_ROOT, 'demo', 'demo.css'), join(OUT_DIR, 'demo.css'))
if (existsSync(DEMO_MEDIA)) {
  cpSync(DEMO_MEDIA, join(OUT_DIR, 'media'), { recursive: true })
}

console.log(`[demo] 演示站已生成：${OUT_DIR}`)
