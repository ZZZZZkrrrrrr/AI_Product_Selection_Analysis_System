# AI 选品分析系统方案迭代

## 迭代 01：从单品报告升级为“商品情报决策系统”

时间：2026-05-23 02:40（Asia/Shanghai）

### 当前实现状态

- n8n 工作流已可通过 Webhook 执行，最近一次执行成功，执行 ID 为 `8`。
- 最新 HTML 报告已包含选品推荐指数、数据透视、机会位置矩阵和移动端适配。
- 当前数据链路是：单个 Amazon 商品 URL -> Crawlee + Playwright -> 阿里百炼 `qwen-turbo` -> HTML + CSV。
- 当前系统边界：免费本地抓取会偶发遇到 Amazon `Continue shopping` 或验证码页；已补充识别逻辑，但还没有稳定代理、历史价格、关键词需求、广告和官方卖家数据。

### 市场先进系统对标

1. Helium 10 的 Listing Builder 已经把关键词发现、关键词库管理、AI Listing 生成放进一个闭环，并结合 ASIN、图片、品牌语气、Rufus 客户洞察做 Listing 优化。
2. Jungle Scout 把能力分为产品级运营工具和市场级情报工具，后者强调全市场基准、自动竞品跟踪、Buy Box 监控、Share of Voice、广告自动化和高管看板。
3. SmartScout 的优势是把品牌、卖家、产品、关键词和广告连成图谱，还提供 Traffic Graph、Ad Spy、Keyword Detective、AI Listing Architect。
4. DataHawk 更像数据仓库/BI 层，把 Amazon、Walmart、Seller Central、Vendor Central、Advertising 数据结构化后交付到 Snowflake、BigQuery、Databricks。
5. Agellic 代表一个新趋势：用自然语言驱动 Keepa 查询，把 BSR、价格、Buy Box、库存、卖家竞争等复杂筛选转成可复跑的搜索和产品列表。
6. Amazon 官方 SP-API、Ads API 是企业级稳定数据源：SP-API覆盖 Catalog Items、Listings、Pricing、Fees 等；Ads API 支持广告活动、报告、预算和竞价自动化。

### 本轮判断

当前系统已经完成“单品 AI 报告”的 MVP，但离先进系统还有三个关键差距：

- 数据维度不足：缺历史价格/BSR、关键词搜索量、竞品集合、Buy Box、广告位置、利润/FBA 费用。
- 决策模型不足：现在评分主要基于价格、评分、评论和抓取完整度，缺少需求强度、竞争强度、利润空间、差评风险、合规风险、供应链风险。
- 工作流闭环不足：还没有批量输入、周期监控、异常重试、机会列表、看板和可追踪的行动建议。

### 下一版 SOP 骨架

1. 输入层：单品 URL、ASIN 列表、关键词、类目、竞品 ASIN、CSV 批量任务。
2. 数据层：本地 Crawlee 页面抓取、SP-API 官方字段、Keepa 历史价格/BSR、Amazon Ads 报告、评论/QA 文本、FBA 费用和体积重量。
3. 清洗层：反爬状态判断、字段可信度、历史数据补齐、ASIN 去重、站点/币种/时区标准化。
4. AI 分析层：商品定位、评论痛点、竞品差异、关键词覆盖、Listing 改写、风险和机会解释。
5. 评分层：需求、竞争、利润、口碑、稳定性、合规、运营复杂度，输出总分和分项证据。
6. 可视化层：单品报告、竞品对比表、机会矩阵、价格/BSR 趋势、关键词漏斗、行动清单。
7. 自动化层：Webhook 触发、批量队列、失败重试、每日/每周监控、历史快照和 CSV/数据库备份。
8. 运维层：API 成本预算、抓取频率限制、凭据加密、日志、报告归档、数据来源标注。

### 下一轮要验证的问题

- 免费抓取 + 官方 API + Keepa 的混合数据架构，哪个字段作为主来源、哪个字段作为补充来源。
- 评分模型是否先采用可解释规则，后续再引入机器学习/LLM 评分。
- 批量分析的最小闭环：CSV 输入、Split in Batches、报告总览看板、失败重试。

### 来源

- Amazon SP-API reference: https://developer-docs.amazon.com/sp-api/lang-en_US/reference/welcome-to-api-references
- Amazon Ads API: https://advertising.amazon.com/en-gb/about-api
- Helium 10 Listing Builder AI: https://kb.helium10.com/hc/en-us/articles/4407213995419-Listing-Builder-Keyword-Research-Revamped-AI-Listing-Generation
- Jungle Scout platform overview: https://support.junglescout.com/hc/en-us/articles/26234503954967-What-is-Jungle-Scout-Amazon-Growth-Tools-and-Market-Intelligence-for-Brands-Agencies-and-Sellers
- SmartScout features: https://www.smartscout.com/features
- DataHawk overview: https://docs.datahawk.co/DataHawk-Overview-1cb4aa5f57fa800d97f9f09fb85cd498
- Agellic / Keepa AI workflow: https://www.agellic.com/
- Amazon sales-rank factor study: https://arxiv.org/abs/2411.04305

## 迭代 02：确立“官方数据优先 + 历史趋势补强 + AI 决策解释”的架构

时间：2026-05-23 02:46（Asia/Shanghai）

### 当前实现状态

- 最新 HTML 报告仍存在，包含选品推荐指数、机会位置矩阵和移动端适配。
- 最新 CSV 已追加到 5 行，最近一条为 ASIN `B0BQXZ11B8`，商品标题为 Sony DualSense Wireless Controller Grey Camo。
- n8n 最近一次相关执行为 Webhook 模式，执行 ID `8`，状态为成功。
- 当前系统仍处在“单品 URL 初筛”阶段，还没有批量队列、历史趋势和官方 Seller/Brand/Ads 数据接入。

### 新增市场依据

1. Amazon Product Opportunity Explorer 是官方选品工具，核心不是单品页抓取，而是按 customer need / niche 聚合搜索词、购买行为、竞争定价、评论、退货和产品特征。
2. Amazon Brand Analytics 官方提供 Search Catalog Performance、Search Query Performance、Top Search Terms、Market Basket Analysis 等看板；其中 SQP 能看到 query volume、impressions、clicks、cart adds、purchases，用于判断关键词需求和转化漏斗。
3. SP-API Reports 已支持 Brand Analytics 的 Search Catalog Performance 和 Search Query Performance 报告，输出 JSON，但要求 Brand Analytics 角色和 Brand Registry。
4. Manage Your Experiments 是官方 Listing A/B 测试闭环，能测试 title、main image、bullet points、description、A+ Content；这说明 Listing 优化不能只靠 AI 文案，最终要有实验验证。
5. Keepa 代表第三方历史趋势能力，覆盖当前与历史价格、offer、FBA/FBM、Warehouse、eBay 等数据；适合补足官方接口之外的 BSR/价格/Buy Box 趋势。
6. 广告排序研究显示 Sponsored results 会显著改变 Amazon 搜索页竞争格局，因此选品系统不能只看自然排名和评论数，必须把广告密度、赞助位质量和广告成本作为竞争强度。
7. AmazonQA 研究证明评论和问答可以做 Review-based QA，这支持把“评论痛点问答库”加入 AI 选品判断，而不是只做摘要。

### 本轮方案判断

最优系统不应该把 Crawlee 页面抓取当作唯一主数据源。更稳的架构是三层数据源：

1. 官方主源：SP-API、Brand Analytics、Ads API、Seller/Vendor 报告。用于销售、搜索、广告、转化、费用、库存、Buy Box 等高可信字段。
2. 趋势补强：Keepa 或同类历史数据。用于价格、BSR、优惠、卖家数、Buy Box、季节性和波动性。
3. 页面辅助：Crawlee + Playwright。用于免费 MVP、页面可见字段、图片、五点、详情页文案、反爬状态和人工复核。

因此评分模型应从“页面字段评分”升级为“证据权重评分”：

- 需求强度：关键词搜索量、SQP impressions、BSR 趋势、类目增长。
- 竞争强度：评论数、评分分布、头部 ASIN 集中度、广告密度、赞助位质量、卖家数。
- 利润空间：售价、FBA/Referral Fee、体积重量、采购成本、退货率、广告 ACOS/TACOS。
- Listing 机会：标题覆盖、五点覆盖、图片质量、A+ 内容、关键词缺口、评论痛点未被满足。
- 口碑风险：差评主题、QA 高频疑问、退货原因、质量/安全/合规风险。
- 运营复杂度：季节性、库存周转、物流限制、变体复杂度、售后风险。
- 数据可信度：官方字段数量、历史数据完整度、抓取是否命中验证码、字段缺失率。

### 可执行优化点

1. 报告中新增“数据来源可信度”模块，明确每个结论来自页面抓取、官方 API、历史趋势、AI 推断还是人工输入。
2. CSV schema 升级为宽表 + JSON 证据字段，避免后续扩展 Keepa/SP-API 时反复改列。
3. 评分模型先用可解释规则，不急于训练模型；每个分数必须能追溯到字段和阈值。
4. 把“Listing 优化建议”拆成两层：AI 建议稿和实验假设，后续对接 Manage Your Experiments 或人工 A/B 测试。
5. 批量阶段不要直接高频抓 Amazon 页面，优先用 ASIN 列表 + 低频抓取 + 缓存 + 失败重试。

### 风险

- SP-API、Brand Analytics、Ads API 都需要账号、权限和合规审核，不适合作为立即可用的免费默认能力。
- Keepa 等历史数据通常需要付费或 token，成本模型必须提前设计。
- 官方数据多为卖家自己品牌/账号范围，不一定能拿到全市场竞品完整数据。
- 页面抓取存在反爬、验证码、地区化和 ToS 风险，只能作为低频辅助能力。
- LLM 生成建议容易过度自信，报告必须区分“事实、推断、建议、待验证假设”。

### 下一轮要验证的问题

- 最小可实现版本是否采用“Crawlee + 可选 Keepa + 手工成本字段”的混合方案，先不接 SP-API。
- 报告可视化是否应升级为“决策看板”：总分、分项雷达、证据卡、竞品表、关键词漏斗、行动清单。
- 批量分析的标准输入格式：只用 `product_url`，还是同时支持 `asin`、`marketplace`、`target_cost`、`target_price`、`category`。
- 是否需要把 n8n 的最终输出从 CSV 逐步迁移到 SQLite，CSV 只作为导出备份。

### SOP 增量

1. 数据采集：默认低频 Crawlee 单品抓取；可选 Keepa 历史趋势；企业版接入 SP-API、Brand Analytics、Ads API。
2. 反爬边界：识别 Continue Shopping、Captcha、空标题、价格缺失、区域跳转；命中后降级为“抓取失败/需人工复核”，不让 AI 编造。
3. AI 分析：所有 AI 输出都附带证据字段，缺数据必须写“暂无数据”，不能把页面文本之外的信息当事实。
4. 评分模型：采用需求、竞争、利润、Listing、口碑、运营、可信度 7 个分项；先规则化，后续再用历史结果校准权重。
5. 报告可视化：第一屏只呈现结论、分数、关键风险和下一步动作；详情区再展示证据和原始字段。
6. 批量处理：CSV 输入 -> 去重 -> 队列 -> 单品报告 -> 总览看板 -> 异常清单。
7. 监控自动化：对进入候选池的 ASIN 做每周价格/评分/评论/BSR/Buy Box 快照，异常波动触发复查。
8. 成本控制：每次任务记录抓取次数、AI token、外部 API token、失败重试次数；超过预算暂停。
9. 合规和运维：凭据本地加密，来源标注，尊重 API 权限和站点限制，保留执行日志和报告历史。

### 来源

- Amazon Product Opportunity Explorer: https://sell.amazon.com/tools/product-opportunity-explorer/
- Amazon Brand Analytics: https://sell.amazon.com/tools/amazon-brand-analytics
- SP-API Analytics Reports: https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/report-type-values-analytics
- AWS Prescriptive Guidance for SP-API data: https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-gen-ai-selling-partner-api/data-sp-api.html
- Amazon Manage Your Experiments one-pager: https://m.media-amazon.com/images/G/01/BX_Marketing/2023/MYE_1-Pager_-_V6b-3-10-2023.pdf
- Keepa official price tracker: https://keepa.com/
- Keepa API overview: https://findapis.com/api/keepa
- Sponsored results research: https://arxiv.org/abs/2407.19099
- AmazonQA review-based QA research: https://arxiv.org/abs/1908.04364

## 迭代 03：收敛为可实现的 V1.0 最优方案

时间：2026-05-23 02:52（Asia/Shanghai）

### 当前实现状态

- 最新 HTML 报告稳定存在，仍包含选品推荐指数和机会位置矩阵。
- 最新报告尚未展示独立的“数据来源可信度”模块，这是实现阶段的第一优先级。
- n8n 最近一次执行仍为 Webhook 成功，执行 ID `8`。
- 当前 SOP 文档已完成 3 轮方案迭代，具备进入设计实现阶段的依据。

### 本轮新增依据

1. Amazon Product Opportunity Explorer 的官方逻辑证明，先进选品不是只看单个 Listing，而是围绕 niche/customer need 聚合搜索词、购买行为、竞争价格、评论、退货和产品特征。
2. Amazon Brand Analytics 明确提供 Search Query Performance、Top Search Terms、Market Basket Analysis 等数据；SQP 包含 query volume、impressions、clicks、cart adds、purchases，可直接构成需求和转化漏斗。
3. SP-API Analytics Reports 可请求 `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT`，输出 JSON，字段包括 searchQueryVolume、impression share、click share、cart add share、purchase share。
4. Amazon Revenue Calculator 和 Product Fees API 都说明利润判断必须纳入 referral/FBA/fulfillment 成本，但 Product Fees API 也明确提示估算费用不保证等于实际费用。
5. Amazon Ads API 官方定位是程序化广告管理、报表、自动竞价和关键词优化，因此广告数据应进入竞争强度和真实获客成本，而不是只作为后续营销模块。

### V1.0 最优方案

V1.0 不直接上完整企业级 SP-API/Ads API，因为权限、成本和审核会拖慢落地。最优实现路线是：

1. 保留当前 Crawlee + Playwright + 阿里百炼 + HTML/CSV 的免费闭环。
2. 新增“手工增强字段”，让用户在 n8n 输入或 CSV 中填写采购成本、目标售价、头程/尾程、目标市场、目标关键词、竞品 ASIN。
3. 预留 Keepa/SP-API/Ads API 接口位，但默认关闭；没有凭据时报告显示“未接入”，不影响主流程。
4. 把报告从“摘要型报告”升级为“选品决策看板”：第一屏只显示总分、结论、关键证据、关键风险和下一步动作。
5. 使用可解释评分模型，不让 LLM 直接决定总分；LLM 只负责摘要、评论痛点、Listing 建议、风险解释。
6. 输出一份单品 HTML 报告、一份批量总览 CSV/HTML、一份原始证据 JSON，保证后续可追溯。

### V1.0 数据模型

输入字段：

- `product_url`
- `asin`
- `marketplace`
- `target_keywords`
- `competitor_asins`
- `landed_cost`
- `target_price`
- `shipping_cost`
- `ad_budget_hint`
- `notes`

采集字段：

- 页面字段：title、brand、price、rating、reviews、availability、bullets、description、categories、images、raw_page_text。
- 手工字段：成本、目标售价、关键词、竞品、类目、供应链备注。
- 可选历史字段：price_30d/90d、bsr_30d/90d、buy_box_30d、seller_count、review_delta。
- 可选官方字段：SQP、Search Terms、Product Fees、Ads keyword/campaign report。

输出字段：

- `recommendation_score`
- `decision`
- `score_breakdown_json`
- `evidence_json`
- `risk_flags_json`
- `next_actions_json`
- `html_report`
- `csv_row_created_at`

### V1.0 评分权重

- 需求强度 20：搜索/类目/BSR/评论增速；没有外部数据时用评论数、类目和页面热度弱替代。
- 竞争强度 15：评论护城河、评分集中度、品牌强度、广告密度、竞品数量；分数越高代表竞争越可控。
- 利润空间 20：售价、成本、费用、配送、广告预算后的毛利率/ROI；缺成本时最多给中性分。
- Listing 机会 15：标题、五点、图片、A+、关键词覆盖、评论痛点是否可被改进。
- 口碑风险 10：低评分、差评主题、QA 疑问、质量/安全/合规风险。
- 运营复杂度 10：尺寸重量、季节性、售后、变体、库存周转和平台限制。
- 数据可信度 10：官方/历史/页面/手工字段覆盖率、反爬状态、字段缺失率。

结论阈值：

- 80-100：进入供应链和小批量验证。
- 65-79：进入下一轮评估，补齐成本、关键词和竞品数据。
- 50-64：暂缓，除非有明显供应链优势。
- 0-49：不建议推进或需要重新抓取/人工复核。

### 实现阶段优先级

1. 报告第一屏重构：结论、分数、关键证据、关键风险、下一步动作。
2. 增加数据来源可信度和证据 JSON。
3. 扩展输入字段，支持成本、目标关键词、竞品 ASIN。
4. 增加可解释评分函数，AI 只参与解释和建议。
5. CSV schema 升级，同时继续保留历史兼容。
6. 设计批量输入和总览看板。
7. 预留 Keepa/SP-API/Ads API 适配器，默认未配置时不报错。

### 主要风险和控制

- 抓取失败：识别反爬页面并降级为“数据不足”，不生成虚假建议。
- 成本误判：成本字段缺失时不输出强利润结论。
- API 权限：SP-API/Brand Analytics/Ads API 作为可选企业版，不阻塞 V1.0。
- AI 幻觉：所有建议必须绑定证据；报告明确区分事实、推断、建议、待验证。
- 过度复杂：先完成单品决策看板，再做批量和监控。

### 方案收敛判断

方案已经稳定，可以进入实现阶段。理由：

- 数据源分层已经明确：页面抓取为免费默认，手工字段补利润，历史/API 作为可选增强。
- SOP 已覆盖采集、反爬、AI、评分、可视化、批量、监控、成本、合规和运维。
- 评分模型可解释，能在没有付费 API 的情况下先落地，又能平滑扩展到 Keepa/SP-API/Ads API。
- 实现优先级清晰，不需要继续停留在方案研究。

### 来源

- Amazon Product Opportunity Explorer: https://sell.amazon.com/tools/product-opportunity-explorer/
- Amazon Brand Analytics: https://sell.amazon.com/tools/amazon-brand-analytics
- SP-API Analytics Reports: https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/report-type-values-analytics
- Amazon estimate fees and costs: https://sell.amazon.com/pricing/estimate
- SP-API Product Fees API: https://developer-docs.amazon.com/sp-api/lang-en_US/docs/product-fees-api
- Amazon Ads API: https://advertising.amazon.com/en-gb/about-api

## 实现迭代 01：V1.0 单品决策看板和结构化证据落地

时间：2026-05-23 03:12（Asia/Shanghai）

### 本次实现依据

- 按迭代 03 的 V1.0 方案，先增强现有免费闭环，不引入 SP-API、Keepa 或 Ads API 的强依赖。
- 第一优先级是让报告第一屏成为“选品决策看板”，并把 AI 建议和规则评分分开。
- 评分必须可解释，所有新增字段都要能追溯到页面抓取、手工输入、AI 输出或未接入数据源。

### 本次改动

1. 报告模板升级为“AI 选品决策看板”，第一屏展示总分、结论、关键证据、关键风险和下一步动作。
2. 新增 7 项可解释评分：需求强度、竞争可控、利润空间、Listing 机会、口碑风险、运营复杂度、数据可信度。
3. 新增结构化输出字段：`score_breakdown_json`、`evidence_json`、`risk_flags_json`、`next_actions_json`、`data_sources_json`。
4. 新增数据来源可信度模块：页面抓取、手工增强字段、Keepa、SP-API/Brand Analytics、Amazon Ads API。
5. n8n 输入节点扩展为 V1.0 字段：`marketplace`、`target_keywords`、`competitor_asins`、`landed_cost`、`target_price`、`shipping_cost`、`ad_budget_hint`、`notes`。
6. CSV 表头升级并兼容旧字段，新增评分、证据、风险、动作和手工增强字段。
7. 线上 n8n 工作流已同步新版报告节点和输入字段。

### 验证结果

- 本地语法检查通过。
- 本地预览渲染通过，最新 HTML 已包含决策看板、数据来源可信度和结构化证据 JSON。
- 线上 n8n webhook 端到端执行成功，最近成功执行 ID 为 `10`。
- webhook 入参已验证可进入报告：关键词、竞品 ASIN、成本、目标价和运费均写入 `evidence_json`。
- 最新报告分数为 `90`，结论为“进入供应链和小批量验证”，这是基于本次测试输入的成本和目标价计算结果。
- 桌面和 390px 移动端截图检查通过，未发现横向溢出。

### 本轮剩余风险

- 目前利润计算仍是简化毛利率，不包含 Amazon referral fee、FBA fee、退货率和广告 ACOS。
- 竞品 ASIN 目前只进入证据字段，还没有真实抓取竞品并生成对比表。
- 目标关键词目前只用于 Listing 机会评分，还没有搜索量、SQP 或广告表现数据。
- 当关键风险为空时，报告显示“暂无数据”，后续可以改成“暂未发现高优先级风险”。

### 下一轮实现建议

1. 增加“批量输入标准 CSV”和总览看板草案。
2. 把利润模型升级为：售价 - 采购成本 - 运费 - 平台费估算 - 广告预算。
3. 增加竞品 ASIN 表格结构，即使暂时不抓竞品，也先把输入、状态、缺口展示出来。
4. 增加可选适配器占位配置：Keepa、SP-API、Ads API 未配置时明确显示“未接入，不影响 V1.0”。

## 实现迭代 02：利润模型和竞品 ASIN 跟踪表

时间：2026-05-23 03:30（Asia/Shanghai）

### 本次实现依据

- 迭代 03 要求利润模型不能只看售价和采购成本，必须预留平台费、履约/FBA 费和广告成本。
- Amazon 费用估算和 Product Fees API 的官方说明表明，费用需要按类目、履约方式和账号条件估算；V1.0 不能把占位估算当成最终费用。
- 当前还没有接入竞品抓取，因此先把 `competitor_asins` 变成可视化跟踪表，为下一轮真实竞品对比做结构铺垫。

### 本次改动

1. 新增输入字段：`platform_fee_rate`、`platform_fee`、`fulfillment_fee`、`ad_cost_estimate`。
2. 利润模型升级为：售价 - 采购成本 - 运费 - 平台费估算 - 履约/FBA 费 - 广告预算。
3. 如果未输入 `platform_fee`，系统按 `platform_fee_rate` 估算；未填费率时默认使用占位费率，并在报告中标注“非官方最终费用”。
4. 报告新增“利润估算”表，展示售价、采购成本、物流运费、平台费估算、履约/FBA 费、广告预算和估算净利润。
5. 报告新增“竞品 ASIN 跟踪”表，展示竞品 ASIN、当前状态和下一步说明。
6. 风险与动作改为动态判断：净利率低于 15% 时提示“净利偏薄”和“复核利润”，不再误提示缺成本。
7. CSV schema 追加费用字段，并保持旧字段兼容。

### 验证结果

- 本地语法检查通过。
- 本地模拟验证通过：输入成本、平台费率、履约费、广告成本后，利润分项显示估算净利率 `9.1%`。
- 线上 n8n 已同步新版，最近成功执行 ID 为 `13`。
- 最新报告分数为 `79`，结论为“进入下一轮评估”。
- 最新报告包含“利润估算”“竞品 ASIN 跟踪”“净利偏薄”和竞品 ASIN `B08FC6C75Y`。
- CSV 表头已包含 `platform_fee_rate`、`fulfillment_fee`、`ad_cost_estimate`，最后一行包含本次净利偏薄风险。
- 桌面和 390px 移动端截图检查通过，无横向页面溢出。

### 本轮剩余风险

- 平台费率仍是占位估算，不是 SP-API Product Fees API 的官方费用结果。
- 竞品 ASIN 目前只是记录和展示，还没有逐个抓取竞品详情。
- 广告成本仍是用户输入的估算值，未接入 Ads API 或真实投放结果。
- 净利率阈值当前固定为 15%，后续应按类目、客单价和运营策略调整。

### 下一轮实现建议

1. 实现竞品 ASIN 批量抓取的最小版本：按输入 ASIN 生成 Amazon URL，低频调用现有 crawler，输出竞品价格、评分、评论对比表。
2. 或先做批量输入总览看板：读取 CSV 多个商品链接，输出总分排序、风险排序和异常清单。
3. 增加适配器配置状态对象：Keepa、SP-API、Ads API 未配置时统一返回“未接入”，配置后再补数据。

## 实现迭代 03：批量总览看板雏形

时间：2026-05-23 03:40（Asia/Shanghai）

### 本次实现依据

- 迭代 03 的 V1.0 方案要求系统从单品报告逐步升级到批量输入和总览看板。
- 当前 CSV 已经保存历史单品分析结果、评分、风险和动作，因此可以先不改主流程，直接从 CSV 生成候选池总览。
- 这个增量不依赖 Keepa、SP-API 或 Ads API，符合 V1.0 的免费默认闭环。

### 本次改动

1. 报告生成节点新增 `amazon_product_analysis_overview.html`。
2. 每次工作流执行后，系统会读取 `amazon_product_analysis.csv` 历史记录并生成批量总览看板。
3. 总览看板包含：历史记录数、平均分、可验证候选数、需复核/暂缓数。
4. 总览看板新增“候选排序”：按推荐分数排序，展示分数、结论、ASIN、商品、净利率、风险和历史报告入口。
5. 总览看板新增“最近运行”：按时间倒序展示最近任务和下一步动作。
6. 总览看板新增“风险排行”：统计历史记录里的风险标签出现次数。
7. 移动端表格改为卡片内部横向滚动，避免页面整体横向溢出。

### 新增产物

- 最新单品报告：`output/amazon_product_analysis/amazon_product_analysis_latest.html`
- 批量总览看板：`output/amazon_product_analysis/amazon_product_analysis_overview.html`
- CSV 历史数据：`output/amazon_product_analysis/amazon_product_analysis.csv`

### 验证结果

- 本地语法检查通过。
- 本地预览生成总览看板成功。
- 线上 n8n 已同步新版报告节点，最近成功执行 ID 为 `14`。
- webhook 返回结果已包含 `overview_html_on_windows`。
- 最新总览看板包含“候选排序”“最近运行”“风险排行”。
- CSV 当前为 11 行，最后一行包含本次 overview 验证记录、分数 `79` 和“净利偏薄”风险。
- 桌面和 390px 移动端截图检查通过，无页面级横向溢出。

### 本轮剩余风险

- 当前总览看板基于 CSV 历史记录，尚未实现真正的 CSV 批量输入和队列处理。
- 历史 CSV 中早期旧字段不完整，因此部分旧记录显示“暂无”。
- 总览看板仍有重复 ASIN 记录，后续需要加入“按 ASIN 保留最新一次”或“历史趋势”切换。
- 移动端表格可内部横向滚动，但还不是最理想的移动卡片式列表。

### 下一轮实现建议

1. 增加标准批量输入 CSV 模板，例如 `input/amazon_products_batch.csv`。
2. 新增批量任务说明和 n8n Split in Batches 设计，先不急于高频抓取。
3. 总览看板增加“去重视图”：按 ASIN 只显示最新一次结果。
4. 继续实现竞品 ASIN 低频抓取，生成真实竞品对比表。

## 实现迭代 04：去重候选池和批量输入模板

时间：2026-05-23 03:47（Asia/Shanghai）

### 本次实现依据

- 实现迭代 03 后，总览看板会展示所有历史记录；同一 ASIN 多次测试会挤占候选排序。
- V1.0 需要先形成批量输入标准字段，再进入真正的 Split in Batches 队列。
- 本轮只做低风险增量：总览去重和批量输入模板，不改变现有单品执行链路。

### 本次改动

1. 总览看板新增“去重候选池”，按 ASIN 保留最新一次记录。
2. 原“候选排序”改为“历史候选排序”，保留完整历史轨迹。
3. 总览指标新增“去重候选”数量。
4. 新增批量输入模板：`input/amazon_products_batch_template.csv`。
5. 批量模板字段覆盖 V1.0 输入：商品链接、站点、关键词、竞品 ASIN、采购成本、目标售价、运费、平台费率、平台费、履约费、广告成本、广告备注、补充备注。

### 验证结果

- 本地语法检查通过。
- 本地预览生成总览看板成功，包含“去重候选池”和“历史候选排序”。
- 桌面和 390px 移动端截图检查通过，无页面级横向溢出。
- 线上 n8n 已同步新版，最近成功执行 ID 为 `15`。
- 最新 webhook 返回结果包含 `overview_html_on_windows`。
- 最新总览看板去重候选数为 `1`，符合当前历史数据都围绕同一 ASIN 的状态。
- CSV 当前 12 行，最后一行包含本次去重总览验证记录、分数 `79` 和“净利偏薄”风险。

### 本轮剩余风险

- 批量输入模板已经存在，但 n8n 尚未实现读取 CSV 并 Split in Batches。
- 去重逻辑目前按 ASIN 保留最新一次；如果 ASIN 缺失，则用标题和报告路径兜底，后续可改为 URL/ASIN 复合键。
- 总览看板移动端仍使用表格内部横向滚动，后续可做卡片式移动列表。

### 下一轮实现建议

1. 新增批量执行工作流设计：CSV 输入 -> Split in Batches -> 单品分析 -> 总览刷新。
2. 或实现竞品 ASIN 低频抓取，把当前“待抓取”状态升级为真实价格、评分、评论对比。
3. 总览看板增加“只看最新去重记录 / 查看全部历史记录”的视觉切换。

## 实现迭代 05：本地 CSV 批量执行脚本

时间：2026-05-23 03:51（Asia/Shanghai）

### 本次实现依据

