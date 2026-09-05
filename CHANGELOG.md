# Changelog

所有重要变更记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

### Added
- **AI 主动扩展学习（智能行为层功能四）**：`grow [N]` 命令——整合三个子能力的主动学习入口。
  - 子能力1「高热力延伸」：`KnowledgeTree.getTopHeatNodes(n)` 返回热力最高的N个节点；`DoubaoParser.growExtension(node)` 基于节点内容+隐性标签AI生成2-3个延伸知识点，提议用户存入（默认虚节点）。
  - 子能力2「知识空白检测」：`KnowledgeTree.findKnowledgeIslands()` 扫描隐性标签池，返回只有1个节点的知识孤岛标签，提示用户补充。
  - 子能力3「虚叶引力」：`KnowledgeTree.attractVirtualLeaves()` 虚节点主动寻找同隐性标签实节点建立cross_link；`findVirtualLeavesWithoutSupport()` 检测无实践支撑的虚节点。
  - `meta-prompt.js`：新增 `GROW_PROMPT`——高热力延伸系统提示词（输出JSON extensions数组，每点≤30字）。
  - `grow` 命令三步流程：知识空白检测→虚叶引力→高热力延伸（AI逐个生成延伸点并提议存入）。
  - 设计原则：AI只提议不自动写入（主权在人），扩展内容默认虚节点。
  - 测试新增19项（KnowledgeTree 12 + ai-parser 7），总数达112项全过。
- **AI 跨界启发（智能行为层功能三）**：`inspire "瓶颈"` 命令——AI 基于跨干经验节点生成跨界类比建议。
  - `meta-prompt.js`：新增 `INSPIRE_PROMPT`——跨界启发系统提示词（指导 AI 基于瓶颈+跨干节点生成≤100字跨界启发，输出 JSON 含 insight + implicit_tags）。
  - `DoubaoParser.inspire(bottleneck, relatedNodes)`：输入瓶颈+跨干相关节点，AI 输出 `{ok, insight, implicit_tags}`。
  - `KnowledgeTree.findCrossNodesByTags(tags, excludeAxis, limit=5)`：基于隐性标签找其他主干节点，按热力降序，默认最多5个。
  - `inspire` 命令：四步流程（AI解析瓶颈提取标签→findCrossNodesByTags找跨干节点→AI生成启发→可选存为思主干虚节点）。
  - 测试新增 12 项（findCrossNodesByTags 5 + inspire 7），总数达 93 项全过。
- **落叶化土（智能行为层功能二）**：热力低于阈值的节点自动视觉淡化（落叶化土），数据永久留存，touch 可唤醒。
  - `KnowledgeNode.COMPOST_THRESHOLD = 0.3`：默认化土阈值（可通过 `isCompost(threshold)` 自定义）。
  - `KnowledgeNode.isCompost(threshold)`：判断节点是否已化土（heat_score 严格低于阈值）。
  - `renderASCII` 化土渲染：化土节点显示灰色（ANSI 90m）+ 🍂 标记，不显示热力🔥/标签/跨干（视觉折叠，子节点仍递归渲染并独立判断化土）。
  - 设计原则：化土是纯视觉表现，不是新的节点状态（虚/实不变），对应白皮书"长期不用的知识自动褪色、折叠，但底层留存"。
  - 测试新增 7 项（isCompost 6 + renderASCII 化土标记 1），总数达 81 项全过。
- **认知结晶 AI 化（智能行为层功能一）**：结晶提议从手动查看升级为 AI 自动生成高阶表述。
  - `src/meta-prompt.js`：新增 `CRYSTALLIZATION_PROMPT`——认知结晶归纳系统提示词（指导 AI 将一组底层碎片降维为一条≤50字的第一性原理）。
  - `DoubaoParser.summarizeForCrystallization(childrenNodes)`：单独调一次 AI（用户确认多调用没坏处，理解更透彻），基于子节点内容生成高阶表述，返回 `{ok, summary}`。
  - `crystal` 命令升级：检测到可结晶节点后自动调用 AI 生成表述提议，交互为 `[y=用AI表述 / n=跳过 / m=手动输入]`；未配置 API Key 时降级为旧的手动模式。
  - `parse` 后自动结晶提议：环境变量 `AUTO_CRYSTALLIZE_PROPOSE=1` 时，parse 写入后自动扫描结晶条件并提示（无缝但 parse 变长）；默认关闭，保持独立 crystal 命令。
  - 测试新增 5 项（结晶归纳正常/空数组/空文本/HTTP错误/请求体校验），总数达 74 项全过。
