# Changelog

所有重要变更记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

### Added
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
