#!/usr/bin/env python3
"""知识库与指南文章的 GEO 写法门禁。

GEO（生成式引擎优化）与传统 SEO 的差别在于「谁在读」：SEO 读的是排序信号，
GEO 读的是段落本身。AI 判断一段内容值不值得引用，看的是它脱离上下文能不能读懂、
有没有具体数字、结论是否明确。KDD 2024 的《GEO: Generative Engine Optimization》
把「可引用的具体事实与统计数字」列为高效策略。

这个脚本把已经做对的写法锁成硬门禁，防止回退。它的价值不在抓现有问题，
而在「新写的文章不会又写成散文」。

断言项：
  1. H1 之后、第一个 H2 之前有「> **一句话答案**：」段（自包含结论，AI 引用的首选形态）
  2. 一句话答案不含依赖上下文的措辞（如上所述 / 前文提到 / 综上所述）
  3. 答案段至少含一个具体数字（纯定性描述不可被引用为事实）——降级为提醒
  4. 正文含至少一个 H2（段落分层决定 AI 能否定位到相关片段）
  5. frontmatter 有 keywords（per-page keywords 缺失等于该页回落到全局那条）
  6. 顶层落地页额外要求：页面里有答案胶囊（<div class="zp-answer">），
     且它与 seo_config.mjs 的 pageAnswers 逐字一致（两份真源不许漂移）

「答案段必须在正文之前」用结构边界判定（H1 之后、第一个 H2 之前），
不用固定字数：H1 与答案段之间常有「正式发布地址」引用块，字数窗口会被它挤掉。

用法：python scripts/check_geo_lint.py           # 有问题 exit 1
      python scripts/check_geo_lint.py --fix     # 只提示不报错
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 知识库文章与使用指南都属于「长文」范畴，门禁一视同仁
ARTICLE_DIRS = ['knowledge', 'guides']

# 顶层落地页：购买意图与品牌主场，答案胶囊的价值最高，改动频率也最低。
# 这些页的胶囊是 HTML div（页面要样式），md 镜像里是引用块，
# 两份真源由 scripts/seo_config.mjs 的 pageAnswers 统一维护，门禁盯着它们不许漂移。
TOP_PAGES = [
    'index.md', 'pricing.md', 'collect.md', 'erchuang.md', 'publish.md',
    'screenshots.md', 'feature.md', 'get-started.md', 'online-demo.md', 'contact.md', 'about.md',
]

# 顶层页的 frontmatter 没有 keywords 字段（词表在 seo_config.mjs 里），
# 所以关键词条数不适用于它们，只查 title / description。
TOP_PAGES_SKIP_KEYWORDS = True

# 答案胶囊的两种形态：页面里是 HTML div，md 镜像里是引用块
CAPSULE_HTML_RE = re.compile(r'<p class="zp-answer__text">([\s\S]*?)</p>')
CAPSULE_MD_RE = re.compile(r'^>\s*\*\*一句话答案\*\*：(.+)$', re.M)

# 依赖上下文才读得懂的措辞：一句话答案必须自包含，出现这些就是不合格
CONTEXT_DEPENDENT = [
    '如上所述', '如前所述', '前文提到', '前文所述', '上面提到', '上面说过',
    '下面我们来看', '接下来我们', '综上所述', '如前文', '见下文', '如上表',
]

# 具体数字：阿拉伯数字。纯定性描述不可被引用为事实
DIGIT = re.compile(r'\d')

TITLE_MAX = 32
DESC_MAX = 110
BANNED_TITLE_WORDS = ['详解', '全解析', '一文读懂', '深度解析', '全面解析']


def article_files() -> list[Path]:
    """收集所有需要门禁的文章源文件（不含目录索引页）。"""
    out = []
    for d in ARTICLE_DIRS:
        base = ROOT / d
        if not base.is_dir():
            continue
        for p in sorted(base.glob('*.md')):
            # index.md 是目录索引页，不是一篇文章
            if p.stem == 'index':
                continue
            out.append(p)
    return out


def frontmatter(text: str) -> dict:
    if not text.startswith('---'):
        return {}
    end = text.find('\n---', 3)
    if end < 0:
        return {}
    out = {}
    for line in text[3:end].split('\n'):
        # Windows 检出是 CRLF，行尾会残留 \r，导致正则匹配失败
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$', re.sub(r'\r$', '', line))
        if m:
            out[m[1]] = m[2].strip().strip('"').strip("'")
    return out


def config_answers() -> dict[str, str]:
    """读 scripts/seo_config.mjs 里的 pageAnswers。

    这份是答案胶囊的第二真源（第一真源是页面源文件本身）。
    两个真源必须逐字一致，否则 AI 读到的答案会前后矛盾。
    解析用正则而不是 import：脚本是 .mjs，Python 侧没有对应的运行时。

    两种写法都要认：
      '': '答案……',              键值同行
      collect:                   键值分行
        '答案……',
    另外 heroAnswer / pricingAnswer 是变量引用，要跟着解析成字面量。
    """
    path = ROOT / 'scripts' / 'seo_config.mjs'
    if not path.is_file():
        return {}
    text = path.read_text(encoding='utf-8')

    # 先取页面里用到的顶层常量：heroAnswer / pricingAnswer
    consts: dict[str, str] = {}
    for name in ('heroAnswer', 'pricingAnswer', 'faqAnswer'):
        m = re.search(rf"export const {name} =\s*\n?\s*'([^']*)'", text)
        if m:
            consts[name] = m.group(1)

    block = re.search(r'export const pageAnswers = \{(.*?)\n\}', text, re.S)
    if not block:
        return {}
    body = block.group(1)

    out: dict[str, str] = {}
    # 逐个键解析：键后面要么同行跟字符串，要么换行后跟字符串。
    # 键名有的是 JS 标识符（不带引号，如 collect:），有的是字符串键（''、'get-started':）。
    pattern = re.compile(
        r"^\s*'([^']*)':\s*(?:'([^']*)'|(heroAnswer|pricingAnswer|faqAnswer))\s*,?\s*$"
        r"|^\s*([A-Za-z][A-Za-z0-9]*):\s*(?:'([^']*)'|(heroAnswer|pricingAnswer|faqAnswer))\s*,?\s*$",
        re.M | re.S,
    )
    for m in pattern.finditer(body):
        key = m.group(1) if m.group(1) is not None else m.group(4)
        literal = m.group(2) if m.group(2) is not None else m.group(5)
        name = m.group(3) if m.group(3) is not None else m.group(6)
        if literal is not None:
            out[key] = literal
        elif name in consts:
            out[key] = consts[name]
    return out


def check_top_pages(problems: list[str], warnings: list[str]) -> int:
    """顶层落地页的门禁：答案胶囊必须在，且与 seo_config 逐字一致。"""
    cfg = config_answers()
    checked = 0
    for rel in TOP_PAGES:
        p = ROOT / rel
        if not p.is_file():
            problems.append(f'{rel}: 顶层页面不存在')
            continue
        md = p.read_text(encoding='utf-8')
        fm = frontmatter(md)
        checked += 1

        # --- SEO 元信息（顶层页没有 keywords 字段，词表在 seo_config 里）---
        title = fm.get('title', '')
        desc = fm.get('description', '')
        if not title:
            problems.append(f'{rel}: frontmatter 缺 title')
        if not desc:
            problems.append(f'{rel}: frontmatter 缺 description')
        if title and len(title) > TITLE_MAX:
            problems.append(f'{rel}: title {len(title)} 字，超出 {TITLE_MAX}（{title}）')
        if desc and len(desc) > DESC_MAX:
            problems.append(f'{rel}: description {len(desc)} 字，超出 {DESC_MAX}')
        for w in BANNED_TITLE_WORDS:
            if title and w in title:
                problems.append(f'{rel}: title 含规范禁用词「{w}」（{title}）')

        # --- GEO 写法：页面里必须带答案胶囊 ---
        m = CAPSULE_HTML_RE.search(md)
        if not m:
            problems.append(f'{rel}: 缺答案胶囊 <div class="zp-answer">，'
                            f'AI 读到的页面没有结论')
            continue
        answer = m.group(1).strip()

        for bad in CONTEXT_DEPENDENT:
            if bad in answer:
                problems.append(f'{rel}: 一句话答案含依赖上下文的措辞「{bad}」—— AI 无法独立引用该段')
        if not DIGIT.search(answer):
            warnings.append(f'{rel}: 一句话答案没有具体数字。'
                            f'涉数字的问题（条数、时长、版本、配额）应把数字写进答案段')

        # --- 与 seo_config.mjs 的真源对齐 ---
        route = '' if rel == 'index.md' else rel[:-3]
        if cfg:
            want = cfg.get(route)
            if want is None:
                problems.append(f'{rel}: seo_config.mjs 的 pageAnswers 里没有这一页')
            elif want != answer:
                problems.append(f'{rel}: 页面答案与 seo_config.mjs 的 pageAnswers 不一致\n'
                                f'    页面: {answer}\n'
                                f'    配置: {want}')
    return checked


def main() -> int:
    files = article_files()
    if not files:
        print('[geo] 没找到任何文章，先检查目录结构', file=sys.stderr)
        return 1

    problems: list[str] = []
    warnings: list[str] = []

    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        md = p.read_text(encoding='utf-8')
        fm = frontmatter(md)

        # --- SEO 元信息 ---
        title = fm.get('title', '')
        desc = fm.get('description', '')
        if not title:
            problems.append(f'{rel}: frontmatter 缺 title')
        if not desc:
            problems.append(f'{rel}: frontmatter 缺 description')
        if title and len(title) > TITLE_MAX:
            problems.append(f'{rel}: title {len(title)} 字，超出 {TITLE_MAX}（{title}）')
        if desc and len(desc) > DESC_MAX:
            problems.append(f'{rel}: description {len(desc)} 字，超出 {DESC_MAX}')
        for w in BANNED_TITLE_WORDS:
            if title and w in title:
                problems.append(f'{rel}: title 含规范禁用词「{w}」（{title}）')
        kw = [x.strip() for x in fm.get('keywords', '').split(',') if x.strip()]
        if len(kw) < 3:
            problems.append(f'{rel}: keywords 只有 {len(kw)} 个，per-page keywords 会过薄（至少 3 个）')

        # --- GEO 写法 ---
        h1 = re.search(r'^# (.+)$', md, re.M)
        if not h1:
            problems.append(f'{rel}: 没有 H1')
            continue
        if title and h1.group(1).strip() != title:
            problems.append(f'{rel}: H1 与 frontmatter title 不一致\n'
                            f'    H1:  {h1.group(1).strip()}\n'
                            f'    title: {title}')

        after = md[h1.end():]
        # 窗口取「H1 之后到第一个 H2 之前」这一段，而不是固定字数。
        # 固定字数会被 H1 与答案段之间的引用块挤掉，于是正则只匹配到半句答案。
        h2 = re.search(r'^## .+$', after, re.M)
        window = after[: h2.start()] if h2 else after[:600]
        m = re.search(r'^>\s*\*\*一句话答案\*\*：(.+)$', window, re.M)
        if not m:
            problems.append(f'{rel}: H1 之后、第一个 H2 之前没有「> **一句话答案**：」段')
        else:
            answer = m.group(1).strip()
            for bad in CONTEXT_DEPENDENT:
                if bad in answer:
                    problems.append(f'{rel}: 一句话答案含依赖上下文的措辞「{bad}」—— AI 无法独立引用该段')
            if not DIGIT.search(answer):
                warnings.append(f'{rel}: 一句话答案没有具体数字。'
                                f'涉数字的问题（条数、时长、版本、配额）应把数字写进答案段')

        if not re.search(r'^## .+$', md, re.M):
            problems.append(f'{rel}: 正文没有 H2，段落无法被 AI 定位')

    top_checked = check_top_pages(problems, warnings)

    if warnings:
        print(f'[geo] {len(warnings)} 条提醒（不拦构建）：')
        for w in warnings:
            print('    · ' + w)

    if problems:
        if '--fix' in sys.argv:
            print(f'[geo] {len(problems)} 项待修（--fix 模式不报错）：')
            for p in problems:
                print('    - ' + p)
            return 0
        print(f'[geo] {len(problems)} 项未通过：', file=sys.stderr)
        for p in problems:
            print('    - ' + p, file=sys.stderr)
        return 1

    print(f'[geo] {len(files)} 篇文章 + {top_checked} 个顶层页面通过 GEO 写法门禁'
          f'（H1 后、首个 H2 前有自包含的一句话答案 / 答案不含依赖上下文的措辞 / '
          f'正文有 H2 分层 / title ≤ {TITLE_MAX} 字 / description ≤ {DESC_MAX} 字 / keywords ≥ 3 / '
          f'顶层页面答案与 seo_config.mjs 逐字一致）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
