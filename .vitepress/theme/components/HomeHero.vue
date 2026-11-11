<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import DeviceFrame from './DeviceFrame.vue'

const { theme } = useData()
const label = computed(() => (theme.value as any).contactLabel || '联系销售开通')
const href = computed(() => String((theme.value as any).contactHref || '').trim())
const hasContact = computed(() => href.value.length > 0)
</script>

<template>
  <section class="zp-hero">
    <div class="zp-hero__bg" aria-hidden="true" />
    <div class="zp-hero__grid">
      <div>
        <p class="zp-eyebrow"><span class="zp-dot" aria-hidden="true" />给门店运营用的 Windows 软件</p>
        <h1 class="zp-display">每天的点评笔记<br /><span class="zp-underline">让电脑按时替你发</span></h1>
        <p class="zp-tagline">找素材 · 改文案 · 多账号分发，一次设定</p>
        <p class="zp-lead">
          把同行主页设成每天自动采一遍，新素材自动改写成你能发的样子，
          再到点分给你名下的几个蓝 V。<strong>笔记和素材都存在你自己的电脑里</strong>，不用交给别人托管。
        </p>
        <div class="zp-cta-row">
          <a class="zp-btn zp-btn--primary" :href="hasContact ? href : '/get-started'">先试 7 天</a>
          <a class="zp-btn zp-btn--ghost" href="/screenshots">看看真实界面</a>
          <a class="zp-link" href="/pricing">1 条 1 元起，按发出去的条数算 →</a>
        </div>
        <p class="zp-hint">首次打开自动获得 7 天试用和 10 条额度，不需要显卡，也不用先买。</p>
      </div>
      <div class="zp-hero__shot">
        <DeviceFrame
          src="screenshots/01-dashboard.webp"
          alt="点评笔记助手总览页：今天采集、改写和发布的进度一览"
          title="今天发了几条，一眼看清"
          badge="在你电脑上跑"
        />
        <div class="zp-hero-note">
          <i aria-hidden="true">1</i>
          <span>
            <b>一条笔记只发一个号</b>
            发之前先定下发给谁，中途失败会自动换号补发，不会几个号发同一条。
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.zp-hero-note {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  margin-top: 1.1rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--dpn-paper-2);
  border: 1px solid var(--dpn-line-soft);
  font-size: 0.88rem;
  line-height: 1.7;
  color: var(--dpn-muted);
}

.zp-hero-note i {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: var(--dpn-accent);
  color: #fff;
  font-size: 0.78rem;
  font-style: normal;
  font-weight: 700;
}

.zp-hero-note b {
  display: block;
  color: var(--dpn-ink);
  font-weight: 700;
}
</style>
