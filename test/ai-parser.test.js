/**
 * ai-parser.test.js - 豆包 AI 解析适配器单元测试
 * 用 mock fetch 验证，不真实调用 API。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { DoubaoParser, extractJson, forceFetch } = require('../src/ai-parser');

/** 构造 mock fetch：返回固定 content */
function mockFetchOk(content) {
  return async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

/** 构造 mock fetch：返回 HTTP 错误 */
function mockFetchError(status, body) {
  return async () => ({
    ok: false,
    status,
    text: async () => body,
  });
}

test('正常解析：文本 → 通过校验的节点数据', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('{"axis":"业","state":"实","summary":"Rust内存释放验证","explicit_tags":["Rust"],"implicit_tags":["所有权"]}'),
  });
  const result = await parser.parse('今天调通了 Rust 的内存释放');
  assert.equal(result.ok, true);
  assert.equal(result.data.axis, '业');
  assert.equal(result.data.state, '实');
  assert.deepEqual(result.data.implicit_tags, ['所有权']);
});

test('容忍 ```json 代码块包裹的响应', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('```json\n{"axis":"思","state":"虚","summary":"团队微服务构想","explicit_tags":["团队管理"],"implicit_tags":["解耦"]}\n```'),
  });
  const result = await parser.parse('把团队分工微服务化');
  assert.equal(result.ok, true);
  assert.equal(result.data.axis, '思');
});

test('未配置 API Key 时返回清晰错误', async () => {
  const parser = new DoubaoParser({ apiKey: '', fetchImpl: mockFetchOk('{}') });
  const result = await parser.parse('随便一段话');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('ARK_API_KEY'));
});

test('空文本被拒绝', async () => {
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl: mockFetchOk('{}') });
  const result = await parser.parse('   ');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('不能为空'));
});

test('HTTP 错误时返回清晰错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchError(401, 'invalid api key'),
  });
  const result = await parser.parse('测试内容');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('HTTP 401'));
});

test('AI 返回非 JSON 时返回清晰错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('抱歉，我无法理解你的意思'),
  });
  const result = await parser.parse('测试内容');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('非合法 JSON'));
});

test('AI 返回的 JSON 未通过 Schema 校验时被拦截', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('{"axis":"其他","state":"实","summary":"测试"}'),
  });
  const result = await parser.parse('测试内容');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('Schema 校验'));
});

test('响应缺少 content 字段时报错', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{}] }) }),
  });
  const result = await parser.parse('测试内容');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('AI 调用失败'));
});

test('网络异常（fetch 抛错）时返回清晰错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  const result = await parser.parse('测试内容');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('ECONNREFUSED'));
});

test('extractJson：纯 JSON 直接提取', () => {
  assert.equal(extractJson('{"a":1}'), '{"a":1}');
});

test('extractJson：代码块包裹提取内部 JSON', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
});

test('extractJson：无围栏的代码块标记提取', () => {
  assert.equal(extractJson('```\n{"a":1}\n```'), '{"a":1}');
});

test('请求体构造：包含 META_PROMPT 系统消息', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"axis":"生","state":"实","summary":"测试","explicit_tags":[],"implicit_tags":[]}' } }] }) };
  };
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl });
  await parser.parse('测试内容');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.messages[0].role, 'system');
  assert.ok(body.messages[0].content.includes('ODDM 认知树转化引擎'));
  assert.equal(body.messages[1].content, '测试内容');
  assert.ok(captured.url.endsWith('/chat/completions'));
  assert.equal(captured.options.headers.Authorization, 'Bearer test-key');
});

test('可配置 baseUrl 和 model', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"axis":"思","state":"虚","summary":"x","explicit_tags":[],"implicit_tags":[]}' } }] }) };
  };
  const parser = new DoubaoParser({
    apiKey: 'k', baseUrl: 'https://custom.example.com/v3', model: 'my-model', fetchImpl,
  });
  await parser.parse('测试');
  assert.equal(captured.url, 'https://custom.example.com/v3/chat/completions');
  assert.equal(captured.body.model, 'my-model');
});

// ── forceFetch（默认请求实现，Node 原生 http/https）──
function startTestServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

test('forceFetch：POST 请求结构正确（方法/路径/头/体/Content-Length）', async () => {
  const { server, port } = await startTestServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ echo: { method: req.method, url: req.url, body: JSON.parse(body) } }));
    });
  });
  try {
    const res = await forceFetch(`http://127.0.0.1:${port}/api/v3/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
      body: JSON.stringify({ model: 'm', messages: [] }),
    });
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.echo.method, 'POST');
    assert.equal(data.echo.url, '/api/v3/chat/completions');
    assert.equal(data.echo.body.model, 'm');
    // Content-Length 由 forceFetch 自动计算，body 必须完整可达
    assert.ok(res.text);
    const text = await res.text();
    assert.ok(text.includes('"model":"m"'));
  } finally {
    server.close();
  }
});

test('forceFetch：HTTP 错误状态返回 ok=false', async () => {
  const { server, port } = await startTestServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('invalid api key');
  });
  try {
    const res = await forceFetch(`http://127.0.0.1:${port}/x`, { method: 'GET' });
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.equal(await res.text(), 'invalid api key');
  } finally {
    server.close();
  }
});

test('forceFetch：AbortSignal 触发时抛 AbortError', async () => {
  const { server, port } = await startTestServer(() => {
    // 服务器不响应，等客户端 abort
  });
  try {
    const controller = new AbortController();
    const p = forceFetch(`http://127.0.0.1:${port}/x`, {
      method: 'GET',
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(p, (e) => e.name === 'AbortError');
  } finally {
    server.close();
  }
});

test('DoubaoParser 默认使用 forceFetch（不依赖全局 fetch）', async () => {
  const { server, port } = await startTestServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"axis":"业","state":"实","summary":"默认实现可用","explicit_tags":[],"implicit_tags":["解耦"]}' } }] }));
    });
  });
  try {
    const parser = new DoubaoParser({ apiKey: 'test-key', baseUrl: `http://127.0.0.1:${port}/v3` });
    const result = await parser.parse('测试默认请求实现');
    assert.equal(result.ok, true);
    assert.equal(result.data.axis, '业');
    assert.equal(result.data.summary, '默认实现可用');
  } finally {
    server.close();
  }
});
