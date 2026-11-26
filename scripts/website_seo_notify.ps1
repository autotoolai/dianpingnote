#Requires -Version 5.1
<#
.SYNOPSIS
  官网发版后通知搜索引擎：IndexNow + Bing API + 百度推送（可选）+ GSC 交 sitemap。

.DESCRIPTION
  URL 列表从已构建的 sitemap.xml 读取，避免手写清单与站点内容脱节。

  本文件是公开仓里的权威副本，不含任何密钥。密钥从环境变量读，
  GitHub Actions 的 secrets 会注入到同名环境变量里。

.EXAMPLE
  pwsh -File scripts/website_seo_notify.ps1
  pwsh -File scripts/website_seo_notify.ps1 -DryRun
#>
param(
  [switch]$DryRun,
  # 留空则自动找：本仓根下 .vitepress\dist\sitemap.xml，或父仓 apps\website 下的产物
  [string]$SitemapPath = '',
  # 只推送本次提交改动过的页面。
  # CI 里台账是临时文件（runner 每次全新），没有这个模式就会每天全量重推，
  # 把百度/Bing 的账号级配额浪费在没变化的页面上。
  [switch]$ChangedOnly
)

$ErrorActionPreference = 'Stop'

# 路径一律用 Join-Path 拼，不写死斜杠方向。
# GitHub Actions 的 runner 是 Linux，写死的反斜杠路径在那边会当成普通文件名。

# 站仓根：脚本放在 <站仓>/scripts/ 下，父目录就是站仓根。
$SiteRoot = Split-Path -Parent $PSScriptRoot
Set-Location $SiteRoot

# 工作根：台账、密钥文件的落点。
# 公开仓独立跑时就是站仓根；放在父仓 apps/website 下时用父仓根，
# 这样 temp/seo_push/ 的台账跟父仓其它临时产物在一起。
$RepoRoot = $SiteRoot
$appsDir = Split-Path -Parent $SiteRoot
$parentCandidate = Split-Path -Parent $appsDir
if ((Split-Path -Leaf $appsDir) -eq 'apps' -and (Test-Path -LiteralPath (Join-Path $parentCandidate 'scripts'))) {
  $RepoRoot = $parentCandidate
}

if (-not $SitemapPath) {
  $candidates = @(
    (Join-Path $SiteRoot (Join-Path '.vitepress' (Join-Path 'dist' 'sitemap.xml')))
    (Join-Path $RepoRoot (Join-Path 'apps' (Join-Path 'website' (Join-Path '.vitepress' (Join-Path 'dist' 'sitemap.xml')))))
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { $SitemapPath = $c; break }
  }
  if (-not $SitemapPath) {
    $SitemapPath = $candidates[0]
  }
}

function Import-DotEnv([string]$Path, [switch]$OnlyIfAbsent) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    # 已有环境变量优先：模板与 CI 注入的密钥都该赢过文件里的默认值。
    if ($OnlyIfAbsent -and (Test-Path "Env:$k")) { return }
    # 空值不覆盖已有环境变量。
    # 模板里的空位是为了列出需要的键，不该把 CI 注入的真密钥冲掉。
    if (-not $v -and (Test-Path "Env:$k")) { return }
    Set-Item -Path "Env:$k" -Value $v
  }
}

# 本地密钥文件（可选）。CI 不带密钥文件，全靠环境变量注入；
# 本机跑时从父仓 config/local 读真值。
# 规则：example 只填空缺（环境变量优先），local 覆盖一切。
Import-DotEnv (Join-Path $SiteRoot (Join-Path 'config' 'website_secrets.example.env')) -OnlyIfAbsent
Import-DotEnv (Join-Path $RepoRoot (Join-Path 'config' 'website_secrets.example.env')) -OnlyIfAbsent
Import-DotEnv (Join-Path $SiteRoot (Join-Path 'config' (Join-Path 'local' 'website_secrets.env')))
Import-DotEnv (Join-Path $RepoRoot (Join-Path 'config' (Join-Path 'local' 'website_secrets.env')))

$Origin = if ($env:WEBSITE_ORIGIN) { $env:WEBSITE_ORIGIN.TrimEnd('/') } else { 'https://dianping-note.aiautotools.com' }
$HostName = if ($env:WEBSITE_HOST) { $env:WEBSITE_HOST } else { 'dianping-note.aiautotools.com' }
$IndexNowKey = $env:INDEXNOW_KEY

