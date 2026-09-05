# ODDM 认知树系统元规范 (Meta-Blueprint)

**Target:** 负责底层开发与具体实现的 AI 助手  
**Architecture Principle:** 大道至简 (Simplicity)、对象驱动 (ODDM)、双轨标签、虚实双态、主权在人。

## 模块一：ODDM 对象数据契约 (Object Schema)
本系统基于对象数据库（ODDM）驱动，不使用任何外置图数据库。核心实体为 `KnowledgeNode` 对象。所有的树状结构通过对象的引用关联（Topology）天然形成。

```json
{
 "$schema": "http://json-schema.org/draft-07/schema#",
 "title": "KnowledgeNode",
 "type": "object",
 "properties": {
   "node_id": {
     "type": "string",
     "description": "ODDM 对象唯一标识符"
   },
   "axis": {
     "type": "string",
     "enum": ["生", "业", "思"],
     "description": "人生三大主干坐标：生(生活/生存)、业(工作/创造)、思(思考/情感)"
   },
   "state": {
     "type": "string",
     "enum": ["虚", "实"],
     "description": "状态属性：虚(未实现的灵感/概念)、实(已验证的经验/知识)"
   },
   "content": {
     "type": "object",
     "properties": {
       "summary": { "type": "string", "description": "AI 提炼的核心主旨(建议<50字)" },
       "raw_source": { "type": "string", "description": "原始对话记录或笔记的指针/原文" }
     }
   },
   "tags": {
     "type": "object",
     "properties": {
       "explicit": { "type": "array", "items": { "type": "string" }, "description": "显性业务标签(如: 项目管理, 菜谱)" },
       "implicit": { "type": "array", "items": { "type": "string" }, "description": "隐性结构标签(如: 复利, 解耦, 熵增)，用于跨界联想" }
     }
   },
   "metrics": {
     "type": "object",
     "properties": {
       "heat_score": { "type": "number", "default": 1.0, "description": "热力值，随调用频次增加，随时间自然衰减" },
       "level": { "type": "integer", "default": 1, "description": "抽象层级：1为底层碎片，数字越大越接近第一性原理" }
     }
   },
   "topology": {
     "type": "object",
     "description": "ODDM 对象关联",
     "properties": {
       "parent_id": { "type": ["string", "null"], "description": "上层归纳节点ID" },
       "children_ids": { "type": "array", "items": { "type": "string" }, "description": "下层支撑节点ID集合" },
       "cross_links": { "type": "array", "items": { "type": "string" }, "description": "基于隐性标签触发的跨干关联节点ID" }
     }
   }
 },
 "required": ["node_id", "axis", "state", "content", "tags", "metrics", "topology"]
}
```

## 模块二：数据解析引擎指令 (Meta-Prompt)

此 Prompt 用于处理用户的日常对话和笔记，将其无感化地转化为上述 ODDM 对象。

```
# Role: ODDM 认知树转化引擎
# Task:
你的任务是阅读用户的非结构化输入（对话或笔记），在不改变原意的前提下，将其转化为符合 `KnowledgeNode` 契约的 JSON 数据，以便存入 ODDM 数据库。

# Rules:
1. **坐标锚定 (Axis)：** 强制分类至【生】（生活日常、生存技能）、【业】（工作复盘、专业知识）、【思】（情感、哲学思辨）之一。
2. **虚实判定 (State)：**
   - 验证过的、已发生的事实与经验 = `实`
   - 假设、灵感、待验证的想法 = `虚`
3. **隐性抽象 (Implicit Tags)：** 忽略具体业务表象，提取 1-3 个底层逻辑词。例如，用户讨论"代码模块分离"，隐性标签应为"解耦"或"边界"；用户讨论"长期坚持健身"，隐性标签应为"复利"。
4. **主权在人：** 只输出解析结果。若判定当前多个叶片可归纳为上层节点（认知结晶），必须通过字段向上层应用发起提议，严禁自行合并数据。
```

## 模块三：极简渲染协议 (Rendering Protocol)

前端呈现脱离重型框架，系统需具备输出轻量化视觉格式的能力，方便在任意环境（终端或网页）下预览。

### 1. ASCII CLI 视图 (基于 Heat 排序与过滤)

```
[节点层级] ─ [虚/实] ─ [内容主旨] ─ (隐性标签) ─ [热力感知]

[生]
├── [实] 每日作息调理与褪黑素影响 (生理节律) 🔥0.8
[业]
└── [高阶法则/实] 复杂系统的自下而上构建 (涌现, 解耦) 🔥1.0
     ├── [实] ODDM 框架无图数据库设计 (解耦) 🔥0.9
     └── [虚] AI 驱动的动态视图交互探讨 (自组织) 🔥0.7 ──> (跨干关联: [思] 哲学推演)
```

### 2. 声明式 SVG 直出规范

执行模型在输出图形时，遵循以下极简映射：

- **坐标系：** 三大主干互呈 120° 夹角放射。
- **节点 (Node)：** `<circle>` 元素。半径 r 与 metrics.heat_score 正相关。
- **状态 (State)：** 实叶为 fill="solid"，虚芽为 stroke-dasharray="2,2" fill="none"。
- **层级 (Level)：** level 越高的节点越靠近核心坐标原点。

## 🔍 架构防错与避坑指南 (Dev Notes)

- **防标签爆炸：** 写入隐性标签（Implicit Tags）时，需结合 ODDM 标签池进行相似度对齐，防止同义词泛滥（如"解耦"与"拆耦"规范化）。
- **防渲染死循环：** 遍历跨干关联（Cross-links）或上下级关系时，必须加入访问记录集（Visited Set）防抖过滤，避免构成环状图导致渲染崩溃。
- **溯源不断裂：** 底层叶片虽因热度衰减在视觉上淡化或化土，但 topology.children_ids 与 raw_source 的强关联必须在数据库中永久保留，以确保随时可逆向复原。