- V1.0 已有单品 webhook、批量输入模板和总览看板；下一步需要一个低风险批量入口。
- 直接改 n8n Split in Batches 会影响主工作流，因此先用本地脚本逐行调用现有 webhook，保持主流程不变。
- 批量脚本必须支持干跑、限制行数和延迟，避免高频抓取、重复 AI 成本和反爬风险。

### 本次改动

1. 新增批量执行脚本：`tools/run_amazon_batch_from_csv.ps1`。
2. 默认读取：`input/amazon_products_batch_template.csv`。
3. 默认调用：`http://localhost:5678/webhook/amazon-product-analysis`。
4. 支持参数：
   - `-DryRun`：只生成请求体，不触发 n8n。
   - `-Limit`：限制本次处理的 CSV 行数。
   - `-DelaySeconds`：每行之间的等待时间，默认 20 秒。
   - `-CsvPath`：指定其他批量输入 CSV。
   - `-WebhookUrl`：指定其他 webhook 地址。
5. 每次批量运行会生成结果 JSON：`output/amazon_product_analysis/batch_run_时间.json`。

### 验证结果

- 干跑验证通过：脚本正确读取 CSV 并生成 webhook 请求体，未触发 n8n。
- 真实执行验证通过：使用模板第一行执行 1 次，成功调用 n8n webhook。
- 最近成功执行 ID 为 `16`。
- 批量结果文件已生成：`output/amazon_product_analysis/batch_run_20260523_035040.json`。
- 批量结果显示 `success_count = 1`、`failed_count = 0`。
- 最新单品报告分数为 `79`，总览看板仍显示去重候选数 `1`。
- CSV 当前 13 行，最后一行来自本次批量脚本执行，包含分数 `79` 和“净利偏薄”风险。

### 本轮剩余风险

- 当前批量入口是本地脚本，不是 n8n 内置 Split in Batches 节点。
- 批量脚本会真实调用爬虫和阿里百炼，使用前需要控制 `Limit` 和 `DelaySeconds`。
- CSV 中如果放大量商品链接，仍需考虑 Amazon 反爬、AI 成本和失败重试。

### 下一轮实现建议

1. 在 n8n 内新增真正的批量工作流，读取 CSV 后 Split in Batches。
2. 或继续实现竞品 ASIN 低频抓取，把单品报告中的“待抓取”竞品表升级为真实对比表。
3. 为批量脚本增加失败重试和失败行导出。

## 实现迭代 06：批量脚本失败重试和失败行导出

时间：2026-05-23 03:55（Asia/Shanghai）

### 本次实现依据

- V1.0 已有本地 CSV 批量执行脚本，但批量任务实际运行时一定会遇到 webhook、网络、反爬或 AI 节点失败。
- 在进入 n8n Split in Batches 之前，先把本地批量入口做稳：支持重试、失败结果持久化和失败行复跑。
- 本轮不触碰主 n8n 工作流，避免影响已验证的单品报告和总览看板。

### 本次改动

1. `tools/run_amazon_batch_from_csv.ps1` 新增参数：
   - `RetryCount`：失败后重试次数，默认 `1`。
   - `RetryDelaySeconds`：重试间隔，默认 `10` 秒。
   - `FailedCsvPath`：失败行导出路径，默认写入 `output/amazon_product_analysis/batch_failed_时间.csv`。
2. 每一行批量任务现在会记录 `attempts`。
3. 批量结果 JSON 新增：
   - `dry_run_count`
   - `retry_count`
   - `retry_delay_seconds`
   - `failed_csv_path`
4. 失败行 CSV 会保留原始输入字段，并追加 `row_number`、`attempts`、`error`，方便直接修正后复跑。

### 验证结果

- DryRun 验证通过：读取模板 CSV，生成请求体，不触发 n8n。
- 故意使用不存在的 webhook 验证失败路径，结果符合预期：
  - `failed_count = 1`
  - `attempts = 2`
  - 已生成失败行 CSV：`output/amazon_product_analysis/batch_failed_20260523_035432.csv`
- 失败验证没有触发新的 n8n AI 执行；线上最近成功执行仍为 ID `16`。
- 主 CSV 行数仍为 13，未因失败测试产生新的商品分析记录。

### 本轮剩余风险

- 当前失败重试只在脚本层重试整行任务，没有区分爬虫失败、AI 节点失败和报告写入失败。
- 失败行导出后需要用户或后续脚本手动复跑。
- 对大量 CSV 批量任务，仍需要更强的速率限制、暂停恢复和任务队列状态。

### 下一轮实现建议

1. 为批量脚本增加 `ResumeFromFailedCsv` 用法说明或参数。
2. 实现竞品 ASIN 低频抓取，把报告里的“待抓取”竞品表升级为真实对比表。
3. 设计 n8n 内置批量工作流：CSV 输入 -> Split in Batches -> 单品分析 -> 总览刷新。

## 实现迭代 07：失败 CSV 直接复跑支持

时间：2026-05-23 04:03（Asia/Shanghai）

### 本次实现依据

- 实现迭代 06 已能导出失败行 CSV，但复跑失败 CSV 时会包含 `row_number`、`attempts`、`error` 等脚本元数据。
- 这些元数据不应该传给 n8n webhook，避免污染输入字段和后续证据 JSON。
- 本轮只增强批量脚本，不触碰 n8n 主工作流。

### 本次改动

1. `tools/run_amazon_batch_from_csv.ps1` 新增元数据列过滤。
2. 自动识别输入 CSV 是否来自失败行导出，并在结果 JSON 中写入 `source_is_failed_csv`。
3. 复跑失败 CSV 时，会自动忽略：
   - `row_number`
   - `attempts`
   - `error`
4. 普通批量模板和失败行 CSV 现在可以共用同一个脚本入口。

### 验证结果

- 使用上一轮失败文件 `batch_failed_20260523_035432.csv` 做 DryRun 复跑验证。
- 结果 JSON 显示 `source_is_failed_csv = true`。
- 请求体保留 `product_url`、关键词、成本、费用等业务字段。
- 请求体不包含 `error` 和 `attempts`。
- DryRun 未触发 n8n，线上最近成功执行仍为 ID `16`。
- 主 CSV 行数仍为 13，未产生新的商品分析记录。

### 本轮剩余风险

- 失败 CSV 复跑目前仍需用户手动指定 `-CsvPath`。
- 脚本还没有自动区分临时错误和永久错误。
- 没有批量暂停/恢复状态文件，只能通过失败 CSV 复跑。

### 下一轮实现建议

1. 增加批量脚本使用说明文档，写清楚普通批量、DryRun、失败复跑和推荐延迟。
2. 或开始实现竞品 ASIN 低频抓取，把“待抓取”竞品表升级为真实对比表。
3. 继续设计 n8n 内置 Split in Batches 批量工作流。

## 实现迭代 08：批量执行 SOP 和脚本内置帮助

时间：2026-05-23 04:10（Asia/Shanghai）

### 本次实现依据

- 批量脚本已经具备模板读取、DryRun、真实执行、重试、失败导出和失败 CSV 复跑能力。
- 这些能力如果没有 SOP，实际使用时容易误触发高频抓取或重复 AI 成本。
- 本轮只补文档和脚本帮助，不触碰主工作流。

### 本次改动

1. 新增批量执行 SOP：`docs/AI选品系统_批量执行SOP.md`。
2. SOP 覆盖：
   - 文件位置
   - CSV 字段说明
   - 推荐执行顺序
   - 常用命令
   - 成本和频率建议
   - 输出检查
   - 当前边界
3. `tools/run_amazon_batch_from_csv.ps1` 新增 `-ShowHelp` 参数。
4. 脚本内置帮助使用 ASCII 英文，避免 Windows PowerShell 控制台中文编码乱码。
5. 完整中文说明保留在 SOP 文档中。

### 验证结果

- `-ShowHelp` 验证通过，帮助内容可读。
- `-DryRun -Limit 1` 验证通过，未触发 n8n。
- 线上 n8n 最近成功执行仍为 ID `16`。
- 主 CSV 行数仍为 13，没有因为本轮测试新增商品分析记录。
- 批量 SOP 已包含 `-ShowHelp`、`-DryRun` 和失败行复跑说明。

### 本轮剩余风险

- SOP 仍是本地脚本文档，n8n 内还没有原生批量工作流。
- 用户执行真实批量时仍需控制 `Limit` 和 `DelaySeconds`。
- 竞品 ASIN 仍未真实抓取。

### 下一轮实现建议

1. 开始实现竞品 ASIN 低频抓取，把“待抓取”竞品表升级为真实对比表。
2. 或设计 n8n 内置 Split in Batches 批量工作流。
3. 为批量结果增加更友好的 HTML 运行日志。

## 实现迭代 09：竞品 ASIN 低频抓取快照

时间：2026-05-23 04:18（Asia/Shanghai）

### 本次实现依据

- V1.0 当前报告已经能记录 `competitor_asins`，但报告中的竞品表仍主要是“待接入/待抓取”状态。
- Keepa、SP-API、Ads API 暂未配置时，系统仍需要一个免费、低频、可手动控制的竞品验证入口。
- 本轮不改变主 n8n 工作流，只新增独立快照脚本，避免影响现有单品分析、批量执行和 HTML/CSV 主产物。
- 该快照只适合低频抽样，不作为历史价格、销量趋势或广告数据的权威来源。

### 本次改动

1. 新增竞品快照脚本：`tools/run_competitor_snapshot.ps1`。
2. 默认从最新 `amazon_product_analysis.csv` 读取：
   - `competitor_asins`
   - `marketplace`
3. 支持手动传入 `-Asins` 和 `-Marketplace`，可脱离 CSV 单独运行。
4. 支持 `-DryRun`、`-Limit`、`-DelaySeconds` 和 `-TimeoutMs`，用于控制频率和风险。
5. 调用本地 `amazon-crawler` 抓取竞品 ASIN，并输出：
   - `output/amazon_product_analysis/competitor_snapshot_latest.json`
   - `output/amazon_product_analysis/competitor_snapshot_latest.html`
   - `output/amazon_product_analysis/competitor_snapshot_时间.json`
6. 脚本文案和 HTML 固定文案使用 ASCII，避免 Windows PowerShell 5 中文编码乱码。

### 验证结果

- `-DryRun -Limit 3` 验证通过，未调用 Amazon 页面，成功从最新 CSV 解析出 3 个竞品 ASIN。
- 本地爬虫健康检查通过：`amazon-crawler` 返回 `ok = true`。
- 真实低频测试使用 `-Limit 1 -DelaySeconds 0`，成功抓取 1 个竞品 ASIN。
- 本次抓取结果：
  - ASIN：`B08FC6C75Y`
  - 标题：`Sony Playstation DualSense Wireless Controller`
  - 价格：`₹6,299.00`
  - 评分：`3.9 out of 5 stars`
  - 评论数：`1,579`
  - 库存：`In stock`
- 最新快照 HTML 已生成：`output/amazon_product_analysis/competitor_snapshot_latest.html`。
- 本轮没有触发 n8n webhook，也没有新增主 CSV 商品分析记录；线上最近成功执行仍为 ID `16`。

### 本轮剩余风险

- 该脚本仍然依赖 Amazon 页面结构和本地 crawler，遇到验证码、地区限制或页面变体时可能返回缺失字段。
- 竞品快照目前是独立产物，尚未合并回单品 HTML 报告或总览看板。
- 该数据不是 Keepa 历史价格/BSR/销量趋势，也不是 SP-API 官方库存或订单数据。
- 如果批量抓取多个竞品 ASIN，仍需严格控制 `Limit` 和 `DelaySeconds`。

### 下一轮实现建议

1. 将 `competitor_snapshot_latest.json` 合并进单品报告中的竞品对比区，显示真实价格、评分、评论数和库存。
2. 在总览看板中增加“竞品快照状态”，区分未抓取、部分成功、全部成功和被限制。
3. 继续预留 Keepa/SP-API 适配器字段，将低频快照作为免费兜底数据源。

## 实现迭代 10：主报告接入竞品快照证据

时间：2026-05-23 04:42（Asia/Shanghai）

### 本次实现依据

- 实现迭代 09 已能生成 `competitor_snapshot_latest.json`，但它仍是独立产物，主报告无法直接展示真实竞品价格、评分和评论。
- V1.0 的关键目标是“选品决策看板 + 可解释证据”，竞品快照应该进入单品报告和 `evidence_json`，而不是只停留在单独 HTML。
- 本轮只改报告生成模板和本地预览脚本，不触发 n8n 完整 AI 分析，避免重复调用百炼和追加 CSV。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 新增读取 `competitor_snapshot_latest.json` 的逻辑。
2. 主报告“数据来源可信度”新增“竞品快照”卡片。
3. 主报告“竞品 ASIN 跟踪”从“待抓取”升级为表格字段：
   - 快照状态
   - 价格
   - 评分
   - 评论
   - 说明
4. `evidence_json` 新增 `competitor_snapshot`，并扩展 `competitor_status` 的价格、评分、评论字段。
5. 下一步动作会根据快照状态从“抓取竞品”升级为“复核竞品价差”。
6. `tools/render_optimized_amazon_report_preview.mjs` 补齐 CSV 手工增强字段模拟，保证本地预览能验证真实 webhook 输入字段。
7. 移动端样式继续压缩标题、卡片和商品图尺寸，降低长文本横向裁切风险。
8. 本地导入用工作流 JSON 已同步：`n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，未追加主 CSV。
- 最新本地报告已显示：
  - 数据源“竞品快照”：`部分成功`
  - `B08FC6C75Y`：`已抓取`
  - 竞品价格：`₹6,299.00`
  - 竞品评分：`3.9 out of 5 stars`
  - 竞品评论：`(1,579)`
- `evidence_json` 已包含 `competitor_snapshot` 和扩展后的 `competitor_status`。
- 已生成桌面和移动端截图：
  - `output/amazon_product_analysis/v1_competitor_snapshot_desktop.png`
  - `output/amazon_product_analysis/v1_competitor_snapshot_mobile.png`
- n8n 线上工作流在 API 更新尝试后已恢复启用，最近成功执行仍为 ID `16`。
- 本轮没有触发完整 n8n 分析，也没有新增主 CSV 商品分析记录。

### 本轮剩余风险

- n8n API 替换线上报告节点时出现长时间不返回；本轮已恢复工作流启用，但线上工作流仍是旧报告模板。
- 当前已完成的是本地模板、最新本地报告和导入用 workflow JSON；线上 n8n 需要下一轮单独处理更新卡住问题，或通过 n8n UI 重新导入/粘贴报告节点代码。
- 移动端已继续压缩排版，但长英文标题和长 URL 在极窄截图下仍可能产生视觉截断，需要下一轮做更彻底的移动端卡片化。
- 竞品快照只匹配最新快照文件中的 ASIN；未抓取的竞品仍显示“待抓取”。

### 下一轮实现建议

1. 先处理 n8n 线上报告节点更新卡住问题，确保 live workflow 使用当前 V1.0 模板。
2. 将竞品快照状态汇总进 `amazon_product_analysis_overview.html`，让总览看板能看到“竞品已验证/待抓取”。
3. 把移动端第一屏进一步改成单列短句卡片，减少长标题、长链接和表格对版面的影响。

## 实现迭代 11：修复线上 n8n 报告节点同步

时间：2026-05-23 04:51（Asia/Shanghai）

### 本次实现依据

- 实现迭代 10 已完成本地报告模板和导入用 workflow JSON，但线上 n8n 报告节点仍是旧模板。
- 之前使用 PowerShell 对大 JSON 对象重新序列化后 PUT，出现 500 或长时间不返回。
- 本轮目标是只解决“线上 n8n 报告节点同步”这一件事，不触发完整商品分析，不追加 CSV，不重复调用阿里百炼。

### 本次改动

1. 新增同步脚本：`tools/sync_live_n8n_report_node.ps1`。
2. 脚本流程改为：
   - 通过 n8n API 拉取线上 workflow 原始 JSON 到本地文件。
   - 用 Node 只替换“生成 HTML 可视化报告”代码节点的 `jsCode`。
   - 生成干净更新体：`live_workflow_report_node_update_payload.json`。
   - 使用 `curl.exe --data-binary` 上传 JSON 文件，避免 PowerShell 大对象重新序列化。
   - 更新后重新拉取 workflow，验证报告节点是否包含指定标记。
3. 脚本定位报告节点时不再依赖中文节点名，而是按节点类型和代码特征定位，避免 Windows PowerShell 控制台编码破坏中文字符串。
4. 修复 PowerShell 5 空错误文件 `.Trim()` 和 `node -` 参数偏移问题。

### 验证结果

- `tools/sync_live_n8n_report_node.ps1` 回归执行成功。
- 线上 n8n 工作流状态：
  - `active = true`
  - `report_has_marker = true`
  - `updatedAt = 2026-05-22T20:50:25.856Z`
  - 报告节点代码长度：`60839`
- 线上报告节点已包含 `competitorSnapshotFile`，说明迭代 10 的竞品快照主报告模板已经同步到 live workflow。
- 最近 n8n 执行仍为 ID `16`，状态 `success`，本轮没有触发新执行。
- 主 CSV 记录数仍为 `12`，本轮没有追加新商品分析记录。

### 本轮剩余风险

- 本轮只同步了线上报告节点模板，没有重新执行完整工作流；下一次用户或批量脚本触发后，才会由 n8n 生成带竞品快照的新报告。
- 同步脚本依赖本地已保存的 n8n API Key，若凭据失效需要重新设置。
- 脚本默认按当前 workflow ID 执行，如果复制了新 workflow，需要传入新的 `WorkflowId`。

### 下一轮实现建议

1. 触发一次低成本验证运行，确认 live n8n 生成的新报告也包含“竞品快照”卡片和扩展 evidence JSON。
2. 将竞品快照状态汇总进 `amazon_product_analysis_overview.html`。
3. 继续优化移动端第一屏，把长标题和长链接进一步拆成更短的决策卡片。

## 实现迭代 12：live n8n 新模板闭环验证

时间：2026-05-23 04:55（Asia/Shanghai）

### 本次实现依据

- 实现迭代 11 已确认线上 n8n 报告节点同步成功，但还没有通过真实 webhook 路径生成新报告。
- V1.0 必须验证“线上工作流 -> Crawlee 抓取 -> 阿里百炼分析 -> 新 HTML/CSV 输出”整条链路，而不是只验证本地预览。
- 本轮只做 1 行低频验证运行，避免批量触发、避免高频抓取和过多 AI 成本。

### 本次操作

1. 使用 `tools/run_amazon_batch_from_csv.ps1` 执行模板第 1 行：
   - `-Limit 1`
   - `-DelaySeconds 0`
   - `-RetryCount 0`
2. 输入来自 `input/amazon_products_batch_template.csv`。
3. 运行路径为 live n8n webhook：`http://localhost:5678/webhook/amazon-product-analysis`。
4. 本轮触发了 1 次真实 n8n 分析，会调用本地 crawler 和阿里百炼。

### 验证结果

- 批量脚本返回：
  - `success_count = 1`
  - `failed_count = 0`
  - 结果文件：`output/amazon_product_analysis/batch_run_20260523_045250.json`
- n8n 最新执行：
  - 执行 ID：`26`
  - 状态：`success`
  - 模式：`webhook`
  - 时间：`2026-05-22T20:52:50Z` 到 `2026-05-22T20:53:06Z`
- 主 CSV 记录数从 `12` 增加到 `13`。
- 最新报告已由 live n8n 生成，并包含：
  - 数据源“竞品快照”
  - 表头“快照状态 / 价格 / 评分 / 评论”
  - 竞品 `B08FC6C75Y`
  - 竞品价格 `₹6,299.00`
  - 竞品评分 `3.9 out of 5 stars`
  - 竞品评论 `(1,579)`
  - 下一步动作“复核竞品价差”
  - `evidence_json.competitor_snapshot`
- 新增截图：
  - `output/amazon_product_analysis/v1_live_competitor_snapshot_desktop.png`
  - `output/amazon_product_analysis/v1_live_competitor_snapshot_mobile.png`

### 本轮剩余风险

- 本轮是真实 AI 调用，会产生一次阿里百炼模型调用成本，后续批量仍需控制 `Limit` 和 `DelaySeconds`。
- 最新 live 报告已经带竞品快照，但移动端第一屏在极窄宽度下仍有长英文标题、长句和 URL 裁切风险。
- 竞品快照目前只有 1/3 个竞品成功，另外两个 ASIN 仍是“待抓取”。
- 总览看板尚未汇总竞品快照状态，仍需要打开单品报告查看竞品验证情况。

### 下一轮实现建议

1. 优先做移动端第一屏卡片化：压缩标题、隐藏长 URL、把关键证据/风险/动作改成更短的决策条目。
2. 将竞品快照状态汇总进 `amazon_product_analysis_overview.html`。
3. 扩展竞品快照脚本，一次低频补抓剩余 2 个竞品 ASIN，并继续保持限速。

## 实现迭代 13：移动端第一屏短卡片化

时间：2026-05-23 05:03（Asia/Shanghai）

### 本次实现依据

- 实现迭代 12 的 live 报告已经包含竞品快照，但 390px 移动端第一屏仍有长英文标题、长句和 URL 的视觉裁切风险。
- 用户明确要求“文字排版简洁，易读，重点”，移动端不应直接照搬桌面端三列长列表。
- 本轮只优化 HTML 模板的移动端展示，不改评分模型、不触发 n8n 分析、不追加 CSV。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 新增移动端短标题：
   - 桌面端仍显示完整商品标题。
   - 移动端显示截断后的核心标题。
2. 移动端新增 `mobile-brief` 决策摘要区，包含 4 个单列短卡片：
   - 结论
   - 首要风险
   - 下一步
   - 竞品快照
3. 移动端隐藏原三块长列表 `decision-board`，桌面端继续保留完整“关键证据 / 关键风险 / 下一步动作”。
4. 移动端隐藏长商品 URL，只显示可点击的“打开商品链接”。
5. 移动端商品类目改为短类目，降低长英文类目横向裁切风险。
6. 增加移动端强制换行和单列摘要卡片规则，避免窄屏两列挤压。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，未追加 CSV。
- 390px 移动端截图已生成：`output/amazon_product_analysis/v1_mobile_first_screen_mobile.png`。
- 浏览器布局指标检查显示无横向溢出：
  - `scrollWidth = clientWidth`
  - 未发现元素级横向溢出。
- 本地 workflow JSON 已同步：`n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `hasMobileBrief = true`
  - `updatedAt = 2026-05-22T21:02:30.286Z`
- 最近 n8n 执行仍为 ID `26`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮没有新增 AI 成本。

### 本轮剩余风险

- 移动端短标题使用截断展示，完整标题仍保留在桌面端、HTML title 和结构化证据中。
- 旧报告文件不会自动重写，只有最新模板生成的新报告和本地预览报告使用该样式。
- 移动端首屏更偏决策摘要，完整证据仍需向下滚动查看。

### 下一轮实现建议

1. 将竞品快照状态汇总进 `amazon_product_analysis_overview.html`，让总览看板能直接看到竞品验证进度。
2. 扩展竞品快照脚本，低频补抓剩余 2 个竞品 ASIN。
3. 给批量总览增加“最后验证时间”和“竞品覆盖率”字段。

## 实现迭代 14：总览看板接入竞品快照状态

时间：2026-05-23 05:09（Asia/Shanghai）

### 本次实现依据

- 实现迭代 12 已让单品报告包含 `competitor_snapshot`，但批量总览仍无法直接看到竞品验证进度。
- 选品总览的核心用途是快速排序和安排下一步动作，因此需要在候选池层面显示“竞品是否已抓取、覆盖率是多少、最后验证时间是什么”。
- 本轮只改总览生成逻辑，不触发 n8n 执行、不追加 CSV、不产生新的 AI 调用成本。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 的 `buildOverviewReport()` 开始解析每行 CSV 的 `evidence_json.competitor_snapshot`。
2. 总览顶部指标新增：
   - `竞品已验`
   - `平均覆盖`
3. “去重候选池”新增 `竞品覆盖` 列。
4. “历史候选排序”新增 `竞品覆盖` 列。
5. “最近运行”新增 `竞品快照` 列。
6. 右侧新增“竞品快照状态”面板，显示：
   - ASIN
   - 商品
   - 覆盖
   - 状态
   - 更新时间
7. 使用说明更新为：总览已读取单品报告中的竞品快照证据。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，未追加 CSV。
- 最新总览 HTML 已包含：
  - `竞品已验 = 1`
  - `平均覆盖 = 33%`
  - `竞品覆盖`
  - `竞品快照状态`
  - `1/3 部分成功`
- 新增截图：
  - `output/amazon_product_analysis/v1_overview_competitor_snapshot_desktop.png`
  - `output/amazon_product_analysis/v1_overview_competitor_snapshot_mobile.png`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `hasOverviewCompetitorMetric = true`
  - `updatedAt = 2026-05-22T21:08:40.300Z`
- 最近 n8n 执行仍为 ID `26`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮没有新增 AI 成本。

### 本轮剩余风险

- 总览竞品覆盖率依赖每行 CSV 中已有的 `evidence_json`；旧记录没有该字段时会显示“暂无”。
- 当前竞品快照仍只有 `1/3` 个 ASIN 成功，覆盖率为 `33%`。
- 移动端总览表格仍使用内部横向滚动，适合查看但不是最终的移动卡片式看板。

### 下一轮实现建议

1. 扩展竞品快照脚本，低频补抓剩余 2 个竞品 ASIN。
2. 将总览移动端表格改为卡片式列表，减少横向滚动。
3. 给批量总览增加“最后验证时间”排序和“仅看竞品未验证”筛选。

## 实现迭代 15：竞品快照缺失项补抓与数据清洗

时间：2026-05-23 05:20（Asia/Shanghai）

### 本次实现依据

- 实现迭代 14 已把竞品快照状态接入单品报告和总览，但当时只有 `1/3` 个竞品 ASIN 成功。
- 选品系统需要逐步补齐竞品证据，不能每次为了缺失项重复请求已经成功的 ASIN，否则会增加 Amazon 访问频率和封控风险。
- 本轮只推进“竞品快照补抓”一个增量，不触发 n8n AI 分析，不追加主 CSV。

### 本次改动

1. `tools/run_competitor_snapshot.ps1` 新增 `-MissingOnly` 参数。
2. 脚本会读取 `competitor_snapshot_latest.json`，保留已有成功结果，只请求缺失或失败的 ASIN。
3. 新增输出字段：
   - `missing_only`
   - `requested_asin_count`
   - `fetch_count`
   - `carried_forward_count`
   - `not_fetched_count`
4. 当 `-MissingOnly` 与 `-Limit` 同时使用时，`Limit` 只限制本轮实际补抓数量，不会丢弃已经成功的历史竞品。
5. 新增库存字段清洗规则，避免 Amazon 页面脚本日志混入 `availability` 和后续 evidence JSON。

### 验证结果

- DryRun 验证通过：
  - 请求竞品：`3`
  - 需要补抓：`2`
  - 沿用旧成功结果：`1`
- 真实低频补抓完成：
  - `fetch_count = 2`
  - `carried_forward_count = 1`
  - `asin_count = 3`
  - `success_count = 3`
  - `failed_count = 0`
- 再次运行 `-MissingOnly` 后不再访问爬虫：
  - `fetch_count = 0`
  - `carried_forward_count = 3`
- 最新竞品快照已经包含：
  - `B08FC6C75Y`：已抓取，价格 `₹6,299.00`，评分 `3.9 out of 5 stars`，评论 `(1,579)`
  - `B09V4B6K53`：已抓取，价格 `₹4,900.00`，评分 `4.5 out of 5 stars`，评论 `(37,347)`
  - `B0BY8QNV1C`：已抓取，价格 `₹5,299.00`，评分 `4.3 out of 5 stars`，评论 `(2,722)`
- 最新本地 HTML 已重新生成，竞品快照显示 `匹配 3/3 个竞品`。
- 页面脚本噪音已从最新报告 evidence JSON 中清除，不再出现 `P.when`。
- 新增截图：
  - `output/amazon_product_analysis/v1_competitor_missing_fill_desktop.png`
  - `output/amazon_product_analysis/v1_competitor_missing_fill_mobile.png`
- n8n 线上工作流仍为启用状态，最近一次执行仍为 ID `26`，本轮没有触发新的 AI 分析。
- 主 CSV 仍为 `13` 条，本轮没有新增 CSV 记录和阿里百炼调用成本。

### 本轮剩余风险

- 最新主商品页面仍被 Amazon 识别为疑似受限页面，所以商品本体结论仍是“先换链接或重试”；本轮只补齐竞品侧证据。
- 竞品快照成功不等于官方 Amazon 数据源，仍是免费本地爬虫结果，需要在正式选品前人工抽样复核。
- 总览页当前读取的是 CSV 历史记录中的 evidence；如果只更新本地快照文件而不重新生成报告或重新执行 n8n，旧 CSV 记录里的覆盖率不会自动变化。

### 下一轮实现建议

1. 将总览移动端表格改为卡片式列表，减少横向滚动。
2. 给批量总览增加“最后验证时间”排序和“仅看竞品未验证”筛选。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 16：总览看板移动端卡片化

时间：2026-05-23 05:37（Asia/Shanghai）

### 本次实现依据

- 实现迭代 15 已补齐竞品快照到 `3/3`，下一步应提升批量总览在手机端的可读性。
- 原总览页在移动端依赖横向滚动表格，不适合快速判断“分数、结论、竞品覆盖、风险和下一步动作”。
- 本轮只改总览展示层，不改变评分逻辑，不触发新的 n8n AI 分析，不追加主 CSV。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 的 `buildOverviewReport()` 新增移动端卡片列表。
2. 桌面端继续保留表格视图，适合密集对比。
3. 560px 以下移动端隐藏桌面表格，改为单列卡片：
   - 去重候选池卡片
   - 历史候选排序卡片
   - 最近运行卡片
   - 竞品快照状态卡片
   - 风险排行卡片
4. 卡片重点展示：
   - 分数
   - 结论
   - 商品标题
   - ASIN
   - 净利率
   - 竞品覆盖
   - 下一步或主要风险
   - 打开报告入口
5. 修复移动端宽度和长文本换行，避免说明文字、长标题和三列指标造成横向溢出。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，主 CSV 仍为 `13` 条，没有新增 AI 调用成本。
- 最新总览 HTML 已包含：
  - `mobile-card-list`
  - `overview-card`
  - `desktop-table`
- 使用真实 390px 移动视口验证：
  - `clientWidth = 390`
  - `scrollWidth = 390`
  - `bodyScrollWidth = 390`
  - 可见移动卡片列表：`5`
  - 移动端可见桌面表格：`0`
- 新增截图：
  - `output/amazon_product_analysis/v1_overview_mobile_cards_desktop_final.png`
  - `output/amazon_product_analysis/v1_overview_mobile_cards_cdp_mobile.png`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T21:33:44.383Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。

### 本轮剩余风险

- 总览页仍主要读取 CSV 历史记录中的 `evidence_json`；如果只更新竞品快照文件而不重新生成报告或重新执行 n8n，旧 CSV 行的竞品覆盖率不会自动刷新。
- 当前移动端卡片是静态 HTML，可读性已提升，但还没有筛选控件。
- 桌面端表格密度较高，适合对比，但后续可以继续增加“只看最新 / 只看未验证 / 按最后验证时间排序”。

### 下一轮实现建议

1. 给批量总览增加“最后验证时间”排序和“仅看竞品未验证”筛选。
2. 让总览在生成时可选读取最新 `competitor_snapshot_latest.json` 覆盖最新候选的竞品状态。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 17：总览竞品验证工作台

时间：2026-05-23 05:42（Asia/Shanghai）

### 本次实现依据

- 实现迭代 16 已完成总览移动端卡片化，但总览仍缺少直接筛选“竞品未验证候选”的工作台。
- 选品批量总览的下一步不是继续堆信息，而是帮助运营优先处理“未验证 / 部分验证 / 最近验证较旧”的候选。
- 本轮只改总览展示层，不改变评分逻辑，不触发新的 n8n AI 分析，不追加主 CSV。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 的 `buildOverviewReport()` 新增竞品验证字段：
   - `competitorUpdatedTime`
   - `competitorNeedsVerification`
2. 总览顶部指标新增 `待验竞品`。
3. 新增“竞品验证工作台”区块。
4. 工作台提供两个视图：
   - `仅看未验证`
   - `按验证时间`
5. 桌面端使用表格展示，移动端使用卡片展示。
6. 新增前端切换脚本，只在静态 HTML 内切换显示，不依赖外部服务。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，主 CSV 仍为 `13` 条，没有新增 AI 调用成本。
- 最新总览 HTML 已包含：
  - `竞品验证工作台`
  - `仅看未验证`
  - `按验证时间`
  - `verification-workbench`
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T21:40:55.612Z`
  - `report_has_marker = true`