# URL 清单：从 sitemap 读
$Urls = @()
if (Test-Path -LiteralPath $SitemapPath) {
  [xml]$map = Get-Content -LiteralPath $SitemapPath -Raw -Encoding UTF8
  $Urls = @($map.urlset.url.loc | ForEach-Object { $_.Trim() })
} else {
  Write-Warning "未找到 $SitemapPath，退回只推送首页"
  $Urls = @("$Origin/")
}

# 只推本次改动过的页面：从 git diff 拿到变更的源文件，映射成站点路由。
function Get-ChangedRoutes {
  param([string]$SiteRoot)
  $routes = New-Object 'System.Collections.Generic.HashSet[string]'
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if (-not $cmd) { return ,$routes }
  Push-Location $SiteRoot
  try {
    # 基准提交：CI 里 submodule 是 detached HEAD，HEAD~1 可能不存在。
    # 先探一次，探不到就退回「全部推送」，不静默漏推。
    $base = $null
    & git rev-parse --verify 'HEAD~1' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $base = 'HEAD~1' }
    if (-not $base) {
      Write-Warning 'ChangedOnly: 取不到 HEAD~1，改成全量推送'
      return ,$null
    }
    $diff = & git diff --name-only $base 'HEAD' 2>$null
  } catch {
    $diff = @()
  } finally {
    Pop-Location
  }
  foreach ($f in $diff) {
    if (-not $f) { continue }
    $p = $f.Replace('\', '/')
    # 只关心能变成页面的源文件
    if ($p -notmatch '\.(md|vue|ts|js)$') { continue }
    if ($p -like 'demo/*' -or $p -like 'scripts/*' -or $p -like 'data/*' -or $p -like '.*') { continue }
    $rel = $p -replace '\.(md|vue|ts|js)$', ''
    # 目录索引页：knowledge/index.md -> /knowledge
    $rel = $rel -replace '/index$', ''
    [void]$routes.Add("/$rel")
  }
  return ,$routes
}

if ($ChangedOnly) {
  $changed = Get-ChangedRoutes -SiteRoot $SiteRoot
  if ($null -eq $changed) {
    # 取不到 diff 基准就不筛了，保持全量推送
  } elseif ($changed.Count -eq 0) {
    Write-Host 'ChangedOnly: 本次提交没有页面改动，跳过推送'
    $Urls = @()
  } else {
    $filtered = @($Urls | Where-Object {
      $path = ([uri]$_).AbsolutePath.TrimEnd('/')
      if (-not $path) { $path = '/' }
      $changed.Contains($path)
    })
    Write-Host "ChangedOnly: 本次改动页面 $($changed.Count) 个，命中 sitemap $($filtered.Count) 个"
    $Urls = $filtered
  }
}

Write-Host "site: $Origin"
Write-Host "urls: $($Urls.Count)"

# 推送优先级：购买意图与品牌主场在前，长尾文章页压后。
# 百度日配额约 10 条、Bing 的 SubmitUrlBatch 按条数扣额，顺序决定哪批页先被抓取。
# 与 seo_config.mjs 的「一词一主场」保持一致：/pricing 是购买意图唯一主场。
$PriorityPaths = @('/', '/pricing', '/collect', '/erchuang', '/publish', '/knowledge', '/faq', '/get-started', '/about', '/contact', '/screenshots', '/online-demo')

function Submit-IndexNow {
  if (-not $IndexNowKey) {
    Write-Host ''
    Write-Host 'IndexNow: skip (未设 INDEXNOW_KEY)'
    return
  }
  if ($Urls.Count -eq 0) {
    Write-Host ''
    Write-Host 'IndexNow: skip (没有要推的 URL)'
    return
  }
  $keyLocation = "$Origin/$IndexNowKey.txt"
  $payload = @{
    host        = $HostName
    key         = $IndexNowKey
    keyLocation = $keyLocation
    urlList     = $Urls
  } | ConvertTo-Json -Compress
  Write-Host ''
  Write-Host "IndexNow: POST api.indexnow.org (key file: $keyLocation)"
  if ($DryRun) { Write-Host "DryRun: $payload"; return }
  try {
    $resp = Invoke-WebRequest -Uri 'https://api.indexnow.org/indexnow' -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing
    Write-Host "IndexNow: HTTP $($resp.StatusCode) OK"
  } catch {
    $resp = $_.Exception.Response
    if ($null -ne $resp) {
      $code = [int]$resp.StatusCode
      if ($code -eq 200 -or $code -eq 202) { Write-Host "IndexNow: HTTP $code accepted"; return }
    }
    Write-Warning "IndexNow failed: $_"
  }
}

