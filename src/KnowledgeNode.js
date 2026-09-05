/**
 * KnowledgeNode - 认知树节点对象（ODDM 核心实体）
 *
 * 【设计哲学】
 * ODDM（对象驱动数据库模型）范式下，节点既是数据也是行为主体。
 * 传统数据库是"表+行"，ODDM 是"对象+引用"——树状结构通过对象的
 * 引用关联（parent_id / children_ids / cross_links）天然形成，无需外键。
 *
 * 【六维属性模型】
 * 每个节点由六个正交维度构成：
 *   1. axis     — 空间坐标：生(生活) / 业(工作) / 思(思考)，三大主干
 *   2. state    — 存在状态：虚(构想/待验证) / 实(经验/已验证)，双态
 *   3. content  — 内容载体：summary(提炼主旨，树上显示) + raw_source(完整原文)
 *   4. tags     — 标签系统：explicit(显性业务标签) + implicit(隐性结构标签，用于跨界启发)
 *   5. metrics  — 度量指标：heat_score(热力/注意力) + level(抽象层级，1=碎片，越大越接近第一性原理)
 *   6. topology — 拓扑关系：parent_id(父) + children_ids(子) + cross_links(跨干关联)
 *
 * 【行为主体】
 * 节点不是被动的数据容器，它有自己的行为：
 *   - touch()    被注意到，热力上升（对应人的注意力投射）
 *   - decay()    自然衰减，热力下降（对应时间流逝）
 *   - promoteToSolid()  虚转实（构想被实践验证，必须显式调用，主权在人）
 *   - canCrystallize()  判断是否达到结晶条件（底层碎片积累足够支撑）
 *   - isCompost()       判断是否已落叶化土（热力低于阈值，视觉淡化）
 *
 * @example
 * const node = new KnowledgeNode({
 *   node_id: 'oddm_overview',
 *   axis: '业',
 *   state: '实',
 *   summary: 'ODDM 对象驱动数据库模型总览',
 *   raw_source: '完整的文档内容...',
 *   implicit_tags: ['解耦', '极简', '自组织'],
 *   heat_score: 5.0,
 *   level: 2,
 *   children_ids: ['oddm_architecture', 'oddm_datamodel'],
 * });
 */
class KnowledgeNode {
  /** 合法主干坐标枚举 */
  static VALID_AXES = ['生', '业', '思'];
  /** 合法状态枚举 */
  static VALID_STATES = ['虚', '实'];
  /** 热力值上限（防止无限增长） */
  static HEAT_MAX = 10;
  /** 每次 touch() 热力提升步长 */
  static HEAT_TOUCH_STEP = 0.3;
  /** 每次 decay() 热力衰减步长 */
  static HEAT_DECAY_STEP = 0.1;
  /** 落叶化土阈值：heat_score 低于此值视为化土（视觉淡化，数据留存） */
  static COMPOST_THRESHOLD = 0.3;

  /**
   * @param {Object} opts
   * @param {string} opts.node_id - 对象唯一标识
   * @param {string} opts.axis - 主干坐标：生/业/思
   * @param {string} opts.state - 状态：虚/实
   * @param {string} opts.summary - AI提炼的核心主旨
   * @param {string} [opts.raw_source] - 原始对话/笔记指针
   * @param {string[]} [opts.explicit_tags] - 显性业务标签
   * @param {string[]} [opts.implicit_tags] - 隐性结构标签（复利/解耦/熵增...）
   * @param {number} [opts.heat_score=1.0] - 热力值
   * @param {number} [opts.level=1] - 抽象层级，1为底层碎片，越大越接近第一性原理
   * @param {string|null} [opts.parent_id] - 上层归纳节点
   * @param {string[]} [opts.children_ids] - 下层支撑节点
   * @param {string[]} [opts.cross_links] - 跨干关联节点
   */
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

  /**
   * 被注意到——热力上升
   * 对应人的注意力投射到这个知识点上
   */
  touch() {
    this.heat_score = Math.min(
      KnowledgeNode.HEAT_MAX,
      this.heat_score + KnowledgeNode.HEAT_TOUCH_STEP
    );
    return this.heat_score;
  }

  /**
   * 自然衰减——热力下降
   * 对应时间流逝，不再被关注的知识慢慢褪色
   */
  decay() {
    this.heat_score = Math.max(0, this.heat_score - KnowledgeNode.HEAT_DECAY_STEP);
    return this.heat_score;
  }

  /**
   * 虚转实——构想被实践验证
   * 必须显式调用，系统不会自动转换（主权在人）
   */
  promoteToSolid() {
    if (this.state === '虚') {
      this.state = '实';
      this.touch(); // 转实带来一次热力提升
    }
    return this.state;
  }

  /**
   * 添加跨干关联（自动去重）
   * 基于隐性标签触发的跨主干启发
   */
  addCrossLink(target_node_id) {
    if (!this.cross_links.includes(target_node_id)) {
      this.cross_links.push(target_node_id);
    }
    return this.cross_links;
  }

  /**
   * 判断是否达到结晶条件
   * 底层碎片积累足够多的子节点支撑时，可以提议升维结晶
   * @param {number} threshold - 需要的子节点数量阈值
   * @returns {boolean}
   */
  canCrystallize(threshold = 3) {
    return this.level <= 1 && this.children_ids.length >= threshold;
  }

  /**
   * 判断是否已落叶化土
   *
   * 【设计意图】
   * 白皮书第4节"热力驱动"：长期不用的知识自动褪色、折叠（落叶化土），但底层留存。
   * 化土是纯视觉表现，不是新的节点状态（虚/实不变），数据永久留存。
   * 化土节点被 touch（注意力重新投射）后热力回升，可唤醒。
   *
   * @param {number} [threshold] - 化土阈值，默认 COMPOST_THRESHOLD(0.3)
   * @returns {boolean} heat_score 严格低于阈值时返回 true
   */
  isCompost(threshold = KnowledgeNode.COMPOST_THRESHOLD) {
    return this.heat_score < threshold;
  }

  /**
   * 序列化——对齐 ODDM 对象契约
   */
  toJSON() {
    return {
      node_id: this.node_id,
      axis: this.axis,
      state: this.state,
      content: {
        summary: this.summary,
        raw_source: this.raw_source,
      },
      tags: {
        explicit: this.explicit_tags,
        implicit: this.implicit_tags,
      },
      metrics: {
        heat_score: this.heat_score,
        level: this.level,
      },
      topology: {
        parent_id: this.parent_id,
        children_ids: this.children_ids,
        cross_links: this.cross_links,
      },
    };
  }
}

module.exports = { KnowledgeNode };
