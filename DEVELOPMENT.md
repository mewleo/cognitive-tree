# ODDM 认知树 - 开发文档

> 本文档面向开发者（人和 AI），说明系统的 OOP 设计方案、架构、实现路径和开发规范。
> 目标：让任何开发者读完本文档后，都能直观理解系统架构并参与开发。

---

## 一、OOP 设计方案

### 1.1 核心设计理念

**ODDM（对象驱动数据库模型）** 是本系统的底层范式。与传统的"表+行"数据库不同，ODDM 中：

- **一切皆对象**：知识节点是对象，树是对象的容器
- **引用即关系**：对象间通过 ID 引用形成拓扑，无需外键
- **行为封装**：对象不仅有数据，还有行为（touch/decay/crystallize 等）
- **聚合根模式**：KnowledgeTree 是聚合根，外部通过它操作所有节点

### 1.2 类图

```
┌─────────────────────────────────────────────────────────┐
│                    KnowledgeTree (聚合根)                  │
├─────────────────────────────────────────────────────────┤
│ - nodes: Map<string, KnowledgeNode>                      │
├─────────────────────────────────────────────────────────┤
│ + addNode(node) → KnowledgeNode                          │
│ + getNode(id) → KnowledgeNode | null                     │
│ + getByAxis(axis) → KnowledgeNode[]                      │
│ + getChildren(parentId) → KnowledgeNode[]                │
│ + touchNode(id) → KnowledgeNode                           │
│ + decayAll() → void                                       │
│ + suggestCrystallization(threshold) → KnowledgeNode[]    │
│ + crystallize(id, newSummary) → KnowledgeNode            │
│ + discoverCrossLinks() → KnowledgeNode[]                  │
│ + addNote(content, axis, tags) → KnowledgeNode           │
│ + addIdea(content, tags) → KnowledgeNode                  │
│ + renderASCII() → string                                   │
│ + introspect() → Object                                    │
│ + toJSON() → Array                                         │
│ + static fromJSON(data) → KnowledgeTree                   │
└─────────────────────────────────────────────────────────┘
                              │ 拥有
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   KnowledgeNode (实体)                     │
├─────────────────────────────────────────────────────────┤
│ + node_id: string                                         │
│ + axis: '生' | '业' | '思'                                │
│ + state: '虚' | '实'                                      │
│ + summary: string                                         │
│ + raw_source: string                                      │
│ + explicit_tags: string[]                                 │
│ + implicit_tags: string[]                                 │
│ + heat_score: number                                      │
│ + level: number                                           │
│ + parent_id: string | null                                │
│ + children_ids: string[]                                  │
│ + cross_links: string[]                                   │
├─────────────────────────────────────────────────────────┤
│ + touch() → number（热力上升）                             │
│ + decay() → number（热力衰减）                             │
│ + promoteToSolid() → string（虚转实）                     │
│ + addCrossLink(targetId) → string[]                       │
│ + canCrystallize(threshold) → boolean                     │
│ + toJSON() → Object（对齐 ODDM 契约）                     │
└─────────────────────────────────────────────────────────┘
```

### 1.3 对象关系图

```
                    KnowledgeTree
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
        【生】主干     【业】主干     【思】主干
           │             │             │
     ┌─────┴─────┐  ┌──┴──┐      ┌──┴──┐
     ▼           ▼  ▼     ▼      ▼     ▼
  实节点       虚节点  L2节点  L1节点  虚节点  实节点
     │           │     │      │      │      │
     └─────┬─────┘     └──┬───┘      └──┬───┘
           │                │               │
           ▼                ▼               ▼
      children_ids     children_ids    children_ids
      （父子引用）      （父子引用）     （父子引用）
           │                │               │
           └────────────────┼───────────────┘
                            ▼
                     cross_links
                  （跨干关联，基于
                   implicit_tags）
```

### 1.4 六维属性模型

每个 KnowledgeNode 由六个正交维度构成，这是系统的核心数据模型：

