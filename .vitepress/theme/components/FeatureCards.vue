<script setup lang="ts">
const props = defineProps<{
  items: { title: string; desc: string; icon?: string; link?: string; linkText?: string }[]
  /** 第一张卡放大成视觉锚点，其余为常规格 */
  leadFirst?: boolean
}>()

/** 内联描边图标，避免额外图片请求；未命中时用默认圆点 */
const PATHS: Record<string, string> = {
  crawl: 'M12 3v10m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  erchuang: 'M4 20h16M6 16l8-8 3 3-8 8H6zM14 6l1.5-1.5a2.1 2.1 0 0 1 3 3L17 9',
  publish: 'M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3z',
  local: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  schedule: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0',
  tag: 'M3 11V4a1 1 0 0 1 1-1h7l10 10-8 8L3 11zm4-4h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9 2 2 4-4',
}

const path = (name?: string) => PATHS[name || 'tag'] || PATHS.tag
</script>

<template>
  <div class="zp-cards">
    <article
      v-for="(item, i) in props.items"
      :key="item.title"
      :class="['zp-card', { 'zp-card--lead': props.leadFirst && i === 0 }]"
    >
      <span class="zp-card__index" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
      <svg class="zp-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path :d="path(item.icon)" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <h3>{{ item.title }}</h3>
      <p>{{ item.desc }}</p>
      <a v-if="item.link" class="zp-card__link" :href="item.link">{{ item.linkText || '了解更多' }} →</a>
    </article>
  </div>
</template>
