/**
 * 演示站的数据服务层。
 *
 * 拦截 window.fetch，把 /api/* 请求路由到本地示例数据。
 * 产品前端代码一行不改，演示站跑的就是真实界面。
 */

import {
  DEMO_NOTES,
  DEMO_TARGETS,
  DEMO_BLUE_V,
  DEMO_CRAWL_ACCOUNTS,
  DEMO_MERCHANT_TREE,
  DEMO_TASKS,
  DEMO_PUBLISH_RUNS,
  DEMO_CRAWL_RUNS,
  DEMO_ERCHUANG_QUEUE,
  DEMO_LOGIN_STATUS,
} from './fixtures.js'

/* ------------------------------------------------------------------ */
/* 可变的演示状态：点击「发布」「采集」后界面要有反馈                    */
/* ------------------------------------------------------------------ */

const state = {
  notes: DEMO_NOTES.map((n) => ({ ...n })),
  targets: DEMO_TARGETS.map((t) => ({ ...t })),
  tasks: DEMO_TASKS.map((t) => ({ ...t })),
  accounts: [...DEMO_BLUE_V, ...DEMO_CRAWL_ACCOUNTS].map((a) => ({ ...a })),
  publishRuns: DEMO_PUBLISH_RUNS.map((r) => ({ ...r })),
  crawlRuns: DEMO_CRAWL_RUNS.map((r) => ({ ...r })),
  queue: DEMO_ERCHUANG_QUEUE.map((q) => ({ ...q })),
  erchuangSettings: null,
  notesSettings: null,
  publishWebhook: '',
  accountSchedule: { exists: false, schedule_value: '06:00', enabled: false, next_run: '已关闭' },
  crawlSchedule: {
    id: 2,
    name: '每日采集',
    task_type: 'crawl',
    schedule_type: 'daily',
    schedule_value: '08:00',
    enabled: 1,
    next_run_at: null,
    exists: true,
    browser_note: '采集为 API 拉取，不使用浏览器',
    next_run: '明天 08:00',
    total_profiles: DEMO_TARGETS.length,
  },
  publishRunning: false,
  crawlRunning: false,
  publishBatch: '',
  publishPhase: '',
  publishTotal: 0,
  publishDone: 0,
  scanRunning: false,
  validateRunning: false,
  batchReprocess: null,
  startedAt: Date.now(),
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function text(body, status = 200, type = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { 'Content-Type': type } })
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v))
}

/** 演示数据里所有日期都用同一天，方便页面上的「今天」类文案自洽 */
function today() {
  return state.startedAt
}

/* ------------------------------------------------------------------ */
/* 笔记                                                                */
/* ------------------------------------------------------------------ */

function noteById(id) {
  return state.notes.find((n) => n.id === id) || null
}

function listNotes(qs) {
  const page = Math.max(1, parseInt(qs.get('page') || '1', 10) || 1)
  const pageSize = Math.max(1, parseInt(qs.get('page_size') || '10', 10) || 10)
  const sort = qs.get('sort') || 'updated_at'
  const order = (qs.get('order') || 'desc').toLowerCase() === 'asc' ? 1 : -1

  let rows = state.notes.slice()

  const eq = (key, val) => {
    if (!val) return
    if (key === 'platform_id') {
      rows = rows.filter((n) => (n.platforms || []).some((p) => p.platform_id === val))
      return
    }
    if (key === 'platform_status') {
      rows = rows.filter((n) => (n.platforms || []).some((p) => p.platform_id === qs.get('platform_id') && p.status === val))
      return
    }
    rows = rows.filter((n) => String(n[key] ?? '') === val)
  }
  eq('pipeline_status', qs.get('pipeline_status'))
  eq('media_status', qs.get('media_status'))
  eq('erchuang_status', qs.get('erchuang_status'))
  eq('source_platform', qs.get('source_platform'))
  eq('note_type', qs.get('note_type'))
  eq('assigned_account_id', qs.get('assigned_account_id'))
  eq('publish_status', qs.get('publish_status'))

  const needs = qs.get('needs_reprocess')
  if (needs) rows = rows.filter((n) => String(!!n.needs_reprocess) === needs)

  const q = (qs.get('q') || '').trim()
  if (q) {
    const lower = q.toLowerCase()
    rows = rows.filter((n) =>
      [n.publish_title, n.source_title, n.creator_username, n.video_id]
        .some((v) => String(v || '').toLowerCase().includes(lower)),
    )
  }

  const actionable = qs.get('actionable') === 'true'
  if (actionable) {
    rows = rows.filter((n) => n.needs_reprocess || n.media_status === 'failed' || n.erchuang_status === 'failed')
  }

  rows.sort((a, b) => {
    const av = String(a[sort] || '')
    const bv = String(b[sort] || '')
    if (av === bv) return 0
    return av > bv ? order : -order
  })

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  return {
    items: rows.slice(start, start + pageSize).map(clone),
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    limit: pageSize,
    offset: start,
  }
}

function notesStats() {
  const by = (key) => {
    const out = {}
    state.notes.forEach((n) => {
      const v = String(n[key] || 'unknown')
      out[v] = (out[v] || 0) + 1
    })
    return out
  }
  const ready = state.notes.filter((n) => n.pipeline_status === 'ready' && n.media_status === 'ready').length
  const published = state.notes.filter((n) => n.publish_status === 'published').length
  const actionable = state.notes.filter(
    (n) => n.needs_reprocess || n.media_status === 'failed' || n.erchuang_status === 'failed',
  ).length
  return {
    by_pipeline: by('pipeline_status'),
    by_media: by('media_status'),
    by_erchuang: by('erchuang_status'),
    by_publish: by('publish_status'),
    total: state.notes.length,
    needs_reprocess: state.notes.filter((n) => n.needs_reprocess).length,
    download_health: {
      ready: state.notes.filter((n) => n.media_status === 'ready').length,
      downloading: 0,
      failed: state.notes.filter((n) => n.media_status === 'failed').length,
      unavailable: 0,
      missing_media: state.notes.filter((n) => !n.has_raw_video && n.media_status !== 'ready').length,
      queue_pending: 0,
      erchuang_pending: 0,
      missing_media_pending: false,
    },
    enrich_health: {
      pending: 0,
      running: 0,
      ready: state.notes.filter((n) => n.media_status === 'ready').length,
      failed: state.notes.filter((n) => n.erchuang_status === 'failed').length,
      via_cookie: state.notes.length,
      queue_pending: 0,
      queue_failed: 0,
    },
    reprocess: {
      actionable,
      already_queued: state.queue.filter((q) => q.status === 'running' || q.status === 'pending').length,
      by_reason: {
        download_failed: state.notes.filter((n) => n.media_status === 'failed').length,
        missing_media: 0,
        erchuang_failed: state.notes.filter((n) => n.erchuang_status === 'failed').length,
        title_unrecognized: 0,
        erchuang_stalled: 0,
        burn_failed: 0,
        burn_escalate_download: 0,
        bad_media_redownload: 0,
        needs_reprocess: 0,
        burn_failed_ready: 0,
      },
      excluded: { unavailable: 0, deleted_needs_reprocess: 0 },
      pause_auto: false,
    },
    detail: {},
  }
}

