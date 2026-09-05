/**
 * ai-parser.js - 豆包 AI 解析适配器
 * 调用火山方舟 Chat Completions API，把用户非结构化输入转化为 KnowledgeNode JSON。
 * 网络层可注入（fetchImpl），便于单元测试 mock。
 */
const http = require('http');
const https = require('https');
const { META_PROMPT, CRYSTALLIZATION_PROMPT, INSPIRE_PROMPT, GROW_PROMPT } = require('./meta-prompt');
const { SchemaValidator } = require('./schema-validator');

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seed-2-1-pro-260628';
const REQUEST_TIMEOUT_MS = 120000;

class DoubaoParser {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ARK_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.ARK_MODEL_ID || DEFAULT_MODEL;
    this.fetchImpl = config.fetchImpl || forceFetch;
  }

  checkKey() {
    if (!this.apiKey) return { ok: false, error: '未配置豆包 API Key。请设置 ARK_API_KEY 环境变量。' };
    return { ok: true, error: null };
  }

  getConfig() {
    return { baseUrl: this.baseUrl, model: this.model, hasKey: !!this.apiKey, timeoutSec: REQUEST_TIMEOUT_MS / 1000 };
  }

  async parse(text) {
    const textCheck = SchemaValidator.validateText(text);
    if (!textCheck.ok) return { ok: false, error: textCheck.error };
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) return { ok: false, error: keyCheck.error };
    let responseText;
    try { responseText = await this._request(META_PROMPT, text); }
    catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) return { ok: false, error: `AI 请求超时（${REQUEST_TIMEOUT_MS / 1000}s）` };
      return { ok: false, error: `AI 调用失败: ${e.message}` };
    }
    let parsed;
    try { parsed = JSON.parse(extractJson(responseText)); }
    catch (e) { return { ok: false, error: `AI 返回非合法 JSON: ${truncate(responseText, 120)}` }; }
    const check = SchemaValidator.validateNode(parsed);
    if (!check.ok) return { ok: false, error: `解析结果未通过 Schema 校验: ${check.errors.join('; ')}` };
    return { ok: true, data: check.data };
  }

  async summarizeForCrystallization(childrenNodes) {
    if (!Array.isArray(childrenNodes) || childrenNodes.length === 0) return { ok: false, error: '结晶归纳至少需要1个子节点' };
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) return { ok: false, error: keyCheck.error };
    const userText = childrenNodes.map((n, i) => {
      const src = n.raw_source ? `\n  原文: ${n.raw_source}` : '';
      return `${i + 1}. [${n.axis}/${n.state}] ${n.summary}${src}`;
    }).join('\n');
    let responseText;
    try { responseText = await this._request(CRYSTALLIZATION_PROMPT, userText); }
    catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) return { ok: false, error: `结晶归纳 AI 请求超时` };
      return { ok: false, error: `结晶归纳 AI 调用失败: ${e.message}` };
    }
    const summary = extractJson(responseText) || responseText.trim().replace(/^["'「『]+|["'」』]+$/g, '').trim();
    if (!summary || summary.length === 0) return { ok: false, error: '结晶归纳 AI 返回空文本' };
    return { ok: true, summary };
  }

  async inspire(bottleneck, relatedNodes) {
    if (!bottleneck || typeof bottleneck !== 'string' || bottleneck.trim().length === 0) return { ok: false, error: '瓶颈描述不能为空' };
    if (!Array.isArray(relatedNodes) || relatedNodes.length === 0) return { ok: false, error: '没有相关节点可供跨界启发' };
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) return { ok: false, error: keyCheck.error };
    const nodesText = relatedNodes.map((n, i) => {
      const src = n.raw_source ? `\n  原文: ${n.raw_source}` : '';
      return `${i + 1}. [${n.axis}/${n.state}] ${n.summary}${src}`;
    }).join('\n');
    const userText = `瓶颈：${bottleneck.trim()}\n\n相关经验（来自其他领域）：\n${nodesText}`;
    let responseText;
    try { responseText = await this._request(INSPIRE_PROMPT, userText); }
    catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) return { ok: false, error: `跨界启发 AI 请求超时` };
      return { ok: false, error: `跨界启发 AI 调用失败: ${e.message}` };
    }
    let parsed;
    try { parsed = JSON.parse(extractJson(responseText)); }
    catch (e) { return { ok: false, error: `跨界启发 AI 返回非合法 JSON: ${truncate(responseText, 120)}` }; }
    if (!parsed.insight || typeof parsed.insight !== 'string') return { ok: false, error: '跨界启发结果缺少 insight 字段' };
    return { ok: true, insight: parsed.insight.trim(), implicit_tags: Array.isArray(parsed.implicit_tags) ? parsed.implicit_tags : [] };
  }

  /**
   * 高热力延伸——基于一个高热力节点生成 2-3 个延伸知识点/问题
   * 功能四子能力1：AI 主动扩展学习核心。
   * @param {Object} node - 知识节点对象
   * @returns {Promise<{ok: boolean, extensions?: Array, error?: string}>}
   */
  async growExtension(node) {
    if (!node || !node.summary || typeof node.summary !== 'string') return { ok: false, error: '延伸节点不能为空或缺少 summary' };
    const keyCheck = this.checkKey();
    if (!keyCheck.ok) return { ok: false, error: keyCheck.error };
    const tags = (node.implicit_tags || []).join(', ');
    const src = node.raw_source ? `\n  原文: ${node.raw_source}` : '';
    const userText = `原节点：${node.summary} [${node.axis}/${node.state}] 隐性标签：${tags || '(无)'}${src}`;
    let responseText;
    try { responseText = await this._request(GROW_PROMPT, userText); }
    catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.message)) return { ok: false, error: `高热力延伸 AI 请求超时` };
      return { ok: false, error: `高热力延伸 AI 调用失败: ${e.message}` };
    }
    let parsed;
    try { parsed = JSON.parse(extractJson(responseText)); }
    catch (e) { return { ok: false, error: `高热力延伸 AI 返回非合法 JSON: ${truncate(responseText, 120)}` }; }
    if (!Array.isArray(parsed.extensions) || parsed.extensions.length === 0) return { ok: false, error: '高热力延伸结果缺少 extensions 数组' };
    const extensions = parsed.extensions
      .filter(e => e && e.summary && typeof e.summary === 'string')
      .map(e => ({ summary: e.summary.trim().slice(0, 30), implicit_tags: Array.isArray(e.implicit_tags) ? e.implicit_tags : [] }));
    if (extensions.length === 0) return { ok: false, error: '高热力延伸结果中没有有效的延伸点' };
    return { ok: true, extensions };
  }

  async _request(systemPrompt, userText) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, temperature: 0.3, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }] }),
        signal: controller.signal,
      });
      if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${truncate(body, 200)}`); }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) throw new Error('响应中缺少 choices[0].message.content');
      return content;
    } finally { clearTimeout(timer); }
  }
}

function extractJson(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1];
  return trimmed;
}

function truncate(text, max) { return text.length > max ? text.slice(0, max) + '…' : text; }

function forceFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const headers = Object.assign({}, options.headers);
    const body = options.body;
    if (body && !Object.keys(headers).some(k => k.toLowerCase() === 'content-length')) headers['Content-Length'] = Buffer.byteLength(body);
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search, method: options.method || 'GET', headers, family: 4,
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, async text() { return text; }, async json() { return JSON.parse(text); } });
      });
    });
    req.on('error', (e) => {
      if (options.signal && options.signal.aborted) { const err = new Error('This operation was aborted'); err.name = 'AbortError'; reject(err); }
      else reject(e);
    });
    if (options.signal) {
      if (options.signal.aborted) req.destroy(new Error('This operation was aborted'));
      else options.signal.addEventListener('abort', () => req.destroy(new Error('This operation was aborted')));
    }
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { DoubaoParser, extractJson, forceFetch };
