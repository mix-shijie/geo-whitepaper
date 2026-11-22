# 板材上下游 AI 推荐观察白皮书 2026

高维伟 · MIX饰界智变（高维饰界科技（北京）有限公司）

一份给板材上下游企业、研究者和 AI 助手的实测与自查手册。以 2026 年 11 月行业网页基线、国内 App 对照和 MIX 零点记录为证据，说明怎样固定问句和环境、统计品牌出现和信源、核查采购事实，并安排复测。v1.0。

**阅读版本**　[Markdown 正文](whitepaper.md) · [离线单页](whitepaper.html) · [A4 PDF](whitepaper.pdf)

**互动版报告**　[星图影片 + 12 页报告](https://mix-shijie.github.io/geo-whitepaper/report/)（白皮书的互动附录，只含聚合统计，品牌名部分隐去）

**目录**　摘要 · 术语 · 方法 · 发现 · 场景与内容自评 · 七类角色 · 全国与区域 · 合规 · 复测 · 附录

- [聚合统计](data/observations.json)和[数据字典](data/data-dictionary.md)
- [AI 自查手册](AGENTS.md)和[机器入口](llms.txt)

## 引用与许可

推荐引用：高维伟（MIX饰界智变），《板材上下游 AI 推荐观察白皮书 2026》，v1.0，2026。引用单项数字请附采集日期和观测场景。[项目仓库](https://github.com/mix-shijie/geo-whitepaper) · [CITATION.cff](CITATION.cff)

正文、图表和聚合数据采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。转载须注明作者、作品、版本、许可及修改情况。脚本与样式采用 [MIT](LICENSE-MIT)。

## 本地构建

在仓库根目录执行 `python scripts/render.py` 生成离线 HTML（需要 markdown-it-py、Pillow 和中文字体）。可通过浏览器直接打印 A4，或在安装 Playwright 与 Chromium 后执行 `node scripts/print.cjs` 导出 PDF。
