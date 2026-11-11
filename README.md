# 点评笔记助手官网

| 项 | 值 |
|---|---|
| 对外域名 | https://dianping-note.aiautotools.com （二级域，标签 `dianpingnote`） |
| 备用预览 | https://dianpingnote.pages.dev （建好 Pages 项目后可用） |
| 栈 | VitePress → Cloudflare Pages（对齐唯知笔记 / 智品专员选型） |
| 图床 | Cloudflare R2（桶 `dianpingnote-img`）；`themeConfig.imgCdn` 留空时图片走本站 `public/images` |
| 收录通知 | `scripts/website_seo_notify.ps1`（IndexNow / Bing / 百度 / GSC） |

权威文档：[docs/website/](../../docs/website/)

## 演示站（/demo/）

演示站和产品界面是**同一套代码**：构建时把 `packages/admin/static/` 原样复制到
`apps/website/public/demo/`，再叠一层假数据（`demo/src/api.js` 拦截 `fetch`）。
所以改产品前端，演示站下次构建自动跟着变。

但假数据层不会自动跟上接口变化，因此改完产品前端必须跑一次：

```bash
npm run check:demo    # 产品用的接口，演示站是不是都实现了
```

漏实现会在构建阶段报错（`prebuild` 里已接上）。详细约定见
[docs/website/demo_site_iteration.md](../../docs/website/demo_site_iteration.md)。

## 本地开发

```bash
cd apps/website
npm install
npm run dev      # http://127.0.0.1:5175
```

## 构建与部署

```bash
# 一键：构建 + Pages 部署 + 收录通知
pwsh -File ../../scripts/deploy_website.ps1

# 或分步
npm run build
npx --yes wrangler@4 pages deploy .vitepress/dist --project-name=dianpingnote --branch=master --commit-dirty=true
pwsh -File ../../scripts/website_seo_notify.ps1
```

VitePress 默认输出目录：`.vitepress/dist`。`npm run build` 前后会自动跑
`scripts/build_seo.mjs`：构建前生成 `faq.md`（由 `data/faq.json` 生成），构建后写 `sitemap.xml`、`robots.txt`、`llms.txt` 并做一次审计。

GEO 产物分工：`vitepress-plugin-llms` 负责 `llms-full.txt` 与每个子页面的 `.md` 版本（llms.txt v2 约定），
`build_seo.mjs` 负责 `llms.txt` 本体（带分组与事实速览，链接指向各页 `.md`）。插件的 `generateLLMsTxt` 已关闭，避免两个写入方互相覆盖。

## 页面结构

| 路径 | 职责 |
|---|---|
| `/` | 品牌首屏 + 三步流水线 + 能力 + 手工对比 + 适合谁 |
| `/collect` `/erchuang` `/publish` | 三段核心能力 |
| `/screenshots` | 真实界面截图（10 张，来自 `docs/sales/screenshots/`） |
| `/pricing` | 按条计价、月订阅、数量包、试用 |
| `/get-started` | 开始使用与联系销售 |
| `/contact` | 联系我们（微信二维码，`ContactWechat` 组件） |
| `/faq` | 常见问题（由 `data/faq.json` 生成，同时输出 FAQPage JSON-LD） |
| `/about` | 品牌、数据与隐私、技术说明 |
| `/guides/*` | 帮助中心：安装、首次上手、采集、二创、发布、状态词典、故障排查、数据与隐私 |

新增页面：写 `.md`（必须有 frontmatter `title` 与 `description`）后，
`sitemap.xml` 与 `llms.txt` 自动收录；在 `scripts/build_seo.mjs` 的 `SITE.sections` 里登记可调整 llms.txt 分组。

## 图片

- 截图转 WebP + 生成 OG 图：`python apps/website/scripts/prepare_images.py`（源：`docs/sales/screenshots/*.png`）
- 图片默认放 `apps/website/public/images/`；开通 R2 后上传到 `site/images/` 并把
  `.vitepress/config.mts` 的 `themeConfig.imgCdn` 设为 `https://img.aiautotools.com` 即可切 CDN。

```bash
python scripts/website_r2_upload.py dir apps/website/public/images site/images
```

### 微信二维码

`public/images/wechat-qr-code.png` 是唯一的客服二维码，供 `ContactWechat` 组件使用。
微信号写在 `.vitepress/config.mts` 的 `themeConfig.wechatId`，二维码文件名写在 `themeConfig.wechatQr`，
组件默认读这两个值，页面上可以用 `qr` / `wechatId` 属性覆盖。

换二维码时注意：**必须是正方形**（否则 `width`/`height` 固定会拉变形），
且四周留足静默区，否则手机扫不出来。换完用这段校验：

```bash
python -c "import cv2; i=cv2.imread('apps/website/public/images/wechat-qr-code.png', cv2.IMREAD_GRAYSCALE); print(i.shape, cv2.QRCodeDetector().detect(i)[0])"
```

`detect` 返回 True 才算合格（微信个人码 OpenCV 解不出内容属正常，不用 decode）。

## 密钥

`config/website_secrets.example.env` → 复制为 `config/local/website_secrets.env`；
`config/website_r2_secrets.example.env` → 复制为 `config/local/website_r2_secrets.env`。
`config/local/` 已 gitignore，真密钥不要提交。