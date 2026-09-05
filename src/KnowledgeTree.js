/**
 * KnowledgeTree - 认知树容器（聚合根 / Aggregate Root）
 *
 * 【架构定位】
 * 在 DDD（领域驱动设计）中，KnowledgeTree 是聚合根，负责管理所有
 * KnowledgeNode 实体的生命周期和不变量。它是 AI 和用户与认知系统
 * 交互的唯一入口——外部不直接操作节点，而是通过树容器的方法。
 *
 * 【核心职责】
 *   1. 节点管理：addNode / getNode / getByAxis / getChildren
 *   2. 热力驱动：touchNode（注意力上升）/ decayAll（时间流逝）
 *   3. 认知结晶：suggestCrystallization（提议）/ crystallize（执行）
 *      —— 系统只提议，人做决定（主权在人）
 *   4. 跨干启发：discoverCrossLinks（基于隐性标签自动发现跨主干关联）
 *   5. 快速通道：addNote（实节点/笔记）/ addIdea（虚节点/想法）
 *   6. 渲染输出：renderASCII（CLI 树形视图）
 *   7. 自省快照：introspect（对齐 ODDM introspect 理念，AI 操作入口）
 *   8. 持久化：toJSON / fromJSON（序列化/反序列化，当前为 JSON 文件，后续接入 ODDM）
 *
 * 【存储模型】
 * 当前使用内存 Map 存储，toJSON() 导出为扁平数组（节点间通过 ID 引用关联）。
 * 这与 ODDM 的对象引用模型完全对齐——后续可平滑替换为 ODDM 持久化引擎，
 * 业务逻辑无需改动。
 *
 * 【不变量（Invariants）】
 *   - 节点 ID 全局唯一
 *   - axis 只能是 生/业/思，state 只能是 虚/实（由 KnowledgeNode 构造函数保证）
 *   - 结晶操作必须满足 canCrystallize() 条件
 *   - 跨干关联只在不同主干的节点间建立
 *
 * @example
 * const tree = new KnowledgeTree();
 * const node = tree.addNote('今天用ODDM重构了存储层', '业', ['解耦']);
 * tree.touchNode(node.node_id);           // 热力上升
 * tree.discoverCrossLinks();               // 发现跨干关联
 * console.log(tree.renderASCII());         // 渲染树形视图
 * const json = tree.toJSON();              // 序列化
 * const restored = KnowledgeTree.fromJSON(json);  // 反序列化
 */
const { KnowledgeNode } = require('./KnowledgeNode');

class KnowledgeTree {
  /**
   * 构造函数——初始化空树
   * 使用 Map 存储节点，O(1) 查找
   */
  constructor() {
    /** @type {Map<string, KnowledgeNode>} 节点存储，key=node_id */
    this.nodes = new Map();
  }

  /**
   * 添加节点
   */
  addNode(node) {
    this.nodes.set(node.node_id, node);
    return node;
  }

  /**
   * 获取节点
   */
  getNode(node_id) {
    return this.nodes.get(node_id) || null;
  }

  /**
   * 按主干坐标查询
   * @param {'生'|'业'|'思'} axis
   * @returns {KnowledgeNode[]}
   */
  getByAxis(axis) {
    return Array.from(this.nodes.values()).filter(n => n.axis === axis);
  }

  /**
   * 获取某节点的直接子节点
   */
  getChildren(parent_id) {
    const parent = this.getNode(parent_id);
    if (!parent) return [];
    return parent.children_ids
      .map(id => this.getNode(id))
      .filter(Boolean);
  }

  /**
   * 注意某个节点——热力上升
   */
  touchNode(node_id) {
    const node = this.getNode(node_id);
    if (node) node.touch();
    return node;
  }

  /**
   * 全树自然衰减——时间流逝
   */
  decayAll() {
    for (const node of this.nodes.values()) {
      node.decay();
    }
  }

  /**
   * 结晶提议——找到满足条件的底层节点
   * 系统只提议，不自动执行（主权在人）
   * @param {number} threshold - 需要的子节点数量
   * @returns {KnowledgeNode[]}
   */
  suggestCrystallization(threshold = 3) {
    return Array.from(this.nodes.values()).filter(n => n.canCrystallize(threshold));
  }

  /**
   * 执行结晶——将一个底层节点升维为高阶原理
   * 必须显式调用，系统不会自动结晶
   * @param {string} node_id
   * @param {string} new_summary - 结晶后的高阶原理表述
   */
  crystallize(node_id, new_summary) {
    const node = this.getNode(node_id);
    if (!node || !node.canCrystallize()) return null;
    node.level += 1;
    node.summary = new_summary;
    node.touch();
    return node;
  }

