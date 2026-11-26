# 点评笔记助手 · 官网源码

> 点评笔记助手（DianPingNote）是一款 Windows 桌面应用：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。数据全部保存在本机。
>
> **线上站点**：https://dianping-note.aiautotools.com
> **本仓库**：官网的 VitePress 源码与 SEO/GEO 构建链，公开可核对。

关键词：大众点评笔记 / 点评蓝 V / 大众点评经营宝 / 点评笔记发布 / 小红书采集 / 视频笔记二创 / 抖音采集 / B站采集 / 门店笔记运营 / 本地笔记池 / 定时发布软件 / 点评笔记助手 / DianPingNote

## 这是什么仓库

官网 `dianping-note.aiautotools.com` 的完整源码，VitePress 静态站。

| 目录 | 内容 |
|---|---|
| `index.md` 等页面 | 官网全部页面（首页、采集、二创、发布、价格、FAQ、指南、联系） |
| `guides/` | 帮助中心：首次上手、采集与登录、二创设置、发布与定时、状态词典、故障排查、数据与隐私 |
| `.vitepress/` | 站点配置与主题组件（DOM 结构、OG 图、JSON-LD、canonical） |
| `scripts/build_seo.mjs` | 构建后产出 `sitemap.xml`、`robots.txt`、`llms.txt`、`llms-full.txt`、每页 `.md` 镜像 |
| `scripts/build_demo.mjs` | 生成「在线体验」演示站 |
| `demo/` | 演示站的假数据层（72 个接口的 mock）与示例素材 |
| `data/faq.json` | FAQ 的唯一数据源，`faq.md` 由它生成 |

## 关于产品源码

**产品本身不开源。** 桌面端的采集、发布、授权等实现在另一个私有仓库里，本仓库不含任何产品代码。

「在线体验」演示站的界面用的是产品真实界面，但产品源码不在本仓库里，所以从 GitHub 克隆后构建出来的站点没有 `/demo/` 目录——那是预期行为。线上站点的 `/demo/` 由完整仓库在本机构建后部署，功能完整。

演示站里属于本仓库的部分是 `demo/src/`：**72 个接口的假数据层**，它演示的是「产品界面在没有后端时如何表现」，不涉及任何采集、发布、授权逻辑。

## 本地开发

```bash
npm install
npm run dev      # http://127.0.0.1:5175
```

`npm run dev` 与 `npm run build` 都会先跑 `scripts/build_demo.mjs`。在没有产品源码的环境里它会跳过演示站，不报错。

## 构建

```bash
npm run build
```

构建链做三件事：

1. `build_seo.mjs --stage src` — 从 `data/faq.json` 生成 `faq.md`，校验每页 frontmatter 的 title/description
2. `vitepress build` — 出静态站
3. `build_seo.mjs --stage dist` — 生成 `sitemap.xml` / `robots.txt` / `llms.txt` / `llms-full.txt`，并交叉审计 sitemap 与 llms.txt 是否收录了未构建的页面

## SEO / GEO

站点面向搜索引擎与生成式引擎做了结构化处理：

- 每页独立的 title / description / canonical / OG 标签
- `Organization` + `WebSite` + `SoftwareApplication` JSON-LD，FAQ 页追加 `FAQPage`
- `llms.txt` 与 `llms-full.txt`：给 AI 引擎的站点目录，含每页摘要、二级标题与事实速览
- `sitemap.xml` 带 `lastmod` / `changefreq` / `priority`
- 站内页面同时提供 `.md` 镜像，便于 AI 直接抓取正文

## 部署

站点部署在 Cloudflare Pages（项目 `dianpingnote`，分支 `master`）。

```bash
npm run build
npx --yes wrangler@4 pages deploy .vitepress/dist --project-name=dianpingnote --branch=master
```

发版后由脚本向 IndexNow、Bing、百度与 Google Search Console 推送新 URL 与 sitemap。

## 许可

本仓库的官网源码以 MIT 许可开放，见 [LICENSE](LICENSE)。

产品「点评笔记助手」为商业软件，源码不公开。商标与产品名称归各自所有者所有。