/* ------------------------------------------------------------------ */
/* 汇总 / 概览                                                          */
/* ------------------------------------------------------------------ */

function dashboardSummary() {
  const published = state.publishRuns.filter((r) => r.status === 'success').length
  const failed = state.publishRuns.filter((r) => r.status === 'failed').length
  const skipped = state.publishRuns.filter((r) => r.status === 'skipped').length
  const pending = state.notes.filter((n) => n.publish_status === 'pending').length

  return {
    today_date: '2026-10-25',
    today_date_label: '2026年10月25日 周日',
    today_publish: {
      date: '2026-10-25',
      date_label: '2026年10月25日 周日',
      success: published,
      failed,
      pending: 0,
      accounts: DEMO_BLUE_V.length,
      total: published + failed,
      attempts: published + failed,
      execution_count: 2,
      executions: [
        {
          kind: 'schedule',
          trigger: 'schedule',
          label: '每日发布',
          time: '2026-10-25 12:00',
          account_count: DEMO_BLUE_V.length,
          success_count: published,
          failed_count: failed,
          skipped_count: skipped,
          account_success_count: published,
          account_failed_count: failed,
          all_success: failed === 0,
        },
      ],
      manual_success: 0,
      schedule_success: published,
      standalone_success: 0,
    },
    today_crawl: { inserted: 5, duplicated: 7, failed: 0, runs: 1 },
    last_crawl: {
      time: '2026-10-25T08:00:26',
      inserted: 5,
      duplicated: 7,
      failed: 0,
      status: 'success',
      trigger: 'schedule',
    },
    notes_backlog: {
      platforms: [
        {
          platform_id: 'dianping',
          platform_label: '大众点评',
          count: pending,
          capped: false,
          latest_title: '北京宝妈看过来！娃练太极后的变化真的惊喜',
          latest_time: '2026-10-22T16:44:10',
          oldest_time: '2026-10-16 09:12:03',
          oldest_wait_days: 9,
          error: '',
          loading: false,
        },
      ],
      error: '',
      loading: false,
      loaded_at: '2026-10-25T08:05:00',
      source: 'local_notes',
    },
    lark_backlog: {
      platforms: [
        {
          platform_id: 'dianping',
          platform_label: '大众点评',
          count: pending,
          capped: false,
          latest_title: '北京宝妈看过来！娃练太极后的变化真的惊喜',
          latest_time: '2026-10-22T16:44:10',
          oldest_time: '2026-10-16 09:12:03',
          oldest_wait_days: 9,
          error: '',
          loading: false,
        },
      ],
      error: '',
      loading: false,
      loaded_at: '2026-10-25T08:05:00',
      source: 'local_notes',
    },
    upcoming_schedules: [
      { id: 2, category: 'crawl', label: '每日采集', detail: `${DEMO_TARGETS.length} 个主页`, schedule_value: '08:00', next_run: '明天 08:00', route: '#/crawl' },
      { id: 3, category: 'publish', label: '每日发布', detail: 'dianping', schedule_value: '12:00', next_run: '2026-10-26 12:00', route: '#/publish' },
      { id: 4, category: 'publish', label: '每日发布（备用）', detail: 'dianping', schedule_value: '15:00', next_run: '2026-10-25 15:00', route: '#/publish' },
    ],
    attention_items: [
      {
        kind: 'cookie_invalid',
        time: '2026-10-25T08:05:00',
        title: '发布账号需登录 · 示例蓝V·少儿武术馆',
        subtitle: '蓝 V登录已失效，发布会中断',
        status: 'warn',
        ref: '1',
        route: '#/accounts',
        action_label: '去登录',
        account_id: 1,
        account_kind: 'blue_v',
      },
    ],
    publish_status: publishStatus(),
    crawl_status: crawlStatus(),
    cookie_health: {
      total: state.accounts.length,
      valid: state.accounts.filter((a) => a.cookie_valid).length,
      invalid: state.accounts.filter((a) => a.cookie_valid === false).length,
      unchecked: state.accounts.filter((a) => a.cookie_valid == null).length,
      publishable: DEMO_BLUE_V.length,
      publish: {
        total: DEMO_BLUE_V.length,
        valid: DEMO_BLUE_V.filter((a) => a.cookie_valid).length,
        invalid: DEMO_BLUE_V.filter((a) => a.cookie_valid === false).length,
        unchecked: 0,
      },
      crawl: {
        total: DEMO_CRAWL_ACCOUNTS.length,
        valid: DEMO_CRAWL_ACCOUNTS.filter((a) => a.cookie_valid).length,
        invalid: 0,
        unchecked: 0,
      },
      invalid_accounts: state.accounts
        .filter((a) => a.cookie_valid === false)
        .map((a) => ({
          id: a.id,
          userName: a.userName,
          platform: a.platform,
          platform_label: a.platform_label,
          account_kind: a.account_kind,
          cookie_checked_at: a.cookie_checked_at,
        })),
    },
    account_count: state.accounts.length,
    next_tasks: state.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      task_type: t.task_type,
      schedule_value: t.schedule_value,
      enabled: t.enabled,
    })),
    recent_events: [
      {
        type: 'publish',
        time: '2026-10-25T12:00:37',
        title: '每日发布',
        status: 'success',
        detail: '大众点评-示例蓝V·少儿武术馆',
        error: '',
        ref: '01MDEMO0001',
      },
      {
        type: 'publish',
        time: '2026-10-25T12:00:35',
        title: '每日发布',
        status: 'success',
        detail: '大众点评-示例蓝V·少儿太极馆',
        error: '',
        ref: '01MDEMO0002',
      },
      {
        type: 'crawl',
        time: '2026-10-25T08:00:26',
        title: '每日采集',
        status: 'success',
        detail: 5,
        error: '',
        ref: '3',
      },
      {
        type: 'publish',
        time: '2026-10-24T11:04:18',
        title: '每日发布',
        status: 'failed',
        detail: '大众点评-示例蓝V·少儿武术馆',
        error: '示例：发布时经营宝登录已失效，请重新扫码登录',
        ref: '01MDEMO0003',
      },
    ],
    activated: true,
  }
}

