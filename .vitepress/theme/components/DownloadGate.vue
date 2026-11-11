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
  <div v-else class="tip custom-block">
    <p class="custom-block-title">下载地址</p>
    <p>
      安装包暂未公开下载。新用户可先通过
      <a href="/get-started#contact">联系销售</a> 开通，试用期内会提供安装包；公开下载链接公布后，这里会变成按钮。
    </p>
  </div>
</template>