function Get-PushedSet {
  param([string]$RecordFile)
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  if (Test-Path -LiteralPath $RecordFile) {
    foreach ($line in (Get-Content -LiteralPath $RecordFile -Encoding UTF8)) {
      $u = $line.Trim()
      if ($u) { [void]$set.Add($u) }
    }
  }
  # The comma keeps PowerShell from unrolling the HashSet into individual strings;
  # an empty set would otherwise come back as $null and $pushed.Contains() would throw.
  return ,$set
}

function Add-Pushed {
  param([string]$RecordFile, [string]$Url)
  $dir = Split-Path -Parent $RecordFile
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -LiteralPath $RecordFile -Value $Url -Encoding UTF8
}

function Get-PushOrder {
  <#
    推送顺序：重要页优先，文章页压后；已推过的跳过。

    为什么要排序：百度日配额约 10 条、Bing 的 SubmitUrlBatch 按条数扣额。
    按 sitemap 原序推的话，末尾的新文章永远排在后面 —— 实测有条目从��被抓取过。
    为什么要台账：台账为空时（首次运行）会全量推出去，之后每天的名额都花在没推过的页上。

    实现用 [Array]::Sort 而非 Sort-Object：后者经脚本作用域调用时会把结果退化成单个字符串。
  #>
  param(
    [string[]]$AllUrls,
    [string]$RecordFile,
    [string[]]$PriorityPaths
  )

  $pushed = Get-PushedSet $RecordFile

  $rows = New-Object 'System.Collections.Generic.List[object]'
  for ($i = 0; $i -lt $AllUrls.Count; $i++) {
    $u = [string]$AllUrls[$i]
    if ($pushed.Contains($u)) { continue }
    $path = ([uri]$u).AbsolutePath
    $rank = [array]::IndexOf($PriorityPaths, $path)
    # 知识库与指南文章压到最后：它们是长尾词，前期不占配额
    if ($rank -lt 0) { $rank = if ($path -like '*/knowledge/*' -or $path -like '*/guides/*') { 100 } else { 50 } }
    $rows.Add([pscustomobject]@{ Url = $u; Rank = $rank; Seq = $i })
  }
  if ($rows.Count -le 1) { return @($rows | ForEach-Object { $_.Url }) }

  $arr = $rows.ToArray()
  [Array]::Sort($arr, [System.Comparison[object]] {
    param($a, $b)
    if ($a.Rank -ne $b.Rank) {
      if ($a.Rank -lt $b.Rank) { return -1 }
      return 1
    }
    if ($a.Seq -lt $b.Seq) { return -1 }
    if ($a.Seq -gt $b.Seq) { return 1 }
    return 0
  })
  return @($arr | ForEach-Object { $_.Url })
}