function notesBacklog() {
  const pending = state.notes.filter((n) => n.publish_status === 'pending')
  return {
    platforms: [
      {
        platform_id: 'dianping',
        platform_label: '大众点评',
        count: pending.length,
        capped: false,
        latest_title: pending.length ? pending[pending.length - 1].publish_title : '',
        latest_time: pending.length ? pending[pending.length - 1].created_at.replace(' ', 'T') : '',
        oldest_time: pending.length ? pending[0].created_at.replace(' ', 'T') : '',
        oldest_wait_days: pending.length ? 9 : null,
        error: '',
        loading: false,
      },
    ],
    pipeline: {
      ready: state.notes.filter((n) => n.pipeline_status === 'ready').length,
      downloading: 0,
      failed: state.notes.filter((n) => n.pipeline_status === 'failed').length,
      unavailable: 0,
      missing_media: 0,
      queue_pending: 0,
      erchuang_pending: state.notes.filter((n) => n.erchuang_status === 'running').length,
      missing_media_pending: false,
      enrich_pending: 0,
      enrich_running: 0,
      enrich_failed: state.notes.filter((n) => n.erchuang_status === 'failed').length,
    },
    error: '',
    loading: false,
    loaded_at: '2026-10-25T08:05:00',
    source: 'local_notes',
  }
}

/* ------------------------------------------------------------------ */
/* 状态机：发布 / 采集                                                  */
/* ------------------------------------------------------------------ */

function publishStatus() {
  return {
    running: state.publishRunning,
    batch_id: state.publishBatch,
    task_run_id: null,
    task_id: null,
    started_at: state.publishRunning ? '2026-10-25T12:00:00' : '',
    trigger: state.publishRunning ? 'publish-now' : '',
    total_jobs: state.publishTotal,
    completed_jobs: state.publishDone,
    job_index: state.publishDone,
    job_total: state.publishTotal,
    phase: state.publishRunning ? 'publish' : '',
    phase_label: state.publishRunning ? '发布中' : '',
    current_platform: state.publishRunning ? '大众点评' : '',
    current_account: state.publishRunning ? '示例蓝V·少儿武术馆' : '',
    current_title: state.publishRunning ? '北京少儿太极招生｜你猜视频里的小朋友练了多久？' : '',
    current: '',
    log_path: '',
    progress_text: state.publishRunning ? '发布中 · 1/2' : '',
    last_updated_at: state.publishRunning ? '2026-10-25T12:00:20' : '',
    stale_sec: 0,
    health: state.publishRunning ? 'running' : 'idle',
    health_label: state.publishRunning ? '发布中' : '',
    headless: true,
    browser_mode_label: '后台',
    worker_pid: null,
    timeline: [],
  }
}

function crawlStatus() {
  return {
    running: state.crawlRunning,
    run_id: 3,
    trigger: state.crawlRunning ? 'schedule' : '',
    crawl_type: state.crawlRunning ? 'profile_batch' : '',
    started_at: state.crawlRunning ? '2026-10-25T08:00:00' : '',
    video_total: 0,
    video_done: 0,
    profile_total: DEMO_TARGETS.length,
    profile_done: state.crawlRunning ? 1 : 0,
    phase: state.crawlRunning ? 'fetch' : '',
    phase_label: state.crawlRunning ? '拉取链接' : '',
    job_index: state.crawlRunning ? 1 : 0,
    job_total: DEMO_TARGETS.length,
    current: state.crawlRunning ? DEMO_TARGETS[0].profile_url : '',
    log_path: '',
    progress_text: '主页采集',
    last_updated_at: state.crawlRunning ? '2026-10-25T08:00:12' : '',
    stale_sec: 0,
    health: state.crawlRunning ? 'running' : 'idle',
    health_label: state.crawlRunning ? '采集中' : '',
    progress_ts: null,
    timeline: [],
  }
}

/* ------------------------------------------------------------------ */
/* 账号                                                                */
/* ------------------------------------------------------------------ */

function accountsHealth() {
  const out = {}
  state.accounts.forEach((a) => {
    const runs = state.publishRuns.filter((r) => r.account_name === a.userName)
    const ok = runs.filter((r) => r.status === 'success').length
    const fail = runs.filter((r) => r.status === 'failed').length
    out[String(a.id)] = {
      account_name: a.userName,
      platform_name: a.platform_label,
      success: ok,
      failed: fail,
      total: ok + fail,
      last_title: runs.length ? runs[0].note_title : '',
      last_success_at: ok ? '2026-10-25T12:00:52' : '',
      last_failure_at: fail ? '2026-10-24T11:04:18' : '',
      last_error: fail ? '示例：经营宝登录已失效' : '',
      last_error_type: fail ? '发布失败' : '',
      success_rate: ok + fail ? ok / (ok + fail) : null,
    }
  })
  return out
}

function merchantTree() {
  const tree = clone(DEMO_MERCHANT_TREE)
  tree.blue_vs = tree.sessions[0].blue_vs.map((bv) => {
    const live = state.accounts.find((a) => a.id === bv.id)
    return live ? { ...bv, ...live } : bv
  })
  tree.sessions[0].blue_vs = tree.blue_vs
  return tree
}

/* ------------------------------------------------------------------ */
/* 二创设置                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_ERCHUANG_SETTINGS = {
  copy_enabled: true,
  copy_prompt: '',
  copy_style: 'growth',
  copy_rewrite_level: 'close',
  copy_title_length: 'standard',
  copy_body_length: 'standard',
  copy_auto_polish: false,
  copy_preferred_tags: [],
  burn_title: true,
  burn_dialogue: false,
  image_mask_enabled: true,
  image_max_count: 9,
  image_mask_icon: '',
  reflect_translate: true,
  polish_zh: false,
  min_content_units: 6,
  silence_mean_db: -40.0,
  silence_max_db: -25.0,
  min_segment_duration_sec: 0.4,
  translate_non_zh: true,
  strict_dialogue: false,
  whisper_model: 'small',
  force_source_lang: '',
  force_asr: false,
  llm_max_inflight: 2,
  pause_auto: false,
  asr_quality_gate: true,
  asr_quality_min_score: 0.45,
  asr_llm_judge_borderline: true,
  erchuang_daily_enabled: false,
  erchuang_daily_time: '04:00',
  auto_enqueue_copy_after_download: true,
  layout: {
    title_margin_v_ratio: 0.1,
    dialogue_margin_v_ratio: 0.14,
    dialogue_max_lines: 2,
    dialogue_max_chars_per_line: 20,
    dialogue_min_display_sec: 0.8,
    side_margin_ratio: 0.06,
    smart_position_enabled: true,
    ocr_max_samples: 8,
    ocr_min_confidence: 0.45,
    ocr_min_hit_frames: 2,
    mask_blur_radius: 26,
    mask_opacity_percent: 72,
  },
  subtitle: {},
}

function erchuangSettings() {
  if (!state.erchuangSettings) state.erchuangSettings = clone(DEFAULT_ERCHUANG_SETTINGS)
  return state.erchuangSettings
}

function erchuangStats() {
  const s = erchuangSettings()
  return {
    erchuang_pending: state.notes.filter((n) => n.erchuang_status === 'pending').length,
    erchuang_done: state.notes.filter((n) => n.erchuang_status === 'ready').length,
    subtitling: 0,
    ready: state.notes.filter((n) => n.pipeline_status === 'ready').length,
    failed: state.notes.filter((n) => n.erchuang_status === 'failed').length,
    erchuang_manual: 0,
    platform_rejected: 0,
    copy_queue_active: state.queue.filter((q) => q.status === 'running' || q.status === 'pending').length,
    subtitle_queue_active: 0,
    needs_reprocess: state.notes.filter((n) => n.needs_reprocess).length,
    reprocess: notesStats().reprocess,
    settings: clone(s),
  }
}

/* ------------------------------------------------------------------ */
/* 路由表                                                              */
/* ------------------------------------------------------------------ */

