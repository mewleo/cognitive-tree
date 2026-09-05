# Changelog

所有重要变更记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

### Added
- **DEVELOPMENT.md**：完整开发文档，包含 OOP 设计方案、类图、系统架构、核心机制详解、实现路径、开发规范
- **DESIGN.md**：核心设计文档，包含产品定位、六条原则、数据模型、技术决策、Web 应用架构、AI 交互方案
- **CHANGELOG.md**：变更日志（本文件）

### Changed
- **源代码注释增强**：KnowledgeNode.js 和 KnowledgeTree.js 的类级别注释补充了设计哲学、六维属性模型、核心职责、不变量约束、完整使用示例；renderASCII 补充了渲染算法、每行格式说明、设计原则；静态常量全部加注释
- **AGENT.md**：更新节点 ID 说明，新增相关文档索引

### Fixed
- **H5 页面空白**：`generateHtmlPage` 中 `const DATA=${dataJson}` 被错误转义为 `\${dataJson}`，导致 JSON 数据未注入页面。修复为不转义，确保数据正确注入。
- **H5 SVG 嵌套模板字符串语法错误**：树状布局版本中，SVG JS 代码内的模板字符串反引号未正确转义，导致 `SyntaxError: Unexpected identifier 'M$'`。批量修复 `<script>` 标签内所有模板字符串转义。

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
- **CLI 渲染精简**：跨干关联从完整 ID 列表改为仅显示数量 `↔N`；隐性标签最多显示2个（`·`分隔，超出标 `+N`）；移除行尾 node_id（用 `view <id>` 查看详情）；热力最多3个🔥。
- **H5 布局重构**：从放射状脑图布局改为自上而下树状布局；圆点节点改为矩形卡片（190×52px）；字体从 11px 提升到 13px；浅色背景（#f5f5f0）提升可读性；卡片内显示状态点+标题（16字截断）+标签+热力+层级；hover 显示完整内容 tooltip。
- 版本号从 0.1.0 升级到 0.2.0。

## [0.1.0] - 2026-09-05

### Added
- **KnowledgeNode 类**：认知节点对象，包含 axis（生/业/思）、state（虚/实）、summary、raw_source、explicit_tags、implicit_tags、heat_score、level、parent_id、children_ids、cross_links。
- **KnowledgeTree 类**：树容器，提供 addNode/getNode/getByAxis/getChildren/touchNode/decayAll/suggestCrystallization/crystallize/discoverCrossLinks/addNote/addIdea/renderASCII/introspect/toJSON/fromJSON。
- **CLI 交互**：基础命令 list/view/add/touch/decay/crystal/crystallize/cross/inspect/help/exit。
- **核心机制**：热力驱动（touch/decay）、认知结晶（suggestCrystallization/crystallize）、跨干关联（discoverCrossLinks，基于 implicit_tags）。
- **单元测试**：KnowledgeNode 12项 + KnowledgeTree 19项，共31项全过。
- **示例数据**：9个演示节点（业主干3、生主干2、思主干4）。