- 真实 390px 移动视口验证：
  - 初始视图：`activeView = unverified`
  - 切换后：`activeView = recent`
  - `scrollWidth = 390`
  - `clientWidth = 390`
  - 移动端可见桌面表格：`0`
- 新增截图：
  - `output/amazon_product_analysis/v1_overview_verification_workbench_desktop.png`
  - `output/amazon_product_analysis/v1_overview_verification_workbench_mobile.png`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。

### 本轮剩余风险

- 总览工作台仍以 CSV 历史记录中的 `evidence_json` 为准；如果只更新 `competitor_snapshot_latest.json`，旧 CSV 行不会自动刷新为最新覆盖率。
- 当前“按验证时间”是总览生成时的静态排序，不是用户可自由选择升序/降序的动态表格。
- 工作台已经能筛选未验证候选，但还没有提供“一键补抓缺失竞品”的按钮；补抓仍通过本地脚本执行。

### 下一轮实现建议

1. 让总览在生成时可选读取最新 `competitor_snapshot_latest.json` 覆盖最新候选的竞品状态。
2. 为竞品快照补抓脚本生成 HTML 运行日志，显示本轮抓了哪些、沿用了哪些、失败了哪些。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 18：总览读取最新竞品快照覆盖旧 CSV 状态

时间：2026-05-23 05:49（Asia/Shanghai）

### 本次实现依据

- 实现迭代 17 的验证工作台仍以 CSV 历史记录中的 `evidence_json` 为准，旧记录会继续显示 `1/3` 和 `33%`。
- 实现迭代 15 已经把 `competitor_snapshot_latest.json` 补齐到 `3/3`，但如果不重新跑 n8n AI 分析，CSV 中的旧 evidence 不会自动刷新。
- 本轮目标是让总览生成时自动读取最新竞品快照文件，并在竞品 ASIN 集合一致时覆盖旧 CSV 中的竞品状态。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 的 `buildOverviewReport()` 新增最新快照读取逻辑。
2. 新增 ASIN 集合匹配逻辑：
   - 读取 `competitor_snapshot_latest.json` 中的 `results[].input_asin / asin`
   - 读取 CSV/evidence 中的 `competitor_asins`
   - 标准化、去重、排序后比较集合
3. 当两边 ASIN 集合一致且最新快照不是 DryRun 时，用最新快照覆盖总览中的：
   - `competitorStatus`
   - `competitorSuccess`
   - `competitorTotal`
   - `competitorCoverage`
   - `competitorUpdatedAt`
4. 修复移动端空态重复显示：无未验证候选时，移动端只显示一个“暂无数据”。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，主 CSV 仍为 `13` 条，没有新增 AI 调用成本。
- 最新总览从旧 CSV 的 `1/3`、`33%` 自动刷新为：
  - `竞品已验 = 1`
  - `平均覆盖 = 100%`
  - `待验竞品 = 0`
  - `3/3 已接入`
- 真实 390px 移动视口验证：
  - `clientWidth = 390`
  - `scrollWidth = 390`
  - 移动端可见桌面表格：`0`
  - 移动端重复空态已清除
- 新增截图：
  - `output/amazon_product_analysis/v1_overview_latest_snapshot_overlay_desktop.png`
  - `output/amazon_product_analysis/v1_overview_latest_snapshot_overlay_mobile_final.png`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T21:47:48.349Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。

### 本轮剩余风险

- 覆盖逻辑按“竞品 ASIN 集合一致”判断，不区分同一组竞品对应的不同主商品；如果多个主商品共用完全相同竞品集合，总览会共享同一份最新快照。
- 该覆盖只影响总览展示，不会回写 CSV 历史记录，也不会改写旧单品 HTML 报告。
- 如果最新快照文件来自 DryRun，当前逻辑不会覆盖，避免把真实数据降级为空跑结果。

### 下一轮实现建议

1. 为竞品快照补抓脚本生成 HTML 运行日志，显示本轮抓了哪些、沿用了哪些、失败了哪些。
2. 给总览或补抓脚本增加“同一主商品 ASIN + 同一竞品集合”的关联标识，降低共用竞品集合时的误覆盖风险。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 19：竞品快照补抓 HTML 运行日志

时间：2026-05-23 05:55（Asia/Shanghai）

### 本次实现依据

- 实现迭代 18 已让总览读取最新竞品快照，但竞品补抓脚本自身的 HTML 仍只是简单表格。
- 运营复盘时需要快速看清“本轮到底新抓了哪些、沿用了哪些、失败了哪些、哪些没抓”，不能只看最终 `success`。
- 本轮只改 `tools/run_competitor_snapshot.ps1` 的输出结构和 HTML 日志，不触发 n8n，不调用阿里百炼，不追加主 CSV。

### 本次改动

1. 竞品快照结果行新增 `run_action`：
   - `fetched`
   - `carried_forward`
   - `dry_run`
   - `not_fetched`
2. JSON summary 新增：
   - `fetched_count`
   - `dry_run_count`
   - `history_html_path`
3. HTML 日志新增顶部指标卡：
   - Requested
   - Success
   - Fetched
   - Carried
   - Failed
   - Not fetched
4. HTML 日志新增 `Run Log` 分区：
   - Fetched this run
   - Carried forward
   - Dry run only
   - Failed
   - Not fetched
5. HTML 现在同时写入：
   - `competitor_snapshot_latest.html`
   - `competitor_snapshot_时间.html`
6. 移动端补充页面宽度和长文本换行约束，避免整页横向溢出。

### 验证结果

- 执行 `run_competitor_snapshot.ps1 -MissingOnly -Limit 5` 成功。
- 本轮因为 3 个竞品都已有成功快照，所以未访问爬虫：
  - `fetch_count = 0`
  - `fetched_count = 0`
  - `carried_forward_count = 3`
  - `success_count = 3`
  - `failed_count = 0`
  - `not_fetched_count = 0`
- 最新 JSON 中 3 个 ASIN 都标记为 `run_action = carried_forward`。
- 最新 HTML 已包含：
  - `Run Log`
  - `Fetched this run`
  - `Carried forward`
  - `Snapshot Rows`
  - `carried_forward`
- 新增历史 HTML：
  - `output/amazon_product_analysis/competitor_snapshot_20260523_055312.html`
- 新增截图：
  - `output/amazon_product_analysis/v1_competitor_snapshot_run_log_desktop.png`
  - `output/amazon_product_analysis/v1_competitor_snapshot_run_log_cdp_mobile.png`
- 真实 390px 移动视口验证：
  - `clientWidth = 390`
  - `scrollWidth = 390`
  - `bodyScrollWidth = 390`
- n8n 线上工作流仍为启用状态，最近执行仍为 ID `26`，状态 `success`。
- 主 CSV 仍为 `13` 条，本轮没有新增 AI 调用成本。

### 本轮剩余风险

- Snapshot Rows 明细表在移动端仍使用表格内部横向滚动；整体页面不溢出，但极窄屏查看明细需要横向滑动。
- HTML 日志是脚本运行产物，尚未从总览页直接链接过去。
- 当前 `carried_forward` 表示沿用最新快照结果，不代表本轮重新验证 Amazon 页面。

### 下一轮实现建议

1. 给总览或补抓脚本增加“主商品 ASIN + 竞品集合”的关联标识，降低共用竞品集合时的误覆盖风险。
2. 在总览页的竞品验证工作台增加“打开竞品快照日志”入口。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 20：总览页打通竞品快照日志入口

时间：2026-05-23 05:59（Asia/Shanghai）

### 本次实现依据

- 实现迭代 19 已生成 `competitor_snapshot_latest.html` 和时间戳历史日志，但总览页还不能直接打开这些日志。
- 运营在总览页看到竞品覆盖率后，需要能一键跳转到“本轮抓取/沿用/失败/未抓取”明细。
- 本轮只改总览展示层，不改评分逻辑，不触发 n8n 执行，不追加主 CSV。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js` 的 `buildOverviewReport()` 新增 HTML 日志链接解析。
2. 从最新竞品快照 JSON 中读取：
   - `html_path`
   - `history_html_path`
3. 总览页新增两个入口：
   - `打开竞品快照日志`
   - `打开本轮历史日志`
4. 入口显示在：
   - `竞品验证工作台`
   - `竞品快照状态`
5. 链接使用同目录相对路径，适配本地 HTML 打开方式和 n8n 输出目录。
6. 移动端把日志入口显示为单列按钮，保持 390px 视口可读。

### 验证结果

- `node --check` 语法检查通过。
- 本地预览生成成功，主 CSV 仍为 `13` 条，没有新增 AI 调用成本。
- 最新总览 HTML 已包含：
  - `打开竞品快照日志`
  - `打开本轮历史日志`
  - `competitor_snapshot_latest.html`
  - `competitor_snapshot_20260523_055312.html`
- 链接目标文件均存在。
- 真实 390px 移动视口验证：
  - `clientWidth = 390`
  - `scrollWidth = 390`
  - 移动端可见日志入口：`2` 组
  - 移动端可见桌面表格：`0`
- 新增截图：
  - `output/amazon_product_analysis/v1_overview_snapshot_log_links_desktop.png`
  - `output/amazon_product_analysis/v1_overview_snapshot_log_links_mobile.png`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T21:57:26.214Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。

### 本轮剩余风险

- 总览页链接的是最新快照日志和最新历史日志；旧历史报告不会自动拥有当时对应的日志入口。
- 如果用户手动删除 `competitor_snapshot_latest.html` 或历史日志文件，入口会存在但目标文件不可打开。
- 当前还没有把“主商品 ASIN + 竞品集合”的关联标识写入竞品快照，多个主商品共用同一竞品集合时仍可能共享同一份日志。

### 下一轮实现建议

1. 给总览或补抓脚本增加“主商品 ASIN + 竞品集合”的关联标识，降低共用竞品集合时的误覆盖风险。
2. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。
3. 给竞品快照日志增加“重新补抓命令提示”，方便用户按 MissingOnly 低频补抓。

## 实现迭代 21：竞品快照增加主商品范围标识

时间：2026-05-23 06:06（Asia/Shanghai）

### 本次实现依据

- 实现迭代 18 到 20 已经让总览页可以读取最新 `competitor_snapshot_latest.json`，并把竞品覆盖率从旧 CSV 证据覆盖为最新快照状态。
- 旧覆盖逻辑只按“竞品 ASIN 集合一致”判断，不区分这组竞品对应的是哪个主商品。
- 批量选品时，不同主商品可能复用同一批竞品做参照；如果不记录主商品范围，总览页可能把 A 商品的快照状态叠加到 B 商品。
- 本轮只增加范围标识和匹配约束，不触发 n8n 新执行，不追加主 CSV。

### 本次改动

1. `tools/run_competitor_snapshot.ps1`
   - 新增 `-SourceAsin` 参数。
   - 未手动传入时，自动从最新 CSV 记录读取主商品 `asin`。
   - 快照 JSON 新增：
     - `source_asin`
     - `source_product_title`
     - `competitor_asin_key`
     - `snapshot_scope_key`
   - 快照 HTML 头部新增 `Source ASIN` 和 `Scope`，便于人工核对这份日志属于哪个主商品。

2. `tools/n8n_html_report_code_optimized.js`
   - 新增 `normalizeMarketplace()`，统一 `in / us / amazon.in / amazon.com` 等站点写法。
   - `loadCompetitorSnapshot()` 新增可选 `sourceAsin` 参数。
   - 当最新快照已经写入 `source_asin`，但当前商品 ASIN 不一致时，返回 `未匹配`，不再把该快照当成当前商品的竞品证据。
   - 总览页叠加最新快照时，同时检查：
     - 竞品 ASIN 集合一致
     - 主商品 ASIN 一致
     - marketplace 一致
   - `evidence_json.competitor_snapshot` 新增 `source_asin`、`source_match` 和 `snapshot_scope_key`，便于后续审计。

3. 重新运行竞品快照脚本：
   - 使用 `-MissingOnly`。
   - 因已有 3 个竞品均成功，本轮 `fetch_count = 0`，没有重新请求 Amazon 页面。

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 竞品快照重新写入成功：
  - `source_asin = B0BQXZ11B8`
  - `competitor_asin_key = B08FC6C75Y|B09V4B6K53|B0BY8QNV1C`
  - `snapshot_scope_key = source=B0BQXZ11B8|marketplace=amazon.in|competitors=B08FC6C75Y|B09V4B6K53|B0BY8QNV1C`
  - `fetch_count = 0`
  - `fetched_count = 0`
  - `carried_forward_count = 3`
  - `success_count = 3`
- 本地预览生成成功，`evidence_json` 已包含：
  - `source_asin`
  - `source_match = true`
  - `snapshot_scope_key`
- 最新总览仍显示竞品覆盖率 `100%`，并链接到：
  - `competitor_snapshot_latest.html`
  - `competitor_snapshot_20260523_060410.html`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T22:04:49.795Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。
- 移动截图工具本轮缺少 `playwright-core` 依赖，未生成截图；改用 HTML 结构检查确认快照页包含移动端 CSS、长文本换行规则、`Source ASIN` 和 `Scope`。

### 本轮剩余风险

- 旧 CSV 记录里的 `evidence_json` 仍保留当时写入的竞品快照证据；总览页已优先叠加最新且范围匹配的快照，但旧历史报告不会自动回写。
- 如果用户手动传入 `-Asins` 但没有传 `-SourceAsin`，脚本会从最新 CSV 记录推断主商品；批量场景最好显式传入 `-SourceAsin`。
- 移动端截图验证依赖仍需恢复；当前只做了结构级检查。

### 下一轮实现建议

1. 给 `run_competitor_snapshot.ps1 -ShowHelp` 增加 `-SourceAsin` 用法和“重新补抓命令提示”。
2. 在竞品快照 HTML 中直接展示推荐的 MissingOnly 补抓命令，降低日常运维门槛。
3. 设计 Keepa / SP-API / Ads API 的适配器配置说明和未接入状态检查。

## 实现迭代 22：竞品快照日志增加补抓命令提示

时间：2026-05-23 06:12（Asia/Shanghai）

### 本次实现依据

- 实现迭代 21 已经把竞品快照绑定到“主商品 ASIN + marketplace + 竞品集合”。
- 但用户打开 `competitor_snapshot_latest.html` 后，只能看到抓取结果，还需要回忆脚本命令才能补抓缺失竞品。
- 日常运维应让日志本身给出下一步命令，降低误抓全量、忘记 `SourceAsin` 或过高频率抓取的风险。
- 本轮只增强本地竞品快照脚本和 HTML 日志，不修改 n8n 报告节点，不触发 n8n 新执行。

### 本次改动

1. `tools/run_competitor_snapshot.ps1`
   - 新增 `-ShowHelp` 参数。
   - 帮助内容包含：
     - 查看帮助
     - 按最新 CSV 记录补抓缺失竞品
     - 显式指定 `-SourceAsin`、`-Asins`、`-Marketplace`
     - `-DryRun` 演练模式
   - 帮助文本使用 ASCII，避免 Windows PowerShell 旧版按本地编码执行时出现中文字符串解析问题。

2. `competitor_snapshot_latest.html`
   - 新增 `Next Commands` 区块。
   - 展示三条可直接复制的命令：
     - `Refetch missing rows`
     - `Dry run first`
     - `Show help`
   - 命令里自动带上当前：
     - 脚本路径
     - 竞品 ASIN 集合
     - `SourceAsin`
     - marketplace
   - 命令卡片使用单列移动端布局，并对长命令开启换行，避免撑宽页面。

### 验证结果

- `run_competitor_snapshot.ps1 -ShowHelp` 可正常输出帮助。
- 重新运行：
  - `run_competitor_snapshot.ps1 -MissingOnly -Limit 1 -DelaySeconds 0`
- 本轮没有重新抓 Amazon 页面：
  - `fetch_count = 0`
  - `fetched_count = 0`
  - `carried_forward_count = 3`
  - `success_count = 3`
- 新历史日志已生成：
  - `output/amazon_product_analysis/competitor_snapshot_20260523_061129.html`
- 最新竞品快照 HTML 已包含：
  - `Next Commands`
  - `-MissingOnly -Limit 2 -DelaySeconds 20`
  - `-DryRun`
  - `-ShowHelp`
  - `source=B0BQXZ11B8`
- 本地报告预览重新生成成功，最新总览页已链接到新的历史日志。
- 主 CSV 仍为 `13` 条。
- 线上 n8n workflow 未改动，仍为：
  - `active = true`
  - `updatedAt = 2026-05-22T22:04:49.795Z`
  - 最近执行 ID `26`，状态 `success`

### 本轮剩余风险

- `Next Commands` 是文本命令，不是可点击执行按钮；这符合当前本地 HTML 文件的安全边界。
- 如果用户手动编辑 CSV 或快照 JSON，命令区会在下一次运行脚本时刷新，不会自动实时更新。
- 还没有对 Keepa / SP-API / Ads API 做统一适配器配置页。

### 下一轮实现建议

1. 增加 `config/data_sources.example.json`，沉淀 Keepa / SP-API / Ads API / Crawlee 的配置边界和未接入状态。
2. 在报告里读取该配置文件，统一显示“已接入 / 未接入 / 配置缺失”，避免每个模块各自写死。
3. 给 SOP 增加“数据源接入优先级”：Crawlee 免费兜底、Keepa 历史价格和 BSR、SP-API 官方销售/库存、Ads API 关键词与广告。

## 实现迭代 23：统一数据源配置状态

时间：2026-05-23 06:18（Asia/Shanghai）

### 本次实现依据

- V1.0 当前已经有 Crawlee 免费抓取、手工字段、竞品快照三个可用数据源。
- Keepa、SP-API、Amazon Ads API 目前只是预留能力，如果报告里到处写死“未接入”，后续接入时容易出现状态不一致。
- 选品报告需要明确告诉用户：哪些数据源已接入、哪些未接入、哪些只是配置缺失，避免把免费爬虫结果误解为官方销售或广告数据。
- 本轮只做配置状态和报告展示，不接入任何付费 API，不触发 n8n 新执行。

### 本次改动

1. 新增示例配置：
   - `config/data_sources.example.json`
2. 新增本地运行配置：
   - `output/amazon_product_analysis/data_sources.local.json`
3. 配置覆盖的数据源：
   - `crawlee`
   - `manual_inputs`
   - `competitor_snapshot`
   - `keepa`
   - `sp_api`
   - `amazon_ads_api`
4. `tools/n8n_html_report_code_optimized.js`
   - 新增 `AMAZON_DATA_SOURCES_CONFIG_FILE` 环境变量入口。
   - 默认读取：
     - `outputDir + '/data_sources.local.json'`
   - 新增内置默认状态，配置缺失时不报错。
   - `buildDataSources()` 增加 `数据源配置` 卡片。
   - Keepa、SP-API、Ads API 状态从配置读取，当前统一为 `未接入`。
   - `evidence_json` 新增：
     - `data_source_config`
     - 从配置派生的 `optional_sources`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- `config/data_sources.example.json` 和 `output/amazon_product_analysis/data_sources.local.json` 均为合法 JSON。
- 本地预览生成成功，最新报告包含：
  - `数据源配置`
  - `已读取`
  - `Keepa 历史趋势`
  - `SP-API / Brand Analytics`
  - `Amazon Ads API`
  - `data_source_config`
- `evidence_json` 中：
  - `data_source_config.status = 已读取`
  - `optional_sources.keepa = 未接入`
  - `optional_sources.sp_api_brand_analytics = 未接入`
  - `optional_sources.amazon_ads_api = 未接入`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T22:17:58.884Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 当前配置只管理状态和说明，不会真正调用 Keepa、SP-API 或 Ads API。
- n8n 容器需要能访问 `output/amazon_product_analysis/data_sources.local.json`；如果文件被删除，报告会显示 `配置缺失` 并回退到内置默认状态。
- 后续如果真实接入外部 API，还需要增加凭据校验、限流、失败降级和费用控制。

### 下一轮实现建议

1. 在报告的“数据来源可信度”区域增加更明确的数据源优先级说明：免费兜底、历史趋势、官方销售库存、广告关键词。
2. 增加 `docs/AI选品系统_V1数据源接入SOP.md`，写清 Crawlee、Keepa、SP-API、Ads API 的用途、凭据、成本、失败降级和合规边界。
3. 给未来适配器预留 `tools/adapters/` 目录结构，但先只放接口说明，不实现真实付费调用。

## 实现迭代 24：沉淀 V1 数据源接入 SOP

时间：2026-05-23 06:23（Asia/Shanghai）

### 本次实现依据

- 实现迭代 23 已经把数据源状态集中到 `data_sources.local.json`。
- 但配置文件只说明“当前状态”，还没有说明每个数据源为什么接、什么时候接、怎么接、失败后怎么降级。
- V1 系统需要清楚区分：
  - 免费本地兜底数据
  - 手工增强字段
  - 第三方历史趋势数据
  - Amazon 官方销售/库存/费用数据
  - Amazon 官方广告和关键词数据
- 本轮只新增 SOP 文档，不修改 n8n workflow，不调用付费 API。

### 本次依据来源

- Crawlee PlaywrightCrawler 官方文档：
  - https://crawlee.dev/js/api/3.14/playwright-crawler/interface/PlaywrightCrawlerOptions
- Keepa API / Python 客户端文档：
  - https://keepaapi.readthedocs.io/en/stable/
  - https://keepa.com/#!api
- Amazon SP-API 官方文档：
  - https://developer-docs.amazon.com/sp-api/lang-en_US/
  - https://developer-docs.amazon.com/sp-api/lang-US/docs/connecting-to-the-selling-partner-api
  - https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits
- Amazon Ads API 官方页面：
  - https://advertising.amazon.com/about-api

### 本次改动

1. 新增文档：
   - `docs/AI选品系统_V1数据源接入SOP.md`
2. 文档覆盖：
   - 数据源接入目标
   - 当前配置文件位置
   - 状态约定
   - 数据源优先级
   - Crawlee 免费兜底边界
   - 手工增强字段边界
   - 竞品快照边界
   - Keepa 预留接入方案
   - SP-API 预留接入方案
   - Amazon Ads API 预留接入方案
   - 成本控制
   - 合规边界
   - 故障降级
   - V1 到 V1.5 升级路径
   - 日常检查清单

### 关键设计结论

1. Crawlee 是 P0 免费兜底，但不能绕过验证码，也不能作为官方销售数据。
2. 手工增强字段是利润和运营判断的最小必需输入。
3. 竞品快照是低频免费验证，不等同 Keepa 历史趋势或官方销售库存。
4. Keepa 适合作为 P3：历史价格、BSR、Buy Box、卖家数趋势。
5. SP-API 适合作为 P4：官方目录、费用、销售、库存、报表、品牌分析。
6. Amazon Ads API 适合作为 P5：关键词、广告报表、ACOS/TACOS、小预算验证。
7. V1 禁止自动下单、自动改价、自动开启广告。
8. 所有付费或官方 API 必须缓存、限流、失败降级。

### 验证结果

- `docs/AI选品系统_V1数据源接入SOP.md` 已生成。
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:17:58.884Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。
- 最新 HTML 报告仍包含 `data_source_config`。
- 总览页仍包含竞品快照日志入口。

### 本轮剩余风险

- SOP 中 Keepa 使用了 Keepa 官方入口和 Python 客户端文档；真实商业计费和 token 规则仍需以 Keepa 账号后台为准。
- SP-API 和 Ads API 的权限、审批、限流、报表范围会随账号类型、marketplace 和 Amazon 政策变化，接入前必须再次核对官方文档和账号权限。
- 当前仍未实现真实 Keepa / SP-API / Ads API 适配器，只是完成接入方案和边界。

### 下一轮实现建议

1. 给报告的“数据来源可信度”区域增加一句数据源优先级说明，直接面向非技术用户解释哪些数据是免费抓取、哪些是未接入官方增强。
2. 预留 `tools/adapters/` 目录和 `README.md`，只定义 Keepa / SP-API / Ads API 的输入输出契约，不写真实付费调用。
3. 给 `data_sources.local.json` 增加 `last_checked_at` 和 `owner_notes` 字段，方便日常运维追踪。

## 实现迭代 25：报告数据源可信度增加非技术说明

时间：2026-05-23 06:26（Asia/Shanghai）

### 本次实现依据

- 实现迭代 23 已经把数据源状态集中到配置文件。
- 实现迭代 24 已经沉淀完整数据源接入 SOP。
- 但主报告里的“数据来源可信度”区域仍主要依赖卡片状态，非技术用户可能不清楚哪些数据已参与评分，哪些只是预留增强数据源。
- 本轮只改报告展示文案，不改评分、不改 CSV schema、不触发 n8n 新执行。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js`
   - 在主报告“数据来源可信度”标题下新增一句说明：
     - 当前结论优先基于本地免费抓取、手工成本字段和低频竞品快照。
     - Keepa 历史趋势、SP-API 官方销售/库存、Amazon Ads 关键词和广告数据按配置显示。
     - 未接入时不参与评分。
   - 新增 `.source-note` 样式，保证说明文字在移动端可换行、不撑宽页面。

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地报告预览生成成功。
- 最新 HTML 报告已包含：
  - `source-note`
  - `当前结论优先基于本地免费抓取`
  - `Keepa 历史趋势、SP-API 官方销售/库存、Amazon Ads 关键词和广告数据`
  - `data_source_config`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T22:25:58.941Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 这只是展示说明，不会改变数据源接入状态。
- 如果未来 Keepa / SP-API / Ads API 真正接入，需要同步调整文案，避免仍然让用户以为这些数据未参与评分。
- 本轮没有做移动端截图，只做了模板、HTML 和同步验证。

### 下一轮实现建议

1. 预留 `tools/adapters/` 目录和 `README.md`，定义 Keepa / SP-API / Ads API 的输入输出契约，不实现真实付费调用。
2. 给 `data_sources.local.json` 增加 `last_checked_at` 和 `owner_notes` 字段，方便日常运维追踪。
3. 在总览页也增加一条简短数据源边界说明，避免批量看板被误解为官方市场数据。

## 实现迭代 26：预留外部数据适配器契约

时间：2026-05-23 06:32（Asia/Shanghai）

### 本次实现依据

- 实现迭代 23 已有统一数据源状态配置。
- 实现迭代 24 已有数据源接入 SOP。
- 实现迭代 25 已在主报告里解释哪些数据参与当前评分。
- 下一步真实接入 Keepa、SP-API、Amazon Ads API 前，需要先统一输入、输出、缓存、成本、错误和降级格式，避免后续每个适配器各自返回不同结构。
- 本轮只放契约和说明，不实现真实付费 API 调用。

### 本次依据来源

- Crawlee PlaywrightCrawler 官方文档：
  - https://crawlee.dev/js/api/3.14/playwright-crawler/interface/PlaywrightCrawlerOptions
- Keepa API / Python 客户端文档：
  - https://keepa.com/#!api
  - https://keepaapi.readthedocs.io/en/stable/
- Amazon SP-API 官方文档：
  - https://developer-docs.amazon.com/sp-api/lang-en_US/
  - https://developer-docs.amazon.com/sp-api/lang-US/docs/connecting-to-the-selling-partner-api
  - https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits
- Amazon Ads API 官方页面：
  - https://advertising.amazon.com/about-api