const ROUTES = [
  /* ---------- 状态 / 授权 ---------- */
  ['GET', '/api/health', () => ({
    ok: true,
    service: 'dianping-notes',
    app_id: 'dianpingnotes',
    app_name: '点评笔记助手',
    ui_rev: '20260716-admin-static-split',
    capabilities: [
      'open-platform',
      'validate-cookie',
      'validate-cookies',
      'merchant-scan-login',
      'scan-login-reveal',
      'blue-v-status',
      'discover-blue-v',
      'notes-bundle-io',
    ],
    product_mode: false,
    dev_mode: true,
    activated: true,
    chrome: {
      installed: 'true',
      bundled: 'false',
      path: '（演示环境不检测本地浏览器）',
      is_edge: 'false',
      download_url_cn: 'https://www.google.cn/chrome/',
    },
    port: 39227,
    preferred_port: 39227,
  })],

  ['GET', '/api/license/status', () => ({
    activated: true,
    entitlement: 'dev',
    plan: null,
    expired: false,
    status_label: '演示模式',
    purchase_hint: '联系销售',
    product_mode: false,
    dev_mode: true,
    machine_code: 'DEMO-0000-0000-0000',
    remaining_sec: null,
    remaining_text: null,
    started_at: null,
    started_at_text: null,
    expires_at: null,
    expires_at_text: null,
    validity_days: null,
    activation_code: '',
    activation_code_masked: '',
    has_activation_code: false,
    offline_stale: false,
    offline_grace_sec: 0,
    last_checkin_at: null,
    checkin: null,
  })],

  /* ---------- 概览 ---------- */
  ['GET', '/api/dashboard/summary', () => dashboardSummary()],
  ['GET', '/api/dashboard/notes-backlog', () => notesBacklog()],

  /* ---------- 笔记 ---------- */
  ['GET', '/api/notes', (m, qs) => listNotes(qs)],
  ['GET', '/api/notes/stats/summary', () => {
    const s = notesStats()
    return {
      by_pipeline: s.by_pipeline,
      by_media: s.by_media,
      by_erchuang: s.by_erchuang,
      by_publish: s.by_publish,
      total: s.total,
      needs_reprocess: s.needs_reprocess,
      download_health: s.download_health,
      enrich_health: s.enrich_health,
      reprocess: s.reprocess,
    }
  }],
  ['GET', '/api/notes/stats', () => notesStats()],
  ['GET', '/api/notes/settings', () =>
    state.notesSettings || {
      download_max_attempts: 5,
      download_zombie_timeout_min: 30,
      auto_enrich_after_crawl: true,
      auto_download_after_crawl: true,
      download_catchup_offset_hours: 3,
      download_daily_enabled: false,
      download_daily_time: '03:00',
      erchuang_daily_enabled: false,
      erchuang_daily_time: '04:00',
      note_type_policy: 'video',
    }],
  ['GET', '/api/notes/batch-reprocess/progress', () => ({
    busy: false,
    status: 'done',
    total: 0,
    settled: 0,
    completed: 0,
    failed: 0,
    active: 0,
    percent: 100,
    current_label: '',
  })],

  /* ---------- 账号 ---------- */
  ['GET', '/api/accounts', () => clone(state.accounts)],
  ['GET', '/api/accounts/health', () => accountsHealth()],
  ['GET', '/api/accounts/merchant-tree', () => merchantTree()],
  ['GET', '/api/accounts/merchant-session', () => clone(DEMO_MERCHANT_TREE.sessions[0].session)],
  ['GET', '/api/accounts/schedule', () => clone(state.accountSchedule)],
  ['GET', '/api/accounts/scan-login/status', () => ({
    running: state.scanRunning,
    mode: '',
    platform: '',
    account_id: null,
    account_name: '',
    phase: '',
    message: '',
    qr_image: '',
    preview_image: '',
    error: '',
    result: null,
    needs_manual: false,
    browser_ready: false,
  })],
  ['GET', '/api/accounts/validate-cookies/status', () => ({
    running: state.validateRunning,
    started_at: state.validateRunning ? '2026-10-25T08:05:00' : '',
    finished_at: '',
    total: state.validateRunning ? state.accounts.length : 0,
    done: 0,
  })],
  ['GET', '/api/accounts/open-platform/status', () => ({
    running: false,
    account_id: null,
    account_name: '',
    platform: '',
    message: '',
    error: '',
    pid: null,
  })],

  /* ---------- 采集 ---------- */
  ['GET', '/api/crawl-targets', () => clone(state.targets)],
  ['GET', '/api/crawl/schedule', () => clone(state.crawlSchedule)],
  ['GET', '/api/crawl/status', () => crawlStatus()],
  ['GET', '/api/crawl/login-status', () => clone(DEMO_LOGIN_STATUS)],
  ['GET', '/api/crawl/download-stats', () => clone(notesStats().download_health)],
  ['GET', '/api/crawl/enrich-stats', () => clone(notesStats().enrich_health)],
  ['GET', '/api/crawl/runs', (m, qs) => {
    const page = Math.max(1, parseInt(qs.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, parseInt(qs.get('page_size') || '15', 10) || 15)
    let rows = state.crawlRuns.slice()
    const st = qs.get('status')
    if (st) rows = rows.filter((r) => r.status === st)
    const ct = qs.get('crawl_type')
    if (ct) rows = rows.filter((r) => (r.summary && r.summary.crawl_type === ct))
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map(clone),
      total: rows.length,
      page,
      page_size: pageSize,
    }
  }],
  ['GET', '/api/crawl/missing-media', () => ({ items: [] })],
  ['GET', '/api/crawl/download-failures', () => ({
    items: state.notes
      .filter((n) => n.media_status === 'failed')
      .map((n) => ({ note_id: n.id, title: n.publish_title, error: n.media_error, pipeline_error: n.media_error })),
  })],
  ['GET', '/api/crawl/enrich-failures', () => ({
    items: state.notes
      .filter((n) => n.erchuang_status === 'failed')
      .map((n) => ({ note_id: n.id, title: n.publish_title, error: n.erchuang_error })),
  })],

  /* ---------- 二创 ---------- */
  ['GET', '/api/erchuang/settings', () => clone(erchuangSettings())],
  ['GET', '/api/erchuang/stats', () => erchuangStats()],
  ['GET', '/api/erchuang/queue', (m, qs) => {
    const limit = parseInt(qs.get('limit') || '50', 10) || 50
    const offset = parseInt(qs.get('offset') || '0', 10) || 0
    const items = state.queue.slice(offset, offset + limit).map(clone)
    return { items, total: state.queue.length, limit, offset }
  }],
  ['GET', '/api/erchuang/prompts', () => ({
    copy_effective: '你是专为大众点评蓝 V 商户笔记运营的资深文案策划。请基于素材创作适合发布的标题、正文与标签。\n\n## 内容风格\n整篇侧重故事感与变化：用具体前后对比和细节，避免空泛堆砌形容词。\n\n## 篇幅（必须遵守）\n- 标题：12–24 个汉字\n- 正文：150–280 字\n- 标签：2–5 个，空格分隔并带 #\n\n## 合规\n- 禁止标题党、虚假承诺、医疗功效、包过或绝对化保证\n',
    copy_is_default: true,
    copy_extra_requirements: '',
    copy_legacy_full_prompt: false,
    subtitle: {},
  })],

  /* ---------- 发布 ---------- */
  ['GET', '/api/publish/status', () => publishStatus()],
  ['GET', '/api/publish/settings', () => ({ webhook_url: state.publishWebhook })],
  ['GET', '/api/publish/runs', (m, qs) => {
    const page = Math.max(1, parseInt(qs.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, parseInt(qs.get('page_size') || '15', 10) || 15)
    let rows = state.publishRuns.slice()
    const st = qs.get('status')
    if (st) rows = rows.filter((r) => r.status === st)
    const platform = qs.get('platform')
    if (platform) rows = rows.filter((r) => r.platform_type === 8 && platform === 'dianping')
    const account = qs.get('account')
    if (account) rows = rows.filter((r) => r.account_name === account)
    const q = (qs.get('q') || '').trim()
    if (q) rows = rows.filter((r) => String(r.note_title || '').includes(q))
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map(clone),
      total: rows.length,
      page,
      page_size: pageSize,
    }
  }],
  ['GET', '/api/publish/task-runs', (m, qs) => {
    const page = Math.max(1, parseInt(qs.get('page') || '1', 10) || 1)
    const pageSize = Math.max(1, parseInt(qs.get('page_size') || '15', 10) || 15)
    const rows = [
      {
        id: 12,
        task_id: 3,
        planned_at: '2026-10-25T12:00:00',
        started_at: '2026-10-25T12:00:00',
        finished_at: '2026-10-25T12:00:52',
        status: 'success',
        reason: '',
        command: 'schedule',
        log_path: '',
        batch_id: '01MDEMOBATCH01',
        scheduled_at: '2026-10-25T12:00:00',
        trigger: 'schedule',
        task_name: '每日发布',
        task_type: 'publish',
        duration_sec: 52,
        summary: {
          success: true,
          trigger: 'schedule',
          task_name: '每日发布',
          headless: true,
          browser_mode: 'headless',
          browser_mode_label: '后台',
          preview: { preview: '将发布到：全部已启用蓝 V' },
        },
        trigger_label: '定时',
        headless: true,
        browser_mode_label: '后台',
        publish_stats: {
          account_count: 2,
          publish_count: 2,
          success_count: 2,
          failed_count: 0,
          skipped_count: 0,
          account_success_count: 2,
          account_failed_count: 0,
          all_success: true,
        },
      },
      {
        id: 11,
        task_id: 4,
        planned_at: '2026-10-24T15:00:00',
        started_at: '2026-10-24T15:00:00',
        finished_at: '2026-10-24T15:00:38',
        status: 'failed',
        reason: '示例：发布时经营宝登录已失效，请重新扫码登录',
        command: 'schedule',
        log_path: '',
        batch_id: '01MDEMOBATCH02',
        scheduled_at: '2026-10-24T15:00:00',
        trigger: 'schedule',
        task_name: '每日发布（备用）',
        task_type: 'publish',
        duration_sec: 38,
        summary: {
          success: false,
          error: '示例：发布时经营宝登录已失效，请重新扫码登录',
          trigger: 'schedule',
          task_name: '每日发布（备用）',
          headless: true,
          browser_mode: 'headless',
          browser_mode_label: '后台',
        },
        trigger_label: '定时',
        headless: true,
        browser_mode_label: '后台',
        publish_stats: {
          account_count: 1,
          publish_count: 1,
          success_count: 0,
          failed_count: 1,
          skipped_count: 0,
          account_success_count: 0,
          account_failed_count: 1,
        },
      },
    ]
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      page_size: pageSize,
    }
  }],

  /* ---------- 定时任务 ---------- */
  ['GET', '/api/tasks', (m, qs) => {
    const type = qs.get('task_type')
    const rows = type ? state.tasks.filter((t) => t.task_type === type) : state.tasks
    return clone(rows)
  }],

  /* ---------- 系统 / 帮助 ---------- */
  ['GET', '/api/system/runtime', () => ({
    autostart_enabled: true,
    tray_on_close_enabled: true,
    autostart_registered: false,
    service: {
      running: true,
      pid: null,
      port: 39227,
      preferred_port: 39227,
      host: '0.0.0.0',
      url: 'https://dianping-note.aiautotools.com/demo',
      app_id: 'dianpingnotes',
    },
    platform: 'win32',
  })],
  ['GET', '/api/system/settings', () => ({
    autostart_enabled: true,
    tray_on_close_enabled: true,
  })],
  ['GET', '/api/help/meta', () => ({
    ok: true,
    source_url: '',
    open_url: 'https://dianping-note.aiautotools.com/guide/',
    doc_src: '',
    obj_token: '',
    obj_type: '',
    node_token: '',
    title: '点评笔记助手使用说明',
  })],

  /* ---------- LLM ---------- */
  ['GET', '/api/llm/settings', () => ({
    text_provider: 'cloud',
    text_mode: 'cloud',
    text_order: ['cloud'],
    auto_failover: false,
    openai_enabled: false,
    openai_name: '',
    vision_provider: '',
    openai_base_url: '',
    openai_api_key: '',
    openai_api_key_set: false,
    openai_model: '',
    openai_timeout_sec: 60,
    providers: [
      {
        id: 'cloud',
        name: '官方在线文案',
        ready: true,
        status: '已激活可用',
        builtin: true,
        removable: false,
        needs_activation: false,
        secrets_visible: false,
      },
    ],
    openai_ready: false,
    summary: '当前：官方在线文案',
    cloud: {
      id: 'cloud',
      name: '官方在线文案',
      ready: true,
      status: '已激活可用',
      builtin: true,
      removable: false,
      needs_activation: false,
      secrets_visible: false,
    },
    modes: [
      {
        id: 'cloud',
        name: '官方在线文案',
        desc: '经授权服务生成；需已激活，无需配置密钥',
        ready: true,
        status: '已激活可用',
        needs_activation: false,
      },
    ],
    feishu_enabled: false,
    extra_llm_enabled: false,
    hint: '演示环境：文案由内置示例数据提供，不调用任何模型服务。',
  })],
  ['GET', '/api/llm/local/status', () => ({
    phase: 'idle',
    label: '演示环境不提供本机模型',
    ready: false,
    status: '演示环境不提供本机模型',
    extra_llm_enabled: false,
    download: {},
    hardware: {},
  })],
]

