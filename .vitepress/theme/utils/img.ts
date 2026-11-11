/**
 * 图片 URL：站点在 public/images 下；若配了图床（themeConfig.imgCdn），改走 CDN。
 * 例：imgUrl('screenshots/01-dashboard.webp', cdn)
 *   → 无 cdn： /images/screenshots/01-dashboard.webp
 *   → 有 cdn： https://img.aiautotools.com/site/images/screenshots/01-dashboard.webp
 */
export function imgUrl(path: string, cdn = ''): string {
  const clean = path.replace(/^\//, '')
  const base = (cdn || '').replace(/\/$/, '')
  if (base) return `${base}/site/images/${clean}`
  return `/images/${clean}`
}