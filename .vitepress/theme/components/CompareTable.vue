<script setup lang="ts">
const props = defineProps<{
  caption?: string
  rows: { aspect: string; manual: string; ours: string }[]
}>()
</script>

<template>
  <div class="zp-compare-wrap">
    <table class="zp-compare">
      <thead>
        <tr>
          <th>环节</th>
          <th>纯手工</th>
          <th>点评笔记助手</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in props.rows" :key="r.aspect">
          <td>{{ r.aspect }}</td>
          <td class="is-manual">{{ r.manual }}</td>
          <td class="is-ours">{{ r.ours }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="props.caption" class="zp-compare-caption">{{ props.caption }}</p>
  </div>
</template>

<style scoped>
.zp-compare-wrap {
  margin: 1.2rem 0;
}

.zp-compare-caption {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--dpn-muted);
}
</style>