<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { imgUrl } from '../utils/img'

const props = defineProps<{
  src: string
  alt?: string
  caption?: string
  title?: string
  badge?: string
}>()

const { theme } = useData()
const cdn = computed(() => String((theme.value as any).imgCdn || ''))
const url = computed(() => imgUrl(props.src, cdn.value))
</script>

<template>
  <figure class="zp-window-wrap">
    <div class="zp-window">
      <div class="zp-window__bar">
        <span class="zp-window__dots" aria-hidden="true"><i /><i /><i /></span>
        <span class="zp-window__title">{{ title || '点评笔记助手' }}</span>
        <span v-if="badge" class="zp-window__badge">{{ badge }}</span>
      </div>
      <img :src="url" :alt="alt || ''" loading="lazy" decoding="async" />
    </div>
    <figcaption v-if="caption" class="zp-figure-caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.zp-window-wrap {
  margin: 0;
}

.zp-figure-caption {
  margin-top: 0.55rem;
  font-size: 0.85rem;
  color: var(--dpn-muted);
  text-align: center;
}
</style>