### 本次改动

1. 新增目录：
   - `tools/adapters/`
2. 新增说明文档：
   - `tools/adapters/README.md`
3. 新增契约 Schema：
   - `tools/adapters/adapter_contract.schema.json`

### 契约内容

1. 通用请求字段：
   - `trace_id`
   - `source`
   - `marketplace`
   - `asin`
   - `source_asin`
   - `competitor_asins`
   - `target_keywords`
   - `date_range`
   - `cache_policy`
   - `dry_run`
2. 通用响应字段：
   - `ok`
   - `source`
   - `status`
   - `status_label`
   - `fetched_at`
   - `cache`
   - `cost`
   - `data`
   - `evidence`
   - `risk_flags`
   - `error`
   - `next_retry_at`
3. 状态映射：
   - `connected`
   - `configured`
   - `not_connected`
   - `missing_config`
   - `rate_limited`
   - `quota_exhausted`
   - `permission_denied`
   - `auth_expired`
   - `failed`
4. 三个预留适配器：
   - Keepa：历史价格、BSR、Buy Box、卖家数、评论趋势。
   - SP-API：官方目录、费用、库存、销售、报表、品牌分析。
   - Amazon Ads API：广告报表、关键词、ACOS/TACOS、小预算验证。
5. 缓存约束：
   - 未来适配器只写脱敏缓存。
   - 报告生成只读缓存，不直接扇出调用付费 API。
   - 缓存不得包含密钥、refresh token、client secret 或 PII。

### 验证结果

- `adapter_contract.schema.json` 已通过 JSON 解析验证。
- `tools/adapters/README.md` 已包含：
  - `Design Rules`
  - `Keepa Adapter Contract`
  - `SP-API Adapter Contract`
  - `Amazon Ads API Adapter Contract`
  - `Cache Layout`
  - `Integration Points`
  - `Official references`
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:25:58.941Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 当前只有契约，没有真实适配器实现。
- JSON Schema 只校验公共响应结构，尚未细化 Keepa / SP-API / Ads API 各自 `data` 内部字段。
- 真实接入前仍需再次核对账号权限、审批状态、费用、限流和合规要求。

### 下一轮实现建议

1. 给 `data_sources.local.json` 增加 `last_checked_at` 和 `owner_notes` 字段，方便日常运维追踪。
2. 在总览页也增加一条简短数据源边界说明，避免批量看板被误解为官方市场数据。
3. 给 `tools/adapters/` 增加一个本地 `validate_adapter_contract.mjs`，只验证缓存 JSON 是否符合公共契约，不调用外部 API。

## 实现迭代 27：数据源配置增加运维追踪字段

时间：2026-05-23 06:38（Asia/Shanghai）

### 本次实现依据

- 实现迭代 23 已经引入 `data_sources.local.json` 作为统一数据源状态配置。
- 实现迭代 26 已经预留外部数据适配器契约。
- 日常运维需要知道数据源配置最后一次检查时间，以及当前为什么某些增强数据源保持未接入。
- 本轮只增加配置追踪字段和报告证据输出，不改变评分逻辑，不触发 n8n 新执行。

### 本次改动

1. `config/data_sources.example.json`
   - 新增 `last_checked_at`
   - 新增 `owner_notes`
2. `output/amazon_product_analysis/data_sources.local.json`
   - 新增 `last_checked_at = 2026-05-23T06:36:00+08:00`
   - 新增 `owner_notes`
   - 明确当前 V1 只启用 Crawlee、手工字段和竞品快照；Keepa、SP-API、Amazon Ads API 保持未接入，不参与评分。
3. `tools/n8n_html_report_code_optimized.js`
   - `loadDataSourceConfig()` 读取 `last_checked_at` 和 `owner_notes`。
   - “数据源配置”卡片的说明中显示最后检查时间和备注。
   - `evidence_json.data_source_config` 新增：
     - `last_checked_at`
     - `owner_notes`

### 验证结果

- `config/data_sources.example.json` 和 `output/amazon_product_analysis/data_sources.local.json` 均为合法 JSON。
- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地报告预览生成成功。
- 最新 HTML 报告已包含：
  - `2026-05-23T06:36:00+08:00`
  - `当前 V1 只启用 Crawlee`
  - `data_source_config`
  - `当前结论优先基于本地免费抓取`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T22:37:19.370Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- `last_checked_at` 是人工维护字段，不会自动代表外部 API 健康状态。
- 当前备注是全局备注，还没有给每个数据源单独维护 owner notes。
- 如果未来真实接入 Keepa / SP-API / Ads API，需要让适配器运行结果自动更新更细的健康检查字段。

### 下一轮实现建议

1. 在总览页也增加一条简短数据源边界说明，避免批量看板被误解为官方市场数据。
2. 给 `tools/adapters/` 增加本地 `validate_adapter_contract.mjs`，只验证缓存 JSON 是否符合公共契约，不调用外部 API。
3. 给 `data_sources.local.json` 后续扩展 per-source `last_checked_at` 和 `owner_notes`。

## 实现迭代 28：总览页增加数据源边界说明

时间：2026-05-23 06:42（Asia/Shanghai）

### 本次实现依据

- 实现迭代 25 已在单品报告“数据来源可信度”区域解释数据源边界。
- 总览页是批量看板，用户可能只看候选池分数、竞品覆盖和风险排行，误以为这些指标来自 Amazon 官方销售、库存或广告市场数据。
- V1.0 当前仍主要基于本地 CSV、单品报告证据和低频竞品快照。
- 本轮只改总览页展示文案，不改评分、不改 CSV schema、不触发 n8n 新执行。

### 本次改动

1. `tools/n8n_html_report_code_optimized.js`
   - 总览页第一屏新增 `overview-boundary` 说明：
     - 本看板汇总本地 CSV、单品报告证据和低频竞品快照。
     - Keepa、SP-API、Amazon Ads API 未接入时，不代表 Amazon 官方销售、库存或广告市场数据。
   - 更新“使用说明”脚注：
     - 外部数据源未接入时，不影响看板生成，也不会参与分数或结论。
   - 新增 `.overview-boundary` 样式，保持第一屏可读和移动端换行稳定。

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地报告预览生成成功。
- 最新总览 HTML 已包含：
  - `overview-boundary`
  - `本看板汇总本地 CSV、单品报告证据和低频竞品快照`
  - `不代表 Amazon 官方销售、库存或广告市场数据`
  - `不会参与分数或结论`
- 总览页仍包含竞品快照日志入口和最新历史日志入口。
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 本轮没有做移动端截图验证，只做了模板、HTML、n8n 同步和 CSV 状态检查。
- 总览页说明是静态文案；未来真实接入 Keepa / SP-API / Ads API 后，需要根据配置状态动态调整“未接入”表达。
- 旧历史总览文件不会自动回写这条说明，最新总览已更新。

### 下一轮实现建议

1. 给 `tools/adapters/` 增加本地 `validate_adapter_contract.mjs`，只验证缓存 JSON 是否符合公共契约，不调用外部 API。
2. 给 `data_sources.local.json` 后续扩展 per-source `last_checked_at` 和 `owner_notes`。
3. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。

## 实现迭代 29：适配器缓存契约本地校验脚本

时间：2026-05-23 06:45（Asia/Shanghai）

### 本次实现依据

- 实现迭代 26 已预留 `tools/adapters/` 和公共响应契约。
- 后续如果接入 Keepa、SP-API、Amazon Ads API，应先验证缓存 JSON 是否符合公共契约，再让报告读取。
- 为避免误触发外部付费或官方 API，本轮只做本地 JSON 校验，不调用任何外部服务。

### 本次改动

1. 新增脚本：
   - `tools/adapters/validate_adapter_contract.mjs`
2. 更新说明：
   - `tools/adapters/README.md`
3. 校验内容：
   - 必填字段：`ok`、`source`、`status`、`fetched_at`、`cache`、`cost`、`data`、`evidence`、`risk_flags`
   - 枚举字段：`source`、`status`、`evidence.confidence`、`risk_flags.severity`
   - 嵌套字段：`cache`、`cost`、`error`
   - 数组元素：`evidence[]`、`risk_flags[]`
4. 脚本能力：
   - `--self-test`
   - `--help`
   - 校验一个或多个本地 JSON 文件
   - 返回非 0 退出码用于后续自动化集成

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `node tools/adapters/validate_adapter_contract.mjs --self-test` 输出：
  - `self-test: ok`
- `--help` 输出明确说明：
  - 只检查本地 cache / adapter JSON
  - 不调用外部 API
- 故意构造缺字段 JSON：
  - 校验返回退出码 `1`
  - 正确报告缺少 `status`、`fetched_at`、`cache`、`cost`、`data`、`evidence`、`risk_flags`
  - 临时测试文件已删除
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 校验器是轻量本地校验，不是完整 JSON Schema 引擎。
- 当前只校验公共契约，不校验 Keepa / SP-API / Ads API 各自 `data` 内部结构。
- 还没有真实 adapter cache 示例文件，后续接入时需要按来源补充 fixture。

### 下一轮实现建议

1. 给 `data_sources.local.json` 后续扩展 per-source `last_checked_at` 和 `owner_notes`。
2. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
3. 增加 adapters fixture 示例，但内容必须是脱敏假数据，不能包含真实 API 响应或凭据。

## 实现迭代 30：适配器契约增加脱敏 fixture 示例

时间：2026-05-23 06:50（Asia/Shanghai）

### 本次实现依据

- 实现迭代 29 已经有本地契约校验脚本。
- 校验器需要固定的合规示例，方便后续改契约时快速确认 Keepa、SP-API、Amazon Ads API 三类响应仍能通过。
- fixture 必须是脱敏假数据，不能从真实 API 响应复制，也不能包含 key、secret、token、password 等敏感字段。
- 本轮只增加本地示例和 README 用法，不改 n8n workflow，不调用任何外部 API。

### 本次改动

1. 新增 fixture 目录：
   - `tools/adapters/fixtures/`
2. 新增三份脱敏示例：
   - `tools/adapters/fixtures/keepa_connected.sample.json`
   - `tools/adapters/fixtures/sp_api_missing_config.sample.json`
   - `tools/adapters/fixtures/amazon_ads_not_connected.sample.json`
3. 更新说明：
   - `tools/adapters/README.md`
   - 新增 `Sanitized fixture check`
   - 明确 fixture 是假数据，不得替换为原始 API 响应或包含凭据的文件。

### 验证结果

- `validate_adapter_contract.mjs --self-test` 通过。
- 三份 fixture 全部通过契约校验：
  - `amazon_ads_not_connected.sample.json: ok`
  - `keepa_connected.sample.json: ok`
  - `sp_api_missing_config.sample.json: ok`
- 敏感字段扫描未命中：
  - `api_key`
  - `apikey`
  - `client_secret`
  - `refresh_token`
  - `access_token`
  - `authorization`
  - `password`
  - `bearer`
  - `sk-`
  - `AKIA`
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- fixture 只覆盖公共契约的代表性场景，不代表真实 API 字段完整性。
- Keepa 示例使用少量简化历史价格点，不代表真实 Keepa 数据结构。
- 后续真实 adapter 仍需要各自独立的字段级校验和缓存脱敏检查。

### 下一轮实现建议

1. 给 `data_sources.local.json` 后续扩展 per-source `last_checked_at` 和 `owner_notes`。
2. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
3. 给适配器 README 增加“接入前检查清单”，明确配置、缓存、校验、费用和合规检查顺序。

## 实现迭代 31：适配器接入前检查清单

时间：2026-05-23 06:58（Asia/Shanghai）

### 本次实现依据

- 实现迭代 26 已定义适配器契约。
- 实现迭代 29 已增加本地契约校验脚本。
- 实现迭代 30 已增加脱敏 fixture。
- 在真实接入 Keepa、SP-API、Amazon Ads API 前，需要固定接入顺序，避免把凭据写入仓库、绕过缓存、在报告生成时直接调用付费 API，或让失败传播成 n8n 工作流失败。
- 本轮只更新 README，不调用外部 API，不修改 n8n workflow。

### 本次改动

1. 更新：
   - `tools/adapters/README.md`
2. 新增章节：
   - `Pre-Integration Checklist`
3. 检查清单覆盖：
   - `Scope`
   - `Configuration`
   - `Dry Run`
   - `Cache`
   - `Validation`
   - `Cost And Rate Limits`
   - `Report Integration`
   - `Rollback`

### 关键规则

1. 适配器在 V1.x 阶段必须只读。
2. 凭据只能放环境变量或 n8n credentials，不能写入仓库文件。
3. 外部 API 调用结果必须先写脱敏缓存。
4. 报告生成只读缓存，不能在渲染节点里直接扇出调用付费 API。
5. SP-API PII 操作保持禁用。
6. Amazon Ads API 保持只读，不创建广告、不改预算、不调价。
7. 429、额度不足、权限不足、授权过期都必须转成 adapter status，而不是让工作流直接失败。
8. 启用前必须跑本地契约校验。

### 验证结果

- README 已包含：
  - `Pre-Integration Checklist`
  - `Scope`
  - `Configuration`
  - `Dry Run`
  - `Cache`
  - `Validation`
  - `Cost And Rate Limits`
  - `Report Integration`
  - `Rollback`
- `validate_adapter_contract.mjs --self-test` 通过。
- 三份 fixture 仍全部通过契约校验：
  - `amazon_ads_not_connected.sample.json: ok`
  - `keepa_connected.sample.json: ok`
  - `sp_api_missing_config.sample.json: ok`
- README 未发现真实凭据模式：
  - `sk-`
  - `AKIA`
  - `Bearer ...`
  - `refresh_token=...`
  - `client_secret=...`
  - `password=...`
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- README 是接入规范，不会自动阻止错误实现；后续真实适配器仍需要代码层防护。
- 还没有 per-source 运维字段，当前只有全局 `last_checked_at` 和 `owner_notes`。
- 总览页新增数据边界说明尚未做移动端截图验证。

### 下一轮实现建议

1. 给 `data_sources.local.json` 扩展 per-source `last_checked_at` 和 `owner_notes`。
2. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
3. 给适配器校验器增加 `--scan-sensitive` 参数，统一扫描 fixture/cache 中的敏感字段模式。

## 实现迭代 32：适配器校验器增加敏感字段扫描

时间：2026-05-23 07:03（Asia/Shanghai）

### 本次实现依据

- 实现迭代 29 已有本地契约校验器。
- 实现迭代 30 已有脱敏 fixture。
- 实现迭代 31 已要求接入前扫描 fixture/cache 样例。
- 为避免把 API key、secret、token、Authorization header、AWS access key、password 等敏感内容写入仓库或报告，需要把扫描能力固化到同一个适配器工具里。
- 本轮只改本地校验器和 README，不调用外部 API，不修改 n8n workflow。

### 本次改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - 新增 `--scan-sensitive <file...>` 模式。
   - 新增敏感模式：
     - OpenAI-style `sk-...`
     - AWS `AKIA...`
     - `Bearer ...`
     - `api_key` / `apikey` / `access_key`
     - `client_secret`
     - `refresh_token`
     - `access_token`
     - `authorization`
     - `password`
   - 扫描命中时输出行号、类型和截断样例，并返回非 0 退出码。
2. `tools/adapters/README.md`
   - 新增 `Sensitive-pattern scan` 用法。
   - 在接入前检查清单里要求每个 fixture/cache 样例都运行 `--scan-sensitive`。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `--help` 已显示：
  - `--scan-sensitive <adapter-output.json> [more.json]`
- `--self-test` 通过。
- 三份 fixture 仍全部通过契约校验。
- 三份 fixture 通过敏感扫描：
  - `no sensitive patterns found`
- 临时构造包含 `refresh_token` 的测试文件：
  - `--scan-sensitive` 返回退出码 `1`
  - 正确报告 `refresh token field with value`
  - 临时测试文件已删除
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 敏感扫描是模式识别，不能保证发现所有可能形式的密钥。
- 扫描可能对某些说明性文本产生误报；当前模式尽量限定为“字段 + 值”或常见密钥格式。
- 后续真实适配器仍应在写缓存前做字段白名单和脱敏处理，不能只依赖扫描器。

### 下一轮实现建议

1. 给 `data_sources.local.json` 扩展 per-source `last_checked_at` 和 `owner_notes`。
2. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
3. 给适配器校验器增加 `--check-all-fixtures` 快捷命令，一键跑 self-test、fixture 合约校验和敏感扫描。

## 实现迭代 33：适配器 fixture 一键检查命令

时间：2026-05-23 07:08（Asia/Shanghai）

### 本次实现依据

- 实现迭代 29 已有契约校验。
- 实现迭代 30 已有脱敏 fixture。
- 实现迭代 32 已有敏感字段扫描。
- 每次改 schema、validator 或 fixture 都要手动跑三条命令，容易漏掉其中一步。
- 本轮把 self-test、fixture 合约校验、fixture 敏感扫描合成一个本地快捷命令，不调用外部 API，不修改 n8n workflow。

### 本次改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - 新增 `--check-all-fixtures`。
   - 默认读取 `tools/adapters/fixtures/*.sample.json`。
   - 顺序执行：
     1. self-test
     2. fixture contract validation
     3. fixture sensitive-pattern scan
   - 任一步失败都会返回非 0 退出码。
2. `tools/adapters/README.md`
   - 新增 `One-command fixture check` 用法。
   - 在接入前检查清单中要求修改 schema、validator 或 fixture 后运行该命令。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `--help` 已显示：
  - `--check-all-fixtures`
- 运行：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures`
- 输出结果：
  - `[1/3] self-test`
  - `self-test: ok`
  - `[2/3] fixture contract validation`
  - 三份 fixture 均 `ok`
  - `[3/3] fixture sensitive-pattern scan`
  - 三份 fixture 均 `no sensitive patterns found`
  - `all fixture checks: ok`
- 当前 n8n workflow 未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T22:41:32.398Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- `--check-all-fixtures` 只检查 fixture，不扫描未来真实 cache 目录。
- 如果 fixture 数量很大，后续可能需要增加目录参数或并发控制。
- 真实适配器接入时仍需要单独验证每个 cache 输出。

### 下一轮实现建议

1. 给 `data_sources.local.json` 扩展 per-source `last_checked_at` 和 `owner_notes`。
2. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
3. 给校验器增加可选 `--fixtures-dir <dir>`，方便未来检查其他目录中的脱敏样例。

## 实现迭代 34：数据源配置扩展 per-source 运维字段

时间：2026-05-23 07:18（Asia/Shanghai）

### 本次实现依据

- 实现迭代 27 已增加全局 `last_checked_at` 和 `owner_notes`。
- 但全局备注无法说明每个数据源当前为什么启用或未接入。
- Keepa、SP-API、Amazon Ads API 后续会分别接入、缓存、限流和降级，需要每个 source 都能独立记录检查时间和运维备注。
- 本轮只扩展配置和报告证据，不接入外部 API，不触发 n8n 新执行。

### 本次改动

1. `config/data_sources.example.json`
   - 每个 `sources.*` 新增：
     - `last_checked_at`
     - `owner_notes`
2. `output/amazon_product_analysis/data_sources.local.json`
   - 每个数据源新增独立运维备注：
     - `crawlee`
     - `manual_inputs`
     - `competitor_snapshot`
     - `keepa`
     - `sp_api`
     - `amazon_ads_api`
3. `tools/n8n_html_report_code_optimized.js`
   - `configuredSource()` 读取 per-source `last_checked_at` 和 `owner_notes`。
   - 数据源卡片 detail 中追加：
     - `检查：...`
     - `备注：...`
   - `evidence_json` 新增 `data_source_details`，逐条输出：
     - `key`
     - `label`
     - `status`
     - `detail`
     - `last_checked_at`
     - `owner_notes`

### 验证结果

- `config/data_sources.example.json` 和 `output/amazon_product_analysis/data_sources.local.json` 均为合法 JSON。
- 所有 `sources.*` 均已包含：
  - `last_checked_at`
  - `owner_notes`
- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地报告预览生成成功。
- 最新 HTML 报告已包含：
  - `data_source_details`
  - `2026-05-23T07:16:00+08:00`
  - `没有 KEEPA_API_KEY`
  - `没有 SP-API 授权和凭据`
  - `没有 Ads API 授权`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T23:17:30.815Z`
  - `report_has_marker = true`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- per-source `last_checked_at` 仍是人工维护字段，不代表自动健康检查。
- 数据源卡片 detail 会变长；当前已验证 HTML 内容存在，但尚未做移动端截图。
- 后续真实适配器接入后，应由适配器运行结果自动更新更细的健康状态。

### 下一轮实现建议

1. 为总览页补一次移动端截图验证，确认新增说明不造成窄屏溢出。
2. 给校验器增加可选 `--fixtures-dir <dir>`，方便未来检查其他目录中的脱敏样例。
3. 增加一个只读数据源健康检查脚本，汇总 `data_sources.local.json` 和最新报告中的数据源状态。

## 实现迭代 35：总览看板移动端截图和布局稳定性验证

时间：2026-05-23 07:24（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 28 在总览页新增了数据边界说明。
- 实现迭代 34 扩展了每个数据源的 `last_checked_at` 和 `owner_notes`，说明文字更长。
- 总览看板是批量选品的入口，移动端必须优先保证“可读、无横向滚动、重点入口可点击”。
- 本轮只做展示层验证和文档沉淀，不修改生产模板，不触发新的 n8n 执行。

### 本轮检查结果

1. 当前项目状态
   - 当前目录不是 Git 仓库，因此本轮用文件时间、n8n 工作流状态和输出产物状态确认。
   - 最新单品报告存在：`output/amazon_product_analysis/amazon_product_analysis_latest.html`
   - 总览看板存在：`output/amazon_product_analysis/amazon_product_analysis_overview.html`
   - 主 CSV 仍为 `13` 条。
2. n8n 工作流状态
   - `active = true`
   - `updatedAt = 2026-05-22T23:17:30.815Z`
   - 最近执行 ID `26`，状态 `success`
   - 本轮没有触发新执行，也没有改动线上 workflow。
3. 移动端视觉验证
   - 使用本机 Chrome DevTools 协议打开总览页。
   - 视口宽度：`390px`
   - 截图输出：`output/amazon_product_analysis/v1_iter35_overview_mobile_cdp.png`
   - 顶部数据边界说明可见。
   - 工作入口、候选商品卡片和报告链接可见。

### 移动端量化验证

- `viewportWidth = 390`
- `documentScrollWidth = 390`
- `bodyScrollWidth = 390`
- `hasHorizontalOverflow = false`
- `overviewBoundaryVisible = true`
- `visibleCards = 29`
- `visibleMobileLists = 6`
- `visibleTables = 0`
- `visibleDesktopBlocks = 0`
- `overflowingNodes = []`

结论：总览看板在 390px 移动端宽度下已切换为移动卡片视图，没有横向溢出；新增数据边界说明和数据源说明没有撑破页面。

### 本轮剩余风险

- 当前验证覆盖的是最新总览页，不覆盖历史 HTML 报告。
- 本轮使用本机 Chrome DevTools 协议验证；项目内仍未固化成可复用的截图检查脚本。
- 只验证 390px 宽度，后续可补充 360px、414px 和桌面宽屏回归。

### 下一轮实现建议

1. 给适配器校验器增加可选 `--fixtures-dir <dir>`，方便未来检查其他目录中的脱敏样例。
2. 增加只读数据源健康检查脚本，汇总 `data_sources.local.json`、最新报告和适配器 fixture 状态。
3. 把本轮移动端截图检查沉淀成可复用脚本，作为以后改总览页 CSS 后的回归检查。

## 实现迭代 36：适配器 fixture 目录参数化

时间：2026-05-23 07:31（Asia/Shanghai）

### 本轮实现依据

- V1.0 预留 Keepa、SP-API、Amazon Ads API 适配器，但默认仍不接入外部付费 API。
- 实现迭代 33 已有 `--check-all-fixtures`，可以一次跑 self-test、fixture 合约校验和敏感信息扫描。
- 后续真实适配器可能把脱敏样例放在各自目录，不能把校验器固定死在 `tools/adapters/fixtures`。
- 本轮只增强本地校验工具，不修改报告模板，不同步 n8n，不触发新执行。

### 本轮改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - `--check-all-fixtures` 新增可选参数：
     - `--fixtures-dir <dir>`
   - 默认行为保持不变，仍检查 `tools/adapters/fixtures`。
   - 相对目录改为按项目根目录解析，避免终端当前目录不一致导致找错路径。
   - 如果单独使用 `--fixtures-dir`，会提示只能和 `--check-all-fixtures` 一起使用。
   - 输出中新增当前 fixture 目录，方便排查检查目标。
2. `tools/adapters/README.md`
   - 新增自定义 fixture 目录用法。
   - 在接入前检查清单中补充非默认目录校验要求。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `--help` 已显示：
  - `--check-all-fixtures [--fixtures-dir <dir>]`
- 默认目录检查通过：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures`
  - 三份 fixture 合约校验均 `ok`
  - 三份 fixture 敏感扫描均 `no sensitive patterns found`
  - `all fixture checks: ok`
- 自定义目录检查通过：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures --fixtures-dir tools/adapters/fixtures`
  - 输出目录正确解析为当前项目下的 `tools/adapters/fixtures`
  - `all fixture checks: ok`
- 误用参数验证通过：
  - `node tools/adapters/validate_adapter_contract.mjs --fixtures-dir tools/adapters/fixtures`
  - 返回退出码 `1`
  - 明确提示 `--fixtures-dir can only be used with --check-all-fixtures`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T23:17:30.815Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 校验器只验证本地 JSON 样例，不代表真实 API 权限、额度、限流或字段完整性。
- 敏感扫描是规则识别，不能替代适配器写入前的字段白名单和脱敏逻辑。
- 当前 `--fixtures-dir` 只读取目录下的 `*.sample.json`，如果未来真实 cache 样例命名不同，需要额外参数。

### 下一轮实现建议

1. 增加只读数据源健康检查脚本，汇总 `data_sources.local.json`、最新报告和 adapter fixture 状态。
2. 把移动端截图检查沉淀成可复用脚本，作为总览页 CSS 回归检查。
3. 为未来真实 adapter cache 目录设计 `--cache-dir <dir>` 校验模式，但默认仍不读取任何凭据。

## 实现迭代 37：只读数据源健康检查脚本

时间：2026-05-23 07:35（Asia/Shanghai）

### 本轮实现依据

- V1.0 当前依赖 Crawlee、手工字段和竞品快照，Keepa、SP-API、Amazon Ads API 只是预留适配器。
- 报告评分和证据已经依赖 `data_source_details`，后续改评分或接适配器前必须先确认数据源边界。
- 实现迭代 36 已支持自定义 fixture 目录，本轮把配置、报告和 fixture 校验串成一个只读健康检查。
- 本轮不调用外部 API，不读取或打印凭据值，不修改报告模板，不同步 n8n，不触发新执行。

### 本轮改动

1. 新增 `tools/adapters/check_data_source_health.mjs`
   - 默认读取：
     - `output/amazon_product_analysis/data_sources.local.json`
     - `output/amazon_product_analysis/amazon_product_analysis_latest.html`
     - `tools/adapters/fixtures`
   - 汇总每个数据源：
     - `status`
     - `mode`
     - `last_checked_at`
     - `owner_notes`
     - 预留适配器所需环境变量数量和本地可见数量
   - 检查最新报告是否包含：
     - `data_source_details`
     - 所有数据源标签
   - 自动调用本地 validator 跑 fixture 三步检查：
     - self-test
     - contract validation
     - sensitive-pattern scan
   - 支持：
     - `--json`
     - `--data-sources <path>`
     - `--report <path>`
     - `--fixtures-dir <dir>`
2. 更新 `tools/adapters/README.md`
   - 新增数据源健康检查用法。
   - 在接入前检查清单中要求启用预留 adapter 或改评分前先跑健康检查。

### 验证结果

- `node --check tools/adapters/check_data_source_health.mjs` 通过。
- `--help` 正常显示。
- 默认健康检查通过：
  - `Overall: OK`
  - `crawlee = OK`
  - `manual_inputs = OK`
  - `competitor_snapshot = OK`
  - `keepa = INFO / not_connected`
  - `sp_api = INFO / not_connected`
  - `amazon_ads_api = INFO / not_connected`
  - 最新报告存在。
  - 最新报告包含 `data_source_details`。
  - 数据源标签显示 `6/6`。
  - fixture 样例数 `3`。
  - fixture validation `ok`。
  - `Warnings: none`
  - `Issues: none`
- `--json` 输出通过，适合后续自动化读取。
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T23:17:30.815Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 健康检查只确认本地配置、最新报告和脱敏 fixture，不代表真实 Keepa、SP-API 或 Ads API 权限可用。
- 本地环境变量可见性只做数量统计，不打印值；真实凭据仍可能只存在 n8n 凭据中。
- 报告标签检查是文本存在性检查，不是完整 HTML 结构解析。

### 下一轮实现建议

1. 把移动端截图检查沉淀成可复用脚本，作为总览页 CSS 回归检查。
2. 为真实 adapter cache 目录设计 `--cache-dir <dir>` 校验模式，但默认只读、不读取凭据。
3. 在总览看板中增加“数据源健康检查入口/最后检查摘要”，让非技术用户能直接看到当前边界。

## 实现迭代 38：总览页移动端布局回归检查脚本

时间：2026-05-23 07:41（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 35 已手工验证总览看板在 390px 移动端无横向溢出。
- 总览页后续还会继续增加批量看板、数据源健康摘要和适配器状态，CSS 回归风险会持续存在。
- 需要把一次性截图验证变成可复用脚本，避免每次改报告后只靠肉眼判断。
- 本轮只新增本地检查工具和说明，不修改报告模板，不同步 n8n，不触发新执行。

### 本轮改动

