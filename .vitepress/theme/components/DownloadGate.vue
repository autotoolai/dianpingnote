<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

const { theme } = useData()
const url = computed(() => String((theme.value as any).downloadUrl || '').trim())
const hasDownload = computed(() => url.value.length > 0)
</script>

<template>
  <p v-if="hasDownload" class="zp-cta-row">
    <a class="zp-btn zp-btn--primary" :href="url" rel="noopener">下载 Windows 安装包</a>
    <span class="zp-hint">约 820 MB，内置 Chrome，无需另装浏览器。</span>
  </p>
  <div v-else class="zp-cta-row zp-cta-row--stack">
    <p class="zp-hint">
      安装包未公开直链下载。加微信后我们把安装包发给你，
      装好首次打开自动获得 <strong>7 天试用 + 10 条发布额度</strong>。
    </p>
    <p class="zp-cta-row">
      <a class="zp-btn zp-btn--primary" href="/contact">微信获取安装包</a>
      <a class="zp-btn zp-btn--ghost" href="/demo/" target="_blank" rel="noopener">先看在线演示</a>
    </p>
  </div>
</template>