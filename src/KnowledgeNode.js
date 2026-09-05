/**
 * KnowledgeNode - 认知树节点对象
 *
 * ODDM 对象驱动范式：节点既是数据也是行为主体。
 * 树结构通过对象引用（parent_id / children_ids / cross_links）天然形成。
 */
class KnowledgeNode {
  static VALID_AXES = ['生', '业', '思'];
  static VALID_STATES = ['虚', '实'];
  static HEAT_MAX = 10;
  static HEAT_TOUCH_STEP = 0.3;
  static HEAT_DECAY_STEP = 0.1;

  constructor(opts) {
    if (!KnowledgeNode.VALID_AXES.includes(opts.axis)) {
      throw new Error(`axis 必须为生/业/思，收到: ${opts.axis}`);
    }
    if (!KnowledgeNode.VALID_STATES.includes(opts.state)) {
      throw new Error(`state 必须为虚/实，收到: ${opts.state}`);
    }
    this.node_id = opts.node_id;
    this.axis = opts.axis;
    this.state = opts.state;
    this.summary = opts.summary;
    this.raw_source = opts.raw_source || '';
    this.explicit_tags = opts.explicit_tags || [];
    this.implicit_tags = opts.implicit_tags || [];
    this.heat_score = opts.heat_score ?? 1.0;
    this.level = opts.level ?? 1;
    this.parent_id = opts.parent_id || null;
    this.children_ids = opts.children_ids || [];
    this.cross_links = opts.cross_links || [];
  }

  touch() {
    this.heat_score = Math.min(KnowledgeNode.HEAT_MAX, this.heat_score + KnowledgeNode.HEAT_TOUCH_STEP);
    return this.heat_score;
  }

  decay() {
    this.heat_score = Math.max(0, this.heat_score - KnowledgeNode.HEAT_DECAY_STEP);
    return this.heat_score;
  }

  promoteToSolid() {
    if (this.state === '虚') {
      this.state = '实';
      this.touch();
    }
    return this.state;
  }

  addCrossLink(target_node_id) {
    if (!this.cross_links.includes(target_node_id)) {
      this.cross_links.push(target_node_id);
    }
    return this.cross_links;
  }

  canCrystallize(threshold = 3) {
    return this.level <= 1 && this.children_ids.length >= threshold;
  }

  toJSON() {
    return {
      node_id: this.node_id,
      axis: this.axis,
      state: this.state,
      content: { summary: this.summary, raw_source: this.raw_source },
      tags: { explicit: this.explicit_tags, implicit: this.implicit_tags },
      metrics: { heat_score: this.heat_score, level: this.level },
      topology: { parent_id: this.parent_id, children_ids: this.children_ids, cross_links: this.cross_links },
    };
  }
}

module.exports = { KnowledgeNode };