1. 新增 `tools/check_overview_mobile_layout.mjs`
   - 默认检查：
     - `output/amazon_product_analysis/amazon_product_analysis_overview.html`
   - 默认截图输出：
     - `output/amazon_product_analysis/overview_mobile_layout_check.png`
   - 使用本机 Chrome/Edge headless 打开本地 HTML。
   - 支持：
     - `--json`
     - `--report <html>`
     - `--screenshot <png>`
     - `--width <px>`
     - `--height <px>`
     - `--chrome <path>`
   - 检查项：
     - 无横向溢出。
     - 顶部数据边界说明可见。
     - 没有可见节点撑破宽度。
     - 移动卡片可见。
     - 移动卡片分组可见。
     - 桌面表格和桌面表格容器已隐藏。
2. 更新 `README_AI选品分析系统.md`
   - 新增本地检查入口。
   - 补充数据源健康检查和移动端布局检查命令。

### 验证结果

- `node --check tools/check_overview_mobile_layout.mjs` 通过。
- `--help` 正常显示。
- 默认 390px 检查通过：
  - `Overall: OK`
  - `horizontal overflow: no`
  - `overview boundary visible: yes`
  - `visible cards: 29`
  - `visible mobile groups: 6`
  - `visible tables: 0`
  - `visible desktop blocks: 0`
  - `overflowing nodes: 0`
  - 输出截图：`output/amazon_product_analysis/overview_mobile_layout_check.png`
- 360px 检查通过：
  - 输出截图：`output/amazon_product_analysis/overview_mobile_layout_360.png`
- 414px 检查通过：
  - 输出截图：`output/amazon_product_analysis/overview_mobile_layout_414.png`
- `--json` 输出通过，适合后续自动化读取。
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T23:17:30.815Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 该脚本只验证总览页，不验证单品报告详情页。
- 该脚本依赖本机 Chrome/Edge；如果机器未安装浏览器，需要通过 `--chrome <path>` 指定。
- 当前只做布局指标检查，不做截图像素级差异比对。

### 下一轮实现建议

1. 为真实 adapter cache 目录设计 `--cache-dir <dir>` 校验模式，但默认只读、不读取凭据。
2. 在总览看板中增加“数据源健康检查摘要”，让非技术用户能直接看到当前边界。
3. 给单品最新报告增加同类移动端布局检查脚本，覆盖第一屏决策看板。

## 实现迭代 39：真实 adapter cache 目录只读校验模式

时间：2026-05-23 07:45（Asia/Shanghai）

### 本轮实现依据

- V1.0 预留 Keepa、SP-API、Amazon Ads API 适配器，但真实接入前必须先保证本地 cache 不含凭据且符合统一合约。
- 实现迭代 36 已支持 fixture 目录校验，但 fixture 是脱敏样例，不等于未来真实 cache 输出目录。
- 未来 cache 目录会按 `output/amazon_product_analysis/cache/{source}/...` 分层存放，因此校验器需要递归读取 `.json` 文件。
- 本轮只增强本地校验工具，不调用外部 API，不读取凭据，不修改报告模板，不同步 n8n，不触发新执行。

### 本轮改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - 新增命令：
     - `--cache-dir <dir>`
   - 递归读取目录下所有 `.json` 文件。
   - 对每个 JSON 执行：
     - adapter contract validation
     - sensitive-pattern scan
   - 输出 cache 目录和文件数量。
   - 所有文件通过时输出：
     - `all cache checks: ok`
   - `--cache-dir` 必须单独使用，避免和 `--scan-sensitive`、fixture 模式混淆。
2. `tools/adapters/README.md`
   - 新增 cache directory validation 用法。
   - 在接入前检查清单中要求真实 adapter cache 进入报告证据前先运行 `--cache-dir <dir>`。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `--help` 已显示：
  - `node tools/adapters/validate_adapter_contract.mjs --cache-dir <dir>`
- 默认 fixture 检查仍通过：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures`
  - `all fixture checks: ok`
- 自定义 fixture 目录检查仍通过：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures --fixtures-dir tools/adapters/fixtures`
  - `all fixture checks: ok`
- cache 目录递归检查通过：
  - `node tools/adapters/validate_adapter_contract.mjs --cache-dir tools/adapters/fixtures`
  - `cache files: 3`
  - 三份 JSON 合约校验均 `ok`
  - 三份 JSON 敏感扫描均 `no sensitive patterns found`
  - `all cache checks: ok`
- 误用参数验证通过：
  - `node tools/adapters/validate_adapter_contract.mjs --cache-dir tools/adapters/fixtures --scan-sensitive`
  - 返回退出码 `1`
  - 明确提示 `--cache-dir must be used by itself: --cache-dir <dir>`
- 数据源健康检查仍通过：
  - `Overall: OK`
  - `Warnings: none`
  - `Issues: none`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-22T23:17:30.815Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- `--cache-dir` 只验证本地 JSON 文件，不代表真实 API 权限、额度、限流或字段业务含义正确。
- 敏感扫描仍是规则识别，不能替代 adapter 写入前的字段白名单和脱敏逻辑。
- 当前 cache 检查没有区分 source 子目录；未来可以增加按 source 汇总、过期 TTL 检查和 stale cache 提醒。

### 下一轮实现建议

1. 在总览看板中增加“数据源健康检查摘要”，让非技术用户能直接看到当前边界。
2. 给单品最新报告增加移动端布局检查脚本，覆盖第一屏决策看板。
3. 给 cache 校验模式增加按 source 汇总和 TTL/stale 过期提示。

## 实现迭代 40：总览看板数据源健康摘要

时间：2026-05-23 07:53（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 37 已有只读数据源健康检查脚本，但非技术用户仍需要打开命令行才能看到状态。
- 总览看板是批量选品入口，应在第一屏直接说明当前数据边界。
- V1.0 当前只启用 Crawlee、手工字段和竞品快照；Keepa、SP-API、Amazon Ads API 是高级预留，未接入时不能误导为官方销售、库存或广告数据。
- 本轮只改 HTML 报告展示和本地回归检查，不触发新的 n8n 执行。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - `buildOverviewReport()` 读取 `data_sources.local.json`。
   - 总览页第一屏新增“数据源健康”摘要模块。
   - 展示：
     - `本地可用 3/3`
     - `高级预留未接入 3/3`
     - `配置正常`
     - 6 个数据源状态标签：页面抓取、手工增强字段、竞品快照、Keepa、SP-API、Amazon Ads API。
   - 说明未接入高级数据源不参与评分，当前结论按本地抓取、手工字段和竞品快照生成。
   - 移动端使用两列状态标签，避免横向溢出。
2. `tools/check_overview_mobile_layout.mjs`
   - 新增回归指标：
     - `sourceHealthVisible`
     - `sourceChipCount`
   - 新增检查项：
     - `source health summary visible`
     - `source status chips visible`
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`source-health`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地预览生成成功。
- 最新总览 HTML 已包含：
  - `数据源健康`
  - `本地可用 3/3 · 高级预留未接入 3/3`
  - `配置正常`
- 数据源健康检查仍通过：
  - `Overall: OK`
  - `Warnings: none`
  - `Issues: none`
- 移动端布局检查通过：
  - 390px：`Overall: OK`
  - 360px：`Overall: OK`
  - 414px：`Overall: OK`
  - `source health visible: yes`
  - `source chips: 6`
  - `horizontal overflow: no`
  - `visible tables: 0`
  - `overflowing nodes: 0`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-22T23:52:21.255Z`
  - `report_has_marker = true`
  - `report_code_length = 93375`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 总览页数据源健康摘要来自本地配置和报告状态，不代表 Keepa、SP-API 或 Ads API 的真实授权可用。
- 预留适配器一旦改为 `configured` 或 `connected`，仍需要先跑 adapter cache 校验和数据源健康检查。
- 本轮只增强总览页，单品详情页第一屏移动端仍缺少独立回归检查脚本。

### 下一轮实现建议

1. 给单品最新报告增加移动端布局检查脚本，覆盖第一屏决策看板。
2. 给 cache 校验模式增加按 source 汇总和 TTL/stale 过期提示。
3. 在总览页增加最近一次本地检查截图/校验文件入口，方便回溯视觉状态。

## 实现迭代 41：单品最新报告移动端布局回归检查脚本

时间：2026-05-23 08:05（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 38 已经让总览看板具备移动端布局回归检查。
- 单品最新报告是用户最常打开的决策页，第一屏必须稳定展示结论、总分、关键证据、关键风险和下一步动作。
- 实现迭代 40 的剩余风险明确指出：单品详情页第一屏仍缺少独立移动端回归检查脚本。
- 本轮只推进单品报告移动端检查和一处移动端文案优化，不触发新的 n8n 执行。

### 本轮改动

1. 新增 `tools/check_latest_report_mobile_layout.mjs`
   - 默认检查：
     - `output/amazon_product_analysis/amazon_product_analysis_latest.html`
   - 默认截图输出：
     - `output/amazon_product_analysis/latest_report_mobile_layout_check.png`
   - 使用本机 Chrome/Edge headless 打开本地 HTML。
   - 支持：
     - `--json`
     - `--report <html>`
     - `--screenshot <png>`
     - `--width <px>`
     - `--height <px>`
     - `--chrome <path>`
   - 检查项：
     - 无横向溢出。
     - 第一屏 hero 可见。
     - 评分环可见且分数为 0-100。
     - 选品推荐指数文案可见。
     - 商品视觉区可见。
     - 价格/评分/评论/库存指标卡可见。
     - 数据源卡片可见。
     - 移动摘要卡可见。
     - 移动端隐藏桌面决策卡。
     - 移动摘要中包含证据、风险和下一步动作。
2. `tools/n8n_html_report_code_optimized.js`
   - 单品报告移动端第四张摘要卡从“竞品快照”优化为：
     - `关键证据`
     - `竞品快照：已接入/未接入/...`
   - 让手机首屏和桌面端“关键证据 / 关键风险 / 下一步动作”的决策结构保持一致。
3. `README_AI选品分析系统.md`
   - 新增单品最新报告移动端布局检查命令。
4. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
5. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`竞品快照：`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- `node --check tools/check_latest_report_mobile_layout.mjs` 通过。
- 本地预览生成成功。
- 单品最新报告移动端检查通过：
  - 390px：`Overall: OK`
  - 360px：`Overall: OK`
  - 414px：`Overall: OK`
  - `horizontal overflow: no`
  - `hero visible: yes`
  - `score: 77`
  - `decision visible: yes`
  - `mobile brief visible: yes`
  - `mobile brief cards: 4`
  - `decision board visible: 0`
  - `product visual visible: yes`
  - `metric cards: 4`
  - `data source cards: 7`
  - `overflowing nodes: 0`
- `--json` 输出通过，适合后续自动化读取。
- 总览页移动端布局检查仍通过：
  - `Overall: OK`
- 数据源健康检查仍通过：
  - `Overall: OK`
  - `Warnings: none`
  - `Issues: none`
- adapter fixture 检查仍通过：
  - `all fixture checks: ok`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T00:03:44.240Z`
  - `report_has_marker = true`
  - `report_code_length = 93380`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 单品移动端检查依赖本机 Chrome/Edge；如果机器没有浏览器，需要通过 `--chrome <path>` 指定。
- 该脚本检查的是最新报告和结构指标，不做像素级截图差异比对。
- 当前检查覆盖第一屏关键决策区，但不逐项验证所有下方表格和折叠原文内容。

### 下一轮实现建议

1. 给 cache 校验模式增加按 source 汇总和 TTL/stale 过期提示。
2. 增加一个“一键本地回归检查”脚本，串联数据源健康、fixture/cache 校验、总览移动端和单品移动端检查。
3. 在总览页增加最近一次本地检查截图/校验文件入口，方便回溯视觉状态。

## 实现迭代 42：cache 校验按 source 汇总和 TTL/stale 提示

时间：2026-05-23 08:10（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 39 已有 `--cache-dir <dir>`，可以递归检查真实 adapter cache 的 JSON 合约和敏感信息。
- 但真实接入 Keepa、SP-API、Amazon Ads API 后，仅知道“文件通过/失败”不够，还需要按 source 看缓存数量、状态和新鲜度。
- V1.0 报告会读取 cache 作为证据，过期或 stale cache 不能被误解为最新市场数据。
- 本轮只增强本地校验工具，不调用外部 API，不读取凭据，不修改报告模板，不同步 n8n，不触发新执行。

### 本轮改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - `--cache-dir <dir>` 从两步检查扩展为三步检查：
     - `[1/3] cache contract validation`
     - `[2/3] cache sensitive-pattern scan`
     - `[3/3] cache source and freshness summary`
   - 新增按 `source` 汇总：
     - `files`
     - `statuses`
     - `stale`
     - `expired`
     - `ttl_missing`
     - `fetched_missing`
     - `oldest`
     - `newest`
   - 新增 TTL/stale 提示：
     - `cache.stale = true` 会进入 freshness warning。
     - `fetched_at + cache.ttl_hours` 早于当前时间会进入 expired warning。
     - 缺失或无效 `fetched_at` / `ttl_hours` 会进入 warning。
   - freshness warning 只提示，不改变退出码；命令失败仍只由 JSON 合约错误或敏感信息扫描错误决定。
2. `tools/adapters/README.md`
   - 补充 cache source-level freshness summary 说明。
   - 明确 stale/expired 是提示，不等于命令失败。
   - 增加接入建议：过期或 stale cache 应先刷新，再用于趋势或广告表现证据。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- 默认 fixture 检查仍通过：
  - `node tools/adapters/validate_adapter_contract.mjs --check-all-fixtures`
  - `all fixture checks: ok`
- cache 目录递归检查通过：
  - `node tools/adapters/validate_adapter_contract.mjs --cache-dir tools/adapters/fixtures`
  - `cache files: 3`
  - 三份 JSON 合约校验均 `ok`
  - 三份 JSON 敏感扫描均 `no sensitive patterns found`
  - source 汇总输出：
    - `amazon_ads_api: files=1, statuses=not_connected:1, stale=0, expired=0`
    - `keepa: files=1, statuses=connected:1, stale=0, expired=0`
    - `sp_api: files=1, statuses=missing_config:1, stale=0, expired=0`
  - `cache freshness warnings: none`
  - `all cache checks: ok`
- 数据源健康检查仍通过：
  - `Overall: OK`
  - `Warnings: none`
  - `Issues: none`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-23T00:03:44.240Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- TTL/stale 提示依赖 adapter cache 正确写入 `fetched_at` 和 `cache.ttl_hours`。
- freshness warning 不会让命令失败；如果未来希望 CI 阶段强制失败，需要新增严格模式。
- source 汇总只基于 cache JSON 自身字段，不验证真实 API 额度、权限或业务指标可信度。

### 下一轮实现建议

1. 增加一个“一键本地回归检查”脚本，串联数据源健康、fixture/cache 校验、总览移动端和单品移动端检查。
2. 在总览页增加最近一次本地检查截图/校验文件入口，方便回溯视觉状态。
3. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。

## 实现迭代 43：一键本地回归检查脚本

时间：2026-05-23 08:18（Asia/Shanghai）

### 本轮实现依据

- V1.0 已经具备数据源健康检查、adapter fixture/cache 校验、总览移动端检查和单品移动端检查。
- 如果每次模板或适配器改动都手动运行多条命令，容易漏掉某一项。
- 本轮把关键本地检查串成一个入口，作为“改动后先本地回归，再决定是否同步 n8n 或执行 workflow”的固定动作。
- 本轮不调用外部 API，不触发 n8n 执行，不修改报告模板。

### 本轮改动

1. 新增 `tools/run_local_regression_checks.mjs`
   - 默认串联运行：
     - 数据源健康检查。
     - adapter fixture 合约和敏感扫描。
     - adapter cache 合约、敏感扫描和 freshness 汇总。
     - 总览页移动端布局检查。
     - 单品最新报告移动端布局检查。
   - 如果默认 cache 目录没有 JSON 文件，cache 步骤标记为 `SKIP`，不算失败。
   - 支持：
     - `--json`
     - `--cache-dir <dir>`
     - `--summary <json>`
   - 默认写出：
     - `output/amazon_product_analysis/local_regression_latest.json`
2. `README_AI选品分析系统.md`
   - 新增“一键本地回归检查”命令。
   - 说明默认结果文件位置。

### 验证结果

- `node --check tools/run_local_regression_checks.mjs` 通过。
- `--help` 正常显示。
- 默认一键检查通过：
  - `Overall: OK`
  - `Data source health = OK`
  - `Adapter fixture contract and sensitive scan = OK`
  - `Adapter cache = SKIP`
  - `Overview mobile layout = OK`
  - `Latest product report mobile layout = OK`
  - 结果文件：`output/amazon_product_analysis/local_regression_latest.json`
- 指定 fixture 目录模拟 cache 检查通过：
  - `node tools/run_local_regression_checks.mjs --cache-dir tools/adapters/fixtures --summary output/amazon_product_analysis/local_regression_with_fixture_cache.json`
  - `Overall: OK`
  - `Adapter cache contract, sensitive scan, and freshness summary = OK`
- `--json` 输出通过，适合后续自动化读取：
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
- 默认结果文件已生成：
  - `local_regression_latest.json`
- fixture cache 模拟结果文件已生成：
  - `local_regression_with_fixture_cache.json`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-23T00:03:44.240Z`
  - 最近执行 ID `26`，状态 `success`
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 一键检查当前默认只跑 390px 移动端宽度；360px/414px 仍可用独立脚本补测。
- 默认 cache 目录为空时会跳过 cache 检查；真实 adapter 接入后应确保 cache 目录存在并包含 JSON。
- 回归结果 JSON 保存命令输出文本，适合追踪，但还不是面向非技术用户的 HTML 汇总。

### 下一轮实现建议

1. 在总览页增加最近一次本地检查截图/校验文件入口，方便回溯视觉状态。
2. 给一键回归脚本增加多视口模式，覆盖 360px、390px、414px。
3. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。

## 实现迭代 44：总览页本地回归检查入口

时间：2026-05-23 08:30（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 43 已经生成 `local_regression_latest.json`，但用户仍需要去文件夹里找结果。
- 总览看板是批量选品入口，应该直接展示最近一次本地回归状态，并提供截图和 JSON 入口。
- 这个入口只读取本地文件，不运行检查、不调用外部 API、不触发 n8n workflow。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - `buildOverviewReport()` 读取：
     - `local_regression_latest.json`
     - `overview_mobile_layout_check.png`
     - `latest_report_mobile_layout_check.png`
   - 总览页新增“本地回归检查”面板。
   - 展示：
     - 最近检查时间。
     - 总状态：`OK / FAILED / 未生成`。
     - 通过、跳过、失败数量。
     - 三个入口：
       - 回归结果 JSON
       - 总览移动截图
       - 单品移动截图
   - 移动端使用单列链接，避免横向溢出。
2. `tools/check_overview_mobile_layout.mjs`
   - 新增回归入口检查：
     - `checkSummaryVisible`
     - `checkLinks`
   - 新增断言：
     - `local regression summary visible`
     - `local regression links visible`
3. `README_AI选品分析系统.md`
   - 补充说明：总览看板会读取最近一次本地回归结果，并提供 JSON 和截图入口。
4. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
5. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`本地回归检查`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- `node --check tools/check_overview_mobile_layout.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- 本地预览生成成功。
- 一键本地回归检查通过：
  - `Overall: OK`
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
- 总览页已包含：
  - `本地回归检查`
  - `通过 4`
  - `跳过 1`
  - `失败 0`
  - `回归结果 JSON`
  - `总览移动截图`
  - `单品移动截图`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression visible: yes`
  - `local regression links: 3`
  - `horizontal overflow: no`
  - `visible tables: 0`
  - `overflowing nodes: 0`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 数据源健康检查仍通过：
  - `Overall: OK`
  - `Warnings: none`
  - `Issues: none`
- adapter fixture 检查仍通过：
  - `all fixture checks: ok`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T00:29:35.589Z`
  - `report_has_marker = true`
  - `report_code_length = 97212`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 总览页展示的是最近一次已生成的本地回归结果，不会自动重新运行检查。
- 当前入口链接到 JSON 和 PNG，仍不是专门的 HTML 回归报告。
- 一键检查默认仍只覆盖 390px；360px/414px 需要独立脚本或后续多视口模式。

### 下一轮实现建议

1. 给一键回归脚本增加多视口模式，覆盖 360px、390px、414px。
2. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。
3. 把本地回归结果渲染为轻量 HTML 报告，供总览页直接打开。

## 实现迭代 45：一键回归多视口模式

时间：2026-05-23 08:35（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 44 已经把本地回归状态放进总览页，但回归脚本默认只检查 390px。
- 用户重点要求“文字排版简洁、易读、重点”，移动端是最容易出现标题、按钮、卡片挤压的位置。
- 360px、390px、414px 分别覆盖窄屏、常见中屏和大屏手机宽度，适合作为 V1.0 报告模板的基础视觉回归断点。

### 本轮改动

1. `tools/run_local_regression_checks.mjs`
   - 新增 `--multi-viewport` 参数。
   - 新增 `--viewports 360,390,414` 自定义参数。
   - 默认行为保持不变：仍只跑 390px，仍写入 `local_regression_latest.json`。
   - 多视口模式会分别运行：
     - 总览页 360px、390px、414px 检查。
     - 单品最新报告 360px、390px、414px 检查。
   - 多视口截图按宽度输出，例如：
     - `overview_mobile_layout_check_360.png`
     - `latest_report_mobile_layout_check_360.png`
   - 回归 JSON 新增：
     - `mobile_viewports`
     - `mobile_height`
2. `README_AI选品分析系统.md`
   - 补充多视口回归命令：
     - `node tools/run_local_regression_checks.mjs --multi-viewport`
   - 说明默认 390px，增强模式覆盖 360/390/414。

### 验证结果

- `node --check tools/run_local_regression_checks.mjs` 通过。
- 默认一键回归检查通过：
  - `Overall: OK`
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
- 多视口一键回归检查通过：
  - `Overall: OK`
  - `total = 9`
  - `passed = 8`
  - `skipped = 1`
  - `failed = 0`
  - `mobile_viewports = 360,390,414`
- 已生成多视口结果文件：
  - `local_regression_multi_viewport.json`
- 已生成多视口截图：
  - `overview_mobile_layout_check_360.png`
  - `overview_mobile_layout_check_390.png`
  - `overview_mobile_layout_check_414.png`
  - `latest_report_mobile_layout_check_360.png`
  - `latest_report_mobile_layout_check_390.png`
  - `latest_report_mobile_layout_check_414.png`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-23T00:29:35.589Z`
  - 最近执行 ID `26`，状态 `success`

### 本轮剩余风险

- 多视口模式当前不会覆盖桌面大屏；桌面报告主要依赖人工打开或后续增加桌面截图检查。
- 总览页当前仍只读取默认 `local_regression_latest.json`，不会自动展示 `local_regression_multi_viewport.json`。
- cache 目录为空时仍按跳过处理；真实接入 Keepa/SP-API/Ads API 后需要严格模式判断过期数据。

### 下一轮实现建议

1. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。
2. 把本地回归结果渲染为轻量 HTML 报告，供总览页直接打开。
3. 让总览页识别多视口回归结果，并展示覆盖断点数量。

## 实现迭代 46：本地回归 HTML 报告

时间：2026-05-23 08:45（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 44 的总览页已经提供 JSON 和截图入口，但 JSON 对非技术查看不够直观。
- 实现迭代 45 已经支持多视口回归，结果项更多，适合沉淀成一份可直接打开的 HTML 检查报告。
- 本轮只增强本地回归输出和总览入口，不触发 n8n 执行，不改变爬虫、AI 节点或 CSV 写入逻辑。

### 本轮改动

1. `tools/run_local_regression_checks.mjs`
   - 默认在写入 JSON 的同时生成 HTML 回归报告。
   - 新增 `--html <html>` 参数，可指定 HTML 输出路径。
   - JSON 摘要新增：
     - `html_report_path`
   - 默认输出：
     - `local_regression_latest.json`
     - `local_regression_latest.html`
   - 多视口输出：
     - `local_regression_multi_viewport.json`
     - `local_regression_multi_viewport.html`
   - HTML 报告展示：
     - 总状态。
     - 通过、跳过、失败数量。
     - 覆盖的移动宽度。
     - JSON 明细入口。
     - 对应宽度截图入口。
     - 每个检查步骤的状态和关键输出。
2. `tools/n8n_html_report_code_optimized.js`
   - 总览页“本地回归检查”入口新增：
     - `回归报告 HTML`
3. `README_AI选品分析系统.md`
   - 补充 HTML 回归报告路径和总览入口说明。
4. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
5. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`回归报告 HTML`

### 验证结果

- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 默认一键回归检查通过：
  - `Overall: OK`
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
  - `html_report_path = local_regression_latest.html`
- 多视口一键回归检查通过：
  - `Overall: OK`
  - `total = 9`
  - `passed = 8`
  - `skipped = 1`
  - `failed = 0`
  - `html_report_path = local_regression_multi_viewport.html`
  - `mobile_viewports = 360,390,414`
- 本地预览生成成功。
- 总览页已出现：
  - `回归报告 HTML`
  - `回归结果 JSON`
  - `总览移动截图`
  - `单品移动截图`
- HTML 回归报告已包含：
  - `AI选品系统本地回归检查`
  - `JSON 明细`
  - `总览截图 390px`
  - `单品截图 390px`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 4`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T00:44:36.293Z`
  - `report_has_marker = true`
  - `report_code_length = 97278`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 总览页当前只链接默认 `local_regression_latest.html`，多视口 HTML 需要从文件夹或命令输出打开。
- HTML 回归报告是静态文件，只有运行回归脚本后才刷新。
- cache 目录为空时仍按跳过处理；真实接入高级数据源后仍需要严格模式判断 stale/expired。

### 下一轮实现建议

1. 让总览页识别多视口回归结果，并展示覆盖断点数量和多视口 HTML 入口。
2. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。
3. 增加桌面宽度截图检查，补齐 1366px 或 1440px 的报告布局回归。

## 实现迭代 47：总览页识别多视口回归

时间：2026-05-23 08:49（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 45 已经能生成 360px、390px、414px 多视口回归结果。
- 实现迭代 46 已经把默认回归 HTML 放入总览页，但多视口报告仍需要用户到文件夹里找。
- 总览页是批量看板和运维入口，应直接暴露“是否做过多视口检查、覆盖了哪些宽度、检查是否通过”。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - 总览页读取：
     - `local_regression_latest.json`
     - `local_regression_multi_viewport.json`
   - “本地回归检查”面板新增：
     - 默认检查宽度。
     - 多视口覆盖宽度。
     - 多视口状态。
     - 多视口最近检查时间。
   - 入口新增：
     - `多视口报告 HTML`
     - `多视口结果 JSON`
   - 移动端仍保持单列链接，避免横向溢出。
2. `README_AI选品分析系统.md`
   - 补充说明：运行 `--multi-viewport` 后，总览页会显示 360/390/414 覆盖宽度和多视口报告入口。
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`多视口报告 HTML`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 多视口一键回归检查通过：
  - `Overall: OK`
  - `total = 9`
  - `passed = 8`
  - `skipped = 1`
  - `failed = 0`
  - `mobile_viewports = 360,390,414`
- 本地预览生成成功。
- 总览页已出现：
  - `多视口 360px / 390px / 414px`
  - `多视口状态 OK`
  - `多视口报告 HTML`
  - `多视口结果 JSON`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 6`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T00:49:07.576Z`
  - `report_has_marker = true`
  - `report_code_length = 98780`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 多视口状态展示依赖最近一次 `--multi-viewport` 输出；如果长期不运行，页面只会展示旧检查时间。
- 当前仍未覆盖桌面大屏视觉回归。
- cache 目录为空仍是跳过，不会在默认模式下阻断回归。

### 下一轮实现建议

1. 给 cache 校验增加可选严格模式，让 stale/expired 在需要时返回非 0。
2. 增加桌面宽度截图检查，补齐 1366px 或 1440px 的报告布局回归。
3. 在总览页给过期回归结果加醒目标识，例如超过 24 小时显示“需重跑”。

## 实现迭代 48：cache 新鲜度严格模式

时间：2026-05-23 08:54（Asia/Shanghai）

### 本轮实现依据

- V1.0 方案要求数据来源可信度可解释，不能只检查 JSON 字段结构。
- 实现迭代 42 已经能提示 cache stale/expired，但默认不会阻断回归。
- 当前 Keepa、SP-API、Ads API 仍是预留适配器；后续一旦接入付费或半自动数据源，过期 cache 必须能在需要时变成失败。

### 本轮改动

1. `tools/adapters/validate_adapter_contract.mjs`
   - 新增 `--strict-freshness`。
   - 用法：
     - `node tools/adapters/validate_adapter_contract.mjs --cache-dir <dir> --strict-freshness`
   - 默认模式保持不变：
     - stale、expired、缺少 `ttl_hours`、`fetched_at` 异常只作为 warning。
   - 严格模式：
     - stale cache 返回非 0。
     - TTL expired 返回非 0。
     - `ttl_hours` 缺失或异常返回非 0。
     - `fetched_at` 缺失或异常返回非 0。
2. `tools/run_local_regression_checks.mjs`
   - 新增 `--strict-cache`。
   - 有 cache 文件时，会把 `--strict-freshness` 传给 adapter validator。
   - 无 cache 文件时：
     - 默认模式仍是 `SKIP`。
     - `--strict-cache` 模式下变成 `FAIL`。
   - 回归 JSON 和 HTML 新增/展示：
     - `strict_cache`
3. `tools/adapters/fixtures/strict_freshness/keepa_stale_cache.json`
   - 新增 stale/expired 负向 fixture。
   - 用于验证默认模式只提示 warning，严格模式失败。
4. `README_AI选品分析系统.md`
   - 补充严格 cache 回归命令：
     - `node tools/run_local_regression_checks.mjs --strict-cache`
   - 说明 strict cache 会把 stale、expired 或缺少新鲜度字段的 cache 视为失败。

### 验证结果

- `node --check tools/adapters/validate_adapter_contract.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- adapter fixture 检查通过：
  - `all fixture checks: ok`
