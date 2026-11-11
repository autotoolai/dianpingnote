#!/usr/bin/env node
/**
 * 生成演示站用的示例媒体（合成素材，不是真实门店视频）。
 *
 *   node scripts/make_demo_media.mjs
 *
 * 产物：apps/website/demo/media/
 *   - sample-processed.mp4  带叠标题的「成片」
 *   - sample-raw.mp4        原片
 *   - sample-processed.webm / sample-raw.webm  同一画面的 VP9 版本
 *   - sample-01.jpg ~ 03.jpg  图文笔记示例图
 *
 * 为什么两种格式：
 *   Playwright 自带的 Chromium 不带 H.264 解码器，播不了 mp4；
 *   部分 Linux 浏览器同样没有。所以再给一份 webm，演示站按浏览器能力自动挑。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '..', 'demo', 'media')
const FONT = 'C\\:/Windows/Fonts/msyh.ttc'

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

function have(bin) {
  try {
    execFileSync(bin, ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!have('ffmpeg')) {
  console.error('[demo-media] 需要 ffmpeg 才能生成示例视频')
  process.exit(1)
}

const TEXT = '孩子练太极两个月，专注力明显提升'
const SUB = '示例素材 · 仅用于界面演示'

/** 渐变底 + 标题叠字，模拟「叠完标题的成片」 */
function drawFilter(withTitle) {
  const draw = withTitle
    ? [
        `drawtext=fontfile='${FONT}':text='${TEXT}':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h*0.06`,
        `drawtext=fontfile='${FONT}':text='${SUB}':fontcolor=0xFDE68A:fontsize=20:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h*0.14`,
      ].join(',')
    : `drawtext=fontfile='${FONT}':text='${SUB}':fontcolor=0xCBD5E1:fontsize=22:box=1:boxcolor=black@0.45:boxborderw=10:x=(w-text_w)/2:y=h*0.88`
  return `drawbox=x=0:y=0:w=iw:h=ih*0.42:color=0x1D4ED8@0.55:t=fill,${draw}`
}

/** H.264 的 mp4：Windows / macOS / Android 的默认选择 */
function makeMp4(out, withTitle) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x14213D:s=720x1280:d=6:r=24',
    '-vf', drawFilter(withTitle),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', out,
  ]
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
}

/** VP9 的 webm：不带 H.264 解码器的浏览器用这份 */
function makeWebm(out, withTitle) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x14213D:s=720x1280:d=6:r=24',
    '-vf', drawFilter(withTitle),
    '-c:v', 'libvpx-vp9', '-b:v', '450k', '-crf', '34', '-deadline', 'good', '-cpu-used', '2',
    '-pix_fmt', 'yuv420p', '-an', out,
  ]
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
}

for (const [base, withTitle] of [
  ['sample-processed', true],
  ['sample-raw', false],
]) {
  makeMp4(join(OUT, `${base}.mp4`), withTitle)
  makeWebm(join(OUT, `${base}.webm`), withTitle)
}

/* ---------- 图文示例图 ---------- */

const PICS = [
  { file: 'sample-01.jpg', top: '#1D4ED8', bottom: '#0F172A', text: '站桩五分钟', sub: '示例图文 1' },
  { file: 'sample-02.jpg', top: '#0F766E', bottom: '#0F172A', text: '专注力训练', sub: '示例图文 2' },
  { file: 'sample-03.jpg', top: '#B45309', bottom: '#0F172A', text: '少儿武术课', sub: '示例图文 3' },
]

for (const p of PICS) {
  // 用 ffmpeg 生成纯色渐变图，避免依赖 Pillow
  const tmp = join(OUT, p.file.replace(/\.jpg$/, '.png'))
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `gradients=s=900x1200:c0=${p.top.slice(1)}:c1=${p.bottom.slice(1)}:x0=0:y0=0:x1=900:y1=1200`,
      '-vf', `drawtext=fontfile='${FONT}':text='${p.text}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=fontfile='${FONT}':text='${p.sub}':fontcolor=0xCBD5E1:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+60`,
      '-frames:v', '1', tmp,
    ],
    { stdio: 'inherit' },
  )
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-q:v', '3', join(OUT, p.file)], {
    stdio: 'inherit',
  })
  rmSync(tmp, { force: true })
}

console.log(`[demo-media] 示例媒体已生成：${OUT}`)
