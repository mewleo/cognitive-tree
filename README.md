# 🌳 ODDM 认知树 (Cognitive Tree)

基于 ODDM（对象驱动数据库模型）的个人认知生态系统样板程序。

不是文件夹+笔记的静态仓库，而是一棵有生命、有呼吸、随注意力盛衰的认知树。

## 核心哲学

- **生 / 业 / 思** 三主干：所有知识归属于生活、工作、思考三大本源
- **虚 / 实** 双态：构想灵感为虚，验证经验为实，虚不能自动转实（主权在人）
- **热力驱动**：被注意则盛，时间流逝则衰，应季则展，非时则敛
- **认知结晶**：底层碎片积累足够，提议升维为第一性原理，碎片自然淡化
- **跨干启发**：隐性标签（解耦/复利/熵增...）打通三大主干，跨界联想
- **大道至简**：对象即数据，引用即拓扑，无外键，无表结构

## 快速开始

```bash
# 运行 CLI（自动持久化到 ctree_data.json）
node src/cli.js

# 运行全部单元测试
node --test test/KnowledgeNode.test.js test/KnowledgeTree.test.js
```

## 持久化

- 数据自动保存到当前目录的 `ctree_data.json`
- 启动时自动加载，修改后自动保存
- 首次运行无数据文件时，使用预置示例数据
- 删除 `ctree_data.json` 可重置为初始状态

## CLI 命令

### 快速通道（终端用户首选）

| 命令 | 说明 |
|------|------|
| `note "内容"` | 一键存笔记（实节点，默认业主干） |
| `note 生 "内容"` | 指定主干存笔记（生/业/思） |
| `idea "内容"` | 一键存想法（虚节点，思主干） |

### 完整命令

| 命令 | 说明 |
|------|------|
| `list` | 渲染认知树（干支叶层级，按热力排序） |
| `view <id>` | 查看节点完整内容（含原文、标签、关联） |
| `add` | 交互式添加新节点（完整字段） |
| `touch <id>` | 注意某个节点（热力上升） |
| `decay` | 全树自然衰减（模拟时间流逝） |
| `crystal` | 查看结晶提议 |
| `crystallize <id> <表述>` | 执行结晶升维 |
| `cross` | 重新发现跨干关联 |
| `inspect` | 全树自省快照 |
| `export-md [文件名]` | 导出为 Markdown 文件（干支叶层级） |
| `export-html [文件名]` | 导出为 H5 SVG 页面（浏览器打开查看，可分享） |
| `help` | 帮助 |
| `exit` | 退出 |

## 大内容索引

节点采用**词条式**设计，summary 与 raw_source 分离：

- `summary`：树上显示的提炼主旨（自动截断30字），视图永远简洁
- `raw_source`：完整原文，存在节点中但不显示在树上
- 超过100字的节点显示 📄 标记，提示有完整内容可展开
- `view <id>` 查看节点完整信息面板

两种输入流程：
- **用户侧输入**：先存完整内容，summary 自动截断，AI 可后补提炼标签
- **AI 对话总结**：AI 直接带 summary + 标签一块提交

## 项目结构

```
cognitive-tree/
├── src/
│   ├── KnowledgeNode.js   # 认知节点对象（虚实/热力/结晶/跨干关联）
│   ├── KnowledgeTree.js   # 树容器（查询/结晶提议/跨干发现/渲染/自省）
│   └── cli.js             # CLI 交互入口
├── test/
│   ├── KnowledgeNode.test.js  # 单元测试
│   └── KnowledgeTree.test.js  # 单元测试
├── package.json
├── AGENT.md              # AI 模型调用指南
└── README.md
```

## ODDM 对齐

本项目的对象模型对齐 ODDM 契约：
- `KnowledgeNode.toJSON()` 输出符合 Meta-Blueprint 的对象 Schema
- `KnowledgeTree.introspect()` 对齐 ODDM 的 `introspect()` 自省理念
- 拓扑通过 `parent_id / children_ids / cross_links` 引用关联天然形成，无外键
- 当前为 JSON 文件持久化，后续可平滑接入 ODDM 持久化

## 设计约束

- 系统只提议（结晶、跨干关联），不自动执行结构变更
- 虚节点不能自动转实，必须显式调用 `promoteToSolid()`
- 热力有上限（10），衰减不低于 0
- 跨干关联自动去重
- 零第三方依赖，纯 Node.js 内置模块

## License

Apache-2.0
