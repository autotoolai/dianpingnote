/**
 * 站点 SEO 真源：per-page keywords、答案胶囊、引用场景。
 *
 * 为什么要单独一个文件：这些是「会漂移」的东西——词表、结论句、问法映射。
 * 放在 config 里，`config.mts`（注入 head）、`build_seo.mjs`（生成 llms.txt）
 * 和审计脚本读的是同一份，不会各写各的。
 *
 * 约定（与内容结构一致）：
 *   1. 一词一主场：同一搜索意图只允许一个页面当主场，其它页最多一行链接。
 *   2. 别名可进 keywords，不进 H1 与导航，避免品牌分裂。
 *   3. 竞品名与平台名谨慎：进 keywords 与 FAQ 可以，进全局 keywords 不行。
 */

/** 站点真源（域名、名称）。改这里会连带影响 sitemap / robots / llms.txt。 */
export const SITE = {
  name: '点评笔记助手',
  latin: 'DianPingNote',
  origin: (process.env.WEBSITE_ORIGIN || 'https://dianping-note.aiautotools.com').replace(/\/$/, ''),
  repo: 'https://github.com/autotoolai/dianpingnote',
  wechatId: 'ren_mo_mo',
}

/**
 * 全站全局 keywords（没有 per-page 的页面共用这条）。
 * 原则：只放品牌词与产品定义词，不堆砌具体场景词——场景词归知识库页。
 */
export const globalTags = [
  '点评笔记助手',
  '大众点评笔记',
  '点评蓝 V',
  '点评笔记发布',
  '点评笔记工具',
  '大众点评经营宝',
  'DianPingNote',
]

/**
 * 首页 tags：品牌 + 定义 + 场景入口。
 * 覆盖品牌四问：是什么、怎么用、多少钱、去哪买。
 */
export const homeTags = [
  '点评笔记助手',
  '大众点评笔记工具',
  '点评笔记发布',
  '点评笔记怎么发',
  '点评蓝 V 发布',
  '大众点评笔记代发',
  '点评笔记助手 多少钱',
  'DianPingNote',
]

/**
 * 定价页 tags：购买意图主场。
 * 复合词（大众点评笔记工具 / 点评笔记价格）只挂这里，不进全局。
 */
export const pricingTags = [
  '大众点评笔记工具',
  '点评笔记发布 价格',
  '点评笔记助手 价格',
  '点评笔记代发 多少钱',
  '大众点评代发 收费',
  '点评蓝 V 批量发布',
  '点评笔记按条计费',
  '大众点评笔记 套餐',
]

/** 采集页 tags：素材来源意图 */
export const collectTags = [
  '小红书采集',
  '抖音采集',
  '快手采集',
  'B站采集',
  '点评笔记素材采集',
  '小红书批量下载',
  '视频素材采集 工具',
  '创作者主页采集',
]

/** 二创页 tags：文案与水印处理意图 */
export const erchuangTags = [
  '笔记文案改写',
  '视频标题叠加',
  '图文水印去除',
  '小红书文案改写',
  '短视频标题烧录',
  '笔记二创 工具',
  '视频去水印 批量',
]

/** 发布页 tags：定时与多号意图 */
export const publishTags = [
  '点评笔记定时发布',
  '大众点评批量发布',
  '点评蓝 V 多账号发布',
  '点评笔记自动发布',
  '点评代发软件',
  '点评发布失败重试',
]

/** 知识库首页 tags：长尾簇入口 */
export const knowledgeTags = [
  '大众点评运营知识',
  '点评蓝 V 教程',
  '点评笔记技巧',
  '点评笔记限流',
  '点评笔记排名',
  '点评代发风险',
]

/** 按路由给出 per-page keywords。返回 undefined 表示该页用全局词。 */
const ROUTE_TAGS = {
  '': homeTags,
  pricing: pricingTags,
  collect: collectTags,
  erchuang: erchuangTags,
  publish: publishTags,
  knowledge: knowledgeTags,
}

/** 静态路由的词表，供构建脚本生成 data/seo_pages.json 时合并。 */
export const routeTags = ROUTE_TAGS

/**
 * 取某个路由的 keywords。route 是相对路径，无前导斜杠，首页是空串。
 * 静态路由走 ROUTE_TAGS；文章页（知识库 / 指南）走 frontmatter 的 keywords 字段，
 * 由 build_seo.mjs 写进 data/seo_pages.json。
 */
