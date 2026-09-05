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
 *   4. 跨干启发：discoverCrossLinks / findCrossNodesByTags
 *   5. 主动扩展：getTopHeatNodes / findKnowledgeIslands / attractVirtualLeaves
 *   6. 快速通道：addNote / addIdea / addFromAI
 *   7. 渲染输出：renderASCII
 *   8. 自省快照：introspect
 *   9. 持久化：toJSON / fromJSON
 */
const { KnowledgeNode } = require('./KnowledgeNode');

class KnowledgeTree {
  constructor() {
    /** @type {Map<string, KnowledgeNode>} 节点存储，key=node_id */
    this.nodes = new Map();
  }

  addNode(node) { this.nodes.set(node.node_id, node); return node; }
  getNode(node_id) { return this.nodes.get(node_id) || null; }
  getByAxis(axis) { return Array.from(this.nodes.values()).filter(n => n.axis === axis); }

  getChildren(parent_id) {
    const parent = this.getNode(parent_id);
    if (!parent) return [];
    return parent.children_ids.map(id => this.getNode(id)).filter(Boolean);
  }

  touchNode(node_id) { const node = this.getNode(node_id); if (node) node.touch(); return node; }
  decayAll() { for (const node of this.nodes.values()) node.decay(); }

  suggestCrystallization(threshold = 3) {
    return Array.from(this.nodes.values()).filter(n => n.canCrystallize(threshold));
  }

  crystallize(node_id, new_summary) {
    const node = this.getNode(node_id);
    if (!node || !node.canCrystallize()) return null;
    node.level += 1;
    node.summary = new_summary;
    node.touch();
    return node;
  }

  discoverCrossLinks() {
    const tagGroups = new Map();
    for (const node of this.nodes.values()) {
      for (const tag of node.implicit_tags) {
        if (!tagGroups.has(tag)) tagGroups.set(tag, []);
        tagGroups.get(tag).push(node);
      }
    }
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
   * 基于隐性标签查找其他主干的相关节点（功能三：AI 跨界启发前置）
   * @param {string[]} tags - 隐性标签列表
   * @param {string} excludeAxis - 排除的主干
   * @param {number} [limit=5] - 返回数量上限
   * @returns {KnowledgeNode[]} 按热力降序排列的相关节点
   */
  findCrossNodesByTags(tags, excludeAxis, limit = 5) {
    if (!Array.isArray(tags) || tags.length === 0) return [];
    const tagSet = new Set(tags);
    return Array.from(this.nodes.values())
      .filter(n => n.axis !== excludeAxis)
      .filter(n => n.implicit_tags.some(t => tagSet.has(t)))
      .sort((a, b) => b.heat_score - a.heat_score)
      .slice(0, limit);
  }

  /**
   * 获取热力最高的 N 个节点（功能四：高热力延伸前置）
   * @param {number} [n=5] - 返回数量
   * @returns {KnowledgeNode[]} 按热力降序排列的节点
   */
  getTopHeatNodes(n = 5) {
    return Array.from(this.nodes.values())
      .sort((a, b) => b.heat_score - a.heat_score)
      .slice(0, n);
  }

  /**
   * 知识空白检测——找出只有 1 个节点的隐性标签（知识孤岛）
   * @returns {string[]} 只有1个节点的隐性标签列表
   */
  findKnowledgeIslands() {
    const tagCount = new Map();
    for (const node of this.nodes.values()) {
      for (const tag of node.implicit_tags) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      }
    }
    const islands = [];
    for (const [tag, count] of tagCount) {
      if (count === 1) islands.push(tag);
    }
    return islands;
  }

  /**
   * 找出没有实节点支撑的虚节点（功能四：虚叶引力前置检测）
   * @returns {KnowledgeNode[]} 没有实节点支撑的虚节点列表
   */
  findVirtualLeavesWithoutSupport() {
    const solidTags = new Set();
    for (const node of this.nodes.values()) {
      if (node.state === '实') {
        for (const tag of node.implicit_tags) solidTags.add(tag);
      }
    }
    const result = [];
    for (const node of this.nodes.values()) {
      if (node.state !== '虚') continue;
      const hasSupport = node.implicit_tags.some(t => solidTags.has(t));
      if (!hasSupport) result.push(node);
    }
    return result;
  }

  /**
   * 虚叶引力——虚节点主动寻找同隐性标签的实节点建立 cross_link
   * @returns {KnowledgeNode[]} 新建立了关联的虚节点列表
   */
  attractVirtualLeaves() {
    const newlyLinked = [];
    for (const vNode of this.nodes.values()) {
      if (vNode.state !== '虚') continue;
      let linked = false;
      for (const sNode of this.nodes.values()) {
        if (sNode.state !== '实') continue;
        const shareTag = vNode.implicit_tags.some(t => sNode.implicit_tags.includes(t));
        if (shareTag && !vNode.cross_links.includes(sNode.node_id)) {
          vNode.addCrossLink(sNode.node_id);
          sNode.addCrossLink(vNode.node_id);
          linked = true;
        }
      }
      if (linked) newlyLinked.push(vNode);
    }
    return newlyLinked;
  }

