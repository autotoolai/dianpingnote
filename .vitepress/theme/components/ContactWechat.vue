<script setup lang="ts">
/**
 * 联系我们 —— 全站统一的微信联系入口，只保留微信一条通道。
 *
 * 设计取向：不用弹窗、不用悬浮气泡（会挡住演示站和文档正文），
 * 而是把二维码做成一个独立的版块，卡片式落在页面里，用户主动扫。
 * 卡片底色是纸白而非纯白，方便在暖米色背景上分出层次；
 * 二维码本体保持黑白纯净，边框留足静默区，手机才扫得出来。
 *
 * 图片走 imgUrl()：配了 themeConfig.imgCdn 就从 CDN 取，否则用站内 public/images。
 */
import { useData } from 'vitepress'
import { computed } from 'vue'
import { imgUrl } from '../utils/img'

const props = withDefaults(
  defineProps<{
    /** 二维码在 images 下的路径（相对 public/images）；留空则读 themeConfig.wechatQr */
    qr?: string
    /** 备注文案，说明加好友后会发生什么 */
    note?: string
    /** 微信号；留空则读 themeConfig.wechatId */
    wechatId?: string
    /** 区块标题 */
    title?: string
    /** 标题下的一句话 */
    desc?: string
    /** 是否使用紧凑排版（用于页脚附近的窄栏） */
    compact?: boolean
  }>(),
  {
    qr: '',
    note: '加好友时请备注「点评」，我们会先回你试用和激活方式。',
    wechatId: '',
    title: '联系我们',
    desc: '扫码加微信，把你的蓝 V 数量和每月大概的发布条数说一声，我们给你对应的套餐。',
    compact: false,
  },
)

const { theme } = useData()
const cdn = computed(() => String((theme.value as any).imgCdn || ''))
const qrUrl = computed(() => imgUrl(props.qr || String((theme.value as any).wechatQr || 'wechat-qr-code.png'), cdn.value))
const wechatId = computed(() => props.wechatId || String((theme.value as any).wechatId || ''))
</script>

<template>
  <section :class="['zp-contact', { 'zp-contact--compact': props.compact }]">
    <div class="zp-contact__text">
      <h2 class="zp-display">{{ props.title }}</h2>
      <p class="zp-contact__desc">{{ props.desc }}</p>
      <p v-if="wechatId" class="zp-contact__id">
        微信号：<b>{{ wechatId }}</b>
        <span class="zp-contact__hint">加不上就直接搜这个号</span>
      </p>
      <ul class="zp-contact__list">
        <li>问价格、问套餐、问能不能做你的场景</li>
        <li>试用期内想先聊聊效果</li>
        <li>安装、激活、换机这些具体问题</li>
      </ul>
      <p class="zp-hint">{{ props.note }}</p>
    </div>
    <figure class="zp-contact__qr">
      <img :src="qrUrl" alt="客服微信二维码，用微信扫一扫即可添加" width="200" height="200" loading="lazy" />
      <figcaption>微信扫一扫</figcaption>
    </figure>
  </section>
</template>

<style scoped>
.zp-contact {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2.4rem;
  align-items: center;
  margin: 2.6rem 0 1.5rem;
  padding: 2rem 2.2rem;
  border: 1px solid var(--dpn-line);
  border-radius: 18px;
  background: var(--dpn-paper-2);
}

.zp-contact__desc {
  margin: 0.7rem 0 0;
  max-width: 32rem;
  line-height: 1.85;
  color: var(--dpn-muted);
}

.zp-contact__id {
  margin: 0.9rem 0 0;
  font-size: 0.95rem;
  color: var(--dpn-ink-soft);
}

.zp-contact__id b {
  font-family: var(--dpn-mono);
  font-weight: 700;
  color: var(--dpn-accent-deep);
}

.dark .zp-contact__id b {
  color: var(--dpn-accent-ink);
}

.zp-contact__hint {
  margin-left: 0.5rem;
  font-size: 0.83rem;
  color: var(--dpn-muted);
}

.zp-contact__list {
  margin: 1rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.9rem;
  line-height: 1.9;
  color: var(--dpn-muted);
}

.zp-contact__list li::marker {
  color: var(--dpn-accent);
}

.zp-contact__qr {
  margin: 0;
  text-align: center;
}

.zp-contact__qr img {
  width: 200px;
  height: 200px;
  display: block;
  padding: 10px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--dpn-line);
}

.zp-contact__qr figcaption {
  margin-top: 0.6rem;
  font-size: 0.84rem;
  color: var(--dpn-muted);
}

/* 紧凑版：二维码缩小，文案收紧 */
.zp-contact--compact {
  gap: 1.6rem;
  padding: 1.4rem 1.6rem;
}

.zp-contact--compact .zp-contact__qr img {
  width: 150px;
  height: 150px;
}

.zp-contact--compact .zp-contact__list {
  display: none;
}

@media (max-width: 720px) {
  .zp-contact {
    grid-template-columns: 1fr;
    gap: 1.6rem;
    padding: 1.6rem 1.3rem;
  }

  .zp-contact__qr {
    order: -1;
  }
}
</style>