- 正常 fixture cache 严格模式通过：
  - `strict freshness: ok`
  - `all cache checks: ok`
- stale/expired 负向 fixture 默认模式通过但给 warning：
  - `stale = 1`
  - `expired = 1`
  - `cache freshness warnings` 包含 stale 和 TTL expired。
  - 返回码为 `0`。
- stale/expired 负向 fixture 严格模式失败：
  - `strict freshness failures` 包含 stale 和 TTL expired。
  - 返回码为 `1`。
- 默认一键本地回归仍通过：
  - `Overall: OK`
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
- fixture cache 严格一键回归通过：
  - `Overall: OK`
  - cache step 为 `OK`
- 默认空 cache 严格一键回归按预期失败：
  - `Overall: FAILED`
  - cache step 为 `FAIL`
  - 原因：默认 cache 目录下没有 JSON cache 文件。
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-23T00:49:07.576Z`
  - 最近执行 ID `26`，状态 `success`

### 本轮剩余风险

- 严格模式当前只在命令行启用，总览页只展示最近一次回归是否开启了 `strict_cache`。
- 默认输出目录的 cache 仍为空，因此生产使用 `--strict-cache` 前需要先接入真实 cache 数据。
- 还没有桌面大屏截图回归。

### 下一轮实现建议

1. 增加桌面宽度截图检查，补齐 1366px 或 1440px 的报告布局回归。
2. 在总览页给过期回归结果加醒目标识，例如超过 24 小时显示“需重跑”。
3. 给 strict cache 失败结果增加总览页提示，让非技术用户知道是 cache 为空或过期。

## 实现迭代 49：桌面宽度布局回归

时间：2026-05-23 09:01（Asia/Shanghai）

### 本轮实现依据

- 迭代 45 已经覆盖 360px、390px、414px 移动端，但桌面端仍主要依赖人工打开检查。
- 当前报告第一屏强调“决策看板”和“数据透视”，桌面端需要确保表格、决策区、商品视觉区和数据源卡片没有横向溢出。
- 桌面宽度选择 1366px，覆盖常见笔记本和远程桌面场景；后续可通过 `--desktop-width 1440` 扩展。

### 本轮改动

1. `tools/check_overview_mobile_layout.mjs`
   - 在 `width >= 900` 时新增桌面断言：
     - 桌面表格可见。
     - 移动卡片在桌面隐藏。
     - 无横向溢出。
2. `tools/check_latest_report_mobile_layout.mjs`
   - 在 `width >= 900` 时新增桌面断言：
     - 单品决策看板可见。
     - 移动摘要卡在桌面隐藏。
     - 桌面表格可用。
     - 关键证据、风险和下一步动作文本仍存在。
3. `tools/run_local_regression_checks.mjs`
   - 新增 `--desktop`。
   - 默认桌面宽度为 `1366px`，高度为 `1000px`。
   - 支持：
     - `--desktop-width 1440`
     - `--desktop-height 1000`
   - 生成桌面截图：
     - `overview_desktop_layout_check.png`
     - `latest_report_desktop_layout_check.png`
   - 回归 JSON/HTML 新增：
     - `desktop_check`
     - `desktop_width`
     - `desktop_height`
     - 桌面截图入口。
4. `README_AI选品分析系统.md`
   - 补充桌面回归命令：
     - `node tools/run_local_regression_checks.mjs --desktop`

### 验证结果

- `node --check tools/check_overview_mobile_layout.mjs` 通过。
- `node --check tools/check_latest_report_mobile_layout.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `visible cards = 0`
  - `visible mobile groups = 0`
  - `horizontal overflow = no`
- 单品最新报告 1366px 桌面检查通过：
  - `Overall: OK`
  - `decision board visible = 1`
  - `mobile brief visible = no`
  - `visible tables = 2`
  - `horizontal overflow = no`
- 默认一键回归仍保持原行为并通过：
  - `Overall: OK`
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
- 桌面一键回归通过：
  - `Overall: OK`
  - `total = 7`
  - `passed = 6`
  - `skipped = 1`
  - `failed = 0`
  - `desktop_width = 1366`
- 多视口 + 桌面一键回归通过：
  - `Overall: OK`
  - `total = 11`
  - `passed = 10`
  - `skipped = 1`
  - `failed = 0`
  - `mobile_viewports = 360,390,414`
  - `desktop_width = 1366`
- 已生成桌面结果文件：
  - `local_regression_desktop.json`
  - `local_regression_desktop.html`
  - `local_regression_multi_viewport_desktop.json`
  - `local_regression_multi_viewport_desktop.html`
- 已生成桌面截图：
  - `overview_desktop_layout_check.png`
  - `latest_report_desktop_layout_check.png`
- n8n 工作流未改动：
  - `active = true`
  - `updatedAt = 2026-05-23T00:49:07.576Z`
  - 最近执行 ID `26`，状态 `success`

### 本轮剩余风险

- 桌面回归当前是可选参数，默认一键回归仍只跑 390px 移动端。
- 总览页还没有展示桌面回归结果入口。
- 回归结果是否过期还没有在总览页做醒目标识。

### 下一轮实现建议

1. 在总览页展示桌面回归结果入口和桌面检查状态。
2. 在总览页给过期回归结果加醒目标识，例如超过 24 小时显示“需重跑”。
3. 给 strict cache 失败结果增加总览页提示，让非技术用户知道是 cache 为空或过期。

## 实现迭代 50：总览页展示桌面回归状态

时间：2026-05-23 09:05（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 49 已经生成 1366px 桌面回归结果和截图。
- 总览页是系统运维入口，应该直接显示桌面回归是否执行、执行宽度、状态和截图入口。
- 本轮只改报告可视化入口，不触发 workflow 执行，不改变爬虫、AI 或 CSV 逻辑。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - 总览页读取：
     - `local_regression_desktop.json`
   - “本地回归检查”面板新增：
     - 桌面宽度。
     - 桌面状态。
     - 桌面最近检查时间。
   - 入口新增：
     - `桌面报告 HTML`
     - `桌面结果 JSON`
     - `总览桌面截图`
     - `单品桌面截图`
2. `README_AI选品分析系统.md`
   - 补充说明：运行 `--desktop` 后，总览页会展示桌面宽度、桌面状态、桌面报告和桌面截图入口。
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`桌面报告 HTML`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地预览生成成功。
- 总览页已出现：
  - `桌面宽度 1366px`
  - `桌面状态 OK`
  - `桌面报告 HTML`
  - `桌面结果 JSON`
  - `总览桌面截图`
  - `单品桌面截图`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 10`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `visible cards = 0`
  - `visible mobile groups = 0`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:04:50.405Z`
  - `report_has_marker = true`
  - `report_code_length = 100123`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 桌面回归状态依赖最近一次 `--desktop` 输出；如果长期不运行，页面会展示旧检查时间。
- 当前总览页还没有“回归结果过期”醒目标识。
- strict cache 失败原因还没有在总览页单独解释。

### 下一轮实现建议

1. 在总览页给过期回归结果加醒目标识，例如超过 24 小时显示“需重跑”。
2. 给 strict cache 失败结果增加总览页提示，让非技术用户知道是 cache 为空或过期。
3. 把默认/多视口/桌面回归结果合并成一份总览型回归报告，减少入口数量。

## 实现迭代 51：回归结果新鲜度标识

时间：2026-05-23 09:09（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 50 已经把默认、多视口、桌面回归结果放进总览页。
- 当前总览页只显示最近检查时间，用户需要自行判断结果是否过旧。
- V1.0 运维入口应该直接提示“新鲜 / 需重跑”，避免拿过期视觉回归结论做决策。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - 总览页“本地回归检查”新增新鲜度判断。
   - 默认回归、多视口回归、桌面回归分别判断。
   - 规则：
     - 未生成：`未生成`
     - 时间异常：`时间异常`
     - 超过 24 小时：`需重跑`
     - 24 小时内：`新鲜`
   - 新增展示字段：
     - `默认新鲜度`
     - `多视口新鲜度`
     - `桌面新鲜度`
2. `README_AI选品分析系统.md`
   - 补充说明：回归结果超过 24 小时会标记为“需重跑”。
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`默认新鲜度`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地预览生成成功。
- 总览页已出现：
  - `默认新鲜度 新鲜`
  - `多视口新鲜度 新鲜`
  - `桌面新鲜度 新鲜`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 10`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `visible cards = 0`
  - `visible mobile groups = 0`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:08:51.156Z`
  - `report_has_marker = true`
  - `report_code_length = 101175`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 新鲜度阈值当前固定为 24 小时，暂未做成可配置项。
- strict cache 失败原因还没有在总览页单独解释。
- 默认、多视口、桌面回归仍是多份报告，入口数量较多。

### 下一轮实现建议

1. 给 strict cache 失败结果增加总览页提示，让非技术用户知道是 cache 为空或过期。
2. 把默认/多视口/桌面回归结果合并成一份总览型回归报告，减少入口数量。
3. 给新鲜度阈值增加配置项，例如本地文件或环境变量。

## 实现迭代 52：总览页 strict cache 失败提示

时间：2026-05-23 09:14（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 48 已经支持 `--strict-cache`，但失败原因主要在 JSON/HTML 明细里。
- 非技术用户在总览页需要直接知道 cache 是“未生成但默认不影响流程”，还是“严格模式失败，需要处理”。
- 当前 V1 仍是免费本地流程，高级数据源 cache 为空是正常状态，不能误导为系统故障。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - 总览页“本地回归检查”新增 `Cache 状态` 说明。
   - 自动读取最近一次回归里的 `adapter_cache` 步骤。
   - 展示状态：
     - `未检查`
     - `未生成`
     - `检查通过`
     - `严格通过`
     - `失败`
     - `严格失败`
   - 默认空 cache 时显示：
     - 默认回归会跳过空 cache，不影响当前免费本地流程。
     - 接入 Keepa、SP-API 或 Ads cache 后再启用严格检查。
   - strict-cache 失败且 cache 目录为空时显示：
     - strict-cache 已开启，但 cache 目录没有 JSON。
     - 先生成高级数据源 cache，或在免费流程中关闭 strict-cache。
   - strict-cache 失败且非空时提示检查 stale、expired、`fetched_at`、`ttl_hours`。
2. `README_AI选品分析系统.md`
   - 补充说明：启用 `--strict-cache` 后失败，总览页会解释 cache 为空、过期或缺少新鲜度字段。
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`Cache 状态`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地预览生成成功。
- 当前总览页已出现：
  - `Cache 状态`
  - `未生成`
  - `默认回归会跳过空 cache，不影响当前免费本地流程`
  - `No JSON cache files found under ...\\output\\amazon_product_analysis\\cache`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:13:34.080Z`
  - `report_has_marker = true`
  - `report_code_length = 103230`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 当前只读取 `local_regression_latest.json` 的 cache 状态；单独命名的 strict-cache 失败报告不会自动显示。
- 默认、多视口、桌面回归仍是多份报告，入口较多。
- 新鲜度阈值当前固定为 24 小时，暂未做成可配置项。

### 下一轮实现建议

1. 把默认/多视口/桌面回归结果合并成一份总览型回归报告，减少入口数量。
2. 让总览页可选择显示最近 strict-cache 失败报告。
3. 给新鲜度阈值增加配置项，例如本地文件或环境变量。

## 实现迭代 53：统一回归总览报告

时间：2026-05-23 09:22（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 52 后，总览页已经有默认、多视口、桌面、截图和 cache 相关入口，入口数量偏多。
- V1.0 的运维入口应该先提供一个统一的回归总览，再保留明细入口给排查使用。
- 本轮只读取已有本地回归 JSON，不运行检查、不调用外部 API、不触发 n8n 执行。

### 本轮改动

1. 新增 `tools/build_local_regression_overview.mjs`
   - 读取已有回归结果：
     - `local_regression_latest.json`
     - `local_regression_multi_viewport.json`
     - `local_regression_desktop.json`
     - `local_regression_multi_viewport_desktop.json`
     - `local_regression_strict_cache_fixture.json`
     - `local_regression_strict_cache_empty_expected_fail.json`
   - 输出：
     - `local_regression_overview.json`
     - `local_regression_overview.html`
   - 展示：
     - 总状态。
     - 已配置、已生成、正常、需关注数量。
     - 每类回归的通过、跳过、失败、移动宽度、桌面宽度、cache 状态。
     - 对应 HTML 和 JSON 入口。
   - `strict-cache 空 cache 预期失败` 被识别为负向样例，失败即为预期通过。
2. `tools/n8n_html_report_code_optimized.js`
   - 总览页“本地回归检查”入口新增：
     - `回归总览 HTML`
     - `回归总览 JSON`
3. `README_AI选品分析系统.md`
   - 补充命令：
     - `node tools/build_local_regression_overview.mjs`
   - 补充统一回归总览路径。
4. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
5. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`回归总览 HTML`

### 验证结果

- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 统一回归总览生成成功：
  - `regression overview: OK`
  - `configured = 6`
  - `generated = 6`
  - `ok = 6`
  - `attention = 0`
- `local_regression_overview.html` 已包含：
  - `AI选品系统回归总览`
  - `默认回归`
  - `多视口回归`
  - `桌面回归`
  - `多视口 + 桌面回归`
  - `strict-cache 正向样例`
  - `strict-cache 空 cache 预期失败`
- 本地预览生成成功。
- 总览页已出现：
  - `回归总览 HTML`
  - `回归总览 JSON`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 12`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 本地 workflow JSON 已同步。
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:21:15.202Z`
  - `report_has_marker = true`
  - `report_code_length = 103366`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 统一总览报告当前需要手动运行 `build_local_regression_overview.mjs` 刷新。
- 总览页仍展示所有明细入口，后续可以折叠到“高级明细”里进一步减少视觉噪音。
- 新鲜度阈值当前固定为 24 小时，暂未做成可配置项。

### 下一轮实现建议

1. 让一键回归脚本在结束后自动刷新 `local_regression_overview.html`。
2. 把总览页明细入口折叠成“高级明细”，默认只突出回归总览。
3. 给新鲜度阈值增加配置项，例如本地文件或环境变量。

## 实现迭代 54：一键回归自动刷新统一总览

时间：2026-05-23 09:28（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 53 已经生成统一回归总览，但仍需要手动运行 `tools/build_local_regression_overview.mjs`。
- V1.0 的运维入口应该让“跑完检查”和“看到汇总”绑定在一起，减少遗漏步骤。
- 本轮只增强本地回归脚本，不修改 n8n 报告节点模板，不触发新的 n8n 执行。

### 本轮改动

1. `tools/run_local_regression_checks.mjs`
   - 一键回归结束后默认自动运行 `tools/build_local_regression_overview.mjs`。
   - 回归 JSON 新增：
     - `regression_overview_json_path`
     - `regression_overview_html_path`
     - `regression_overview_refresh`
   - 回归 HTML 摘要新增：
     - `回归总览刷新`
     - `回归总览` 入口。
   - 控制台输出新增 `Overview: OK / ATTENTION / SKIP`。
   - 新增参数：
     - `--no-overview`：只跑当前回归，不刷新统一总览。
   - 总览刷新失败时记录为 `ATTENTION`，但不改变当前回归主结果，避免因为汇总页刷新问题误判核心检查失败。
2. `README_AI选品分析系统.md`
   - 补充说明：一键回归默认会自动刷新统一回归总览。
   - 补充 `--no-overview` 的使用场景。
   - 将统一总览脚本说明调整为“手动生成/刷新”，避免和默认行为冲突。

### 验证结果

- `node --check tools/run_local_regression_checks.mjs` 通过。
- 默认一键回归执行成功：
  - `total = 5`
  - `passed = 4`
  - `skipped = 1`
  - `failed = 0`
  - `Overview: OK`
- `--no-overview` 执行成功：
  - `Overview: SKIP`
  - `reason = Disabled by --no-overview`
- `local_regression_latest.json` 已记录：
  - `regression_overview_refresh.status = OK`
  - `stdout` 包含 `regression overview: OK`
- `local_regression_latest.html` 已出现：
  - `回归总览刷新：OK`
  - `回归总览`
- `local_regression_overview.json` 当前状态：
  - `ok = true`
  - `configured = 6`
  - `generated = 6`
  - `ok = 6`
  - `attention = 0`
- 本地预览生成成功。
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 12`
  - `horizontal overflow = no`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
- 线上 n8n workflow 状态已核对：
  - `active = true`
  - `updatedAt = 2026-05-23T01:21:15.202Z`
  - `node_count = 25`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条。

### 本轮剩余风险

- 统一回归总览只读取固定的 6 类回归结果；如果以后新增新的检查类型，还需要同步更新总览构建脚本。
- 总览页仍展示所有明细入口，视觉上还可以进一步收敛到“核心入口 + 高级明细”。
- 新鲜度阈值当前固定为 24 小时，暂未做成可配置项。

### 下一轮实现建议

1. 把总览页明细入口折叠成“高级明细”，默认只突出统一回归总览。
2. 给统一回归总览增加“最近一次刷新时间”和“是否过期”的非技术提示。
3. 给新鲜度阈值增加配置项，例如本地配置文件或环境变量。

## 实现迭代 55：总览页回归入口收敛

时间：2026-05-23 09:35（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 54 后，一键回归已经会自动刷新统一回归总览。
- 总览页仍默认展示单次回归、多视口、桌面和截图等较多入口，首屏阅读路径偏散。
- V1.0 的非技术 UI 应该优先展示“能否继续用”的核心结论，把排查入口折叠到高级明细。

### 本轮改动

1. `tools/n8n_html_report_code_optimized.js`
   - “本地回归检查”默认只突出：
     - `回归总览 HTML`
     - `回归总览 JSON`
   - 单次回归、多视口回归、桌面回归、移动/桌面截图入口折叠到：
     - `高级明细：单次回归、多视口、桌面和截图`
   - 高级明细标题显示已生成数量，例如 `已生成 10/10`。
   - 未展开时强制隐藏明细链接，确保默认可见入口只有 2 个。
   - 核心总览 HTML 链接使用更醒目的绿色主按钮样式。
2. `README_AI选品分析系统.md`
   - 更新本地回归说明：总览页默认只突出统一回归总览，明细入口排查时再展开。
3. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
4. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`高级明细`

### 验证结果

- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 本地预览生成成功，刷新了：
  - `amazon_product_analysis_latest.html`
  - `amazon_product_analysis_overview.html`
- 总览 HTML 已包含：
  - `check-links check-links-primary`
  - `高级明细：单次回归、多视口、桌面和截图`
  - `.check-details:not([open]) .check-links-detail`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:35:13.652Z`
  - `report_has_marker = true`
  - `report_code_length = 105000`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮本地预览没有追加 CSV。

### 本轮剩余风险

- 高级明细折叠依赖浏览器原生 `details`；主流浏览器正常，但样式可控性比自定义组件弱。
- 统一回归总览仍只读取固定的 6 类回归结果，新增检查类型时需要同步扩展。
- 新鲜度阈值当前固定为 24 小时，暂未做成可配置项。

### 下一轮实现建议

1. 给统一回归总览增加“最近一次刷新时间”和“是否过期”的非技术提示。
2. 给新鲜度阈值增加配置项，例如本地配置文件或环境变量。
3. 让统一回归总览自动识别新增的 `local_regression_*.json`，减少后续维护成本。

## 实现迭代 56：统一回归总览新鲜度提示

时间：2026-05-23 09:42（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 55 已经把总览页入口收敛为“回归总览 + 高级明细”。
- 统一回归总览虽然能合并多类检查结果，但用户打开时还不能直接判断这份总览是否过期。
- V1.0 的运维入口需要把“是否还能参考”直接写出来，避免用户拿过期检查结果判断系统状态。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增 24 小时新鲜度窗口。
   - 每个回归项新增 `freshness`：
     - `status`
     - `status_class`
     - `is_stale`
     - `age_hours`
     - `stale_after`
     - `message`
   - 总览 JSON 新增 `freshness`：
     - `last_refreshed_at`
     - `fresh_until`
     - `threshold_hours`
     - `stale_run_count`
     - `missing_run_count`
     - `message`
   - 统一回归总览 HTML 新增“刷新时间 / 最早过期 / 有效窗口 / 新鲜或需重跑”提示区。
2. `tools/n8n_html_report_code_optimized.js`
   - 主总览页读取 `local_regression_overview.json`。
   - “本地回归检查”新增：
     - `总览新鲜度`
     - `最早过期`
     - `总览提示`
   - 继续保持默认只显示两个核心入口：`回归总览 HTML / JSON`。
3. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会显示最近刷新时间、最早过期时间和 `新鲜/需重跑` 状态。
4. `n8n/workflows/amazon_product_analysis_crawlee_bailian_html.json`
   - 已同步最新报告节点代码。
5. 线上 n8n workflow
   - 已同步报告节点。
   - 验证标记：`总览新鲜度`

### 验证结果

- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node --check tools/n8n_html_report_code_optimized.js` 通过。
- 统一回归总览生成成功：
  - `regression overview: OK`
  - `configured = 6`
  - `generated = 6`
  - `ok = 6`
  - `attention = 0`
  - `freshness.status = 新鲜`
  - `fresh_until = 2026-05-24T00:48:06.011Z`
- `local_regression_overview.html` 已出现：
  - `刷新时间`
  - `最早过期`
  - `有效窗口：24 小时`
  - `全部回归都在 24 小时窗口内，可以继续参考。`
- 本地预览生成成功。
- 主总览页已出现：
  - `总览新鲜度 新鲜`
  - `最早过期 2026-05-24T00:48:06.011Z`
  - `总览提示`
  - `全部回归都在 24 小时窗口内，可以继续参考。`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 线上 n8n 报告节点已同步：
  - `active = true`
  - `updatedAt = 2026-05-23T01:42:26.917Z`
  - `report_has_marker = true`
  - `report_code_length = 106555`
- 最近 n8n 执行仍为 ID `26`，状态 `success`，本轮没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮本地预览没有追加 CSV。

### 本轮剩余风险

- 新鲜度阈值仍固定为 24 小时，暂未做成本地配置项。
- HTML 中的过期提示是生成时计算，不会在浏览器打开后动态倒计时。
- 统一回归总览仍只读取固定的 6 类回归结果，新增检查类型时需要同步扩展。

### 下一轮实现建议

1. 给新鲜度阈值增加配置项，例如本地配置文件或环境变量。
2. 让统一回归总览自动识别新增的 `local_regression_*.json`，减少后续维护成本。
3. 给统一回归总览增加打开时的动态过期提示，避免长时间不刷新时仍显示旧状态。

## 实现迭代 57：回归新鲜度阈值可配置

时间：2026-05-23 09:48（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 56 已经让统一回归总览显示“新鲜 / 需重跑”，但阈值固定为 24 小时。
- 日常低频维护和高频模板迭代对新鲜度要求不同，固定阈值不利于运维。
- 本轮只修改本地回归总览构建逻辑，不改 n8n 报告节点模板，不触发 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增配置读取优先级：
     - 命令行 `--freshness-hours`
     - 环境变量 `AI_SELECTION_REGRESSION_FRESHNESS_HOURS`
     - 本地配置 `config/local_regression.local.json`
     - 默认值 `24`
   - 新增命令行参数：
     - `--config <json>`
     - `--freshness-hours <hours>`
   - 统一回归 JSON 新增 `freshness_config`，记录阈值来源、配置路径和环境变量名。
2. 新增 `config/local_regression.local.json`
   - 默认 `freshness_threshold_hours = 24`。
   - 可直接修改该字段调整本地默认新鲜度窗口。
3. 新增 `config/local_regression.example.json`
   - 作为配置模板和说明。
4. `README_AI选品分析系统.md`
   - 补充本地配置路径。
   - 补充 `freshness_threshold_hours` 字段说明。
   - 补充环境变量临时覆盖示例。

### 验证结果

- `node --check tools/build_local_regression_overview.mjs` 通过。
- `config/local_regression.local.json` 可正常解析：
  - `freshness_threshold_hours = 24`
- 默认生成统一回归总览成功：
  - `freshness.threshold_hours = 24`
  - `freshness_config.source = config`
  - `freshness_config.configPath = ...\config\local_regression.local.json`
  - `fresh_until = 2026-05-24T00:48:06.011Z`
- 命令行覆盖验证通过：
  - `--freshness-hours 48`
  - `threshold = 48`
  - `source = cli`
  - HTML 显示 `有效窗口：48 小时`
- 环境变量覆盖验证通过：
  - `AI_SELECTION_REGRESSION_FRESHNESS_HOURS = 12`
  - `threshold = 12`
  - `source = env`
  - HTML 显示 `有效窗口：12 小时`
- 本地预览生成成功。
- 主总览页仍读取正式配置：
  - `总览新鲜度 新鲜`
  - `最早过期 2026-05-24T00:48:06.011Z`
  - `全部回归都在 24 小时窗口内，可以继续参考。`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 线上 n8n workflow 状态已核对：
  - `active = true`
  - `updatedAt = 2026-05-23T01:42:26.917Z`
  - 最近 n8n 执行仍为 ID `26`，状态 `success`
- 本轮没有改 n8n 报告节点模板，没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮本地预览没有追加 CSV。
- 命令行和环境变量覆盖测试生成的临时 HTML/JSON 已清理。

### 本轮剩余风险

- 配置文件格式错误时，当前脚本会回退默认值或抛出错误；后续可增加更友好的配置校验报告。
- HTML 中的过期提示仍是生成时计算，不会在浏览器打开后动态倒计时。
- 统一回归总览仍只读取固定的 6 类回归结果，新增检查类型时需要同步扩展。

### 下一轮实现建议

1. 让统一回归总览自动识别新增的 `local_regression_*.json`，减少后续维护成本。
2. 给统一回归总览增加打开时的动态过期提示，避免长时间不刷新时仍显示旧状态。
3. 增加本地回归配置校验，配置错误时输出明确的修复建议。

## 实现迭代 58：统一回归总览自动发现新增检查

时间：2026-05-23 09:52（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 57 后，新鲜度阈值已经可配置。
- 统一回归总览仍依赖固定 6 类检查清单；后续新增本地回归时，需要同步改脚本，维护成本偏高。
- 当前输出目录已经存在额外正式回归结果 `local_regression_with_fixture_cache.json`，可作为自动发现验证样例。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 保留核心 6 类回归的固定顺序。
   - 自动发现额外正式回归结果：
     - 匹配 `local_regression_*.json`
     - 排除统一总览自身 `local_regression_overview*.json`
     - 排除临时测试文件 `*_test.json`
     - 排除固定清单已经包含的文件
   - 自动发现的回归项会补齐：
     - `id`
     - `title`
     - `json_file`
     - `html_file`
     - `role = auto_discovered`
     - `discovered = true`
   - 总览 JSON 新增 `discovery`：
     - `enabled`
     - `discovered`
     - `ignored`
   - 总览摘要新增 `counts.discovered`。
   - 统一回归 HTML 的摘要指标新增 `自动发现`。
   - 自动发现项在卡片时间前标注 `自动发现`。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会自动发现新的正式 `local_regression_*.json`。
   - 补充说明会排除总览自身和 `*_test.json` 临时测试文件。

### 验证结果

- `node --check tools/build_local_regression_overview.mjs` 通过。
- 统一回归总览生成成功：
  - `regression overview: OK`
  - `configured = 7`
  - `generated = 7`
  - `ok = 7`
  - `attention = 0`
  - `discovered = 1`
- 自动发现结果：
  - `id = with_fixture_cache`
  - `title = 含 Fixture Cache`
  - `json_file = local_regression_with_fixture_cache.json`
  - `html_file = local_regression_with_fixture_cache.html`
- 已确认 `local_regression_no_overview_test.json` 被排除：
  - `reason = 临时测试文件`
- `local_regression_overview.html` 已出现：
  - `自动发现 1`
  - `含 Fixture Cache`
  - `自动发现 · 2026-05-23T00:16:44.266Z`
  - `local_regression_with_fixture_cache.json`
- 本地预览生成成功。
- 主总览页读取新鲜度后，最早过期时间更新为自动发现项带来的更早时间：
  - `最早过期 2026-05-24T00:16:44.266Z`
  - `全部回归都在 24 小时窗口内，可以继续参考。`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 线上 n8n workflow 状态已核对：
  - `active = true`
  - `updatedAt = 2026-05-23T01:42:26.917Z`
  - 最近 n8n 执行仍为 ID `26`，状态 `success`
- 本轮没有改 n8n 报告节点模板，没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮本地预览没有追加 CSV。

### 本轮剩余风险

- 自动发现项如果没有对应 HTML，只会显示 JSON 入口和 `HTML 未生成`，不视为失败。
- 自动标题来自文件名，复杂命名时可能不够自然；后续可支持配置覆盖标题。
- HTML 中的过期提示仍是生成时计算，不会在浏览器打开后动态倒计时。

### 下一轮实现建议

1. 给统一回归总览增加打开时的动态过期提示，避免长时间不刷新时仍显示旧状态。
2. 增加本地回归配置校验，配置错误时输出明确的修复建议。
3. 支持在配置文件中给自动发现项覆盖标题、角色和是否计入总状态。

## 实现迭代 59：统一回归总览打开时动态过期提示

时间：2026-05-23 09:59（Asia/Shanghai）

### 本轮实现依据

- 实现迭代 58 后，统一回归总览可以自动发现新增正式回归 JSON。
- 统一回归总览的新鲜度状态仍主要在生成 HTML 时计算；如果页面长时间打开，用户可能看到旧的“新鲜”状态。
- 本轮只增强统一回归总览 HTML 的浏览器端提示，不修改 n8n 报告节点模板，不触发 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 统一回归总览 HTML 的新鲜度区新增数据属性：
     - `data-freshness-panel`
     - `data-fresh-until`
     - `data-threshold-hours`
   - 新鲜度状态标签新增 `data-freshness-status`。
   - 新鲜度说明新增 `data-freshness-message`。
   - 新增打开页面时执行的轻量脚本：
     - 读取 `fresh_until`。
     - 按浏览器当前时间重新判断是否过期。
     - 如果已经过期，状态改为 `需重跑`，提示重新运行一键本地回归。
     - 无论是否过期，都显示页面打开时间、有效窗口和最早过期时间。
   - 修复一个小数阈值边界：
     - `--freshness-hours 0.001` 不再被四舍五入成 `0`。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会在浏览器打开时再次判断是否已经过期。

