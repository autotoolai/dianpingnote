/**
 * 演示站入口。
 *
 * 必须在产品 app.js 之前加载：app.js 一上来就会发 /api/health 等请求，
 * 拦截器要先把 fetch 换掉，否则首批请求会打到真实后端。
 */

import { installDemo, patchHelpPage } from './api.js'

installDemo()

/* 帮助页在演示里改用本地说明 */
document.addEventListener('DOMContentLoaded', () => {
  patchHelpPage()
})

/* 演示横幅的「回到官网」链接在 /demo/ 下要指回官网根路径 */
document.addEventListener('DOMContentLoaded', () => {
  const link = document.querySelector('.demo-banner-link')
  if (link) link.setAttribute('href', '/')
})

console.info(
  '%c点评笔记助手 · 界面演示',
  'color:#1D4ED8;font-weight:bold',
  '当前所有数据均为示例内容，不会真的采集、生成或发布。',
)