/* ------------------------------------------------------------------ */
/* 写操作：全部返回「演示成功」                                        */
/* ------------------------------------------------------------------ */

const POST_ROUTES = {
  '/api/publish/run-now': () => {
    state.publishRunning = true
    state.publishBatch = '01MDEMOBATCH03'
    state.publishTotal = 2
    state.publishDone = 0
    // 演示：几秒后自动结束，界面上能看到「进行中 → 已完成」
    setTimeout(() => {
      state.publishRunning = false
      state.publishDone = state.publishTotal
    }, 4000)
    return { started: true, batch_id: state.publishBatch }
  },
  '/api/publish/cancel': () => {
    state.publishRunning = false
    return { cancelled: true }
  },
  '/api/publish/reconcile': () => ({ reconciled: true, reason: '已重置演示状态' }),
  '/api/publish/preview': () => ({
    valid: true,
    preview: '将发布到：全部已启用蓝 V',
    labels: ['全部已启用蓝 V'],
    skipped: [],
    inventory_short: false,
    note_type_policy_label: '仅视频',
  }),
  '/api/crawl/run-profiles': () => {
    state.crawlRunning = true
    setTimeout(() => { state.crawlRunning = false }, 3000)
    return { started: true, platforms_needing_login: [] }
  },
  '/api/crawl/run-videos': () => {
    state.crawlRunning = true
    setTimeout(() => { state.crawlRunning = false }, 3000)
    return { started: true, platforms_needing_login: [] }
  },
  '/api/crawl-targets/batch': () => ({ added_urls: [], added: 0, skipped: [] }),
  '/api/crawl-targets/batch/preview': () => ({
    normalized_text: '',
    token_count: 0,
    valid_count: 0,
    invalid_count: 0,
    duplicate_count: 0,
    to_add_count: 0,
    entries: [],
  }),
  '/api/crawl-targets/verify': () => ({ results: [{ level: 'ok', message: '演示：链接可正常采集', video_count: 0 }] }),
  '/api/crawl/retry-failed-downloads': () => ({ enqueued: 1 }),
  '/api/crawl/retry-failed-enrichs': () => ({ enqueued: 1 }),
  '/api/accounts/validate-cookies': () => {
    state.validateRunning = true
    setTimeout(() => { state.validateRunning = false }, 3000)
    return { started: true, total: state.accounts.length }
  },
  '/api/accounts/scan-login': () => {
    state.scanRunning = true
    setTimeout(() => { state.scanRunning = false }, 4000)
    return { started: true, session_id: 1 }
  },
  '/api/accounts/scan-login/cancel': () => {
    state.scanRunning = false
    return { cancelled: true }
  },
  '/api/notes/batch-reprocess': () => ({
    ok: true,
    enqueued: { download: 0, heal: 0, erchuang: 1, subtitle: 0 },
    total_enqueued: 1,
    skipped: { already_queued: 0 },
    message: '演示：已加入处理队列',
  }),
  '/api/erchuang/prompt/reset': () => clone(erchuangSettings()),
}

