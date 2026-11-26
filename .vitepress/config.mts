import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, type HeadConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

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
  srcExclude: ['README.md'],
  ignoreDeadLinks: true,
  sitemap: { hostname: SITE.origin },

  // 字体走系统栈，不引 Google Fonts：目标用户在国内，fonts.googleapis.com 在大陆不可达
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#fbf6ee' }],
    ['meta', { name: 'author', content: SITE.name }],
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
    const out: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
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
    return out
  },

  themeConfig: {
    logo: '/brand-logo.svg',
    // 「点评」与「笔记」之间加一道渐变划线
    siteTitle: '点评<span class="zp-divider" aria-hidden="true"></span>笔记助手',
    nav: [
      { text: '首页', link: '/' },
      { text: '采集', link: '/collect' },
      { text: '二创', link: '/erchuang' },
      { text: '发布', link: '/publish' },
      { text: '界面一览', link: '/screenshots' },
      { text: '在线体验', link: '/online-demo' },
      { text: '价格', link: '/pricing' },
      { text: '联系我们', link: '/contact' },
      { text: '帮助中心', link: '/guides/getting-started' },
      { text: '知识库', link: '/knowledge/' },
      { text: '常见问题', link: '/faq' },
    ],
    sidebar: [
      {
        text: '开始',
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
          { text: '状态词典', link: '/guides/status-glossary' },
          { text: '故障排查', link: '/guides/troubleshooting' },
          { text: '数据与隐私', link: '/guides/data-and-privacy' },
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
      copyright: `© ${new Date().getFullYear()} 点评<span class="zp-divider" aria-hidden="true"></span>笔记助手 · <a href="https://github.com/autotoolai/dianpingnote" target="_blank" rel="noopener">官网源码</a>`,
    },
    editLink: false,
    outline: { level: [2, 3] },
    // 自定义字段（主题组件读取）
    contactLabel: '联系销售开通',
    contactHref: '/get-started#contact',
    // 微信联系入口（ContactWechat 组件读取）
    wechatId: 'ren_mo_mo',
    wechatQr: 'wechat-qr-code.png',
    downloadUrl: '',
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
        ignoreFiles: ['README.md'],
      }),
    ],
    server: { port: 5175 },
    build: {
      // 图片不内联成 data:，保持可单独请求、可长缓存的 URL
      assetsInlineLimit: 0,
    },
  },
})