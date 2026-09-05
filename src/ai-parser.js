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

const http = require('http');
const https = require('https');
const { META_PROMPT, CRYSTALLIZATION_PROMPT, INSPIRE_PROMPT } = require('./meta-prompt');
const { SchemaValidator } = require('./schema-validator');

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seed-2-1-pro-260628';
const REQUEST_TIMEOUT_MS = 120000; // 120s 超时（pro 模型首 token 可能较慢）

class DoubaoParser {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ARK_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.ARK_MODEL_ID || DEFAULT_MODEL;
    this.fetchImpl = config.fetchImpl || forceFetch;
  }

  checkKey() {
    if (!this.apiKey) {
      return {
        ok: false,
        error: '未配置豆包 API Key。请在环境变量中设置 ARK_API_KEY（火山方舟控制台获取），重启后生效。',
      };
    }
    return { ok: true, error: null };
  }

  getConfig() {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      hasKey: !!this.apiKey,
      timeoutSec: REQUEST_TIMEOUT_MS / 1000,
    };
  }

  async parse(text) {
    const textCheck = SchemaValidator.validateText(text);
    if (!textCheck.ok) {
      return { ok: false, error: textCheck.error };
    }
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) {
      return { ok: false, error: keyCheck.error };
    }
    let responseText;
    try {
      responseText = await this._request(META_PROMPT, text);
    } catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) {
        return {
          ok: false,
          error: `AI 请求超时（${REQUEST_TIMEOUT_MS / 1000}s 未响应）。` +
            `\n  端点: ${this.baseUrl}/chat/completions` +
            `\n  模型: ${this.model}` +
            `\n  排查: ① 网络能否访问火山方舟（curl 测试）` +
            `\n        ② 模型 ID 是否为你账号下的接入点（默认模型可能不可用，用 ARK_MODEL_ID 覆盖）` +
            `\n        ③ API Key 是否有该模型的调用权限`,
        };
      }
      return { ok: false, error: `AI 调用失败: ${e.message}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(extractJson(responseText));
    } catch (e) {
      return { ok: false, error: `AI 返回非合法 JSON: ${truncate(responseText, 120)}` };
    }
    const check = SchemaValidator.validateNode(parsed);
    if (!check.ok) {
      return { ok: false, error: `解析结果未通过 Schema 校验: ${check.errors.join('; ')}` };
    }
    return { ok: true, data: check.data };
  }

  async summarizeForCrystallization(childrenNodes) {
    if (!Array.isArray(childrenNodes) || childrenNodes.length === 0) {
      return { ok: false, error: '结晶归纳至少需要1个子节点' };
    }
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) {
      return { ok: false, error: keyCheck.error };
    }
    const userText = childrenNodes.map((n, i) => {
      const src = n.raw_source ? `\n  原文: ${n.raw_source}` : '';
      return `${i + 1}. [${n.axis}/${n.state}] ${n.summary}${src}`;
    }).join('\n');
    let responseText;
    try {
      responseText = await this._request(CRYSTALLIZATION_PROMPT, userText);
    } catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) {
        return { ok: false, error: `结晶归纳 AI 请求超时（${REQUEST_TIMEOUT_MS / 1000}s）` };
      }
      return { ok: false, error: `结晶归纳 AI 调用失败: ${e.message}` };
    }
    const summary = extractJson(responseText) || responseText.trim().replace(/^["'「『]+|["'」』]+$/g, '').trim();
    if (!summary || summary.length === 0) {
      return { ok: false, error: '结晶归纳 AI 返回空文本' };
    }
    return { ok: true, summary };
  }

  async inspire(bottleneck, relatedNodes) {
    if (!bottleneck || typeof bottleneck !== 'string' || bottleneck.trim().length === 0) {
      return { ok: false, error: '瓶颈描述不能为空' };
    }
    if (!Array.isArray(relatedNodes) || relatedNodes.length === 0) {
      return { ok: false, error: '没有相关节点可供跨界启发' };
    }
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) {
      return { ok: false, error: keyCheck.error };
    }
    const nodesText = relatedNodes.map((n, i) => {
      const src = n.raw_source ? `\n  原文: ${n.raw_source}` : '';
      return `${i + 1}. [${n.axis}/${n.state}] ${n.summary}${src}`;
    }).join('\n');
    const userText = `瓶颈：${bottleneck.trim()}\n\n相关经验（来自其他领域）：\n${nodesText}`;
    let responseText;
    try {
      responseText = await this._request(INSPIRE_PROMPT, userText);
    } catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) {
        return { ok: false, error: `跨界启发 AI 请求超时（${REQUEST_TIMEOUT_MS / 1000}s）` };
      }
      return { ok: false, error: `跨界启发 AI 调用失败: ${e.message}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(extractJson(responseText));
    } catch (e) {
      return { ok: false, error: `跨界启发 AI 返回非合法 JSON: ${truncate(responseText, 120)}` };
    }
    if (!parsed.insight || typeof parsed.insight !== 'string') {
      return { ok: false, error: '跨界启发结果缺少 insight 字段' };
    }
    return {
      ok: true,
      insight: parsed.insight.trim(),
      implicit_tags: Array.isArray(parsed.implicit_tags) ? parsed.implicit_tags : [],
    };
  }

  async _request(systemPrompt, userText) {
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
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
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

function extractJson(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1];
  return trimmed;
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function forceFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const headers = Object.assign({}, options.headers);
    const body = options.body;
    if (body && !Object.keys(headers).some(k => k.toLowerCase() === 'content-length')) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers,
      family: 4,
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          async text() { return text; },
          async json() { return JSON.parse(text); },
        });
      });
    });
    req.on('error', (e) => {
      if (options.signal && options.signal.aborted) {
        const err = new Error('This operation was aborted');
        err.name = 'AbortError';
        reject(err);
      } else {
        reject(e);
      }
    });
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy(new Error('This operation was aborted'));
      } else {
        options.signal.addEventListener('abort', () => {
          req.destroy(new Error('This operation was aborted'));
        });
      }
    }
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { DoubaoParser, extractJson, forceFetch };