- **AI 解析层（白皮书 Phase 1 首步落地）**：`parse "内容"` 命令——调用豆包 Chat Completions API 将对话/笔记文本解析为 KnowledgeNode JSON，经 Schema 校验后展示给用户确认，确认后写入树。双通道摄入（用户手输 + AI 自动提炼）的 AI 通道打通。
  - `src/meta-prompt.js`：系统提示词（坐标锚定/虚实判定/隐性抽象规则 + 三条红线 + 两个 Few-Shot 对齐示例）。
  - `src/schema-validator.js`：KnowledgeNode JSON Schema 校验器（axis/state/summary/标签类型/红线3隐性标签不得含业务词/长度上限），零第三方依赖。
  - `src/ai-parser.js`：`DoubaoParser` 适配器——火山方舟 OpenAI 兼容 Chat Completions 接入（端点/鉴权/超时/JSON 清洗/错误分级），fetch 可注入便于测试。
  - `KnowledgeTree.addFromAI()`：AI 解析结果落库通道（完整字段支持 + parent_hint 挂载提议 + 自动跨干关联）。
  - 测试新增 34 项（schema-validator 14 + ai-parser 14 + addFromAI 6），总数达 65 项全过。

### Fixed
- **CLI 引号污染**：`note "内容"` / `idea "内容"` / `parse "内容"` 会把引号本身存入内容（如 `"测试引号处理"`）。新增 `stripQuotes()` 剥离成对引号，统一处理三类命令。
- **H5 页面空白**：`generateHtmlPage` 中 `const DATA=${dataJson}` 被错误转义为 `\${dataJson}`，导致 JSON 数据未注入页面。修复为不转义，确保数据正确注入。
- **H5 SVG 嵌套模板字符串语法错误**：树状布局版本中，SVG JS 代码内的模板字符串反引号未正确转义，导致 `SyntaxError: Unexpected identifier 'M$'`。批量修复 `<script>` 标签内所有模板字符串转义。

### Changed
- **CLI 渲染精简**：跨干关联从完整 ID 列表改为仅显示数量 `↔N`；隐性标签最多显示2个（`·`分隔，超出标 `+N`）；移除行尾 node_id（用 `view <id>` 查看详情）；热力最多3个🔥。
- **H5 布局重构**：从放射状脑图布局改为自上而下树状布局；圆点节点改为矩形卡片（190×52px）；字体从 11px 提升到 13px；浅色背景（#f5f5f0）提升可读性；卡片内显示状态点+标题（16字截断）+标签+热力+层级；hover 显示完整内容 tooltip。

## [0.2.0] - 2026-09-05

### Added
- **持久化**：JSON 文件持久化（`ctree_data.json`），自动加载/保存。
- **export-md**：导出完整 Markdown 文档，按干支叶层级组织。
- **export-html**：导出 H5 SVG 页面（放射状脑图布局，后续已重构为树状布局）。
- **seed 命令**：`seed oddm-knowledge` 导入33个 ODDM 知识点种子数据。
- **种子数据**：`seed/oddm-knowledge.json`，业主干26节点（ODDM总览→六大枝→20叶），思主干7节点。
- **大内容索引**：summary 截断显示 + raw_source 完整存储 + 📄标记 + `view` 命令查看完整内容。
- **快速通道**：`note "内容"` 存笔记（实节点）、`idea "内容"` 存想法（虚节点）。
- **递归树形渲染**：CLI 支持干支叶多层级递归渲染。

### Changed
- 版本号从 0.1.0 升级到 0.2.0。

## [0.1.0] - 2026-09-05

### Added
- **KnowledgeNode 类**：认知节点对象，包含 axis（生/业/思）、state（虚/实）、summary、raw_source、explicit_tags、implicit_tags、heat_score、level、parent_id、children_ids、cross_links。
- **KnowledgeTree 类**：树容器，提供 addNode/getNode/getByAxis/getChildren/touchNode/decayAll/suggestCrystallization/crystallize/discoverCrossLinks/addNote/addIdea/renderASCII/introspect/toJSON/fromJSON。
- **CLI 交互**：基础命令 list/view/add/touch/decay/crystal/crystallize/cross/inspect/help/exit。
- **核心机制**：热力驱动（touch/decay）、认知结晶（suggestCrystallization/crystallize）、跨干关联（discoverCrossLinks，基于 implicit_tags）。
- **单元测试**：KnowledgeNode 12项 + KnowledgeTree 19项，共31项全过。
- **示例数据**：9个演示节点（业主干3、生主干2、思主干4）。
