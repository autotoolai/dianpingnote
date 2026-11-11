<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { imgUrl } from '../utils/img'

const props = defineProps<{
  src: string
  alt?: string
  caption?: string
  priority?: boolean
}>()

const { theme } = useData()
const cdn = computed(() => String((theme.value as any).imgCdn || ''))
const url = computed(() => imgUrl(props.src, cdn.value))
</script>

<template>
  <figure class="zp-figure">
    <img :src="url" :alt="alt || ''" :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : undefined" decoding="async" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>