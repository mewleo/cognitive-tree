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
   * 添加节点到树中
   * @param {KnowledgeNode} node - 要添加的节点
   * @returns {KnowledgeNode} 添加的节点
   */
  addNode(node) {
    this.nodes.set(node.node_id, node);
    return node;
  }

  /**
   * 根据 ID 获取节点
   * @param {string} node_id - 节点ID
   * @returns {KnowledgeNode|null} 节点对象，不存在返回 null
   */
  getNode(node_id) {
    return this.nodes.get(node_id) || null;
  }

  /**
   * 按主干坐标查询所有节点
   * @param {'生'|'业'|'思'} axis - 主干坐标
   * @returns {KnowledgeNode[]}
   */
  getByAxis(axis) {
    return Array.from(this.nodes.values()).filter(n => n.axis === axis);
  }

  /**
   * 获取某节点的直接子节点（同主干）
   * @param {string} parent_id - 父节点ID
   * @returns {KnowledgeNode[]}
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
   * 对应用户的注意力投射到这个知识点上
   * @param {string} node_id - 节点ID
   * @returns {KnowledgeNode|null}
   */
  touchNode(node_id) {
    const node = this.getNode(node_id);
    if (node) node.touch();
    return node;
  }

  /**
   * 全树自然衰减——时间流逝
   * 所有节点热力下降，模拟时间流逝后知识的自然褪色
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
   * @param {string} node_id - 要结晶的节点ID
   * @param {string} new_summary - 结晶后的高阶原理表述
   * @returns {KnowledgeNode|null}
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
   * 算法：按隐性标签分组，同标签但不同主干的节点互相建立关联
   * @returns {KnowledgeNode[]} 有跨干关联的节点列表
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
   * AI 生成的想法默认是虚节点，等待用户后续实践验证
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
   * 截断文本用于 summary
   * 超过 maxLen 的文本截断并添加省略号
   * @param {string} text - 原始文本
   * @param {number} maxLen - 最大长度
   * @returns {string}
   * @private
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

  /**
   * 按状态统计节点数量
   * @param {'虚'|'实'} state
   * @returns {number}
   * @private
   */
  _countByState(state) {
    return Array.from(this.nodes.values()).filter(n => n.state === state).length;
  }

  /**
   * 全树自省快照——对齐 ODDM introspect 理念
   * 提供树的全局统计信息和所有节点数据，是 AI 操作的入口
   * @returns {Object}
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
   * 序列化——导出扁平数据数组，用于持久化
   * 与 toJSON() 的嵌套结构不同，这里输出扁平结构便于 JSON 文件存储
   * @returns {Array}
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