### 验证结果

- `node --check tools/build_local_regression_overview.mjs` 通过。
- 正式统一回归总览生成成功：
  - `regression overview: OK`
  - `configured = 7`
  - `generated = 7`
  - `ok = 7`
  - `attention = 0`
  - `discovered = 1`
  - `freshness.status = 新鲜`
  - `fresh_until = 2026-05-24T00:16:44.266Z`
- 正式 `local_regression_overview.html` 已包含：
  - `data-freshness-panel`
  - `data-fresh-until`
  - `data-freshness-status`
  - `打开时重新检查`
  - `页面打开时间`
- 极短阈值测试通过：
  - `--freshness-hours 0.001`
  - `threshold = 0.001`
  - `status = 需重跑`
  - HTML 显示 `有效窗口：0.001 小时`
- 浏览器实测动态提示通过：
  - 打开测试页后状态为 `需重跑`
  - 动态提示包含 `页面打开时间`
  - 动态提示包含 `请重新运行一键本地回归后再参考`
- 本地预览生成成功。
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
  - `overflowing nodes = 0`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查仍通过：
  - `Overall: OK`
  - `score = 74`
  - `horizontal overflow = no`
- 线上 n8n workflow 状态已核对：
  - `active = true`
  - `updatedAt = 2026-05-23T01:42:26.917Z`
  - 最近 n8n 执行仍为 ID `26`，状态 `success`
- 本轮没有改 n8n 报告节点模板，没有触发新执行。
- 主 CSV 仍为 `13` 条，本轮本地预览没有追加 CSV。
- 动态过期测试生成的临时 HTML/JSON 已清理。

### 本轮剩余风险

- 动态提示依赖浏览器 JavaScript；如果浏览器禁用脚本，则仍只显示生成时的新鲜度。
- 自动标题仍来自文件名，复杂命名时可能不够自然。
- 本地回归配置错误时的提示还不够友好。

### 下一轮实现建议

1. 增加本地回归配置校验，配置错误时输出明确的修复建议。
2. 支持在配置文件中给自动发现项覆盖标题、角色和是否计入总状态。
3. 给统一回归总览增加“重新生成命令”提示，方便从报告页直接知道下一步怎么重跑。

## 实现迭代 60：本地回归配置校验和修复建议
时间：2026-05-23 10:10（Asia/Shanghai）

### 本轮实现依据

- 迭代 57 已经把本地回归新鲜度窗口改为可配置，但配置错误时仍需要通过失败现象反推原因。
- 迭代 59 后，统一回归总览已经承担运维入口角色，因此配置状态也应该沉淀到总览 JSON/HTML，而不是只停留在命令行错误。
- 本轮只改本地回归总览脚本和 README，不改 n8n 报告节点，不触发线上 workflow 执行，避免影响现有可运行链路。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增 `--validate-config` 命令：只校验配置，不生成报告。
   - 正常配置返回 `local regression config: OK`。
   - 错误配置返回 `ATTENTION`，退出码为 `1`。
   - 统一校验来源优先级：命令行覆盖、环境变量、本地配置、示例配置、默认 24 小时。
   - `freshness_config` 增加 `ok`、`errors`、`warnings`、`repair_suggestions`。
   - 配置错误时仍生成总览 JSON/HTML，但总览命令返回失败码，避免静默忽略错误。
   - 统一回归 HTML 在配置异常或警告时展示“配置需要修复 / 配置提示”区块。
2. `README_AI选品分析系统.md`
   - 增加单独校验命令：`node tools/build_local_regression_overview.mjs --validate-config`。
   - 说明错误配置会输出修复建议，并写入 `freshness_config`。

### 验证结果

- 语法检查通过：`node --check tools/build_local_regression_overview.mjs`。
- 正常配置校验通过：
  - `local regression config: OK`
  - `threshold_hours = 24`
  - `source = config`
- 命令行错误阈值校验通过：
  - `--freshness-hours nope`
  - 返回 `ATTENTION`
  - 退出码 `1`
  - 输出修复建议
- 错误配置文件校验通过：
  - `freshness_threshold_hours = 0`
  - 返回 `ATTENTION`
  - 退出码 `1`
  - 输出修复建议
- 错误配置生成总览测试通过：
  - 临时 HTML 中出现 `配置需要修复`
  - 临时测试文件已清理
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - `configured = 7`
  - `generated = 7`
  - `ok = 7`
  - `attention = 0`
  - `discovered = 1`
  - `freshness_config.ok = true`
  - `freshness_config.source = config`
- 本地报告预览生成成功：
  - ASIN `B0BQXZ11B8`
  - 推荐分 `77`
  - 决策 `进入下一轮评估`
- 总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 当前文件状态：
  - CSV 仍为 `13` 条，本轮预览没有追加 CSV。
  - 最新 HTML 更新时间为 `2026-05-23T10:07:26`。
  - 统一回归总览更新时间为 `2026-05-23T10:06:41`。
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- 配置错误时统一回归总览会生成 HTML/JSON，但命令返回失败码；如果外部脚本只看文件是否存在而不看退出码，仍可能误判。
- HTML 配置提示只在存在错误或警告时显示；正常配置下不展示配置区块，保持页面简洁。
- 当前校验只覆盖新鲜度窗口配置，尚未支持自动发现项的标题、角色、是否计入总状态等扩展配置。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 给统一回归总览增加“重新生成命令”提示，让用户从 HTML 报告页直接知道下一步该运行什么。
3. 把配置校验接入一键回归前置检查，在正式回归前先失败 fast。

## 实现迭代 61：一键回归前置配置校验
时间：2026-05-23 10:14（Asia/Shanghai）

### 本轮实现依据

- 迭代 60 已经支持 `--validate-config` 单独校验本地回归配置。
- 但日常维护更常用的是 `node tools/run_local_regression_checks.mjs` 一键回归；如果配置错误，应该先失败 fast，而不是继续跑数据源、布局和截图检查。
- 本轮只改一键回归脚本和 README，不改 n8n 报告节点，不触发线上 workflow 执行。

### 本轮改动

1. `tools/run_local_regression_checks.mjs`
   - 在一键回归第一步新增 `regression_config`：
     - 执行 `node tools/build_local_regression_overview.mjs --validate-config`
     - 配置正常时继续后续检查。
     - 配置错误时只写出本次失败 summary/HTML，并停止后续检查。
   - 快速失败时 summary 增加：
     - `fail_fast = true`
     - `fail_fast_reason = Local regression configuration is invalid.`
   - 命令行人类可读输出现在会展示失败步骤的 stdout；这样配置错误时能直接看到 `local regression config: ATTENTION`。
2. `README_AI选品分析系统.md`
   - 补充说明一键检查会先校验本地回归配置。
   - 配置错误时会先写出失败报告和修复建议，然后停止后续布局/数据源检查。

### 验证结果

- 语法检查通过：
  - `node --check tools/run_local_regression_checks.mjs`
- 正常配置校验通过：
  - `local regression config: OK`
  - `threshold_hours = 24`
  - `source = config`
- 错误环境变量快速失败测试通过：
  - `AI_SELECTION_REGRESSION_FRESHNESS_HOURS = bad`
  - 一键回归退出码 `1`
  - `fail_fast = true`
  - `counts.total = 1`
  - `counts.failed = 1`
  - 第一项步骤 `regression_config`
  - stdout 包含 `ATTENTION`
  - 测试 summary/HTML 已清理
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 统一回归总览状态正常：
  - `ok = true`
  - `configured = 7`
  - `generated = 7`
  - `ok = 7`
  - `attention = 0`
  - `discovered = 1`
  - `freshness_config.ok = true`
  - `freshness_config.source = config`
- 总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 当前文件状态：
  - CSV 仍为 `13` 条。
  - 本轮一键回归没有追加 CSV。
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- fail-fast 只覆盖本地回归配置；数据源配置、adapter 配置仍在后续步骤中校验。
- 如果外部调用方忽略退出码，只看是否生成了 summary/HTML，仍需要人工查看 `ok=false` 或 `fail_fast=true`。
- 统一回归总览的自动发现项仍只按文件名推断标题和角色。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 给统一回归总览增加“重新生成命令”提示，让用户从 HTML 报告页直接知道下一步该运行什么。
3. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。

## 实现迭代 62：统一回归总览增加重跑命令入口
时间：2026-05-23 10:19（Asia/Shanghai）

### 本轮实现依据

- 迭代 61 已经把配置校验接入一键回归前置检查。
- 日常排查时，用户最常打开的是统一回归总览 HTML；如果页面只能展示状态，但不告诉下一步该运行什么命令，仍需要回 README 查找。
- 本轮只增强统一回归总览的运维可读性，不改 n8n 报告节点，不触发线上 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增 `rerun_commands` 数据字段，写入统一回归总览 JSON。
   - HTML 新增“重跑命令”区块，包含 6 个场景：
     - 日常一键回归：`node tools/run_local_regression_checks.mjs`
     - 只校验配置：`node tools/build_local_regression_overview.mjs --validate-config`
     - 只刷新本页：`node tools/build_local_regression_overview.mjs`
     - 多视口回归：`node tools/run_local_regression_checks.mjs --multi-viewport`
     - 桌面回归：`node tools/run_local_regression_checks.mjs --desktop`
     - 严格 cache 回归：`node tools/run_local_regression_checks.mjs --strict-cache`
   - 命令区块使用两列卡片布局，移动端自动变成单列。
   - 命令文本使用 `overflow-wrap: anywhere`，避免长命令在窄屏横向溢出。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览 HTML 会展示“重跑命令”区块。

### 验证结果

- 语法检查通过：
  - `node --check tools/build_local_regression_overview.mjs`
  - `node --check tools/run_local_regression_checks.mjs`
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - JSON 包含 `rerun_commands`
  - `command_count = 6`
  - 命令 ID 包含 `default_regression`、`config_check`、`refresh_overview`、`multi_viewport`、`desktop_regression`、`strict_cache`
- HTML 结构校验通过：
  - `command-panel = 1`
  - `command-item = 6`
  - 包含 `--validate-config`
  - 包含 `--multi-viewport`
  - 包含 `--desktop`
  - 包含 `--strict-cache`
  - 包含移动端单列规则和长命令换行规则
- 主总览页移动端检查通过：
  - `Overall: OK`
  - `local regression links = 2`
  - `horizontal overflow = no`
- 主总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 当前文件状态：
  - CSV 仍为 `13` 条。
  - 最新 HTML 更新时间保持为 `2026-05-23T10:07:26`，本轮没有重新生成单品报告。
  - 统一回归总览更新时间为 `2026-05-23T10:18:31`。
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- “重跑命令”只是静态提示，不会在 HTML 内直接执行命令。
- 统一回归总览的直接浏览器布局检查本轮采用结构校验；主看板和单品报告已继续通过现有浏览器检查。
- 自动发现项仍只按文件名推断标题和角色。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。
3. 在统一回归总览里显示当前工作目录路径，避免用户复制命令后在错误目录执行。

## 实现迭代 63：统一回归总览显示命令工作目录
时间：2026-05-23 10:23（Asia/Shanghai）

### 本轮实现依据

- 迭代 62 已经给统一回归总览增加“重跑命令”区块。
- 但 Windows 终端当前目录可能不是项目目录；如果用户直接复制命令到错误目录执行，会出现找不到脚本或读错输出目录的问题。
- 本轮只增强统一回归总览的运维提示，不改 n8n 报告节点，不触发线上 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 统一回归总览 JSON 新增 `command_working_directory`。
   - “重跑命令”区块顶部新增“工作目录”提示：
     - `C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing`
   - 命令区块文案从“复制对应命令，在项目目录执行”调整为“先进入工作目录，再执行对应命令”。
   - 工作目录使用独立 `command-cwd` 样式，移动端自动单列，长路径允许换行。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会显示工作目录，先确认执行目录再选择命令。

### 验证结果

- 当前状态核对：
  - 最新单品 HTML 存在。
  - CSV 仍为 `13` 条。
  - 统一回归总览状态 `ok = true`。
  - `command_count = 6`。
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 语法检查通过：
  - `node --check tools/build_local_regression_overview.mjs`
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - JSON 包含 `command_working_directory`
  - HTML 包含 `工作目录`
  - HTML 包含项目路径
  - `command-item = 6`
  - `command-cwd = 1`
  - 移动端单列规则存在
- 主总览页移动端检查通过：
  - `Overall: OK`
  - `horizontal overflow = no`
- 主总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- 工作目录只是静态展示；报告页不会自动打开终端或执行命令。
- 如果项目移动到新路径，需要重新生成统一回归总览后路径才会更新。
- 自动发现项仍只按文件名推断标题和角色。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。
3. 给统一回归总览增加“配置文件入口”提示，直接显示当前读取的 local regression config 路径。

## 实现迭代 64：统一回归总览显示回归配置文件入口
时间：2026-05-23 10:28（Asia/Shanghai）

### 本轮实现依据

- 迭代 63 已经在统一回归总览的“重跑命令”区块展示工作目录。
- 下一步排查配置问题时，用户仍需要知道当前读取的是哪个 `local_regression.local.json`。
- 本轮只增强统一回归总览的运维提示，不改 n8n 报告节点，不触发线上 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 统一回归总览 JSON 新增 `local_regression_config_path`。
   - “重跑命令”区块新增“回归配置”路径：
     - `C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\config\local_regression.local.json`
   - 该路径沿用工作目录块样式，移动端自动单列，长路径允许换行。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会同时显示工作目录和当前回归配置文件。

### 验证结果

- 当前状态核对：
  - 最新单品 HTML 存在。
  - CSV 仍为 `13` 条。
  - 统一回归总览状态 `ok = true`。
  - `command_count = 6`。
  - `command_working_directory = C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing`
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 语法检查通过：
  - `node --check tools/build_local_regression_overview.mjs`
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - JSON 包含 `local_regression_config_path`
  - `freshness_config.configPath` 与 `local_regression_config_path` 一致
  - HTML 包含 `回归配置`
  - HTML 包含 `local_regression.local.json`
  - `command-item = 6`
  - 路径块数量为 `2`，分别是工作目录和回归配置
  - 移动端单列规则存在
- 主总览页移动端检查通过：
  - `Overall: OK`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- 配置路径只是静态展示；报告页不会直接打开或编辑配置文件。
- 如果项目移动到新路径，需要重新生成统一回归总览后路径才会更新。
- 输出目录里仍保留历史测试输出 `local_regression_no_overview_test.*`，自动发现已排除 `*_test.json`，不会进入正式总览。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。
3. 给统一回归总览增加“数据源配置入口”提示，直接显示当前读取的 data_sources.local.json 路径。

## 实现迭代 65：统一回归总览显示数据源配置入口
时间：2026-05-23 10:32（Asia/Shanghai）

### 本轮实现依据

- 迭代 64 已经在统一回归总览里展示工作目录和本地回归配置文件。
- 数据源健康检查读取的是 `output/amazon_product_analysis/data_sources.local.json`；排查 Keepa、SP-API、Ads API、手工字段和 Crawlee 状态时，也需要快速定位这个配置文件。
- 本轮只增强统一回归总览的运维提示，不改 n8n 报告节点，不触发线上 workflow 执行。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增 `defaultDataSourcesPath`，指向：
     - `C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\output\amazon_product_analysis\data_sources.local.json`
   - 统一回归总览 JSON 新增：
     - `data_source_config_path`
     - `data_source_config_exists`
   - “重跑命令”区块新增“数据源配置”路径。
   - 如果数据源配置不存在，该路径块会加 `warn` 样式，并显示“未找到”。
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会显示数据源配置文件。

### 验证结果

- 当前状态核对：
  - 最新单品 HTML 存在。
  - CSV 仍为 `13` 条。
  - 数据源配置文件存在。
  - 统一回归总览状态 `ok = true`。
  - `command_working_directory = C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing`
  - `local_regression_config_path = C:\Users\96259\Desktop\AIcoding\codex02\AIkuajing\config\local_regression.local.json`
- n8n 状态已核对：
  - workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
- 语法检查通过：
  - `node --check tools/build_local_regression_overview.mjs`
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - JSON 包含 `data_source_config_path`
  - JSON 包含 `data_source_config_exists = true`
  - HTML 包含 `数据源配置`
  - HTML 包含 `data_sources.local.json`
  - `command-item = 6`
  - 路径块数量为 `3`，分别是工作目录、回归配置和数据源配置
  - 移动端单列规则存在
- 主总览页移动端检查通过：
  - `Overall: OK`
  - `horizontal overflow = no`
- 主总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `visible tables = 5`
  - `visible desktop blocks = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- 数据源配置路径只是静态展示；报告页不会直接打开或编辑配置文件。
- 如果项目移动到新路径或输出目录改变，需要重新生成统一回归总览后路径才会更新。
- 输出目录里仍保留历史测试输出 `local_regression_no_overview_test.*`，自动发现已排除 `*_test.json`，不会进入正式总览。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。
3. 在统一回归总览中显示数据源健康摘要的最新状态，减少切换到主看板确认的次数。

## 实现迭代 66：统一回归总览显示数据源健康摘要
时间：2026-05-23 10:37（Asia/Shanghai）

### 本轮实现依据

- 迭代 65 已经在统一回归总览里显示 `data_sources.local.json` 路径。
- 日常排查时仍需要切换到主看板或单独运行数据源健康检查，才能确认 Crawlee、手工字段、竞品快照、Keepa、SP-API、Ads API 的状态。
- 本轮让统一回归总览直接读取 `data_sources.local.json`，生成轻量摘要；不运行外部检查，不调用 API，不改变 n8n。

### 本轮改动

1. `tools/build_local_regression_overview.mjs`
   - 新增 `summarizeDataSources()`：
     - 读取 `output/amazon_product_analysis/data_sources.local.json`
     - 统计可用数据源、预留未接入数据源和需关注数据源
     - 保留每个数据源的 label、status、mode、level、last_checked_at 和 owner_notes
   - 统一回归总览 JSON 新增 `data_source_health_summary`。
   - 统一回归总览 HTML 新增“数据源健康”区块：
     - 显示总体状态
     - 显示可用 / 预留 / 关注数量
     - 显示最近检查时间
     - 显示 6 个数据源状态卡片
2. `README_AI选品分析系统.md`
   - 补充说明统一回归总览会展示数据源健康摘要。

### 验证结果

- 当前状态核对：
  - n8n workflow active = `true`
  - node_count = `25`
  - updatedAt = `2026-05-23T01:42:26.917Z`
  - 最近执行 ID `26`，状态 `success`
  - 最近执行没有变化，本轮没有触发 n8n
- 数据源健康检查结构化输出正常：
  - `ok = true`
  - 数据源配置文件存在
  - 最新单品报告存在
  - fixture 校验通过
  - warnings = `0`
  - issues = `0`
- 语法检查通过：
  - `node --check tools/build_local_regression_overview.mjs`
- 正式统一回归总览生成通过：
  - `regression overview: OK`
  - JSON 包含 `data_source_health_summary`
  - `usable = 3`
  - `reserved = 3`
  - `attention = 0`
  - `source_count = 6`
  - HTML 包含 `数据源健康`
  - HTML 包含 6 个 `source-chip`
  - HTML 包含 `页面抓取`
  - HTML 包含 `Keepa 历史趋势`
- 主总览页移动端检查通过：
  - `Overall: OK`
  - `source health visible = yes`
  - `source chips = 6`
  - `horizontal overflow = no`
- 主总览页 1366px 桌面检查通过：
  - `Overall: OK`
  - `source health visible = yes`
  - `source chips = 6`
  - `horizontal overflow = no`
- 单品最新报告移动端检查通过：
  - `Overall: OK`
  - `score = 77`
  - `horizontal overflow = no`
- 正式一键回归通过：
  - `Overall: OK`
  - `counts.total = 6`
  - `counts.passed = 5`
  - `counts.skipped = 1`
  - `counts.failed = 0`
  - 第一项步骤 `regression_config`
  - 统一回归总览刷新 `OK`
- 刷新后一键回归总览仍保留：
  - `data_source_health_summary.ok = true`
  - `usable = 3`
  - `reserved = 3`
  - `attention = 0`
- CSV 仍为 `13` 条，本轮没有追加业务数据。
- 本轮没有同步 n8n 模板，没有触发新的 n8n 执行。

### 本轮剩余风险

- 数据源健康摘要来自配置文件静态读取，不会实时探测外部 API 或环境变量。
- 保留“预留未接入”作为 info，不视为失败；这是当前免费 V1 版本的设计边界。
- 输出目录里仍保留历史测试输出 `local_regression_no_overview_test.*`，自动发现已排除 `*_test.json`，不会进入正式总览。

### 下一轮实现建议

1. 支持在本地回归配置中覆盖自动发现项的标题、角色、是否计入总状态。
2. 把数据源配置也接入更早的 preflight，减少后续检查中的重复失败信息。
3. 给统一回归总览的数据源健康区块增加“异常时下一步命令”提示。

## 实现迭代 67：自动发现回归项支持本地配置覆盖

### 本轮依据

- 迭代 66 已经让统一回归总览自动发现额外的 `local_regression_*.json`，但自动发现项只能使用默认标题和 `auto_discovered` 角色。
- V1.0 方案要求本地回归看板可维护、可解释，新增回归项应该能被命名、分组，并能控制是否计入总状态。
- 为了避免配置误伤，覆盖只允许改展示和状态判断，不允许改 `json/html` 文件路径。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - 新增 `regression_overrides` 读取、规范化和应用逻辑。
  - 支持覆盖自动发现项的 `title`、`role`、`expected_failure`、`include_in_status`。
  - 总状态只统计 `include_in_status !== false` 的回归项。
  - JSON 输出新增 `regression_overrides`、`status_counted`、`override_applied`、`excluded_from_status`。
  - HTML 总览新增覆盖提示、角色标签、是否计入总状态、未计入总状态数量。
- `config/local_regression.local.json`
  - 为 `with_fixture_cache` 增加覆盖配置：`Fixture Cache 合同回归` / `adapter_cache` / 计入总状态。
- `config/local_regression.example.json`
  - 补充同样的示例，便于后续复制。
- `README_AI选品分析系统.md`
  - 补充 `regression_overrides` 使用示例和边界说明。

### 本轮验证

- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node tools/build_local_regression_overview.mjs --validate-config` 返回 `OK`。
- `node tools/build_local_regression_overview.mjs` 返回 `regression overview: OK`。
- 生成后的 `local_regression_overview.json`：
  - `ok = true`
  - `configured = 7`
  - `status_counted = 7`
  - `attention = 0`
  - `excluded_from_status = 0`
  - `regression_overrides.applied = 1`
  - `with_fixture_cache.title = Fixture Cache 合同回归`
  - `with_fixture_cache.role = adapter_cache`
  - `with_fixture_cache.status_counted = true`
- HTML 静态检查确认包含：
  - `Fixture Cache 合同回归`
  - `配置覆盖`
  - `角色 adapter_cache`
  - `总状态 计入`
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过。
- n8n 页面 `http://localhost:5678` 可访问，爬虫健康检查 `http://localhost:8787/health` 可访问；n8n API 仍返回 `401`，当前没有用 API 触发新执行。

### 本轮剩余风险

- `--validate-config` 仍主要校验 JSON 可解析和 `freshness_threshold_hours`；`regression_overrides` 的字段类型问题会进入总览提示，不作为 fail-fast 阻断。
- 自动发现项的覆盖依赖文件名转换出的 id，例如 `local_regression_with_fixture_cache.json` 对应 `with_fixture_cache`；改文件名后需要同步改配置。
- 当前 Docker CLI 在这个终端不可用，只能通过 HTTP 健康检查确认 n8n 和爬虫服务。

### 下一轮实现建议

1. 把 `regression_overrides` 字段校验也接入 `--validate-config` 的 fail-fast。
2. 把数据源配置接入更早的 preflight，减少后续检查中的重复失败信息。
3. 给统一回归总览的数据源健康区块增加“异常时下一步命令”提示。

## 实现迭代 68：回归覆盖配置接入 fail-fast 校验

### 本轮依据

- 迭代 67 已经支持通过 `regression_overrides` 管理自动发现回归项，但错误字段只会在总览提示里暴露。
- 一键本地回归已经把 `--validate-config` 放在第一步；因此配置字段错误应该提前失败，避免后续布局、数据源和 cache 检查浪费时间。
- 只做字段级校验，不要求覆盖 id 必须当前存在，避免阻塞未来即将生成的自动发现项。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - `normalizeRegressionOverrideConfig` 新增严格校验模式。
  - `--validate-config` 现在会校验 `regression_overrides`。
  - `title`、`role` 必须是非空字符串。
  - `expected_failure`、`include_in_status` 必须是布尔值。
  - `json/html/json_file/html_file` 路径覆盖会被视为错误。
  - 校验输出新增 `regression_overrides: OK/ATTENTION` 和覆盖项数量。
  - `freshness_config` 新增 `regression_override_validation`，统一总览 JSON 可追溯。
- `README_AI选品分析系统.md`
  - 补充说明 `--validate-config` 会同时检查 `regression_overrides` 字段类型。

### 本轮验证

- `node --check tools/build_local_regression_overview.mjs` 通过。
- 正常配置：
  - `node tools/build_local_regression_overview.mjs --validate-config` 返回 `OK`
  - 输出 `regression_overrides: OK (1 item(s))`
- 错误配置样例：
  - `title: 123`
  - `expected_failure: "no"`
  - `include_in_status: "yes"`
  - `json: "bad.json"`
  - 校验返回退出码 `1`
  - 输出 `regression_overrides: ATTENTION`
  - 输出路径覆盖禁止和字段类型修复建议。
- `node tools/build_local_regression_overview.mjs` 返回 `regression overview: OK`。
- `local_regression_overview.json`：
  - `ok = true`
  - `attention = 0`
  - `freshness_config.regression_override_validation.ok = true`
  - `override_count = 1`
  - `regression_overrides.applied = 1`
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过。

### 本轮剩余风险

- 覆盖 id 是否存在当前只作为运行总览时的忽略项，不在 `--validate-config` 中阻断；这是为了兼容“先配置、后生成”的自动发现项。
- `--freshness-hours` 和环境变量仍主要覆盖新鲜度窗口；本轮没有改变它们对本地配置文件的读取策略。
- n8n API 授权仍未恢复，当前仍不通过 API 自动执行工作流。

### 下一轮实现建议

1. 把数据源配置接入更早的 preflight，让 `data_sources.local.json` 的结构错误也能 fail-fast。
2. 给统一回归总览的数据源健康区块增加“异常时下一步命令”提示。
3. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。

## 实现迭代 69：数据源配置接入前置 fail-fast 校验

### 本轮依据

- 迭代 68 已经把本地回归配置和 `regression_overrides` 接入 fail-fast。
- V1.0 的数据可信度依赖 `data_sources.local.json`，如果数据源配置缺项或结构错误，后续报告里的“可用/预留/需关注”判断会失真。
- 当前一键回归已经第一步运行 `build_local_regression_overview.mjs --validate-config`，因此把数据源结构校验放到同一个入口，可以更早阻断明显配置错误。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - 新增 `--data-sources <path>` 参数，默认仍使用 `output/amazon_product_analysis/data_sources.local.json`。
  - `--validate-config` 新增 `data_sources: OK/ATTENTION` 输出。
  - 新增 `data_source_validation`，校验：
    - 文件存在且 JSON 可解析。
    - 根对象包含 `sources`。
    - 必需数据源包含 `crawlee`、`manual_inputs`、`competitor_snapshot`、`keepa`、`sp_api`、`amazon_ads_api`。
    - 每个数据源需要 `label`、`status`、`mode` 和数字 `priority`。
    - `required_env` 如果存在，必须是非空字符串数组。
    - V1 本地启用源必须保持可用状态，预留适配器允许 `not_connected`。
  - 统一回归总览继续读取数据源健康摘要，并在 `freshness_config.data_source_validation` 中保留校验结果。
- `README_AI选品分析系统.md`
  - 补充说明 `--validate-config` 会校验数据源配置。
  - 补充 `--data-sources` 临时路径验证用法。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - 统一回归总览 `ok = true`。
  - 数据源健康：`usable = 3`、`reserved = 3`、`attention = 0`。
  - n8n 页面可访问，爬虫健康检查可访问；n8n API 仍为 `401`。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- 正常配置：
  - `node tools/build_local_regression_overview.mjs --validate-config` 返回 `OK`
  - 输出 `regression_overrides: OK (1 item(s))`
  - 输出 `data_sources: OK (6 source(s), 3 usable, 3 reserved)`
- 错误数据源配置样例：
  - 缺少 `manual_inputs`、`competitor_snapshot`、`sp_api`、`amazon_ads_api`
  - `crawlee.status = disabled`
  - `crawlee.priority = "first"`
  - `keepa.required_env = "KEEPA_API_KEY"`
  - 校验返回退出码 `1`
  - 输出 `data_sources: ATTENTION`
  - 输出缺失数据源、状态错误、priority 类型错误和 required_env 类型错误。
- `node tools/build_local_regression_overview.mjs` 返回 `regression overview: OK`。
- `local_regression_overview.json`：
  - `freshness_config.data_source_validation.ok = true`
  - `configured_source_count = 6`
  - `usable_source_count = 3`
  - `reserved_source_count = 3`
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过。

### 本轮剩余风险

- 数据源结构校验不读取外部 API，也不检查真实凭据；这仍由适配器 cache 或后续官方 API 接入时验证。
- 额外数据源只给 warning，不阻断；这样后续新增适配器不会立刻破坏 V1 回归。
- `data_source_health` 步骤仍保留，用于检查最新报告是否展示数据源信息；本轮只是把配置结构错误提前拦截。

### 下一轮实现建议

