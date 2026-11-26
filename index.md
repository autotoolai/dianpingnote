---
layout: page
pageClass: zp-home
sidebar: false
title: 每天的点评笔记，让电脑按时替你发
description: 点评笔记助手是给门店运营用的 Windows 软件：把同行主页设成每天自动采集，自动改写成你能发的样子，再定时分发到大众点评经营宝下的多个蓝 V。笔记和素材都存在你自己的电脑上。
---

<HomeHero />

<div class="zp-answer">
  <p class="zp-answer__label">一句话答案</p>
  <p class="zp-answer__text">点评笔记助手是一款 Windows 桌面软件：从小红书、抖音、快手、B站采集笔记，本机改写文案、把标题叠到视频顶部或遮盖图文水印，再按每日定时发布到大众点评经营宝下的多个蓝 V。笔记、素材和发布状态全部保存在本机。</p>
</div>

<section class="zp-section">
  <h2 class="zp-display">你只需要定三件事</h2>
  <p class="zp-section__lead">
    采谁的主页、每天几点发、发给哪几个号。剩下的下载、改写、排队、上传，电脑按顺序跑完。
  </p>
  <WorkflowStrip
    :steps="[
      {
        title: '每天自动找素材',
        desc: '设一次，之后每天自己更新',
        items: [
          '把你认可的几个同行主页加进来',
          '每天到点自动扫一遍新内容',
          '看到好的一篇，也可以直接粘链接补进来',
          '只留视频或只留图文，按你的偏好'
        ]
      },
      {
        title: '自动改成你的表达',
        desc: '标题、正文、标签一次生成',
        items: [
          '文案重写，不再是照抄同行',
          '视频标题直接叠在画面顶部',
          '图文底部的图标按设置遮住',
          '哪条不满意，随时自己改'
        ]
      },
      {
        title: '到点发给你的号',
        desc: '后台跑，不占你的时间',
        items: [
          '在经营宝下几个蓝 V 之间自动分配',
          '按你定的时刻发，不用守着电脑',
          '发完结果可以推到你自己的群里',
          '哪条卡住了、为什么，一眼看到'
        ]
      }
    ]"
  />
</section>

<section class="zp-section">
  <h2 class="zp-display">它替你解决了什么</h2>
  <p class="zp-section__lead">做门店内容的精力，大多花在重复劳动上，而不是想选题上。</p>
  <FeatureCards
    lead-first
    :items="[
      {
        title: '不用再天天翻同行主页',
        desc: '把主页交给它，每天自动扫一遍。视频和图文一起下，存进你电脑里的素材池。看到好内容不用再手动存链接。',
        icon: 'crawl',
        link: '/collect',
        linkText: '看采集怎么用'
      },
      {
        title: '文案不用一条条重写',
        desc: '自动生成标题、正文和标签，视频标题直接叠进画面顶部。不满意的地方随时改，改完再发。',
        icon: 'erchuang',
        link: '/erchuang',
        linkText: '看改写怎么用'
      },
      {
        title: '几个号不用轮流守着',
        desc: '到点自动分给你名下的蓝 V，一条笔记只发一个号。后台跑，不弹浏览器，发完把结果推到你自己的飞书群。',
        icon: 'publish',
        link: '/publish',
        linkText: '看定时怎么设'
      },
      {
        title: '素材和账号都在你自己电脑上',
        desc: '笔记、原片、发布记录都存在本机，不上传、也不托管给第三方。你换电脑、迁员工，数据跟着走。',
        icon: 'local',
        link: '/guides/data-and-privacy',
        linkText: '看数据怎么存'
      },
      {
        title: '卡住了会自己接上',
        desc: '发布中途失败会自动换号补发，同一条不会重复发出去。每条笔记卡在哪一步、什么原因，都写得很清楚。',
        icon: 'schedule',
        link: '/guides/status-glossary',
        linkText: '看状态说明'
      },
      {
        title: '按发出去的条数付费',
        desc: '只采不发的不扣条数，发布失败也不扣。1 条 1 元起，发得多有更便宜的档。',
        icon: 'tag',
        link: '/pricing',
        linkText: '看价格'
      }
    ]"
  />