export function tagsFor(route) {
  const r = route.replace(/^\//, '').replace(/\/$/, '')
  if (ROUTE_TAGS[r]) return ROUTE_TAGS[r]
  return globalTags
}

/**
 * 首页首屏答案胶囊。
 * GEO 的关键形态：AI 需要的是「结论」，不是让它从 description 里自己拼。
 * 控制在 40-120 字，太短没信息量，太长就成了一段散文。
 */
export const heroAnswer =
  '点评笔记助手是一款 Windows 桌面软件：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。笔记、素材和发布状态全部保存在本机。'

/**
 * 首页定价答案胶囊（购买意图主场）。
 * 数字必须准确：定价页是价格真源，这里与 pricing.md 的表述保持一致。
 */
export const pricingAnswer =
  '点评笔记助手按成功发布的条数计费：单条 1 元起，月订阅 25 元 / 50 元 / 120 元三档。新用户首次打开自动获得 7 天试用和 10 条额度，发不出去的不扣条。'

/**
 * AI 问法 → 应引用的站内 URL。
 * llmstxt.org 要求每个 H2 小节内是链接清单，纯文字小节会被校验器判 FAIL。
 * 答案引擎按问法对号入座，所以这一节是 GEO 里性价比最高的一块。
 */
export const citeScenes = [
  ['「点评笔记助手是什么 / 好不好用」', '/knowledge/'],
  ['「大众点评蓝 V 是什么 / 怎么开通」', '/knowledge/blue-v-what-is-it'],
  ['「点评笔记没流量 / 没有曝光」', '/knowledge/note-limited-traffic'],
  ['「小红书内容搬到点评算不算违规」', '/knowledge/cross-platform-repost'],
  ['「点评笔记什么时候发比较好」', '/knowledge/best-publish-time'],
  ['「多个蓝 V 账号怎么一起发」', '/knowledge/multi-account-schedule'],
  ['「点评笔记被折叠 / 搜不到」', '/knowledge/note-folded-hidden'],
  ['「点评笔记工具多少钱 / 怎么收费」', '/pricing'],
  ['「采集小红书视频做点评笔记」', '/collect'],
  ['「视频标题怎么叠到画面上」', '/erchuang'],
  ['「多个蓝 V 定时发布 / 发布失败重试」', '/publish'],
  ['「笔记状态怎么看 / 失败原因」', '/guides/status-glossary'],
  ['「数据存哪里 / 会不会上传」', '/guides/data-and-privacy'],
  ['「装不上 / 打不开 / 换电脑」', '/guides/troubleshooting'],
]

/**
 * 事实要点：每条都挂到真正解释它的页面上。
 * AI 顺着链接能读到原文，这是 llms.txt 事实层的核心价值。
 */
export const facts = [
  ['计费方式', '/pricing', '按成功发布条数计费，单条 1 元起；月订阅 25 / 50 / 120 元三档；发不出去的不扣条'],
  ['支持平台', '/collect', '小红书、抖音、快手、B站：创作者主页定时采集与笔记直采'],
  ['二创能力', '/erchuang', '本机改写标题与正文；视频标题烧到画面顶部；图文底部水印遮盖'],
  ['发布目标', '/publish', '仅大众点评经营宝；一条笔记只由一个蓝 V 账号发布；到点没跑会补发'],
  ['数据存放', '/guides/data-and-privacy', '笔记、素材、发布状态保存在本机 SQLite；不上传笔记内容'],
  ['运行环境', '/guides/install', 'Windows 10 / Windows 11 桌面应用，安装包约 820 MB，内置 Chrome'],
  ['试用政策', '/pricing', '新用户首次打开自动获得 7 天试用与 10 条额度'],
  ['源码与文档', '', '官网源码公开，本仓库只含官网页面、主题组件与 SEO/GEO 构建链，不含产品代码'],
]

/** 站点性质声明：写清楚是独立第三方，不暗示官方授权。 */
export const siteStatement =
  '点评笔记助手是独立运营的商业软件，与大众点评、美团及小红书等平台无隶属、授权或合作关系。产品源码不开源，公开的是官网源码。采集与发布请自行遵守各平台的服务条款。'