function Submit-Bing {
  $apiKey = $env:BING_API_KEY
  if (-not $apiKey) {
    Write-Host ''
    Write-Host 'Bing: skip (未设 BING_API_KEY)'
    return
  }
  $siteUrl = if ($env:BING_SITE_URL) { $env:BING_SITE_URL } else { "$Origin/" }
  if (-not $siteUrl.EndsWith('/')) { $siteUrl = "$siteUrl/" }
  $sitemapUrl = "$Origin/sitemap.xml"
  $qKey = [uri]::EscapeDataString($apiKey)

  Write-Host ''
  Write-Host "Bing: SubmitFeed $sitemapUrl (site=$siteUrl)"

  # 队列在 DryRun 下也要算出来并打印，否则预览时看不到推送顺序对不对。
  $stateDir = Join-Path $RepoRoot (Join-Path 'temp' 'seo_push')
  $recordFile = Join-Path $stateDir 'bing_pushed.txt'
  $MaxBingUrls = if ($env:BING_LIMIT) { [int]$env:BING_LIMIT } else { 50 }
  $ordered = @(Get-PushOrder -AllUrls $Urls -RecordFile $recordFile -PriorityPaths $PriorityPaths)
  Write-Host "Bing: 待推 $($ordered.Count) 条（总 $($Urls.Count)，上限 $MaxBingUrls）"
  if ($ordered.Count -eq 0) {
    Write-Host 'Bing: 没有待推的新 URL（台账已覆盖全部页面）'
    return
  }
  $todo = @($ordered)[0..([Math]::Min($MaxBingUrls, $ordered.Count) - 1)]
  foreach ($u in $todo) { Write-Host "  队列: $u" }
  if ($DryRun) { Write-Host 'DryRun: SubmitFeed + SubmitUrlBatch'; return }

  $feedBody = @{ siteUrl = $siteUrl; feedUrl = $sitemapUrl } | ConvertTo-Json -Compress
  try {
    $r = Invoke-WebRequest -Uri "https://ssl.bing.com/webmaster/api.svc/json/SubmitFeed?apikey=$qKey" -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($feedBody)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing
    Write-Host "Bing SubmitFeed: HTTP $($r.StatusCode) $($r.Content)"
  } catch { Write-Warning "Bing SubmitFeed failed: $_" }

  # SubmitUrlBatch 的额度按 URL 条数扣（账号级共享，一天 100 条左右）。
  # 超额时正文会带出 "Quota remaining ... Submitted: N"，那才是真正的诊断信息。
  $batchBody = @{ siteUrl = $siteUrl; urlList = $todo } | ConvertTo-Json -Compress
  try {
    $r = Invoke-WebRequest -Uri "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey=$qKey" -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($batchBody)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing
    Write-Host "Bing SubmitUrlBatch: HTTP $($r.StatusCode) $($r.Content)"
    # 成功才记台账：失败的不能记，否则那一页永远推不出去。
    foreach ($u in $todo) { Add-Pushed -RecordFile $recordFile -Url $u }
    Write-Host "Bing: 本次提交 $($todo.Count) 条，台账 $recordFile（已累计 $((Get-PushedSet $recordFile).Count) 条）"
  } catch {
    $body = ''
    try { $body = $_.Exception.Response.GetResponseStream() | ForEach-Object { $sr = New-Object System.IO.StreamReader($_); $sr.ReadToEnd() } } catch { }
    Write-Warning "Bing SubmitUrlBatch failed: $body $_"
  }
}

function Submit-Baidu {
  $site = $env:BAIDU_SITE
  $token = $env:BAIDU_TOKEN
  if (-not $site -or -not $token) {
    Write-Host ''
    Write-Host 'Baidu: skip (未设 BAIDU_SITE / BAIDU_TOKEN，需先在 ziyuan.baidu.com 加站并验证)'
    return
  }
  # 百度 API 的 site 不能带协议，否则 site init fail
  $site = $site.Trim() -replace '^https?://', '' -replace '/$', ''
  $endpoint = "http://data.zz.baidu.com/urls?site=$([uri]::EscapeDataString($site))&token=$([uri]::EscapeDataString($token))"

  # 重要页优先，文章页压后；已推过的跳过
  $stateDir = Join-Path $RepoRoot (Join-Path 'temp' 'seo_push')
  $recordFile = Join-Path $stateDir 'baidu_pushed.txt'
  $ordered = @(Get-PushOrder -AllUrls $Urls -RecordFile $recordFile -PriorityPaths $PriorityPaths)
  $limit = if ($env:BAIDU_LIMIT) { [int]$env:BAIDU_LIMIT } else { 10 }   # 账号级日配额约 10 条
  Write-Host ''
  Write-Host "Baidu: 待推 $($ordered.Count) 条（总 $($Urls.Count)，今日上限 $limit，site=$site）"
  if ($ordered.Count -eq 0) {
    Write-Host 'Baidu: 没有待推的新 URL（台账已覆盖全部页面）'
    return
  }
  $todo = @($ordered)[0..([Math]::Min($limit, $ordered.Count) - 1)]
  foreach ($u in $todo) { Write-Host "  队列: $u" }
  if ($DryRun) { Write-Host "DryRun: site=$site"; return }

  # 新站日配额很小；整批易 over quota，改为逐条直到超额。
  $ok = 0
  foreach ($u in $todo) {
    try {
      $resp = Invoke-WebRequest -Uri $endpoint -Method POST -Body $u -ContentType 'text/plain' -UseBasicParsing
      Write-Host "Baidu OK: $u -> $($resp.Content)"
      # 成功才记台账：失败的不能记，否则那一页永远推不出去。
      Add-Pushed -RecordFile $recordFile -Url $u
      $ok++
      $j = $null
      try { $j = $resp.Content | ConvertFrom-Json } catch { }
      if ($null -ne $j -and $null -ne $j.remain -and [int]$j.remain -le 0) {
        Write-Host 'Baidu: daily quota exhausted; remaining urls tomorrow'
        break
      }
    } catch {
      $body = ''
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $body = $reader.ReadToEnd()
        }
      } catch { }
      if ($body -match 'over quota') {
        Write-Warning "Baidu over quota after $ok urls; rest tomorrow. $body"
        break
      }
      Write-Warning "Baidu failed ($u): $body $_"
      break
    }
  }
  Write-Host "Baidu: 本次成功 $ok 条，台账 $recordFile（已累计 $((Get-PushedSet $recordFile).Count) 条）"
}

