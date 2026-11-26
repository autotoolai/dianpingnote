#!/usr/bin/env node
/**
 * llms.txt 规范校验门禁。
 *
 * 用第三方校验器 @aia-matrix/llms-txt-validator（MIT）跑构建产物 llms.txt，
 * 只取它的 format.* 系列规则（llmstxt.org 格式规范），不跑网络检查：
 *   - 网络检查会去抓 llms.txt 里每一个链接，Cloudflare Pages 在国内线路
 *     有落到海外边缘节点导致 20-60s 超时的情况，放进 CI 会变成随机失败。
 *     链接可达性由 check:links 负责。
 *   - 我们要守的是「格式对不对」：每个 H2 小节必须是链接清单、条目必须以链接开头、
 *     链接后的说明必须以冒号开头。这几条格式错会让部分 AI 客户端直接放弃解析。
 *
 * 校验器没装到本地 node_modules 时走 npx 临时拉取；拉不动就跳过（只提醒不拦构建），
 * 避免离线环境把整条构建卡死。
 *
 * 用法：node scripts/check_llms_txt.mjs
 * 退出码：0 = 通过或跳过；1 = 有 fail 项。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), '.vitepress', 'dist')
const llmsPath = join(DIST, 'llms.txt')

if (!existsSync(llmsPath)) {
  console.error(`[llms-check] 缺 ${llmsPath}，先跑 npm run build`)
  process.exit(1)
}

// Windows 上 npx 是 npx.cmd（.cmd 不是真正的可执行文件，spawnSync 直接起会 EINVAL），
// 所以走 cmd /c。其余平台直接起 npx。
const isWin = process.platform === 'win32'
const npxArgs = ['--yes', '@aia-matrix/llms-txt-validator', llmsPath, '--json', '--no-network']
const res = isWin
  ? spawnSync('cmd', ['/c', 'npx', ...npxArgs], { encoding: 'utf8', timeout: 180000 })
  : spawnSync('npx', npxArgs, { encoding: 'utf8', timeout: 180000 })

if (res.error) {
  console.warn(`[llms-check] 跳过：无法运行校验器（${res.error.message}）。格式由审计脚本兜底。`)
  process.exit(0)
}

// 校验器退出码 2 = 工具自身报错（不是校验失败），要区别对待。
if (res.status === 2) {
  console.warn(`[llms-check] 跳过：校验器执行失败\n${res.stdout || res.stderr}`)
  process.exit(0)
}

let report
try {
  report = JSON.parse(res.stdout)
} catch {
  console.warn(`[llms-check] 跳过：校验器输出不是 JSON\n${res.stdout}\n${res.stderr}`)
  process.exit(0)
}

const results = report.results ?? []
const failures = results.filter((r) => r.status === 'fail')
const warnings = results.filter((r) => r.status === 'warn')

// 只把格式类问题当硬失败：格式错 = 客户端可能直接放弃解析。
// 其余 warn（例如文件体积提示）只记录不拦截。
const formatFailures = failures.filter((r) => r.id.startsWith('format.'))

console.log(
  `[llms-check] 格式校验 ${results.filter((r) => r.status === 'pass').length} 通过 / ${warnings.length} 警告 / ${failures.length} 失败`,
)
for (const r of warnings) console.log(`  · 警告 ${r.id}: ${r.message}`)
for (const r of failures) console.log(`  · 失败 ${r.id}: ${r.message}`)

if (formatFailures.length > 0) {
  console.error(`[llms-check] llms.txt 格式不符合 llmstxt.org 规范（${formatFailures.length} 项），AI 客户端可能拒绝解析`)
  process.exit(1)
}

console.log('[llms-check] llms.txt 格式通过')