  addNote(content, axis = '业', implicit_tags = []) {
    const id = 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id, axis, state: '实',
      summary: this._truncate(content, 30), raw_source: content, implicit_tags,
    });
    this.addNode(node);
    this.discoverCrossLinks();
    return node;
  }

  addIdea(content, implicit_tags = []) {
    const id = 'idea_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id, axis: '思', state: '虚',
      summary: this._truncate(content, 30), raw_source: content, implicit_tags,
    });
    this.addNode(node);
    this.discoverCrossLinks();
    return node;
  }

  addFromAI(parsed, rawSource) {
    const id = 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const node = new KnowledgeNode({
      node_id: id, axis: parsed.axis, state: parsed.state,
      summary: parsed.summary.length > 30 ? parsed.summary.slice(0, 30) + '…' : parsed.summary,
      raw_source: rawSource,
      explicit_tags: parsed.explicit_tags || [], implicit_tags: parsed.implicit_tags || [],
    });
    this.addNode(node);
    if (parsed.parent_hint && this.nodes.has(parsed.parent_hint)) {
      const parent = this.nodes.get(parsed.parent_hint);
      if (parent && parent.axis === parsed.axis) parent.children_ids.push(node.node_id);
    }
    this.discoverCrossLinks();
    return node;
  }

  _truncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  renderASCII() {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════');
    lines.push('                🌳 ODDM 认知树');
    lines.push('═══════════════════════════════════════════════════');
    for (const axis of ['生', '业', '思']) {
      const axisNodes = this.getByAxis(axis);
      lines.push('');
      lines.push(`【${axis}】`);
      if (axisNodes.length === 0) { lines.push('  └── (空)'); continue; }
      const childrenMap = new Map();
      const allChildIds = new Set();
      for (const node of axisNodes) {
        const children = node.children_ids.map(id => this.getNode(id)).filter(n => n && n.axis === axis);
        childrenMap.set(node.node_id, children);
        for (const c of children) allChildIds.add(c.node_id);
      }
      const roots = axisNodes.filter(n => !allChildIds.has(n.node_id)).sort((a, b) => b.heat_score - a.heat_score);
      const renderNode = (node, prefix, isLast) => {
        const connector = isLast ? '└── ' : '├── ';
        const stateMark = node.state === '实' ? '●' : '○';
        const levelMark = node.level > 1 ? `L${node.level} ` : '';
        if (node.isCompost()) {
          lines.push(`${prefix}${connector}\x1b[90m${stateMark} ${levelMark}${node.summary} 🍂\x1b[0m`);
        } else {
          const heatBars = '🔥'.repeat(Math.min(3, Math.ceil(node.heat_score / 2)));
          const tagCount = node.implicit_tags.length;
          const implicit = tagCount > 0 ? ` ·${node.implicit_tags.slice(0, 2).join('·')}${tagCount > 2 ? '+' + (tagCount - 2) : ''}` : '';
          const cross = node.cross_links.length > 0 ? ` ↔${node.cross_links.length}` : '';
          const longContent = node.raw_source && node.raw_source.length > 100 ? ' 📄' : '';
          lines.push(`${prefix}${connector}${stateMark} ${levelMark}${node.summary}${implicit} ${heatBars}${cross}${longContent}`);
        }
        const children = childrenMap.get(node.node_id) || [];
        if (children.length > 0) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          children.forEach((child, idx) => renderNode(child, newPrefix, idx === children.length - 1));
        }
      };
      roots.forEach((root, idx) => renderNode(root, '  ', idx === roots.length - 1));
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════════════');
    lines.push(`节点总数: ${this.nodes.size} | 实: ${this._countByState('实')} 虚: ${this._countByState('虚')} | 跨干关联: ${Array.from(this.nodes.values()).filter(n => n.cross_links.length > 0).length}`);
    lines.push('快速通道: note "内容" 存笔记 | idea "内容" 存想法');
    lines.push('═══════════════════════════════════════════════════');
    return lines.join('\n');
  }

  _countByState(state) { return Array.from(this.nodes.values()).filter(n => n.state === state).length; }

  introspect() {
    return {
      total_nodes: this.nodes.size,
      by_axis: { '生': this.getByAxis('生').length, '业': this.getByAxis('业').length, '思': this.getByAxis('思').length },
      by_state: { '实': this._countByState('实'), '虚': this._countByState('虚') },
      cross_link_count: Array.from(this.nodes.values()).filter(n => n.cross_links.length > 0).length,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
    };
  }

  toJSON() {
    return Array.from(this.nodes.values()).map(n => ({
      node_id: n.node_id, axis: n.axis, state: n.state, summary: n.summary, raw_source: n.raw_source,
      explicit_tags: n.explicit_tags, implicit_tags: n.implicit_tags, heat_score: n.heat_score,
      level: n.level, parent_id: n.parent_id, children_ids: n.children_ids, cross_links: n.cross_links,
    }));
  }

  static fromJSON(data) {
    const tree = new KnowledgeTree();
    if (!Array.isArray(data)) return tree;
    for (const item of data) tree.addNode(new KnowledgeNode(item));
    return tree;
  }
}

module.exports = { KnowledgeTree };