function Resolve-SeoPython {
  $candidates = @(
    (Join-Path $RepoRoot (Join-Path 'temp' (Join-Path 'seo_probe' (Join-Path '.venv' (Join-Path 'Scripts' 'python.exe')))))
    (Join-Path $RepoRoot (Join-Path '.venv' (Join-Path 'Scripts' 'python.exe')))
    (Join-Path $SiteRoot (Join-Path 'temp' (Join-Path 'seo_probe' (Join-Path '.venv' (Join-Path 'Scripts' 'python.exe')))))
    (Join-Path $SiteRoot (Join-Path '.venv' (Join-Path 'Scripts' 'python.exe')))
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  # Linux runner 上叫 python3
  foreach ($name in @('python3', 'python')) {
    $found = Get-Command $name -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
  }
  return 'python'
}

function Submit-GscSitemap {
  $siteUrl = $env:GSC_SITE_URL
  if (-not $siteUrl) {
    Write-Host ''
    Write-Host 'GSC: skip (未设 GSC_SITE_URL)'
    return
  }
  $sitemapUrl = "$Origin/sitemap.xml"
  $py = Resolve-SeoPython
  $helper = Join-Path $SiteRoot (Join-Path 'scripts' 'website_gsc_submit_sitemap.py')
  Write-Host ''
  Write-Host "GSC: submit $sitemapUrl -> $siteUrl"

  # CI 里没有文件，只有环境变量里的 JSON 内容。两种来源都支持。
  $credContent = $env:GOOGLE_SERVICE_ACCOUNT_JSON
  if ($credContent) {
    $credPath = Join-Path (Get-Location) 'gsc_service_account.json'
    Set-Content -LiteralPath $credPath -Value $credContent -Encoding UTF8
    Write-Host 'GSC: 凭据来自 GOOGLE_SERVICE_ACCOUNT_JSON'
  } else {
    $credPath = $env:GOOGLE_APPLICATION_CREDENTIALS
    if (-not $credPath) { $credPath = Join-Path (Join-Path 'config' 'local') 'website_gsc_service_account.json' }
    if (-not [System.IO.Path]::IsPathRooted($credPath)) { $credPath = Join-Path $RepoRoot $credPath }
    if (-not (Test-Path -LiteralPath $credPath)) {
      Write-Host ''
      Write-Host 'GSC: skip (没有服务账号 JSON，且未设 GOOGLE_SERVICE_ACCOUNT_JSON)'
      return
    }
  }
  Write-Host "GSC: python=$py"
  if ($DryRun) { Write-Host "DryRun: $helper"; return }
  & $py $helper --credentials $credPath --site-url $siteUrl --sitemap-url $sitemapUrl
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'GSC submit failed (常见原因：服务账号无 Full 权限、属性类型写错、国内需代理)'
  }
}

Submit-IndexNow
Submit-Bing
Submit-Baidu
Submit-GscSitemap
Write-Host ''
Write-Host 'done.'