| 维度 | 字段 | 说明 | 取值 |
|------|------|------|------|
| **空间坐标** | `axis` | 三大主干 | 生(生活) / 业(工作) / 思(思考) |
| **存在状态** | `state` | 虚实双态 | 虚(构想/待验证) / 实(经验/已验证) |
| **内容载体** | `summary` + `raw_source` | 摘要+原文 | summary<50字（树上显示），raw_source完整内容 |
| **标签系统** | `explicit_tags` + `implicit_tags` | 显性+隐性 | explicit=业务标签，implicit=底层逻辑（复利/解耦/熵增） |
| **度量指标** | `heat_score` + `level` | 热力+层级 | heat=注意力(0-10)，level=抽象层级(1=碎片，越大越接近第一性原理) |
| **拓扑关系** | `parent_id` + `children_ids` + `cross_links` | 父+子+跨干 | 形成树状结构+跨干关联网络 |

---

## 二、系统架构

### 2.1 当前架构（CLI 版本）

```
┌──────────────────────────────────────────────────────┐
│                    用户（终端）                         │
└────────────────────────┬─────────────────────────────┘
                         │ 命令输入
                         ▼
┌──────────────────────────────────────────────────────┐
│                   cli.js (入口层)                       │
│  ├── 命令解析（readline）                              │
│  ├── 命令分发（commands 对象）                         │
│  ├── 持久化（save/load → ctree_data.json）            │
│  └── 导出（export-md / export-html）                  │
└────────────────────────┬─────────────────────────────┘
                         │ 调用
                         ▼
┌──────────────────────────────────────────────────────┐
│              KnowledgeTree (领域层/聚合根)              │
│  ├── 节点管理（addNode/getNode/getByAxis）            │
│  ├── 热力驱动（touchNode/decayAll）                   │
│  ├── 认知结晶（suggestCrystallization/crystallize）   │
│  ├── 跨干启发（discoverCrossLinks）                   │
│  ├── 快速通道（addNote/addIdea）                      │
│  ├── 渲染输出（renderASCII）                           │
│  └── 自省快照（introspect）                            │
└────────────────────────┬─────────────────────────────┘
                         │ 拥有/操作
                         ▼
┌──────────────────────────────────────────────────────┐
│              KnowledgeNode (实体层)                     │
│  ├── 六维属性（axis/state/content/tags/metrics/topo）│
│  ├── 行为方法（touch/decay/promoteToSolid/...）      │
│  └── 序列化（toJSON → 对齐 ODDM 契约）                │
└──────────────────────────────────────────────────────┘
```

### 2.2 目标架构（Web 应用版本）

```
┌──────────────────────────────────────────────────────────┐
│                    前端 (Web App)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SVG 知识树视图 │  │ 知识录入表单  │  │ 管理面板      │  │
│  │（缩放/折叠/   │  │（手动/批量   │  │（编辑/层级    │  │
│  │ 热力可视化）   │  │  导入）      │  │  设定）       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐                                        │
│  │ AI 对话面板   │  （知识提炼/跨域启发/水平评估）        │
│  └──────────────┘                                        │
└─────────────────────────┬────────────────────────────────┘
                          │ REST API / WebSocket
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    后端 (Node.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ REST API 层  │  │ AI 适配器层   │  │ 认证/权限层   │  │
│  │（CRUD/查询/  │  │（默认豆包，   │  │（用户隔离/    │  │
│  │  导出/导入） │  │  可扩展）     │  │  操作审计）   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐    │
│  │           领域层（KnowledgeTree + KnowledgeNode） │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────┬────────────────────────────────┘
                          │ ODDM 接口
                          ▼
┌──────────────────────────────────────────────────────────┐
│              数据层（ODDM → SQLite 持久化）                │
│  ├── 对象存储（KnowledgeNode 序列化）                     │
│  ├── 索引（axis/state/heat_score/implicit_tags）         │
│  └── 事务支持（结晶/跨干关联的原子操作）                  │
└──────────────────────────────────────────────────────────┘
```

