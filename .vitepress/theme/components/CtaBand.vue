<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    desc?: string
  }>(),
  {
    title: '开通后，从第一条开始',
    desc: '新用户首次打开软件自动获得 7 天试用与 10 条额度。正式使用通过「联系销售」获取激活码，按你选定的套餐发放。',
  },
)

const { theme } = useData()
const label = computed(() => (theme.value as any).contactLabel || '联系销售开通')
const href = computed(() => String((theme.value as any).contactHref || '').trim())
const hasContact = computed(() => href.value.length > 0)
</script>

<template>
  <aside id="contact" class="zp-band">
    <h2>{{ props.title }}</h2>
    <p>{{ props.desc }}</p>
    <a v-if="hasContact" class="zp-btn zp-btn--primary" :href="href" rel="noopener">{{ label }}</a>
    <span v-else class="zp-btn zp-btn--primary zp-btn--disabled">{{ label }}（即将开放）</span>
  </aside>
</template>