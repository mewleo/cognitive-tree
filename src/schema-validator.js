/**
 * schema-validator.js - KnowledgeNode JSON Schema 校验器
 *
 * 【用途】
 * 校验 AI 解析层输出的 JSON 是否符合 KnowledgeNode 契约，
 * 在数据进入知识树之前拦截非法结构。零第三方依赖，手动实现。
 *
 * 【校验维度】（对齐白皮书 Phase 1：Schema 校验）
 *   1. axis    — 必须为 生/业/思 之一（红线1：禁止兜底分类）
 *   2. state   — 必须为 虚/实 之一
 *   3. summary — 必须为非空字符串
 *   4. tags    — 必须为字符串数组；隐性标签不得与显性标签重叠（红线3：禁止业务词进隐性标签）
 *   5. 可选字段 — parent_hint 必须为字符串或空
 *
 * 【设计原则】
 * 大道至简：只校验契约硬约束，不做业务语义判断（语义判断由 AI 和用户完成）。
 */

const VALID_AXES = ['生', '业', '思'];
const VALID_STATES = ['虚', '实'];

class SchemaValidator {
  /**
   * 校验 AI 解析出的节点 JSON
   * @param {Object} obj - 待校验对象
   * @returns {{ok: boolean, errors: string[], data: Object|null}}
   *          ok=false 时 errors 为可读错误列表；ok=true 时 data 为清洗后的规范对象
   */
  static validateNode(obj) {
    const errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['解析结果必须是 JSON 对象'], data: null };
    }
    // 1. axis 校验（红线1：禁止兜底分类）
    if (!VALID_AXES.includes(obj.axis)) {
      errors.push(`axis 必须为 生/业/思 之一，收到: ${JSON.stringify(obj.axis)}（禁止"其他/杂项"兜底分类）`);
    }
    // 2. state 校验
    if (!VALID_STATES.includes(obj.state)) {
      errors.push(`state 必须为 虚/实 之一，收到: ${JSON.stringify(obj.state)}`);
    }
    // 3. summary 校验
    if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
      errors.push('summary 必须为非空字符串');
    } else if (obj.summary.length > 50) {
      errors.push(`summary 长度超限（${obj.summary.length}>50），需提炼主旨`);
    }
    // 4. 标签校验
    for (const key of ['explicit_tags', 'implicit_tags']) {
      const tags = obj[key];
      if (tags === undefined || tags === null) continue; // 允许缺省，视为空
      if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string' && t.trim().length > 0)) {
        errors.push(`${key} 必须为非空字符串数组`);
      }
    }
    // 5. 红线3：隐性标签不得与显性标签重叠（防止业务词混入隐性标签）
    const explicit = Array.isArray(obj.explicit_tags) ? obj.explicit_tags.map(t => t.trim()) : [];
    const implicit = Array.isArray(obj.implicit_tags) ? obj.implicit_tags.map(t => t.trim()) : [];
    const overlap = implicit.filter(t => explicit.includes(t));
    if (overlap.length > 0) {
      errors.push(`隐性标签不得包含显性业务词: ${overlap.join('、')}（隐性标签必须是哲理/结构词）`);
    }
    // 6. 可选 parent_hint
    if (obj.parent_hint !== undefined && obj.parent_hint !== null && typeof obj.parent_hint !== 'string') {
      errors.push('parent_hint 必须为字符串或空');
    }
    if (errors.length > 0) {
      return { ok: false, errors, data: null };
    }
    return {
      ok: true,
      errors: [],
      data: {
        axis: obj.axis,
        state: obj.state,
        summary: obj.summary.trim(),
        explicit_tags: explicit,
        implicit_tags: implicit,
        parent_hint: obj.parent_hint || '',
      },
    };
  }

  /**
   * 校验输入文本非空
   * @param {string} text - 用户输入的对话/笔记文本
   * @returns {{ok: boolean, error: string|null}}
   */
  static validateText(text) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      return { ok: false, error: '输入文本不能为空' };
    }
    if (text.trim().length > 8000) {
      return { ok: false, error: '输入文本过长（最多8000字），请分段输入' };
    }
    return { ok: true, error: null };
  }
}

module.exports = { SchemaValidator, VALID_AXES, VALID_STATES };