  /**
   * 发现跨干关联——不同主干但有相同隐性标签的节点
   * 基于隐性标签（复利/解耦/熵增...）触发跨界启发
   */
  discoverCrossLinks() {
    // 按隐性标签分组
    const tagGroups = new Map();
    for (const node of this.nodes.values()) {
      for (const tag of node.implicit_tags) {
        if (!tagGroups.has(tag)) tagGroups.set(tag, []);
        tagGroups.get(tag).push(node);
      }
    }

    // 同标签但不同主干的节点互相建立跨干关联
    for (const [, group] of tagGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].axis !== group[j].axis) {
            group[i].addCrossLink(group[j].node_id);
            group[j].addCrossLink(group[i].node_id);
          }
        }
      }
    }

    return Array.from(this.nodes.values()).filter(n => n.cross_links.length > 0);
  }

  /**
   * 快速保存笔记——一键存入实节点
   * 完整内容存 raw_source，summary 自动截断（树上显示简洁）
   * @param {string} content - 笔记完整内容
   * @param {string} [axis='业'] - 主干，默认业
   * @param {string[]} [implicit_tags=[]] - 隐性标签
   * @returns {KnowledgeNode}
   */
  addNote(content, axis = '业', implicit_tags = []) {
    const id = 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id,
      axis,
      state: '实',
      summary: this._truncate(content, 30),
      raw_source: content,
      implicit_tags,
    });
    this.addNode(node);
    this.discoverCrossLinks();
    return node;
  }

  /**
   * 快速保存想法——一键存入虚节点（思主干）
   * @param {string} content - 想法完整内容
   * @param {string[]} [implicit_tags=[]] - 隐性标签
   * @returns {KnowledgeNode}
   */
  addIdea(content, implicit_tags = []) {
    const id = 'idea_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id,
      axis: '思',
      state: '虚',
      summary: this._truncate(content, 30),
      raw_source: content,
      implicit_tags,
    });
    this.addNode(node);
    this.discoverCrossLinks();
    return node;
  }

  /**
   * AI 解析摄入——将 AI 解析层产出的节点数据写入树
   *
   * 【来源】白皮书 Phase 1（对话→JSON AI 解析层）的落库入口。
   * 与 addNote/addIdea 的区别：支持完整字段（axis/state/summary/显隐标签），
   * 由 AI 提炼而非自动截断。
   *
   * 【主权在人】AI 只是提议：
   *   1. 节点写入后不自动挂到任何父节点（parent_hint 仅作提示，父节点不存在则悬空）
   *   2. state 默认尊重 AI 判定（实=已验证经验 / 虚=待验证构想），用户确认时可见可改
   *   3. 写入后自动触发跨干关联发现，让隐性标签发挥作用
   *
   * @param {Object} parsed - Schema 校验通过的节点数据（{axis,state,summary,explicit_tags,implicit_tags,parent_hint}）
   * @param {string} rawSource - 原始输入文本（对话/笔记原文）
   * @returns {KnowledgeNode}
   */
  addFromAI(parsed, rawSource) {
    const id = 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id,
      axis: parsed.axis,
      state: parsed.state,
      summary: parsed.summary.length > 30 ? parsed.summary.slice(0, 30) + '…' : parsed.summary,
      raw_source: rawSource,
      explicit_tags: parsed.explicit_tags || [],
      implicit_tags: parsed.implicit_tags || [],
    });
    this.addNode(node);
    // parent_hint 若指向已存在节点，则挂载为其子节点（提议执行，结构权仍归用户确认）
    if (parsed.parent_hint && this.nodes.has(parsed.parent_hint)) {
      const parent = this.nodes.get(parsed.parent_hint);
      if (parent && parent.axis === parsed.axis) {
        parent.children_ids.push(node.node_id);
      }
    }
    this.discoverCrossLinks();
    return node;
  }

  /**
   * 截断文本用于 summary
   */
  _truncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  /**
   * ASCII 渲染——干支叶真实层级，递归展示父→子→叶
   *
   * 【渲染算法】
   *   1. 按三大主干（生/业/思）分组
   *   2. 每个主干内构建 childrenMap（节点→同主干子节点列表）
   *   3. 找出根节点（没有被任何节点作为子节点的），按热力降序排列
   *   4. 递归渲染：父节点→子节点→叶节点，使用树形连接符（├── / └── / │）
   *
   * 【每行格式】
   *   {前缀}{连接符}{状态} {层级}{标题} ·标签 🔥热力 ↔跨干数 📄长内容
   *   - 状态：●=实叶，○=虚叶
   *   - 层级：L2/L3...（仅 level>1 时显示）
   *   - 标签：最多2个隐性标签，用·分隔，超出标+N
   *   - 热力：最多3个🔥
   *   - 跨干数：↔N 表示有N个跨干关联（不显示具体ID，保持简洁）
   *   - 长内容：📄 表示 raw_source 超过100字，用 view 命令查看完整内容
   *
   * 【设计原则】
   *   - 大道至简：树上只显示摘要，完整内容用 view 查看
   *   - 热力驱动：根节点按热力排序，高热度的知识优先呈现
   *   - 跨干关联只显示数量：具体关联用 view 或 cross 命令查看
   *
   * @returns {string} 完整的 ASCII 树形文本
   */
  renderASCII() {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════');
    lines.push('                🌳 ODDM 认知树');
    lines.push('═══════════════════════════════════════════════════');

    for (const axis of ['生', '业', '思']) {
      const axisNodes = this.getByAxis(axis);
      lines.push('');
      lines.push(`【${axis}】`);

      if (axisNodes.length === 0) {
        lines.push('  └── (空)');
        continue;
      }

      // 构建 children map
      const childrenMap = new Map();
      const allChildIds = new Set();
      for (const node of axisNodes) {
        const children = node.children_ids
          .map(id => this.getNode(id))
          .filter(n => n && n.axis === axis);
        childrenMap.set(node.node_id, children);
        for (const c of children) allChildIds.add(c.node_id);
      }

      // 根节点：没有被任何节点作为子节点的，按热力排序
      const roots = axisNodes
        .filter(n => !allChildIds.has(n.node_id))
        .sort((a, b) => b.heat_score - a.heat_score);

      // 递归渲染
      const renderNode = (node, prefix, isLast) => {
        const connector = isLast ? '└── ' : '├── ';
        const stateMark = node.state === '实' ? '●' : '○';
        const levelMark = node.level > 1 ? `L${node.level} ` : '';
        const heatBars = '🔥'.repeat(Math.min(3, Math.ceil(node.heat_score / 2)));
        const tagCount = node.implicit_tags.length;
        const implicit = tagCount > 0
          ? ` ·${node.implicit_tags.slice(0, 2).join('·')}${tagCount > 2 ? '+' + (tagCount - 2) : ''}`
          : '';
        const cross = node.cross_links.length > 0 ? ` ↔${node.cross_links.length}` : '';
        const longContent = node.raw_source && node.raw_source.length > 100 ? ' 📄' : '';
        lines.push(`${prefix}${connector}${stateMark} ${levelMark}${node.summary}${implicit} ${heatBars}${cross}${longContent}`);

        const children = childrenMap.get(node.node_id) || [];
        if (children.length > 0) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          children.forEach((child, idx) => {
            renderNode(child, newPrefix, idx === children.length - 1);
          });
        }
      };

      roots.forEach((root, idx) => {
        renderNode(root, '  ', idx === roots.length - 1);
      });
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════');
    lines.push(`节点总数: ${this.nodes.size} | 实: ${this._countByState('实')} 虚: ${this._countByState('虚')} | 跨干关联: ${Array.from(this.nodes.values()).filter(n => n.cross_links.length > 0).length}`);
    lines.push('快速通道: note "内容" 存笔记 | idea "内容" 存想法');
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }

  _countByState(state) {
    return Array.from(this.nodes.values()).filter(n => n.state === state).length;
  }

  /**
   * 全树自省快照——对齐 ODDM introspect 理念
   */
  introspect() {
    return {
      total_nodes: this.nodes.size,
      by_axis: {
        '生': this.getByAxis('生').length,
        '业': this.getByAxis('业').length,
        '思': this.getByAxis('思').length,
      },
      by_state: {
        '实': this._countByState('实'),
        '虚': this._countByState('虚'),
      },
      cross_link_count: Array.from(this.nodes.values()).filter(n => n.cross_links.length > 0).length,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
    };
  }

  /**
   * 序列化——导出纯数据数组，用于持久化
   */
  toJSON() {
    return Array.from(this.nodes.values()).map(n => ({
      node_id: n.node_id,
      axis: n.axis,
      state: n.state,
      summary: n.summary,
      raw_source: n.raw_source,
      explicit_tags: n.explicit_tags,
      implicit_tags: n.implicit_tags,
      heat_score: n.heat_score,
      level: n.level,
      parent_id: n.parent_id,
      children_ids: n.children_ids,
      cross_links: n.cross_links,
    }));
  }

  /**
   * 反序列化——从数据数组重建树
   * @param {Array} data - toJSON() 导出的数组
   * @returns {KnowledgeTree}
   */
  static fromJSON(data) {
    const tree = new KnowledgeTree();
    if (!Array.isArray(data)) return tree;
    for (const item of data) {
      tree.addNode(new KnowledgeNode(item));
    }
    return tree;
  }
}

module.exports = { KnowledgeTree };
