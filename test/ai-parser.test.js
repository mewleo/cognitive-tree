/**
 * ai-parser.test.js - 豆包 AI 解析适配器单元测试
 * 用 mock fetch 验证，不真实调用 API。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { DoubaoParser, extractJson, forceFetch } = require('../src/ai-parser');

function mockFetchOk(content) {
  return async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

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
  const { server, port } = await startTestServer(() => {});
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

test('结晶归纳：正常将子节点碎片归纳为高阶表述', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('明确边界与所有权，系统自然有序无冲突'),
  });
  const children = [
    { summary: 'Rust单播原则下无内存泄漏', axis: '业', state: '实' },
    { summary: 'ODDM对象引用天然形成拓扑', axis: '业', state: '实' },
    { summary: '家庭分工明确不越界', axis: '生', state: '实' },
  ];
  const result = await parser.summarizeForCrystallization(children);
  assert.equal(result.ok, true);
  assert.equal(result.summary, '明确边界与所有权，系统自然有序无冲突');
});

test('结晶归纳：空子节点数组返回错误', async () => {
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl: mockFetchOk('x') });
  const result = await parser.summarizeForCrystallization([]);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('至少需要'));
});

test('结晶归纳：AI返回空文本返回错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('   '),
  });
  const children = [{ summary: '碎片A', axis: '业', state: '实' }];
  const result = await parser.summarizeForCrystallization(children);
  assert.equal(result.ok, false);
  assert.ok(result.error && result.error.length > 0);
});

test('结晶归纳：HTTP错误返回清晰错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchError(500, 'server error'),
  });
  const children = [{ summary: '碎片A', axis: '业', state: '实' }];
  const result = await parser.summarizeForCrystallization(children);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('HTTP 500'));
});

test('结晶归纳：请求体使用结晶提示词并包含子节点内容', async () => {
  let capturedBody = null;
  const fetchImpl = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '归纳结果' } }] }),
    };
  };
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl });
  const children = [
    { summary: '碎片A内容', axis: '业', state: '实', raw_source: '原始A' },
    { summary: '碎片B内容', axis: '思', state: '虚' },
  ];
  await parser.summarizeForCrystallization(children);
  assert.ok(capturedBody, '请求体应被捕获');
  const sysMsg = capturedBody.messages.find(m => m.role === 'system');
  assert.ok(sysMsg.content.includes('认知结晶'), 'system prompt 应包含结晶归纳指令');
  const userMsg = capturedBody.messages.find(m => m.role === 'user');
  assert.ok(userMsg.content.includes('碎片A内容'), 'user message 应包含子节点摘要');
  assert.ok(userMsg.content.includes('碎片B内容'), 'user message 应包含所有子节点');
  assert.ok(userMsg.content.includes('原始A'), 'user message 应包含 raw_source');
});

// ─── 功能三：AI 跨界启发 inspire ───

test('跨界启发：正常生成启发建议', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('{"insight": "像ODDM那样每个角色只暴露标准接口，沟通成本会暴跌", "implicit_tags": ["解耦", "边界"]}'),
  });
  const result = await parser.inspire('团队沟通成本太高', [
    { summary: 'ODDM模块分离', axis: '业', state: '实' },
    { summary: '家庭分工明确', axis: '生', state: '实' },
  ]);
  assert.equal(result.ok, true);
  assert.ok(result.insight.includes('标准接口'));
  assert.deepEqual(result.implicit_tags, ['解耦', '边界']);
});

test('跨界启发：空瓶颈描述返回错误', async () => {
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl: mockFetchOk('{}') });
  const result = await parser.inspire('   ', [{ summary: 'x', axis: '业', state: '实' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('瓶颈描述不能为空'));
});

test('跨界启发：无相关节点返回错误', async () => {
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl: mockFetchOk('{}') });
  const result = await parser.inspire('测试瓶颈', []);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('没有相关节点'));
});

test('跨界启发：AI返回非JSON返回错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('抱歉我无法生成启发'),
  });
  const result = await parser.inspire('测试', [{ summary: 'x', axis: '业', state: '实' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('非合法 JSON'));
});

test('跨界启发：缺少insight字段返回错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchOk('{"implicit_tags": ["解耦"]}'),
  });
  const result = await parser.inspire('测试', [{ summary: 'x', axis: '业', state: '实' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('insight'));
});

test('跨界启发：HTTP错误返回清晰错误', async () => {
  const parser = new DoubaoParser({
    apiKey: 'test-key',
    fetchImpl: mockFetchError(500, 'server error'),
  });
  const result = await parser.inspire('测试', [{ summary: 'x', axis: '业', state: '实' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('HTTP 500'));
});

test('跨界启发：请求体使用INSPIRE_PROMPT并包含瓶颈和相关节点', async () => {
  let capturedBody = null;
  const fetchImpl = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"insight": "测试启发", "implicit_tags": []}' } }] }),
    };
  };
  const parser = new DoubaoParser({ apiKey: 'test-key', fetchImpl });
  await parser.inspire('团队沟通成本太高', [
    { summary: 'ODDM模块分离', axis: '业', state: '实', raw_source: '每个对象只暴露ref接口' },
    { summary: '家庭分工明确', axis: '生', state: '实' },
  ]);
  assert.ok(capturedBody, '请求体应被捕获');
  const sysMsg = capturedBody.messages.find(m => m.role === 'system');
  assert.ok(sysMsg.content.includes('跨界启发'), 'system prompt 应包含跨界启发指令');
  const userMsg = capturedBody.messages.find(m => m.role === 'user');
  assert.ok(userMsg.content.includes('团队沟通成本太高'), 'user message 应包含瓶颈描述');
  assert.ok(userMsg.content.includes('ODDM模块分离'), 'user message 应包含相关节点');
  assert.ok(userMsg.content.includes('家庭分工明确'), 'user message 应包含所有相关节点');
  assert.ok(userMsg.content.includes('每个对象只暴露ref接口'), 'user message 应包含 raw_source');
});