/* ------------------------------------------------------------------ */
/* fetch 拦截                                                          */
/* ------------------------------------------------------------------ */

function matchRoute(method, path) {
  for (const [m, p, fn] of ROUTES) {
    if (m !== method) continue
    if (p === path) return { fn, params: {} }
    if (p.endsWith('/*')) {
      const pre = p.slice(0, -1)
      if (path.startsWith(pre)) return { fn, params: { rest: path.slice(pre.length) } }
    }
  }
  return null
}

/** /api/notes/{id}/... 这类带路径参数的处理 */
function handleDynamic(method, path, qs) {
  const noteMatch = path.match(/^\/api\/notes\/([^/]+)(\/.*)?$/)
  if (noteMatch) {
    const id = decodeURIComponent(noteMatch[1])
    const rest = noteMatch[2] || ''
    const n = noteById(id)

    if (method === 'GET' && rest === '') {
      if (!n) return json({ detail: '笔记不存在' }, 404)
      return json({ note: clone(n), platforms: clone(n.platforms || []) })
    }
    if (method === 'GET' && rest === '/video') {
      return handleVideo(id, qs.get('kind') === 'raw' ? 'raw' : 'processed')
    }
    if (method === 'POST' && rest === '/retry-download') return json({ ok: true, message: '演示：已重新加入下载队列' })
    if (method === 'POST' && rest === '/retry-erchuang') return json({ ok: true, message: '演示：已重新加入二创队列' })
    if (method === 'POST' && rest === '/recheck-platform-rules') return json({ ok: true, passed: true, message: '演示：符合平台规则' })
    if (method === 'PATCH' && rest === '/publish-copy') {
      if (!n) return json({ detail: '笔记不存在' }, 404)
      return json({ ok: true })
    }
    const platRetry = rest.match(/^\/platforms\/([^/]+)\/retry-publish$/)
    if (method === 'POST' && platRetry) return json({ ok: true, message: '演示：已重新加入发布队列' })
  }

  const runMatch = path.match(/^\/api\/publish\/runs\/([^/]+)$/)
  if (runMatch && method === 'GET') {
    const r = state.publishRuns.find((x) => x.run_id === decodeURIComponent(runMatch[1]))
    if (!r) return json({ detail: '记录不存在' }, 404)
    return json({ run: clone(r) })
  }

  const taskRunMatch = path.match(/^\/api\/publish\/task-runs\/([^/]+)$/)
  if (taskRunMatch && method === 'GET') {
    const data = ROUTES.find(([m, p]) => p === '/api/publish/task-runs')[2](method, new URLSearchParams())
    const run = data.items.find((x) => String(x.id) === decodeURIComponent(taskRunMatch[1]))
    if (!run) return json({ detail: '记录不存在' }, 404)
    return json({ run })
  }

  const crawlRunMatch = path.match(/^\/api\/crawl\/runs\/([^/]+)$/)
  if (crawlRunMatch && method === 'GET') {
    const r = state.crawlRuns.find((x) => String(x.id) === decodeURIComponent(crawlRunMatch[1]))
    if (!r) return json({ detail: '记录不存在' }, 404)
    return json({ run: clone(r) })
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/)
  if (taskMatch) {
    const id = decodeURIComponent(taskMatch[1])
    if (method === 'PUT') {
      const t = state.tasks.find((x) => String(x.id) === id)
      if (!t) return json({ detail: '任务不存在' }, 404)
      return json({ ok: true })
    }
  }

  const acctMatch = path.match(/^\/api\/accounts\/(\d+)\/(open-platform|refresh-login|validate-cookie)$/)
  if (acctMatch && method === 'POST') {
    const id = parseInt(acctMatch[1], 10)
    const a = state.accounts.find((x) => x.id === id)
    if (acctMatch[2] === 'refresh-login' && a) {
      a.cookie_valid = true
      a.cookie_checked_at = nowIso()
    }
    return json({ ok: true, message: '演示：操作已模拟完成' })
  }

  const blueVMatch = path.match(/^\/api\/accounts\/blue-v\/(\d+)\/status$/)
  if (blueVMatch && method === 'PATCH') {
    const id = parseInt(blueVMatch[1], 10)
    const a = state.accounts.find((x) => x.id === id)
    if (a) a.status = a.status ? 1 : 0
    return json({ ok: true })
  }

  const msMatch = path.match(/^\/api\/accounts\/merchant-sessions\/(\d+)(\/.*)?$/)
  if (msMatch) {
    const rest = msMatch[2] || ''
    if (method === 'GET') return json(clone(DEMO_MERCHANT_TREE.sessions[0].session))
    if (method === 'POST') return json({ ok: true, message: '演示：操作已模拟完成' })
  }

  const erchMask = path.match(/^\/api\/erchuang\/image-mask-icon(\/reset)?$/)
  if (erchMask && method === 'POST') return json({ ok: true })
  // 遮盖图标预览：演示环境直接给一张占位图，避免 <img src> 打到 404
  if (erchMask && method === 'GET') {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" fill="#e2e8f0"/>' +
      '<text x="32" y="38" font-size="18" text-anchor="middle" fill="#64748b">图</text></svg>'
    return new Response(svg, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
    })
  }

  const taskRunPost = path.match(/^\/api\/tasks\/([^/]+)\/run$/)
  if (taskRunPost && method === 'POST') {
    state.publishRunning = true
    state.publishBatch = '01MDEMOBATCH04'
    state.publishTotal = 2
    state.publishDone = 0
    setTimeout(() => {
      state.publishRunning = false
      state.publishDone = state.publishTotal
    }, 4000)
    return json({ started: true, task_run_id: 13 })
  }

  return null
}