### 2.3 部署架构

```
┌─────────────────────────────────────────┐
│           Docker 容器                     │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Web 前端    │  │  Node.js 后端    │  │
│  │  (静态资源)  │  │  (API + 领域逻辑)│  │
│  └─────────────┘  └────────┬────────┘  │
│                              │           │
│  ┌──────────────────────────▼────────┐  │
│  │        ODDM / SQLite 数据卷        │  │
│  │        (docker volume 挂载)        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
           │
           ▼
    外部 AI API（豆包/可扩展）
```

---

## 三、核心机制详解

### 3.1 热力驱动（Heat-driven）

**设计意图**：放弃人工整理，让知识通过"注意力"自动呈现。

```
用户关注节点 → touch() → heat_score += 0.3（上限10）
时间流逝     → decay() → heat_score -= 0.1（下限0）
渲染时       → 根节点按 heat_score 降序排列，高热度优先呈现
```

**对应自然规律**：像四季轮转，应季的枝叶繁茂（高热力），过季的落叶化土（低热力）。

### 3.2 认知结晶（Crystallization）

**设计意图**：底层碎片积累到一定程度，自动升维为高阶原理。替代复杂的落叶状态机。

```
条件：level <= 1 且 children_ids.length >= 3（默认阈值）
过程：
  1. suggestCrystallization() → 列出满足条件的节点（只提议，不执行）
  2. 用户确认 → crystallize(id, newSummary)
  3. level += 1，summary 更新为高阶原理表述，touch() 提升热力
```

**对应自然规律**：像水凝结成冰晶，零散的经验在足够积累后形成结构化的认知。

### 3.3 跨干启发（Cross-link Discovery）

**设计意图**：基于隐性标签（底层逻辑），在不同主干间建立关联，实现跨域启发。

```
算法：
  1. 按 implicit_tags 分组所有节点
  2. 同标签但不同 axis 的节点，互相建立 cross_links
  3. 自动去重

示例：
  "业"主干的"代码模块分离"（implicit_tags: ['解耦']）
  "生"主干的"家庭分工明确"（implicit_tags: ['解耦']）
  → 自动建立跨干关联，用户在工作中遇到解耦问题时，可从生活经验中获得启发
```

### 3.4 虚实双态（Virtual/Solid Dual-state）

**设计意图**：区分"已验证的知识"和"待验证的构想"，AI 生成的内容默认是虚节点。

```
虚节点（○）：灵感、假设、待探索的理念
  - AI 生成的知识点默认是虚节点
  - 具有"引力"，主动寻找支撑（通过 cross_links 关联到实节点）
  - 用户实践验证后 → promoteToSolid() → 转为实节点

实节点（●）：实实在在的、经过验证的知识和经验
  - 是树的基石
  - 可以作为虚节点的"支撑"
```

**主权在人**：系统不会自动将虚节点转为实节点，必须用户显式调用 promoteToSolid()。

---

## 四、实现路径（演进路线）

### 与白皮书 Phase 对齐

| 白皮书 Phase | 内容 | 当前状态 | 对应本路线图 |
|-------------|------|---------|-------------|
| Phase 1 | 数据解析与 Schema 校验（对话→标准 JSON） | ⏳ 未做 | 阶段二（AI 解析层） |
| Phase 2 | ODDM 对象持久化与查询 | ⏳ JSON 中间态 | 阶段四（ODDM 持久化） |
| Phase 3 | 热力计算与 CLI 文本树 | ✅ 已完成 | 阶段一 |
| Phase 4 | 极简 SVG 动态渲染 | ✅ 已完成（树状布局，偏离白皮书放射状，用户决策） | 阶段一/二 |

### 阶段一：CLI 核心验证（当前 ✅）

