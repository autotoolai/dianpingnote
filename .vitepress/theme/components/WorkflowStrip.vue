<script setup lang="ts">
const props = defineProps<{
  steps: { title: string; desc?: string; items: string[] }[]
}>()
</script>

<template>
  <div class="zp-workflow">
    <div v-for="(s, i) in props.steps" :key="s.title" class="zp-workflow__step">
      <span class="zp-num">{{ String(i + 1).padStart(2, '0') }}</span>
      <h3>{{ s.title }}</h3>
      <p v-if="s.desc">{{ s.desc }}</p>
      <ul>
        <li v-for="t in s.items" :key="t">{{ t }}</li>
      </ul>
    </div>
  </div>
</template>