1. 给统一回归总览的数据源健康区块增加“异常时下一步命令”提示。
2. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
3. 把数据源 validation 结果也展示到统一回归总览 HTML 的配置提示区。

## 实现迭代 70：数据源健康区块显示结构校验和异常处理命令

### 本轮依据

- 迭代 69 已经把 `data_sources.local.json` 接入前置 fail-fast 校验，并把结果写入 `freshness_config.data_source_validation`。
- 统一回归总览是日常运维入口，不能只告诉用户“需关注”，还应该在同一屏给出下一步命令。
- 正常状态下需要保持简洁，只显示结构摘要；异常状态下再展开修复命令，避免视觉噪音。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - 数据源健康区块新增结构校验摘要：
    - `结构 OK/需关注`
    - `配置 当前数量/期望数量`
  - 当数据源配置校验失败、数据源健康失败、关注数量大于 0 或配置文件缺失时，HTML 自动显示“数据源异常处理”区块。
  - 异常处理区块给出三条命令：
    - `node tools/build_local_regression_overview.mjs --validate-config`
    - `node tools/adapters/check_data_source_health.mjs`
    - `node tools/run_local_regression_checks.mjs`
  - 异常消息会直接显示在数据源区块内，便于对照修复。
  - 移动端样式改为单列，避免命令文本溢出。
- `README_AI选品分析系统.md`
  - 补充说明数据源健康区块会显示结构校验和异常处理命令。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - 统一回归总览 `ok = true`。
  - 数据源结构校验 `ok = true`。
  - n8n 页面可访问，爬虫健康检查可访问；n8n API 仍为 `401`。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node tools/build_local_regression_overview.mjs --validate-config` 返回 `OK`。
- `node tools/build_local_regression_overview.mjs` 返回 `regression overview: OK`。
- 正常总览 HTML 静态检查：
  - 包含 `结构 OK`
  - 包含 `配置 6/6`
  - 不显示异常处理区块。
- 临时错误数据源配置生成的总览 HTML：
  - 返回退出码 `1`
  - 包含 `数据源异常处理`
  - 包含 `node tools/build_local_regression_overview.mjs --validate-config`
  - 包含 `结构 需关注`
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过。

### 本轮剩余风险

- 异常处理命令是本地排查入口，不会自动修复配置内容。
- 当前 HTML 只在异常时显示三条固定命令；更细粒度的修复建议仍来自 `--validate-config` 输出。
- n8n API 授权仍未恢复，当前仍不通过 API 触发工作流。

### 下一轮实现建议

1. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
2. 把数据源 validation 的异常细分为“阻断/提醒/预留未接入”，提升总览可读性。
3. 在统一回归总览中增加 n8n API 授权状态摘要，避免重复手动排查 401。

## 实现迭代 71：统一回归总览显示 n8n API 授权状态

### 本轮依据

- 最近多轮都需要手动确认 `http://localhost:5678`、`http://localhost:8787/health` 和 n8n API `401` 状态。
- V1.0 当前仍依赖 n8n 编排和本地 crawler 服务；运维看板需要区分“服务可用”和“API 未授权”。
- n8n API 401 不应阻断本地模板/布局回归，因为用户仍可以在 n8n UI 手动执行工作流；但必须在总览中清楚展示。

### 本轮改动

- 新增 `tools/check_n8n_status.mjs`
  - 只读检查 n8n 页面、n8n workflow API、crawler 健康检查。
  - 默认写入 `output/amazon_product_analysis/n8n_status_latest.json`。
  - 支持 `N8N_API_KEY` 环境变量，发送为 `X-N8N-API-KEY`，但不会打印或保存密钥。
  - n8n 页面和 crawler 可访问时退出码为 `0`；API 401 记录为“未授权”提醒，不让本地回归失败。
- `tools/run_local_regression_checks.mjs`
  - 一键本地回归新增步骤：`n8n page, API authorization, and crawler status`。
- `tools/build_local_regression_overview.mjs`
  - 新增读取 `n8n_status_latest.json`。
  - 统一回归总览新增“n8n 服务状态”区块。
  - 展示页面状态、API 授权状态、crawler 状态、工作流 ID、状态文件路径和 `N8N_API_KEY` 提示。
- `README_AI选品分析系统.md`
  - 补充 n8n 状态检查命令和 `N8N_API_KEY` 使用方式。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - 统一回归总览 `ok = true`。
  - n8n 页面 `HTTP 200`。
  - n8n API `401`，状态为“未授权”。
  - crawler 健康检查 `HTTP 200`。
- `node --check tools/check_n8n_status.mjs` 通过。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node tools/check_n8n_status.mjs`：
  - 写入 `n8n_status_latest.json`
  - `service_ok = true`
  - `authorization_ok = false`
  - `status = API 未授权`
- `node tools/build_local_regression_overview.mjs` 返回 `regression overview: OK`。
- 统一回归总览 HTML 静态检查：
  - 包含 `n8n 服务状态`
  - 包含 `API 未授权`
  - 包含 `爬虫 HTTP 200`
  - 包含 `n8n_status_latest.json`
  - 包含 `N8N_API_KEY`
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过，新增 n8n 状态步骤为 `OK`。

### 本轮剩余风险

- n8n API 仍未授权；本轮只是把状态前置可见，没有替用户注入 API Key。
- `check_n8n_status.mjs` 不触发工作流执行，只验证 API 是否可访问和授权。
- 状态文件里保留 HTTP body preview；当前只包含页面片段或 401 提示，不包含密钥。

### 下一轮实现建议

1. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
2. 给 n8n 状态检查增加 `--fail-on-api-unauthorized` 可选严格模式。
3. 把 n8n 状态摘要同步到一键回归 HTML 的顶部摘要区。

## 实现迭代 72：一键回归 HTML 顶部显示 n8n 状态摘要

### 本轮依据

- 迭代 71 已经生成 `n8n_status_latest.json`，并在统一回归总览中展示 n8n 页面、API 授权和 crawler 状态。
- 日常使用时用户往往先打开 `local_regression_latest.html`，如果 n8n API 仍是 401，需要在本轮回归报告顶部直接看到，不必再跳到统一总览。
- n8n API 未授权不应让本地回归失败；它是运维提醒，而不是模板/布局回归失败。

### 本轮改动

- `tools/run_local_regression_checks.mjs`
  - 新增读取 `output/amazon_product_analysis/n8n_status_latest.json` 的摘要函数。
  - `buildSummary` 新增 `n8n_status_summary` 字段。
  - 一键回归 HTML 顶部新增 `n8n 状态` 面板，展示：
    - 页面状态
    - API 授权状态
    - crawler 状态
    - 工作流 ID
    - 状态文件路径
    - `N8N_API_KEY` 下一步提示
  - 命令行摘要新增一行 n8n 状态，例如 `n8n: API 未授权 (API: 未授权, crawler: HTTP 200)`。
- `README_AI选品分析系统.md`
  - 补充说明一键回归报告顶部也会显示 n8n 状态摘要。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - 统一回归总览 `ok = true`。
  - n8n 页面 `HTTP 200`。
  - n8n API `401`，状态为“未授权”。
  - crawler 健康检查 `HTTP 200`。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node --check tools/check_n8n_status.mjs` 通过。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node tools/run_local_regression_checks.mjs` 通过。
- 命令行输出包含：
  - `n8n: API 未授权 (API: 未授权, crawler: HTTP 200)`
- `local_regression_latest.json`：
  - `n8n_status_summary.status = API 未授权`
  - `authorization_ok = false`
  - `facts.page = HTTP 200`
  - `facts.api = 未授权`
  - `facts.crawler = HTTP 200`
- `local_regression_latest.html` 静态检查：
  - 包含 `n8n 状态`
  - 包含 `API 未授权`
  - 包含 `爬虫 HTTP 200`
  - 包含 `n8n_status_latest.json`
  - 包含 `N8N_API_KEY`
- 统一回归总览仍包含 `n8n 服务状态` 和 `API 未授权`。
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。

### 本轮剩余风险

- `n8n_status_summary` 只在本轮执行过 n8n 状态步骤后写入；如果配置 fail-fast 早停，不展示旧状态，避免误导。
- API 仍未授权；本轮只提升可见性，没有注入或保存 API Key。
- 当前一键回归 HTML 的移动端检查没有单独针对 `local_regression_latest.html` 做截图，只通过静态内容和现有页面布局回归验证。

### 下一轮实现建议

1. 给 n8n 状态检查增加 `--fail-on-api-unauthorized` 可选严格模式。
2. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
3. 给 `local_regression_latest.html` 增加单独的移动端布局检查。

## 实现迭代 73：一键回归报告增加独立移动端布局检查

### 本轮依据

- 迭代 72 已经把 n8n 状态摘要放进 `local_regression_latest.html` 顶部。
- 之前对 `local_regression_latest.html` 只做静态文本检查，没有独立截图和横向溢出检测。
- 一键回归报告本身已经成为运维入口，因此它也需要像单品报告和总览报告一样进入视觉回归链路。

### 本轮改动

- 新增 `tools/check_regression_summary_mobile_layout.mjs`
  - 打开 `output/amazon_product_analysis/local_regression_latest.html`。
  - 生成移动端截图 `local_regression_summary_mobile_layout_check.png`。
  - 检查横向溢出、顶部标题、总状态、指标卡、n8n 状态面板、文件入口、步骤列表和 `N8N_API_KEY` 提示。
- `tools/run_local_regression_checks.mjs`
  - 一键回归先写出 `local_regression_latest.html`。
  - 然后运行 `Local regression summary mobile layout` 检查。
  - 最终 JSON/HTML 写回该步骤结果。
  - 文件入口新增“本地回归截图”链接。
- `README_AI选品分析系统.md`
  - 补充本地回归报告移动端检查命令和截图位置。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - `local_regression_latest.html` 存在。
  - 统一回归总览 `ok = true`。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`，n8n API 仍为 `401 / 未授权`。
- `node --check tools/check_regression_summary_mobile_layout.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node tools/check_regression_summary_mobile_layout.mjs` 通过：
  - 无横向溢出。
  - 顶部标题可见。
  - 指标卡 `5` 个。
  - n8n 面板可见。
  - n8n facts `4` 个。
  - artifact links `4` 个。
  - check steps `7` 个。
  - overflowing nodes `0`。
- `node tools/run_local_regression_checks.mjs` 通过：
  - `counts.total = 8`
  - `passed = 7`
  - `skipped = 1`
  - `failed = 0`
  - 新增步骤 `Local regression summary mobile layout = OK`
- 生成截图：
  - `output/amazon_product_analysis/local_regression_summary_mobile_layout_check.png`
- 最终 `local_regression_latest.html`：
  - 包含 `Local regression summary mobile layout`
  - 包含 `local_regression_summary_mobile_layout_check.png`
  - 包含 `n8n 状态`
- 统一回归总览刷新后仍为 `OK`。

### 本轮剩余风险

- 该检查会先检查已经写出的回归报告，再把检查结果写回最终报告；最终报告比截图多一个“自身布局检查”步骤，但布局结构一致。
- 当前只覆盖移动端默认宽度 `390px`；多视口模式会通过一键回归参数继续扩展。
- n8n API 仍未授权；本轮没有改变 API Key 配置。

### 下一轮实现建议

1. 给 n8n 状态检查增加 `--fail-on-api-unauthorized` 可选严格模式。
2. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
3. 给本地回归报告增加桌面布局检查，和总览/单品桌面检查保持一致。

## 实现迭代 74：n8n API 授权检查增加可选严格模式

### 本轮依据

- 迭代 71-73 已经把 n8n 页面、API 授权和 crawler 健康状态写入本地状态文件，并展示到统一总览和一键回归报告。
- 当前 n8n 页面和 crawler 均可访问，但 n8n API 仍是 `401 / 未授权`。
- 默认本地回归不应该因为 API 401 失败，因为用户仍可在 n8n UI 手动执行；但在需要 API 自动执行前，应有一个严格模式明确阻断。

### 本轮改动

- `tools/check_n8n_status.mjs`
  - 新增 `--fail-on-api-unauthorized`。
  - 默认模式保持不变：n8n 页面和 crawler 可访问时退出码为 `0`，API 401 只显示“API 未授权”。
  - 严格模式下，如果 API 未授权，状态变为 `API 授权失败`，退出码为 `1`。
  - 状态 JSON 新增：
    - `strict_api_authorization`
    - `strict_api_failure`
- `tools/run_local_regression_checks.mjs`
  - 新增 `--strict-n8n-api`。
  - 开启后，n8n 状态步骤会传入 `--fail-on-api-unauthorized`。
  - 一键回归 JSON 新增 `strict_n8n_api`。
  - 一键回归 HTML 文件入口显示 n8n API 严格模式开关。
- `README_AI选品分析系统.md`
  - 补充默认模式和严格模式命令说明。

### 本轮验证

- 当前项目状态：
  - `local_regression_latest.json` 存在，上一轮回归 `ok = true`。
  - `local_regression_overview.json` 存在，统一总览 `ok = true`。
  - n8n 页面 `HTTP 200`。
  - crawler `HTTP 200`。
  - n8n API `401 / 未授权`。
- `node --check tools/check_n8n_status.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- 默认模式：
  - `node tools/check_n8n_status.mjs` 返回退出码 `0`
  - 输出 `Overall: API 未授权`
  - 输出 `strict API authorization: off`
- 严格模式：
  - `node tools/check_n8n_status.mjs --fail-on-api-unauthorized` 返回退出码 `1`
  - 输出 `Overall: API 授权失败`
  - 输出 `strict API authorization: on`
- 默认一键回归：
  - `node tools/run_local_regression_checks.mjs` 通过
  - n8n 状态步骤为 `OK`
- 严格一键回归测试：
  - `node tools/run_local_regression_checks.mjs --strict-n8n-api --no-overview` 返回退出码 `1`
  - n8n 状态步骤为 `FAIL`
  - n8n 步骤命令包含 `--fail-on-api-unauthorized`
  - `strict_n8n_api = true`
  - `n8n_status_summary.status = API 授权失败`
- 刷新统一总览后仍为 `OK`。
- `node tools/check_regression_summary_mobile_layout.mjs` 通过。
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。

### 本轮剩余风险

- 严格模式当前必然失败，因为 n8n API 仍未授权。
- 严格一键回归测试使用临时 summary/html 路径并已清理，正式 `local_regression_latest.*` 保持默认模式通过结果。
- 严格模式只校验授权，不触发 workflow 执行。

### 下一轮实现建议

1. 为 `regression_overrides` 增加“未知 id 提示”，但保持不阻断。
2. 给本地回归报告增加桌面布局检查，和总览/单品桌面检查保持一致。
3. 给 n8n 状态面板增加“API Key 已配置但仍失败”的更细提示。

## 实现迭代 75：回归覆盖配置增加未知 id 提示

### 本轮依据

- `regression_overrides` 已经能覆盖自动发现回归项，但如果配置了未来才会生成的回归 id，之前提示不够清晰。
- V1.0 的本地回归配置需要支持“先配置、后生成”的运维方式，因此未知 id 应该提示，但不能阻断。
- 当前正式配置只覆盖 `with_fixture_cache`，没有未知 id；本轮需要保证正常链路不受影响。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - `applyRegressionOverrides` 新增 `unknown_ids` 输出。
  - 未知覆盖项 reason 改为 `未知覆盖 id，当前没有匹配的回归项`。
  - 未知 id 会进入 `regression_overrides.warnings`，但不会进入 `errors`。
  - `--validate-config` 会输出 `regression_overrides_unknown_ids`，退出码仍为 `0`。
  - 统一回归总览 HTML 增加“未知覆盖 id”提示，说明不会阻断回归。
- `README_AI选品分析系统.md`
  - 补充说明未知覆盖 id 的行为：提示但不阻断，适合预留未来回归项。

### 本轮验证

- 当前项目状态：
  - `local_regression_latest.json` 存在，默认回归 `ok = true`。
  - `local_regression_overview.json` 存在，统一总览 `ok = true`。
  - `n8n_status_latest.json` 为默认模式：`API 未授权`，非严格失败。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`，n8n API `401 / 未授权`。
- `node --check tools/build_local_regression_overview.mjs` 通过。
- 正常配置：
  - `node tools/build_local_regression_overview.mjs --validate-config` 返回 `OK`
  - `regression_overrides: OK (1 item(s))`
  - 没有未知 id 提示。
- 临时未知 id 配置：
  - 添加 `ghost_future_check`
  - `node tools/build_local_regression_overview.mjs --config <temp> --validate-config` 返回退出码 `0`
  - 输出 `regression_overrides_unknown_ids: ghost_future_check`
  - 输出 warning：`当前没有匹配的回归项，已作为提示保留但不阻断`
- 临时未知 id 总览：
  - 返回退出码 `0`
  - `regression_overrides.unknown_ids = ["ghost_future_check"]`
  - HTML 包含 `未知覆盖 id`
  - HTML 包含 `ghost_future_check`
- 正式总览刷新后仍为 `OK`。
- `node tools/run_local_regression_checks.mjs` 通过：
  - `8` 项检查，`7` 通过，`1` 跳过，`0` 失败。
- `node tools/check_overview_mobile_layout.mjs` 通过。
- `node tools/check_latest_report_mobile_layout.mjs` 通过。
- `node tools/check_regression_summary_mobile_layout.mjs` 通过。

### 本轮剩余风险

- 未知 id 只提示，不阻断；如果用户拼错 id，需要主动查看 warning。
- `--validate-config` 的 unknown id 判断依赖当前输出目录已能被自动发现的回归文件列表。
- n8n API 仍未授权，本轮没有改变 API Key 配置。

### 下一轮实现建议

1. 给本地回归报告增加桌面布局检查，和总览/单品桌面检查保持一致。
2. 给 n8n 状态面板增加“API Key 已配置但仍失败”的更细提示。
3. 把未知覆盖 id 数量加入统一回归总览的摘要指标。

## 实现迭代 76：本地回归报告补齐桌面布局检查

### 本轮依据

- 迭代 73 已经给 `local_regression_latest.html` 增加移动端布局检查，但 `--desktop` 模式仍只覆盖总览看板和单品报告。
- 本地回归报告是日常判断系统是否稳定的入口；如果桌面端文件入口、n8n 状态卡或步骤明细溢出，会影响排查效率。
- 本轮只补齐只读布局回归，不触发 n8n 工作流，也不改变 Amazon 抓取和 AI 分析链路。

### 本轮改动

- `tools/check_regression_summary_mobile_layout.mjs`
  - 支持同一脚本检查移动端和桌面端。
  - 宽度低于 `900px` 时使用移动端模拟，`900px` 及以上使用桌面端模拟。
  - 输出标题会按视口显示 `Mobile` 或 `Desktop`。
- `tools/run_local_regression_checks.mjs`
  - `--desktop` 模式新增 `Local regression summary desktop layout` 步骤。
  - 本地回归 HTML 的文件入口新增“本地回归桌面截图”链接。
  - 桌面模式现在同时覆盖：总览桌面、单品桌面、本地回归报告桌面。
- `README_AI选品分析系统.md`
  - 补充本地回归报告桌面检查说明和截图路径。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - `local_regression_latest.html` 存在。
  - 统一回归总览存在。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`，n8n API 仍为 `401 / 未授权`。
- `node --check tools/check_regression_summary_mobile_layout.mjs` 通过。
- `node --check tools/run_local_regression_checks.mjs` 通过。
- `node tools/build_local_regression_overview.mjs --validate-config` 通过：
  - `regression_overrides: OK (1 item(s))`
  - `data_sources: OK (6 source(s), 3 usable, 3 reserved)`
- 单独桌面检查通过：
  - 宽度 `1366px`
  - 无横向溢出
  - n8n 状态面板可见
  - 文件入口可见
  - 步骤明细可见
- `node tools/run_local_regression_checks.mjs --desktop` 通过：
  - `counts.total = 11`
  - `passed = 10`
  - `skipped = 1`
  - `failed = 0`
  - `desktop_check = true`
  - `n8n_status_summary.status = API 未授权`
- 新增截图：
  - `output/amazon_product_analysis/local_regression_summary_desktop_layout_check.png`
- 最终 `local_regression_latest.html` 已包含：
  - `Local regression summary desktop layout (1366px)`
  - `local_regression_summary_desktop_layout_check.png`

### 本轮剩余风险

- n8n API 仍未授权，本轮不处理 API Key；默认回归继续把它作为运维提醒而非失败。
- 本地回归报告桌面截图检查的是当前已经写出的 HTML，然后最终报告再写入该步骤结果；结构一致，但截图本身不会包含最后新增的“自身桌面检查”行。
- 桌面宽度默认是 `1366px`；更宽屏或窄桌面可以通过 `--desktop-width` 单独验证。

### 下一轮实现建议

1. 给 n8n 状态面板增加“API Key 已配置但仍失败”的更细提示。
2. 把未知覆盖 id 数量加入统一回归总览的摘要指标。
3. 让本地回归 summary 检查在自定义 `--html` 路径时显式检查该路径，而不是默认最新报告。

## 实现迭代 77：n8n API Key 被拒绝场景提示细化

### 本轮依据

- 当前 n8n 页面和 crawler 均可访问，但 n8n API 仍为 `401 / 未授权`。
- 原提示只覆盖“没有设置 API Key”的场景；如果用户已经设置 `N8N_API_KEY` 但复制错误、key 过期或来自其他 n8n 实例，仍会看到类似未授权提示，排查方向不够清楚。
- 本轮只增强只读状态检查，不触发 n8n workflow，不修改报告生成主链路。

### 本轮改动

- `tools/check_n8n_status.mjs`
  - 新增 API 授权拒绝判断：`401/403`。
  - 当 `N8N_API_KEY` 未设置且 API 返回 `401/403` 时，仍显示 `API 未授权`，提示创建/复制并设置 key。
  - 当 `N8N_API_KEY` 已设置但 API 返回 `401/403` 时，显示 `API Key 被拒绝`。
  - 状态 JSON 新增 `api_key_rejected`。
  - 命令行输出新增 `API key env: set/not set`，不输出 key 值。
  - 下一步动作区分“没 key”和“key 被拒绝”两类修复路径。
- `README_AI选品分析系统.md`
  - 补充 `API Key 被拒绝` 的含义和处理方式。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - `local_regression_latest.json` 存在。
  - 统一回归总览存在。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`。
- `node --check tools/check_n8n_status.mjs` 通过。
- 无 `N8N_API_KEY` 场景验证通过：
  - 状态为 `API 未授权`
  - `API key env: not set`
  - 下一步动作提示创建/复制并设置 API Key。
- 假 `N8N_API_KEY` 场景验证通过：
  - 状态为 `API Key 被拒绝`
  - `API key env: set`
  - 下一步动作提示重新复制完整 key、检查空格/换行/遗漏。
- 假 key 严格模式验证通过：
  - `--fail-on-api-unauthorized` 返回失败退出码。
  - 状态为 `API Key 被拒绝`。
- 临时测试输出已清理。
- 正式状态已恢复为当前真实状态：
  - `status = API 未授权`
  - `api_key_present = false`
  - `api_key_rejected = false`
- `node tools/run_local_regression_checks.mjs --desktop` 通过：
  - `counts.total = 11`
  - `passed = 10`
  - `skipped = 1`
  - `failed = 0`
  - `n8n_status_summary.status = API 未授权`

### 本轮剩余风险

- 当前终端仍未设置真实 `N8N_API_KEY`，所以 API 自动执行仍不可用。
- 状态检查只验证 workflow API 是否能读取，不触发 workflow；真正执行前仍需要单独确认触发接口和凭据权限。
- 如果 n8n 未来改变 401/403 响应语义，需要同步调整状态解释。

### 下一轮实现建议

1. 把未知覆盖 id 数量加入统一回归总览的摘要指标。
2. 让本地回归 summary 检查在自定义 `--html` 路径时显式检查该路径，而不是默认最新报告。
3. 在统一回归总览里展示 `api_key_present` / `api_key_rejected`，让非技术用户不用打开 JSON 也能判断授权问题类型。

## 实现迭代 78：n8n 授权状态接入已保存 Windows 凭据

### 本轮依据

- 用户已通过 `tools/set_n8n_api_key.ps1` 完成授权，授权状态文件显示 `ok = true`。
- 之前 `tools/check_n8n_status.mjs` 只读取临时环境变量 `N8N_API_KEY`，没有读取本机保存的 Windows 凭据，容易在授权成功后继续误报 `API 未授权`。
- V1.0 的本地运维应优先使用安全保存的凭据，而不是要求每个新终端重复设置环境变量。

### 本轮改动

- `tools/check_n8n_status.mjs`
  - 当 `N8N_API_KEY` 不存在时，会检测当前 Windows 用户下的已保存凭据文件。
  - 如果保存凭据存在，则通过 `tools/invoke_n8n_api.ps1` 做只读 workflow API 验证。
  - 状态 JSON 新增 `credential_path`、`stored_credential_present` 和更准确的 `api_key_source`。
  - CLI 输出从 `API key env` 改为 `API key source`，可显示 `saved_windows_credential`。
  - 不输出 API Key 明文。
- `tools/check_regression_summary_mobile_layout.mjs`
  - 本地回归报告布局检查不再强制要求出现 `N8N_API_KEY` 文案。
  - 现在也接受 `saved_windows_credential`、`已保存的 Windows 凭据` 或 `API key source` 作为授权提示。
- `README_AI选品分析系统.md`
  - 授权 SOP 改为“推荐保存到 Windows 凭据，临时环境变量作为备选”。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - `local_regression_latest.json` 存在。
  - 统一回归总览存在。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`。
- n8n API 只读验证通过：
  - 工作流名称匹配 `Amazon 商品情报分析 - Crawlee免费抓取 + 阿里百炼 + HTML报告`
  - 未触发 workflow 执行。
- `node tools/check_n8n_status.mjs` 通过：
  - `status = 正常`
  - `n8n API = 已授权`
  - `api_key_source = saved_windows_credential`
- `node tools/check_n8n_status.mjs --fail-on-api-unauthorized` 通过：
  - 严格模式下授权已通过，不再失败。
- 本地回归报告移动端和桌面端布局检查均通过：
  - 无横向溢出
  - n8n 状态面板可见
  - 授权来源提示可见
- `node tools/run_local_regression_checks.mjs --desktop --strict-n8n-api` 通过：
  - `counts.total = 11`
  - `passed = 10`
  - `skipped = 1`
  - `failed = 0`
  - `n8n_status_summary.status = 正常`

### 本轮剩余风险

- 当前只是确认 API 读取授权成功，没有通过 API 自动触发 workflow。
- 保存凭据绑定当前 Windows 用户；换用户、换机器或重建 n8n 容器后，需要重新运行授权脚本。
- 若未来要让定时任务在不同执行用户下运行，需要确认该用户也能读取同一份凭据或改用专门的安全凭据管理方式。

### 下一轮实现建议

1. 在统一回归总览里展示 `api_key_source` 和 `stored_credential_present`，让非技术用户不用打开 JSON 也能判断授权来源。
2. 把未知覆盖 id 数量加入统一回归总览的摘要指标。
3. 让本地回归 summary 检查在自定义 `--html` 路径时显式检查该路径，而不是默认最新报告。

## 实现迭代 79：统一回归总览展示 n8n 授权来源

### 本轮依据

- 迭代 78 已经让 n8n 状态检查识别已保存 Windows 凭据，但统一回归总览只显示原始 `api_key_source`，对非技术用户不够直观。
- 当前 API 已授权，来源是 `saved_windows_credential`；这应该在总览页直接显示为“已保存 Windows 凭据”，而不是要求打开 JSON 判断。
- 本轮只更新统一回归总览展示，不触发 n8n workflow，也不修改商品分析主链路。

### 本轮改动

- `tools/build_local_regression_overview.mjs`
  - `n8n_status_summary` 透出 `api_key_rejected`、`stored_credential_present` 和 `credential_path`。
  - n8n 服务状态面板新增：
    - 授权来源
    - 保存凭据
    - Key 状态
    - 凭据位置
  - 将 `saved_windows_credential` 转成“已保存 Windows 凭据”，避免把内部字段直接给用户看。
- `README_AI选品分析系统.md`
  - 补充说明统一回归总览会直接展示 n8n 授权来源和凭据状态。

### 本轮验证

- 当前项目状态：
  - 最新单品报告存在。
  - `local_regression_latest.json` 存在。
  - 统一回归总览存在。
  - n8n 页面 `HTTP 200`，crawler `HTTP 200`。
- `node tools/check_n8n_status.mjs` 通过：
  - `status = 正常`
  - `n8n API = 已授权`
  - `api_key_source = saved_windows_credential`
- `node --check tools/build_local_regression_overview.mjs` 通过。
- `node tools/build_local_regression_overview.mjs` 通过，刷新统一回归总览。
- `local_regression_overview.json` 已包含：
  - `authorization_ok = true`
  - `api_key_source = saved_windows_credential`
  - `stored_credential_present = true`
  - `api_key_rejected = false`
  - `credential_path` 非空
- `local_regression_overview.html` 已显示：
  - `授权来源 已保存 Windows 凭据`
  - `保存凭据 已检测`
  - `Key 状态 可用`
  - `凭据位置 C:\Users\96259\.codex_n8n_api_key.credential.xml`
- `node tools/check_overview_mobile_layout.mjs` 通过；商品总览移动端仍无横向溢出。

### 本轮剩余风险

- 统一回归总览目前没有专门的截图布局检查脚本；本轮通过生成、字段检查和商品总览移动端回归做覆盖。
- 凭据位置会显示本机路径，但不会显示 API Key 明文。
- 当前仍未通过 API 自动执行 workflow；本轮只读验证授权状态。

### 下一轮实现建议

1. 给统一回归总览增加专门的移动端/桌面端布局检查，覆盖 n8n 服务状态、数据源健康和回归卡片。
2. 把未知覆盖 id 数量加入统一回归总览的摘要指标。
3. 让本地回归 summary 检查在自定义 `--html` 路径时显式检查该路径，而不是默认最新报告。
