<script setup lang="ts">
const props = defineProps<{
  items: { value: string; label: string }[]
}>()
</script>

<template>
  <div class="zp-stats">
    <div v-for="s in props.items" :key="s.label">
      <b>{{ s.value }}</b>
      <span>{{ s.label }}</span>
    </div>
  </div>
</template>