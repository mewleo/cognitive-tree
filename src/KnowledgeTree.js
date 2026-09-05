/**
 * KnowledgeTree - 认知树容器
 *
 * 管理所有 KnowledgeNode 对象，提供查询、结晶提议、跨干关联发现、渲染、持久化等能力。
 */
const { KnowledgeNode } = require('./KnowledgeNode');

class KnowledgeTree {
  constructor() { this.nodes = new Map(); }

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
      node_id: n.node_id, axis: n.axis, state: n.state, summary: n.summary,
      raw_source: n.raw_source, explicit_tags: n.explicit_tags, implicit_tags: n.implicit_tags,
      heat_score: n.heat_score, level: n.level, parent_id: n.parent_id,
      children_ids: n.children_ids, cross_links: n.cross_links,
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