- [x] KnowledgeNode 类（六维属性+行为方法）
- [x] KnowledgeTree 类（聚合根，核心机制）
- [x] CLI 交互（命令行入口，快速通道）
- [x] 热力驱动（touch/decay）
- [x] 认知结晶（suggest/crystallize）
- [x] 跨干启发（discoverCrossLinks）
- [x] ASCII 树形渲染（干支叶层级）
- [x] JSON 持久化（ctree_data.json）
- [x] export-md 导出
- [x] export-html 导出（SVG 树状布局）
- [x] 种子数据（33个 ODDM 知识点）
- [x] 31项单元测试全过

### 阶段二：Web 应用基础（下一步）

- [ ] 后端 REST API（Node.js + Express/Fastify）
  - [ ] GET /api/nodes（列表/查询/过滤）
  - [ ] POST /api/nodes（创建）
  - [ ] PUT /api/nodes/:id（更新）
  - [ ] DELETE /api/nodes/:id（删除）
  - [ ] POST /api/nodes/:id/touch（热力上升）
  - [ ] POST /api/decay（全树衰减）
  - [ ] GET /api/crystallization（结晶提议）
  - [ ] POST /api/crystallization/:id（执行结晶）
  - [ ] POST /api/cross-links（重新发现跨干关联）
  - [ ] GET /api/export/md（导出 MD）
  - [ ] GET /api/export/html（导出 HTML）
  - [ ] POST /api/import（批量导入）
- [ ] 前端基础框架
  - [ ] SVG 知识树视图（可缩放/折叠/层级设定）
  - [ ] 知识录入表单（手动录入）
  - [ ] 节点详情面板（查看/编辑）
  - [ ] 管理面板（全局设置/默认层级）

### 阶段三：AI 集成

- [ ] AI 适配器层（默认豆包 API，可扩展）
- [ ] 知识提炼管道（对话/文档 → KnowledgeNode JSON → 用户确认）
- [ ] 标签自动生成（AI 提取 implicit_tags）
- [ ] 跨域启发（AI 基于 cross_links 生成启发建议）
- [ ] 知识水平评估（基于 state/level/heat/children 生成领域掌握度）
- [ ] 个人偏好背书（AI 回答时引用用户的实节点知识）

### 阶段四：ODDM 持久化 + 部署

- [ ] 接入 ODDM（github.com/mewleo/oddm）替代 JSON 文件
- [ ] SQLite 持久化
- [ ] 事务支持（结晶/跨干关联的原子操作）
- [ ] Docker 镜像 + docker-compose
- [ ] 桌面端（Electron 包裹或本地启动）
- [ ] 多用户支持（认证/权限/数据隔离）

---

## 五、开发规范

### 5.1 TDD（测试驱动开发）

**原则**：先写测试，再写实现；每个功能必须有对应的单元测试。

```bash
# 运行所有测试
node --test test/*.test.js

# 运行单个测试文件
node --test test/KnowledgeNode.test.js
```

**测试覆盖要求**：
- KnowledgeNode：所有 public 方法必须有测试
- KnowledgeTree：所有 public 方法必须有测试
- 核心机制（热力/结晶/跨干关联）必须有集成测试
- 边界条件（空树/单节点/深层嵌套）必须有测试

### 5.2 注释规范

**JSDoc 注释**：所有 public 类和方法必须有 JSDoc 注释。

```javascript
/**
 * 方法简要说明
 *
 * 详细说明设计意图、算法、注意事项。
 *
 * @param {string} paramName - 参数说明
 * @returns {KnowledgeNode} 返回值说明
 * @example
 * // 使用示例
 * const result = object.method(param);
 */
```

**类级别注释**：必须包含设计哲学、核心职责、使用示例。

**常量注释**：所有 static 常量必须有说明。