</section>

<section class="zp-section">
  <h2 class="zp-display">手工做，和交给它</h2>
  <p class="zp-section__lead">差别不在「能不能发出一条」，而在每天能不能稳定发出、发完知不知道结果。</p>
  <CompareTable
    :rows="[
      { aspect: '找素材', manual: '挨个平台刷主页，手动存链接', ours: '加一次主页，之后每天自动更新' },
      { aspect: '下载原片', manual: '点开、等待、再点下载', ours: '自动补全信息并下好视频和图文' },
      { aspect: '改文案', manual: '每条都从头重写标题和正文', ours: '自动生成，改一处即可，不满意再手改' },
      { aspect: '标题进画面', manual: '另开剪辑软件逐条叠字', ours: '设置一次，之后自动叠在顶部' },
      { aspect: '图文水印', manual: '裁图或找工具一点点遮', ours: '按设置自动遮住底部图标' },
      { aspect: '多账号发布', manual: '逐个登录、粘贴、发布', ours: '自动在几个蓝 V 之间分配' },
      { aspect: '发布时间', manual: '守着电脑等时间', ours: '到点自动跑，电脑开着就行' },
      { aspect: '发完确认', manual: '挨个后台翻记录', ours: '进度一页看全，失败可一键重来' },
      { aspect: '素材存放', manual: '散在每个人的电脑里', ours: '统一在素材池，状态一目了然' }
    ]"
  />
</section>

<section class="zp-section">
  <h2 class="zp-display">几个数字</h2>
  <StatRow
    :items="[
      { value: '¥1', label: '每条发出去的基线价，发得多更便宜' },
      { value: '7 天', label: '首次打开自动试用，含 10 条额度' },
      { value: '不用显卡', label: '写文案用官方能力，装好就能用' },
      { value: '在你电脑', label: '笔记、素材和发布记录的存放位置' }
    ]"
  />
</section>

<section class="zp-section">
  <h2 class="zp-display">它适合谁</h2>
  <p class="zp-section__lead">
    如果下面几条里有两条以上是你现在的处境，那大概率能用得上。
  </p>
  <div class="zp-split">
    <div>
      <ul class="zp-list zp-list--check">
        <li>要同时管好几个门店蓝 V，运营、店长或代运营团队</li>
        <li>手上有一批看好的同行内容，想持续改成自己的说法</li>
        <li>已经在用软件手动发，但发到一半就乱了：不知道哪条发了、哪条卡住</li>
        <li>每周都在重复做找素材、改文案、换号发布这几件事</li>
        <li>不愿意把门店素材和账号交给第三方托管</li>
      </ul>
    </div>
    <div>
      <ul class="zp-list">
        <li>只发一条、一个月发不到十条的，个人随手发更省事</li>
        <li>想找的是「一键群发」的工具 —— 这套流程需要先花半小时配置一次</li>
        <li>需要团队多人协作审批的，目前是单机单人使用</li>
      </ul>
      <p class="zp-hint">
        不确定是否合适，可以先说说你的做法和卡点，我们会直接告诉你能不能帮上忙。
      </p>
    </div>
  </div>
  <p style="margin-top: 1.6rem">
    <a class="zp-btn zp-btn--ghost" href="/screenshots">看看真实界面</a>
    &nbsp;
    <a class="zp-btn zp-btn--demo" href="/demo/" target="_blank" rel="noopener">在线体验</a>
    &nbsp;
    <a class="zp-btn zp-btn--ghost" href="/faq">看看常见问题</a>
    &nbsp;
    <a class="zp-btn zp-btn--ghost" href="/knowledge/">翻翻点评知识库</a>
  </p>
</section>

<CtaBand
  title="先免费跑一条看看"
  desc="新用户首次打开软件自动获得 7 天试用和 10 条额度，先把一条笔记完整发出去，再决定要不要继续。"
/>

<ContactWechat
  title="联系我们"
  desc="扫码加微信，把你的蓝 V 数量和每月大概的发布条数说一声，我们给你对应的套餐。"
/>