/* ------------------------------------------------------------------ */
/* 静态资源基址：demo.js 自身所在目录，媒体与下载文件都从这里取        */
/* ------------------------------------------------------------------ */

/** 占位图：<img src="/api/..."> 不走 fetch，统一替换成内联 SVG */
const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" fill="#e2e8f0"/>' +
      '<text x="32" y="38" font-size="20" text-anchor="middle" fill="#64748b">图</text></svg>',
  )

let BASE = '/'

function resolveBase() {
  const s = document.currentScript
  if (s && s.src) {
    try {
      return new URL('.', s.src).pathname.replace(/\/?$/, '/')
    } catch (_) { /* ignore */ }
  }
  const p = window.location.pathname
  return p.endsWith('/') ? p : p.replace(/[^/]*$/, '')
}

/* ------------------------------------------------------------------ */
/* 视频：<video src> 由浏览器直接加载，不经过 fetch 拦截，             */
/* 所以这里既提供 302，也用 MutationObserver 把 src 改写成静态媒体。   */
/* ------------------------------------------------------------------ */

function mediaUrl(kind) {
  return `${BASE}media/sample-${kind}.mp4`
}

function handleVideo(id, kind) {
  const n = noteById(id)
  if (!n) return text('演示素材不存在', 404)
  return new Response(null, { status: 302, headers: { Location: mediaUrl(kind) } })
}

