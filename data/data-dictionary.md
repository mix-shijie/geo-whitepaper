# 聚合统计数据字典 · v1.0

机器入口为 [observations.json](observations.json)。日期为北京时间（UTC+8）。计数字段为非负整数。不同采集场景各有自己的分母。品牌按审核显示名记录。

统计的是 AI 回答中的出现情况，不代表产品质量、企业规模或市场份额。

## industry_web · 行业网页基线

- `date_beijing`、`technical_basis`：采集日期、网络和入口条件。
- `answers`、`questions`：有效回答条数、独立题号数。
- `citations`：四家可见引用条数之和。同一出处跨回答出现可重复。
- `brand_count`：出现过的品牌实体数。`brand_mentions`：按回答内品牌去重，再跨回答累加。
- `branded_answers`：出现至少一个品牌的回答数。`top5_covered`：出现至少一个提及次数前五品牌的回答数。前五覆盖率 = 后者除以前者。
- `top5_mentions`：提及次数前五品牌的提及总量。份额以 `brand_mentions` 为分母。
- `selected_brands[]`：按提及次数排列的前六个品牌。`label` 为审核显示名，`mentions` 为提及条数，`first` 为正文首位提及次数。
- `source_entries`：以平台为键，`category` 是该平台内部的引用占比相对其余三家平均占比高出最多的类别（排除“其他”），`count` 是该平台该类引用条数，`category_total` 是该类在四个平台的合计。
- `overlap`：以题号为键，`kind` 为题型，`platforms` 按豆包、元宝、千问、DeepSeek 顺序排列。同一平台取三轮两两 Jaccard 的均值，先保留两位小数，再汇成 `mean`。两集合同时为空按 1。Q11 正文显示值 0.72。
- `qwen_localized`、`qwen_answers`：千问按境外位置改写条数及其全平台内分母。
- `q17`：素板报价的 `sheet` 为共同张幅，`platforms` 为平台数，`e1_or_e2_platforms` 为样本中至少报过一个 E1 或 E2 素板价条目的平台数。`e1_only_platforms` 统计单列 E1 素板报价、未列 E2 的平台数，`e1_and_e2_platforms` 统计同一条目同时列 E1、E2 的平台数。`m3_per_sheet` 为 18 mm 厚情况下单张体积（m³）。

来源为白皮书 S1、S2、S5。时间、模式和判定规则见第 2 章。

## domestic_app · 国内 App 对照

- `date_beijing`、`date_note`、`technical_basis`：记录日期、分享日差异与网络入口。
- `answers`：能匹配题号且有实质正文的回答数，保留有效重复轮。
- `cities`：按城市分别归并别名。`distinct` 为本地名单含商家及市场的去重总数，`two_or_more` 为至少由两个不同平台点到的名字数，`one_only` 为只由一个平台点到的数。
- `qwen_dalian_map_reviews`：千问大连组地图与点评来源计数。
- `price_answers`：两道国内价格题四平台首答总数 `total`、给出 4×8 尺的条数 `stated_4x8`、只给厚度的条数 `thickness_only`。

来源为 S1、S3。名单统计保留可识别的各门店与市场的独立身份，公开包只保留城市层汇总。

## mix_zero · MIX 发布前自测

- `date_beijing`、`technical_basis`：采集日和网络入口条件。
- `questions`、`rounds_planned`、`planned`：计划题目数、每题每平台计划轮数、计划总回答数。
- `answers`、`platform_counts`：实采数和各平台实采数。
- `generic_hits`、`generic_answers`：泛问命中条数与实采泛问分母。
- `named_recognized`、`named_answers`：点名题正确识别主体条数与实采点名题分母。

来源为 S1、S4。未采到的回答不计入命中率分母。

## 公共字段

`version` 为数据版号。`brand_notice` 为品牌出现统计的解释边界。公开包按 CC BY 4.0 授权。采集口径与证据索引见[正文](../whitepaper.md)。
