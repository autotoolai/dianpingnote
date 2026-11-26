# 官网仓库（apps/website）

本目录是一个 **git submodule**，指向公开仓库 `https://github.com/autotoolai/dianpingnote.git`。

## 提交规则（重要）

本目录里的改动**不在父仓 `DianPing_Publisher` 的提交范围内**。父仓只记录一个指针。

改完官网后要提交两次：

```bash
cd apps/website
git add -A
git commit -m "你的提交信息"
git push origin master

cd ../..
git add apps/website          # 只更新指针
git commit -m "chore: 更新官网 submodule"
git push origin master
```

在父仓根目录跑 `git status` 会看到 `apps/website` 有变更，那是要进子仓提交的内容，父仓 `git add apps/website` 只会更新指针，不会带上文件内容。

推送父仓时遵循项目规则：`bash scripts/push_both.sh`（origin + mirror 双推）。

## 这个仓库包含什么

官网的 VitePress 源码与 SEO/GEO 构建链。**不含产品源码**。

产品（桌面端采集、发布、授权）���私有仓库 `futianren/DianPing_Publisher`。

## 演示站的两层

| 层 | 位置 | 是否在本仓库 |
|---|---|---|
| 产品前端 | `packages/admin/static/`（父仓，`../../packages/admin/static`） | **否** |
| 假数据层 | `demo/src/api.js`（72 个接口的 mock） | 是 |

`scripts/build_demo.mjs` 与 `scripts/check_demo_coverage.mjs` 读产品前端：

- 在本机完整仓库里，读得到 → 生成完整演示站，接口覆盖率门禁生效
- 在公开仓库 / CI 里，读不到 → **跳过并正常退出**，不报错

所以从 GitHub 克隆后 `npm run build` 能正常构建，只是没有 `/demo/` 目录。线上站点的 `/demo/` 由本机完整仓库构建后部署。

产品前端位置也可以用环境变量覆盖：

```bash
DIANPING_PRODUCT_STATIC=/path/to/admin/static npm run build
```

## 构建与检查

```bash
npm install
npm run build        # 含 demo 构建 + 覆盖率检查 + SEO 生成 + sitemap 审计
npm run check:demo   # 单独跑接口覆盖率检查
npm run dev          # 本地预览 http://127.0.0.1:5175
npm run verify       # 四道门禁：GEO 写法 / 死链 / llms.txt 格式 / GEO 审计
```

## 硬约束

1. **不要**把产品源码复制进本目录（`packages/` 下的任何东西都不许进来）。
2. `data/faq.json` 是 FAQ 的唯一数据源，`faq.md` 是它的构建产物，不要手改 `faq.md`。
3. `public/demo/` 是构建产物，不入库。
4. 改产品前端（`packages/admin/static/js/app.js`）后要跑 `npm run check:demo`，确认假数据层跟上了接口变化。
5. 域名出现在 `config.mts` 的 `SITE.origin` 和 `scripts/seo_config.mjs` 里，换域名要一起改。
6. 关键词、答案胶囊、事实要点、引用场景只在 `scripts/seo_config.mjs` 里维护一份，改别处会被审计拦下。

## 部署

**生产部署由私有父仓的 GitHub Actions 负责**（`futianren/DianPing_Publisher` 的 `.github/workflows/website_deploy.yml`）：
推送父仓 master → 构建 → 部署 Pages → 通知搜索引擎。

本仓只跑 CI 门禁（`.github/workflows/ci.yml`），不碰生产。原因是演示站 `/demo/` 的产品前端在 `packages/admin/static/`，公开仓读不到；公开仓构建的产物会覆盖掉线上完整的站点。

手动部署（仅本机有完整源码时）：

```bash
npm run build
npx --yes wrangler@4 pages deploy .vitepress/dist --project-name=dianpingnote --branch=master
```

发版后跑收录通知：

```bash
pwsh -File scripts/website_seo_notify.ps1          # 本仓这份是权威副本
pwsh -File scripts/website_seo_notify.ps1 -DryRun  # 只看会推哪些 URL
```

权威文档在父仓 `docs/website/`。