### 5.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | PascalCase | `KnowledgeNode`, `KnowledgeTree` |
| 方法名 | camelCase，动词开头 | `addNode()`, `touchNode()`, `decayAll()` |
| 变量名 | camelCase | `heatScore`, `crossLinks` |
| 常量 | UPPER_SNAKE_CASE | `HEAT_MAX`, `VALID_AXES` |
| 私有方法 | 下划线前缀 | `_truncate()`, `_countByState()` |
| 节点 ID | 语义化前缀 | `oddm_*`, `note_*`, `idea_*` |

### 5.4 提交规范

```
<type>: <简短描述>

<详细描述（可选）>
```

**Type 类型**：
- `feat`：新功能
- `fix`：修复 bug
- `style`：代码格式/样式调整
- `refactor`：重构
- `docs`：文档
- `test`：测试
- `chore`：构建/工具

**示例**：
```
feat: H5改为自上而下树状布局（矩形卡片+清晰字体）

fix: H5页面空白——DATA注入被错误转义

docs: 补充开发文档DEVELOPMENT.md
```

### 5.5 零第三方依赖原则

**当前阶段**：CLI 版本使用 Node.js 原生模块，零第三方依赖。

- 不引入 Express/Lodash 等框架
- 使用原生 `fs`、`path`、`readline`、`crypto`
- 测试使用 Node.js 内置 `node:test`

**理由**：大道至简，避免庞杂的第三方框架，保持代码的可理解性和可维护性。

**Web 应用阶段**：可引入轻量级框架（如 Fastify），但仍需保持极简原则。

---

## 六、文件结构

```
cognitive-tree/
├── src/
│   ├── KnowledgeNode.js    # 认知节点实体类（六维属性+行为）
│   ├── KnowledgeTree.js    # 认知树聚合根（核心机制+渲染+持久化）
│   └── cli.js              # CLI 入口（命令解析+分发+导出）
├── test/
│   ├── KnowledgeNode.test.js  # 节点单元测试（12项）
│   └── KnowledgeTree.test.js  # 树单元测试（19项）
├── seed/
│   └── oddm-knowledge.json    # ODDM 知识点种子数据（33节点）
├── docs/
│   ├── vision-whitepaper.md   # Gemini 原设计文档（项目概念与愿景）
│   └── meta-blueprint.md      # Meta-Blueprint 元规范（ODDM 契约+Meta-Prompt）
├── DESIGN.md                  # 核心设计文档（产品定位+六条原则+架构）
├── DEVELOPMENT.md             # 开发文档（本文档：OOP设计+实现路径+规范）
├── CHANGELOG.md               # 变更日志
├── AGENT.md                   # AI Agent 调用指南
├── README.md                  # 项目说明
├── package.json               # 项目配置
└── .gitignore                 # Git 忽略（ctree_data.json 等）
```

---

## 七、快速开始

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/mewleo/cognitive-tree.git
cd cognitive-tree

# 运行 CLI（无需安装依赖，零第三方依赖）
node src/cli.js

# 运行测试
node --test test/*.test.js
```

### 常用命令

```bash
# 导入种子数据
seed oddm-knowledge

# 查看认知树
list

# 快速存笔记
note "今天用ODDM重构了存储层"

# 快速存想法
idea "认知树可以做成浏览器插件"

# 查看节点详情
view <node_id>

# 导出 Markdown
export-md my-knowledge.md

# 导出 H5 页面
export-html my-knowledge.html
```

---

## 八、AI 开发者指南

如果你是 AI 模型，参与本项目开发时请遵守：

1. **先读文档**：开发前先读 `DESIGN.md`、`DEVELOPMENT.md`、`AGENT.md`
2. **TDD**：新功能先写测试，再写实现
3. **零依赖**：CLI 版本不引入第三方依赖
4. **注释完整**：新类/新方法必须有 JSDoc 注释
5. **主权在人**：涉及结构变更的操作（结晶/删除/合并）必须用户确认
6. **AI 生成内容默认虚节点**：不得自动标记为实节点
7. **推送前确认**：代码修改后先告知用户，等用户说"推送"再推送到 GitHub
8. **大道至简**：避免过度设计，保持代码简洁优雅
