/**
 * ai-parser.js - 豆包 AI 解析适配器（Phase 1：对话文本 → KnowledgeNode JSON）
 *
 * 【用途】
 * 调用火山方舟 Chat Completions API（豆包），把用户的非结构化输入
 * （对话/笔记/想法）解析为符合 KnowledgeNode 契约的 JSON，供认知树摄入。
 *
 * 【接入方式】（已确认，2026-09 官方文档）
 *   - 端点:  POST https://ark.cn-beijing.volces.com/api/v3/chat/completions
 *   - 鉴权:  Authorization: Bearer <ARK_API_KEY>（环境变量）
 *   - 格式:  OpenAI 兼容 Chat Completions
 *   - 模型:  默认 doubao-seed-2-1-pro-260628（可用 ARK_MODEL_ID 覆盖）
 *
 * 【设计原则】
 * 大道至简 + OOP：只做"文本 → 校验后的解析结果"一件事。
 * 网络层可注入（fetchImpl），便于单元测试 mock，不真调 API。
 */

const { META_PROMPT } = require('./meta-prompt');
const { SchemaValidator } = require('./schema-validator');

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seed-2-1-pro-260628';
const REQUEST_TIMEOUT_MS = 120000; // 120s 超时（pro 模型首 token 可能较慢）

class DoubaoParser {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey] - 豆包 API Key，默认读环境变量 ARK_API_KEY
   * @param {string} [config.baseUrl] - API 端点，默认火山方舟北京区
   * @param {string} [config.model] - 模型 ID，默认读 ARK_MODEL_ID 或官方示例模型
   * @param {Function} [config.fetchImpl] - fetch 实现（测试注入用）
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ARK_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.ARK_MODEL_ID || DEFAULT_MODEL;
    this.fetchImpl = config.fetchImpl || globalThis.fetch;
  }

  /**
   * 检查 API Key 是否已配置
   * @returns {{ok: boolean, error: string|null}}
   */
  checkKey() {
    if (!this.apiKey) {
      return {
        ok: false,
        error: '未配置豆包 API Key。请在环境变量中设置 ARK_API_KEY（火山方舟控制台获取），重启后生效。',
      };
    }
    return { ok: true, error: null };
  }

  /**
   * 返回当前配置摘要（供 CLI 显示，便于排查）
   * @returns {{baseUrl: string, model: string, hasKey: boolean, timeoutSec: number}}
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      hasKey: !!this.apiKey,
      timeoutSec: REQUEST_TIMEOUT_MS / 1000,
    };
  }

  /**
   * 解析文本为 KnowledgeNode JSON
   * @param {string} text - 用户输入的对话/笔记/想法
   * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
   *          ok=true 时 data 为通过 Schema 校验的节点数据（含 raw 响应在 meta）
   */
  async parse(text) {
    // 1. 输入校验
    const textCheck = SchemaValidator.validateText(text);
    if (!textCheck.ok) {
      return { ok: false, error: textCheck.error };
    }
    // 2. Key 校验
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) {
      return { ok: false, error: keyCheck.error };
    }
    // 3. 构造并发送请求
    let responseText;
    try {
      responseText = await this._request(text);
    } catch (e) {
      // 区分超时与其他网络错误，给出可操作的排查提示
      if (e.name === 'AbortError' || /abort/i.test(e.message)) {
        return {
          ok: false,
          error: `AI 请求超时（${REQUEST_TIMEOUT_MS / 1000}s 未响应）。` +
            `\n  端点: ${this.baseUrl}/chat/completions` +
            `\n  模型: ${this.model}` +
            `\n  排查: ① 网络能否访问火山方舟（curl 测试）` +
            `\n        ② 模型 ID 是否为你账号下的接入点（默认模型可能不可用，用 ARK_MODEL_ID 覆盖）` +
            `\n        ③ API Key 是否有该模型的调用权限` +
            `\n        ④ 若有代理，Node 内置 fetch 不读 npm 代理，需用 HTTPS_PROXY 或 undici ProxyAgent`,
        };
      }
      return { ok: false, error: `AI 调用失败: ${e.message}` };
    }
    // 4. 清洗并解析 JSON
    let parsed;
    try {
      parsed = JSON.parse(extractJson(responseText));
    } catch (e) {
      return { ok: false, error: `AI 返回非合法 JSON: ${truncate(responseText, 120)}` };
    }
    // 5. Schema 校验
    const check = SchemaValidator.validateNode(parsed);
    if (!check.ok) {
      return { ok: false, error: `解析结果未通过 Schema 校验: ${check.errors.join('; ')}` };
    }
    return { ok: true, data: check.data };
  }

  /**
   * 发送 Chat Completions 请求（可被 mock 替换）
   * @param {string} text
   * @returns {Promise<string>} 模型回复的原始文本
   */
  async _request(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3, // 低温度，保证解析稳定性
          messages: [
            { role: 'system', content: META_PROMPT },
            { role: 'user', content: text },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${truncate(body, 200)}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('响应中缺少 choices[0].message.content');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * 从模型回复中提取 JSON 文本（容忍 ```json 代码块包裹）
 * @param {string} text
 * @returns {string}
 */
function extractJson(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1];
  return trimmed;
}

/**
 * 截断长文本用于错误提示
 */
function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

module.exports = { DoubaoParser, extractJson };