/** 把 /api/notes/{id}/video 改写成静态演示媒体 */
function installVideoRewriter() {
  const rewrite = (el) => {
    const src = el.getAttribute('src')
    if (!src) return
    // 视频地址可能是 /api/notes/{id}/video，也可能是同目录相对路径
    if (src.includes('/api/notes/') && src.includes('/video')) {
      const kind = src.includes('kind=raw') ? 'raw' : 'processed'
      el.setAttribute('src', mediaUrl(kind))
      return
    }
    if (src.startsWith('/api/')) {
      el.setAttribute('src', IMAGE_PLACEHOLDER)
    }
  }
  const observer = new MutationObserver((records) => {
    records.forEach((rec) => {
      if (rec.type === 'attributes' && rec.target.tagName === 'VIDEO') {
        rewrite(rec.target)
        return
      }
      rec.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return
        if (node.tagName === 'VIDEO') rewrite(node)
        node.querySelectorAll?.('video[src]').forEach(rewrite)
      })
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
  document.querySelectorAll('video[src]').forEach(rewrite)
}

/** 导出类链接：浏览器原生下载不会走 fetch，这里在点击时生成 blob */
function installDownloadInterceptor() {
  document.addEventListener(
    'click',
    (ev) => {
      const a = ev.target.closest && ev.target.closest('a[href]')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/api/')) return
      ev.preventDefault()

      let content = '演示环境不提供真实导出文件。\n'
      let name = a.getAttribute('download') || 'download.txt'
      if (href.startsWith('/api/publish/runs/export')) {
        const header = '笔记标题,平台,账号,状态,时间\n'
        const body = state.publishRuns
          .map((r) => `${r.note_title},${r.platform_name},${r.account_name},${r.status},${r.created_at}`)
          .join('\n')
        content = header + body + '\n'
        name = 'publish_runs.csv'
      } else if (href.startsWith('/api/crawl-targets/export')) {
        content = '主页地址,名称\n' + state.targets.map((t) => `${t.url},${t.label}`).join('\n') + '\n'
        name = 'crawl_targets.csv'
      } else if (href.startsWith('/api/notes/exports/download')) {
        content = '演示环境不提供真实导出文件。\n'
        name = 'demo_notes_bundle.txt'
      }

      const blob = new Blob([`﻿${content}`], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    },
    true,
  )
}

/* ------------------------------------------------------------------ */
/* 特殊处理：PUT / POST 需要 body                                     */
/* ------------------------------------------------------------------ */

async function readBody(req) {
  try {
    const t = await req.text()
    return t ? JSON.parse(t) : {}
  } catch (_) {
    return {}
  }
}

async function handle(req) {
  const url = new URL(req.url, window.location.href)
  const path = url.pathname
  const method = (req.method || 'GET').toUpperCase()

  /* 帮助页：走演示版说明，不内嵌飞书云文档 */
  if (path === '/api/help/docs-component') {
    return json({
      mode: 'fallback',
      reason: '演示环境不内嵌在线文档，请查看官网使用说明。',
      open_url: 'https://dianping-note.aiautotools.com/guide/',
      doc_src: '',
    })
  }

  /* 读接口：先匹配静态路由，再匹配带路径参数的动态路由 */
  if (method === 'GET') {
    const hit = matchRoute(method, path)
    if (hit) return json(hit.fn(hit.params, url.searchParams))
    const dyn = handleDynamic(method, path, url.searchParams)
    if (dyn) return dyn
    /* 兜底：任何未覆盖的 /api 都返回空对象，避免前端整页报错 */
    if (path.startsWith('/api/')) return json({ ok: true, demo: true, path })
    return null
  }

  /* 写接口 */
  const dyn = handleDynamic(method, path, url.searchParams)
  if (dyn) return dyn

  if (POST_ROUTES[path]) return json(POST_ROUTES[path]())

  if (path === '/api/publish/settings' && method === 'PUT') {
    const body = await readBody(req)
    state.publishWebhook = body.webhook_url || ''
    return json({ webhook_url: state.publishWebhook })
  }
  if (path === '/api/crawl/schedule' && method === 'PUT') {
    const body = await readBody(req)
    state.crawlSchedule.enabled = body.enabled ? 1 : 0
    state.crawlSchedule.schedule_value = body.schedule_value || state.crawlSchedule.schedule_value
    return json(clone(state.crawlSchedule))
  }
  if (path === '/api/accounts/schedule' && method === 'PUT') {
    const body = await readBody(req)
    state.accountSchedule.enabled = !!body.enabled
    state.accountSchedule.schedule_value = body.schedule_value || state.accountSchedule.schedule_value
    state.accountSchedule.next_run = state.accountSchedule.enabled ? '明天 ' + state.accountSchedule.schedule_value : '已关闭'
    return json(clone(state.accountSchedule))
  }
  if (path === '/api/notes/settings' && method === 'PUT') {
    const body = await readBody(req)
    state.notesSettings = { ...(state.notesSettings || {}), ...body }
    return json(clone(state.notesSettings))
  }
  if (path === '/api/erchuang/settings' && method === 'PUT') {
    const body = await readBody(req)
    state.erchuangSettings = { ...erchuangSettings(), ...body }
    return json(clone(state.erchuangSettings))
  }
  if (path === '/api/llm/settings' && method === 'PUT') {
    return json(ROUTES.find(([m, p]) => p === '/api/llm/settings')[2]())
  }
  if (path === '/api/system/settings' && method === 'PUT') {
    return json({ autostart_enabled: true, tray_on_close_enabled: true })
  }
  if (path === '/api/tasks' && method === 'POST') {
    return json({ ok: true, id: 99 })
  }
  if (path === '/api/tasks' && method === 'DELETE') {
    return json({ ok: true })
  }
  if (path.startsWith('/api/tasks/') && method === 'DELETE') {
    return json({ ok: true })
  }
  if (path === '/api/notes/export-bundle' && method === 'POST') {
    return json({
      ok: true,
      filename: 'demo_notes_bundle.zip',
      note_count: state.notes.length,
      size_bytes: 10240,
      download_url: '',
    })
  }
  if (path === '/api/notes/import-bundle-upload' && method === 'POST') {
    return json({ ok: true, imported: 0 })
  }
  if (path === '/api/notes/heal-missing-videos' && method === 'POST') {
    return json({ ok: true, healed: 0 })
  }
  if (path === '/api/accounts/import' && method === 'POST') {
    return json({ ok: true, imported: 0 })
  }
  if (path === '/api/license/activate' && method === 'POST') {
    return json({ ok: true, activated: true })
  }
  if (path === '/api/llm/test' && method === 'POST') {
    return json({ ok: true, message: '演示：连通正常' })
  }
  if (path === '/api/llm/local/retry-download' && method === 'POST') {
    return json({ ok: true })
  }

  return json({ detail: `演示环境未实现该接口：${method} ${path}` }, 404)
}

/* ------------------------------------------------------------------ */
/* 安装拦截                                                            */
/* ------------------------------------------------------------------ */

export function installDemo() {
  BASE = resolveBase()
  const nativeFetch = window.fetch.bind(window)

  window.fetch = function demoFetch(input, init) {
    let url = ''
    let req = null
    try {
      if (typeof input === 'string') {
        url = input
        req = new Request(input, init)
      } else if (input instanceof Request) {
        url = input.url
        req = input
      } else {
        url = String(input)
        req = new Request(input, init)
      }
    } catch (_) {
      return nativeFetch(input, init)
    }

    let parsed
    try {
      parsed = new URL(url, window.location.href)
    } catch (_) {
      return nativeFetch(input, init)
    }

    // 演示站只拦截本机后端接口；外部资源（文档 SDK、视频、样式）照常放行
    if (!parsed.pathname.startsWith('/api/')) {
      return nativeFetch(input, init)
    }

    return handle(req).then((res) => {
      if (!res) return nativeFetch(input, init)
      return res
    }).catch((err) => {
      console.warn('[demo] 接口处理异常：', parsed.pathname, err)
      return json({ detail: '演示环境内部错误' }, 500)
    })
  }

  // 演示站不加载飞书云文档 SDK，避免外部请求。
  // app.js 启动时会无条件调 ensureDocsComponentSdk(HELP_SDK_URL)，
  // 这里用一个空实现占位，让它认为 SDK 已就绪，脚本标签就不会被插入。
  window.DocComponentSdk = function DemoDocsStub() {
    return {
      setFeatureConfig() {},
      destroy() {},
    }
  }

  installVideoRewriter()
  installDownloadInterceptor()
  installImageRewriter()
}

/**
 * 遮盖图标预览这类 <img src="/api/..."> 同样不经过 fetch，
 * 直接把 src 改写成一个内联 SVG，避免 404 与外部请求。
 */
function installImageRewriter() {
  const rewrite = (el) => {
    const src = el.getAttribute('src')
    if (!src || !src.startsWith('/api/')) return
    el.setAttribute('src', IMAGE_PLACEHOLDER)
  }
  const observer = new MutationObserver((records) => {
    records.forEach((rec) => {
      if (rec.type === 'attributes' && rec.target.tagName === 'IMG') {
        rewrite(rec.target)
        return
      }
      rec.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return
        if (node.tagName === 'IMG') rewrite(node)
        node.querySelectorAll?.('img[src]').forEach(rewrite)
      })
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
  document.querySelectorAll('img[src]').forEach(rewrite)
}

/** 帮助页在演示里改用本地说明文本 */
export function patchHelpPage() {
  const mount = document.getElementById('helpDocMount')
  const fb = document.getElementById('helpDocFallback')
  const msg = document.getElementById('helpFallbackMsg')
  const open = document.getElementById('helpFallbackOpen')
  if (!mount) return
  mount.hidden = true
  if (fb) fb.hidden = false
  if (msg) {
    msg.textContent = '演示环境不内嵌在线文档。下面是演示站能体验到的功能清单，完整说明请查看官网。'
  }
  if (open) {
    open.textContent = '打开官网使用说明'
    open.href = 'https://dianping-note.aiautotools.com/guide/'
  }
}

export default { installDemo, patchHelpPage }
