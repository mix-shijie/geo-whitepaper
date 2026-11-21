"""Build the self-contained reader and three distribution charts."""
import argparse
import base64
from io import BytesIO
import os
import html
import json
from pathlib import Path

from markdown_it import MarkdownIt
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'data/observations.json').read_text(encoding='utf-8'))
system_fonts = Path(os.environ.get('WINDIR', '/usr/share/fonts/opentype/noto'))
FONT = os.environ.get('WHITEPAPER_FONT', str(system_fonts / ('Fonts/msyh.ttc' if os.name == 'nt' else 'NotoSansCJK-Regular.ttc')))
BOLD = os.environ.get('WHITEPAPER_BOLD_FONT', str(system_fonts / ('Fonts/msyhbd.ttc' if os.name == 'nt' else 'NotoSansCJK-Bold.ttc')))
INK = '#1d2126'
GOLD = '#a97529'
GRAY = '#4a5059'
TRACK = '#eee5d7'


def font(size, *, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def chart(number, title, subtitle, rows, source, notice=None):
    width = 1200
    height = 284 + 74 * len(rows) + (42 if notice else 0)
    picture = Image.new('RGB', (width, height), '#fbf6ec')
    draw = ImageDraw.Draw(picture)
    draw.rectangle((0, 0, width, 9), fill=GOLD)
    draw.text((55, 43), f'MIX饰界智变  /  图 {number}', font=font(26, bold=True), fill=GOLD)
    draw.text((55, 94), title, font=font(45, bold=True), fill=INK)
    draw.text((55, 160), subtitle, font=font(26), fill=GRAY)
    for i, (label, value, full, display) in enumerate(rows):
        y = 222 + 74 * i
        draw.text((55, y + 4), label, font=font(27, bold=True), fill=INK)
        draw.rounded_rectangle((362, y + 10, 937, y + 40), radius=15, fill=TRACK)
        if value:
            draw.rounded_rectangle((362, y + 10, 362 + 575 * value / full, y + 40), radius=15, fill=GOLD)
        draw.text((971, y - 1), display, font=font(33, bold=True), fill=INK)
    footer = 229 + 74 * len(rows)
    draw.line((55, footer, 1145, footer), fill='#d4c1a3', width=2)
    draw.text((55, footer + 15), source, font=font(22), fill=GRAY)
    if notice:
        draw.text((55, footer + 45), notice, font=font(22), fill=GRAY)
    buffer = BytesIO()
    picture.save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()


def charts():
    us = DATA['industry_web']
    domestic = DATA['domestic_app']
    coverage = us['top5_covered'] / us['branded_answers']
    share = us['top5_mentions'] / us['brand_mentions']
    coverage_chart = chart(
        1, '两个分母，两种集中度', '前五按提及次数选定。长条使用各自的分母。',
        [('含品牌回答的覆盖率', coverage, 1, f'{coverage:.0%}'),
         ('全部品牌提及的份额', share, 1, f'{share:.0%}')],
        f"星图数据核对 v3  |  覆盖 {us['top5_covered']}/{us['branded_answers']}  ·  份额 {us['top5_mentions']}/{us['brand_mentions']}",
        DATA['brand_notice'],
    )
    sources = [(f"{platform} · {row['category']}", row['count'], 160, str(row['count']))
               for platform, row in us['source_entries'].items()]
    sources_chart = chart(2, '四个平台，四个来源切片', '横条按引用条数统一尺度。每家只展示所列类别。',
          sources, f"星图数据核对 v3  |  行业网页基线四家合计 {us['citations']:,} 条引用")
    cities = [(city, row['two_or_more'], row['distinct'],
               f"{row['two_or_more']}/{row['distinct']}")
              for city, row in domestic['cities'].items()]
    cities_chart = chart(3, '哪些名字被多家平台点到？', '长条表示至少被两个平台报到的本地名单占比。',
          cities, '星图数据核对 v3 与国内 App 对照  |  同城去重，含商家和市场')

    return [coverage_chart, sources_chart, cities_chart]


def render(figures):
    md = MarkdownIt('commonmark', {'html': False}).enable('table')
    content = (ROOT / 'whitepaper.md').read_text(encoding='utf-8')
    tokens = md.parse(content)
    headings = []
    for i, token in enumerate(tokens):
        if token.type != 'heading_open':
            continue
        label = tokens[i + 1].content
        if token.tag in {'h2', 'h3'}:
            number = label.split(' ', 1)[0].strip('.').replace('.', '-')
            ident = f'chapter-{number}'
            token.attrSet('id', ident)
            if token.tag == 'h2':
                headings.append((ident, label))
    first_chapter = next(i for i, token in enumerate(tokens) if token.tag == 'h2')
    cover = md.renderer.render(tokens[:first_chapter], md.options, {})
    cover = cover.replace('推荐观察白皮书 2026', '推荐观察<wbr><span class="title-edition">白皮书 2026</span>', 1)
    body = md.renderer.render(tokens[first_chapter:], md.options, {})
    for figure, section, description in [
        (1, '3-2', '含品牌回答的前五覆盖率 82%，全部品牌提及的前五份额 37%。'),
        (2, '3-4', '引用条数：豆包抖音 146，元宝公众号 38，千问聚合页 104，DeepSeek 知乎 57。'),
        (3, '3-6', '至少两个平台提及的名字：大连 10/49，西安 9/75。'),
    ]:
        png = figures[figure - 1]
        encoded = base64.b64encode(png).decode('ascii')
        marker = f'<h3 id="chapter-{section}">'
        figure_html = f'<figure><img alt="{html.escape(description)}" src="data:image/png;base64,{encoded}"></figure>'
        body = body.replace(marker, figure_html + marker, 1)
    navigation = ''.join(f'<a href="#{ident}">{html.escape(label)}</a>' for ident, label in headings)
    css = (ROOT / 'scripts/style.css').read_text(encoding='utf-8')
    page = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="author" content="高维伟 · MIX饰界智变">
<meta name="description" content="板材上下游企业的 GEO 实测统计、事实自查方法和可复测问句库。">
<title>板材上下游 AI 推荐观察白皮书 2026</title>
<style>{css}</style>
</head>
<body>
<header class="mast"><a href="#top">MIX饰界智变</a><a href="#contents">目录</a></header>
<div class="sheet" id="top">
  <div class="cover">
    <div class="hero">{cover}</div>
    <nav aria-label="白皮书目录" id="contents"><h2>目录</h2><div class="links">{navigation}</div></nav>
  </div>
  <main>{body}</main>
</div>
</body>
</html>
"""
    (ROOT / 'whitepaper.html').write_text(page, encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--charts', type=Path, help='Also save the three charts to this directory.')
    args = parser.parse_args()
    figures = charts()
    if args.charts:
        args.charts.mkdir(parents=True, exist_ok=True)
        for number, png in enumerate(figures, start=1):
            (args.charts / f'figure-{number}.png').write_bytes(png)
    render(figures)
