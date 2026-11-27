import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, type HeadConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'
import { globalTags, tagsFor, SITE as SEO_SITE } from '../scripts/seo_config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(here, '..')

/** 站点常量：改这里即可，sitemap / robots / llms.txt / JSON-LD 会跟着变 */
export const SITE = {
  name: '点评笔记助手',
  latin: 'DianPingNote',
  origin: process.env.WEBSITE_ORIGIN || 'https://dianping-note.aiautotools.com',
  tagline: '设定一次，采集、二创、发布全自动',
  description:
    '点评笔记助手是一款 Windows 桌面应用：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。数据全部保存在本机。',
  price: '¥1',
  updated: '2026-10-02',
} as const

const faq = JSON.parse(readFileSync(resolve(siteRoot, 'data/faq.json'), 'utf-8')) as {
  items: { q: string; a: string }[]
}

const j = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')

const organization = {
  '@type': 'Organization',
  '@id': `${SITE.origin}/#organization`,
  name: SITE.name,
  alternateName: SITE.latin,
  url: `${SITE.origin}/`,
  logo: `${SITE.origin}/brand-logo.svg`,
  // sameAs 指向官网源码仓库：让搜索引擎把「官网」与「GitHub 仓库」认成同一实体，
  // 两个方向的证据互相加强（仓库 README 也指回官网）
  sameAs: [SEO_SITE.repo],
}

const software = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE.origin}/#software`,
  name: SITE.name,
  alternateName: SITE.latin,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Windows 10 / Windows 11',
  url: `${SITE.origin}/`,
  inLanguage: 'zh-CN',
  description: SITE.description,
  publisher: { '@id': `${SITE.origin}/#organization` },
  featureList: [
    '小红书 / 抖音 / 快手 / B站 创作者主页定时采集与笔记直采',
    '本机大模型或自备 API 改写标题、正文与标签',
    '视频标题叠到画面顶部，图文底部水印遮盖',
    '每日定时批量发布到大众点评经营宝下的多个蓝 V',
    '笔记池与发布状态全部保存在本机',
  ],
  offers: {
    '@type': 'Offer',
    price: '1',
    priceCurrency: 'CNY',
    description: '按成功发布条数计费，单条 1 元起；月订阅 ¥25 起。',
    url: `${SITE.origin}/pricing`,
  },
}

const website = {
  '@type': 'WebSite',
  '@id': `${SITE.origin}/#website`,
  url: `${SITE.origin}/`,
  name: SITE.name,
  inLanguage: 'zh-CN',
  publisher: { '@id': `${SITE.origin}/#organization` },
}

