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

    print(f'[geo] {len(files)} 篇文章通过 GEO 写法门禁'
          f'（H1 后、首个 H2 前有自包含的一句话答案 / 答案不含依赖上下文的措辞 / '
          f'正文有 H2 分层 / title ≤ {TITLE_MAX} 字 / description ≤ {DESC_MAX} 字 / keywords ≥ 3）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