export default defineConfig({
  lang: 'zh-CN',
  title: SITE.name,
  // 首页 frontmatter.title 写 slogan，所以这里统一加品牌后缀不会重复品牌名
  titleTemplate: `:title · ${SITE.name}`,
  description: SITE.description,
  cleanUrls: true,
  lastUpdated: true,
  // CLAUDE.md 是 AI 协作说明，不该出现在站点与 llms-full.txt 里。
  // 不排除的话，AI 读全文层会读到一堆内部指令，把内容稀释掉。
  srcExclude: ['README.md', 'CLAUDE.md'],
  ignoreDeadLinks: true,
  sitemap: { hostname: SITE.origin },

  // 字体走系统栈，不引 Google Fonts：目标用户在国内，fonts.googleapis.com 在大陆不可达
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#fbf6ee' }],
    ['meta', { name: 'author', content: SITE.name }],
    // 全局 keywords：per-page 的页面会在 transformHead 里覆盖这一条
    ['meta', { name: 'keywords', content: globalTags.join(',') }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE.name }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:title', content: `${SITE.name} · ${SITE.tagline}` }],
    ['meta', { property: 'og:description', content: SITE.description }],
    ['meta', { property: 'og:image', content: `${SITE.origin}/og-default.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: `${SITE.name} · ${SITE.tagline}` }],
    ['meta', { name: 'twitter:description', content: SITE.description }],
    ['meta', { name: 'twitter:image', content: `${SITE.origin}/og-default.png` }],
    // VitePress head 的第三个数才是标签内容；写成 children 会被当成 HTML 属性
    ['script', { type: 'application/ld+json' }, j({ '@context': 'https://schema.org', '@graph': [organization, website, software] })],
  ],

  transformHead({ pageData }): HeadConfig[] {
    const path = (pageData.relativePath || '').replace(/\\/g, '/').replace(/\.md$/, '')
    const url = path === 'index' ? `${SITE.origin}/` : `${SITE.origin}/${path.replace(/\/index$/, '')}`
    const title = pageData.title
      ? pageData.title === SITE.name
        ? `${SITE.name} · ${SITE.tagline}`
        : `${pageData.title} · ${SITE.name}`
      : `${SITE.name} · ${SITE.tagline}`
    const desc = (pageData.description as string) || SITE.description
    const route = path === 'index' ? '' : path.replace(/\/index$/, '')
    // per-page keywords：文章页用 frontmatter 的 keywords 字段，静态页用词表
    const fmKeywords = (pageData.frontmatter as any)?.keywords
    const keywords: string[] = Array.isArray(fmKeywords) && fmKeywords.length
      ? fmKeywords
      : typeof fmKeywords === 'string' && fmKeywords.trim()
        ? fmKeywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        : tagsFor(route)
    const out: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { name: 'keywords', content: keywords.join(',') }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: desc }],
    ]
    if (path === 'faq') {
      out.push([
        'script',
        { type: 'application/ld+json' },
        j({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.items.map((it) => ({
            '@type': 'Question',
            name: it.q,
            acceptedAnswer: { '@type': 'Answer', text: it.a },
          })),
        }),
      ])
    }
    // 文章页补 Article + WebPage：知识库是长文主力，Article 声明能让搜索引擎
    // 认出「这是一篇有正文、有日期的文章」，而不是当成普通落地页。
    if (route.startsWith('knowledge/') || route.startsWith('guides/')) {
      const articleBody = (pageData.content as string) || ''
      out.push([
        'script',
        { type: 'application/ld+json' },
        j({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              '@id': `${url}#article`,
              headline: title,
              description: desc,
              inLanguage: 'zh-CN',
              datePublished: (pageData.frontmatter as any)?.date || SITE.updated,
              dateModified: (pageData.frontmatter as any)?.updated || (pageData.frontmatter as any)?.date || SITE.updated,
              author: { '@type': 'Organization', name: SITE.name },
              publisher: { '@id': `${SITE.origin}/#organization` },
              isPartOf: { '@id': `${SITE.origin}/#website` },
              mainEntityOfPage: { '@id': `${url}#webpage` },
              wordCount: articleBody.length,
              keywords: keywords.join(','),
            },
            {
              '@type': 'WebPage',
              '@id': `${url}#webpage`,
              url,
              name: title,
              description: desc,
              inLanguage: 'zh-CN',
              isPartOf: { '@id': `${SITE.origin}/#website` },
              breadcrumb: { '@id': `${url}#breadcrumb` },
              about: { '@id': `${SITE.origin}/#software` },
            },
            {
              '@type': 'BreadcrumbList',
              '@id': `${url}#breadcrumb`,
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE.origin}/` },
                ...(route.startsWith('knowledge/')
                  ? [{ '@type': 'ListItem', position: 2, name: '知识库', item: `${SITE.origin}/knowledge/` }]
                  : [{ '@type': 'ListItem', position: 2, name: '帮助中心', item: `${SITE.origin}/guides/getting-started` }]),
                { '@type': 'ListItem', position: 3, name: title.replace(` · ${SITE.name}`, ''), item: url },
              ],
            },
          ],
        }),
      ])
    }
    return out
  },

  themeConfig: {
    logo: '/brand-logo.svg',
    // 「点评」与「笔记」之间加一道渐变划线
    siteTitle: '点评<span class="zp-divider" aria-hidden="true"></span>笔记助手',
    // 导航压到 6 项。采集 / 二创 / 发布 / 常见问题这些落地页不再占顶部位置，
    // 改由 /feature 内部小节引出（URL 保留，SEO 主场不丢），其余收进「文档」下拉。
    nav: [
      { text: '首页', link: '/' },
      { text: '功能', link: '/feature' },
      { text: '界面演示', link: '/screenshots' },
      { text: '价格', link: '/pricing' },
      {
        text: '文档',
        items: [
          {
            text: '开始使用',
            items: [
              { text: '开始使用', link: '/get-started' },
              { text: '安装包与运行环境', link: '/guides/install' },
            ],
          },
          {
            text: '使用指南',
            items: [
              { text: '首次上手', link: '/guides/getting-started' },
              { text: '采集与登录', link: '/guides/collect' },
              { text: '二创设置', link: '/guides/erchuang' },
              { text: '发布与定时', link: '/guides/publish' },
              { text: '状态词典', link: '/guides/status-glossary' },
              { text: '故障排查', link: '/guides/troubleshooting' },
              { text: '数据与隐私', link: '/guides/data-and-privacy' },
            ],
          },
          {
            text: '点评知识库',
            items: [
              { text: '知识库首页', link: '/knowledge/' },
              { text: '蓝 V 是什么', link: '/knowledge/blue-v-what-is-it' },
              { text: '没流量的原因', link: '/knowledge/note-limited-traffic' },
              { text: '跨平台搬运风险', link: '/knowledge/cross-platform-repost' },
              { text: '发布时间怎么选', link: '/knowledge/best-publish-time' },
              {text: '多蓝 V 排期', link: '/knowledge/multi-account-schedule' },
              { text: '被折叠或搜不到', link: '/knowledge/note-folded-hidden' },
            ],
          },
          {
            text: '参考',
            items: [
              { text: '常见问题', link: '/faq' },
              { text: '更新日志', link: '/changelog' },
              { text: '服务条款与免责声明', link: '/terms' },
            ],
          },
        ],
      },
      { text: '联系我们', link: '/contact' },
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '开始使用', link: '/get-started' },
          { text: '安装包与运行环境', link: '/guides/install' },
          { text: '界面演示', link: '/screenshots' },
        ],
      },
      {
        text: '使用指南',
        items: [
          { text: '首次上手', link: '/guides/getting-started' },
          { text: '采集与登录', link: '/guides/collect' },
          { text: '二创设置', link: '/guides/erchuang' },
          { text: '发布与定时', link: '/guides/publish' },
        ],
      },
      {
        text: '知识库',
        items: [
          { text: '知识库首页', link: '/knowledge/' },
          { text: '蓝 V 是什么', link: '/knowledge/blue-v-what-is-it' },
          { text: '没流量的原因', link: '/knowledge/note-limited-traffic' },
          { text: '跨平台搬运风险', link: '/knowledge/cross-platform-repost' },
          { text: '发布时间怎么选', link: '/knowledge/best-publish-time' },
          { text: '多蓝 V 排期', link: '/knowledge/multi-account-schedule' },
          { text: '被折叠或搜不到', link: '/knowledge/note-folded-hidden' },
        ],
      },
      {
        text: '参考',
        items: [
          { text: '功能与原理', link: '/feature' },
          { text: '状态词典', link: '/guides/status-glossary' },
          { text: '故障排查', link: '/guides/troubleshooting' },
          { text: '数据与隐私', link: '/guides/data-and-privacy' },
          { text: '常见问题', link: '/faq' },
          { text: '更新日志', link: '/changelog' },
          { text: '服务条款与免责声明', link: '/terms' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'wechat', link: '/contact' },
      { icon: 'github', link: 'https://github.com/autotoolai/dianpingnote' },
    ],
    footer: {
      message: 'Windows 桌面软件 · 笔记池与发布状态全部保存在本机',
      // 页脚带官网源码链接：给搜索引擎和访客一个可抓取的 GitHub 入口
      copyright: `© ${new Date().getFullYear()} 点评<span class="zp-divider" aria-hidden="true"></span>笔记助手 · <a href="/about">关于</a> · <a href="/changelog">更新日志</a> · <a href="/terms">服务条款</a> · <a href="https://github.com/autotoolai/dianpingnote" target="_blank" rel="noopener">官网源码</a>`,
    },
    editLink: false,
    outline: { level: [2, 3] },
    // 自定义字段（主题组件读取）
    contactLabel: '联系销售开通',
    contactHref: '/get-started#contact',
    // 微信联系入口（ContactWechat 组件读取）
    wechatId: 'ren_mo_mo',
    wechatQr: 'wechat-qr-code.png',
    // 安装包直链。留空时页面显示「微信获取安装包」；发布直链后填这里即自动变成下载按钮。
    downloadUrl: process.env.WEBSITE_DOWNLOAD_URL || '',
    imgCdn: '',
  } as any,

  vite: {
    plugins: [
      // llms.txt v2：生成 llms.txt / llms-full.txt 与每页 .md 版本
      llmstxt({
        domain: SITE.origin,
        title: SITE.name,
        details: SITE.description,
        // llms.txt 由 scripts/build_seo.mjs 生成（含分组与事实速览），这里关掉避免两个写入方打架
        // 插件仍负责 llms-full.txt 与每页 .md 版本
        generateLLMsTxt: false,
        ignoreFiles: ['README.md', 'CLAUDE.md'],
      }),
    ],
    server: { port: 5175 },
    build: {
      // 图片不内联成 data:，保持可单独请求、可长缓存的 URL
      assetsInlineLimit: 0,
    },
  },
})