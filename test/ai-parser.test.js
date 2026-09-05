const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { DoubaoParser, extractJson, forceFetch } = require('../src/ai-parser');

function mockFetch(returnText, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, async text() { return returnText; }, async json() { return JSON.parse(returnText); } });
}

describe('extractJson', () => {
  it('应剥离markdown代码块包裹', () => {
    assert.strictEqual(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
  });
  it('应剥离无语言标识的代码块', () => {
    assert.strictEqual(extractJson('```\n{"a":1}\n```'), '{"a":1}');
  });
  it('纯JSON原样返回', () => {
    assert.strictEqual(extractJson('{"a":1}'), '{"a":1}');
  });
});

describe('DoubaoParser 配置', () => {
  it('默认端点应为火山方舟', () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    assert.ok(p.baseUrl.includes('ark.cn-beijing.volces.com'));
  });
  it('checkKey无key应报错', () => {
    const p = new DoubaoParser({ apiKey: '' });
    assert.strictEqual(p.checkKey().ok, false);
  });
  it('checkKey有key应通过', () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    assert.strictEqual(p.checkKey().ok, true);
  });
});

describe('DoubaoParser.parse', () => {
  it('正常解析应返回结构化数据', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"axis":"业","state":"实","summary":"测试","explicit_tags":[],"implicit_tags":["解耦"]}' } }] })) });
    const result = await p.parse('测试内容');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data.axis, '业');
  });
  it('空文本应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.parse('');
    assert.strictEqual(result.ok, false);
  });
  it('无API Key应报错', async () => {
    const p = new DoubaoParser({ apiKey: '' });
    const result = await p.parse('内容');
    assert.strictEqual(result.ok, false);
  });
  it('非JSON响应应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '不是JSON' } }] })) });
    const result = await p.parse('内容');
    assert.strictEqual(result.ok, false);
  });
  it('HTTP错误应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch('{"error":"bad"}', 400) });
    const result = await p.parse('内容');
    assert.strictEqual(result.ok, false);
  });
  it('非法axis应被Schema拒绝', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"axis":"其他","state":"实","summary":"x","explicit_tags":[],"implicit_tags":[]}' } }] })) });
    const result = await p.parse('内容');
    assert.strictEqual(result.ok, false);
  });
  it('请求体应包含temperature和messages', async () => {
    let capturedBody = null;
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: async (url, opts) => { capturedBody = JSON.parse(opts.body); return { ok: true, status: 200, async text() { return JSON.stringify({ choices: [{ message: { content: '{"axis":"业","state":"实","summary":"x","explicit_tags":[],"implicit_tags":[]}' } }] }); }, async json() { return JSON.parse(JSON.stringify({ choices: [{ message: { content: '{"axis":"业","state":"实","summary":"x","explicit_tags":[],"implicit_tags":[]}' } }] })); } }; } });
    await p.parse('测试');
    assert.strictEqual(capturedBody.temperature, 0.3);
    assert.strictEqual(capturedBody.messages.length, 2);
    assert.strictEqual(capturedBody.messages[0].role, 'system');
  });
});

describe('DoubaoParser.summarizeForCrystallization', () => {
  it('正常归纳应返回一句话', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '明确边界与所有权，系统自然有序' } }] })) });
    const result = await p.summarizeForCrystallization([{ axis: '业', state: '实', summary: 'Rust内存', raw_source: '原文' }]);
    assert.strictEqual(result.ok, true);
    assert.ok(result.summary.length > 0);
  });
  it('空数组应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.summarizeForCrystallization([]);
    assert.strictEqual(result.ok, false);
  });
  it('无API Key应报错', async () => {
    const p = new DoubaoParser({ apiKey: '' });
    const result = await p.summarizeForCrystallization([{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('HTTP错误应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch('err', 500) });
    const result = await p.summarizeForCrystallization([{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('请求体应使用结晶系统提示词', async () => {
    let capturedBody = null;
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: async (url, opts) => { capturedBody = JSON.parse(opts.body); return { ok: true, status: 200, async text() { return JSON.stringify({ choices: [{ message: { content: '归纳结果' } }] }); }, async json() { return JSON.parse(JSON.stringify({ choices: [{ message: { content: '归纳结果' } }] })); } }; } });
    await p.summarizeForCrystallization([{ axis: '业', state: '实', summary: 'x' }]);
    assert.ok(capturedBody.messages[0].content.includes('认知结晶归纳引擎'));
  });
});

describe('DoubaoParser.inspire', () => {
  it('正常启发应返回insight和标签', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"insight":"像ODDM那样明确边界","implicit_tags":["解耦","边界"]}' } }] })) });
    const result = await p.inspire('团队沟通成本高', [{ axis: '业', state: '实', summary: '模块分离' }]);
    assert.strictEqual(result.ok, true);
    assert.ok(result.insight.includes('边界'));
    assert.ok(result.implicit_tags.includes('解耦'));
  });
  it('空瓶颈应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.inspire('', [{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('空相关节点应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.inspire('瓶颈', []);
    assert.strictEqual(result.ok, false);
  });
  it('无API Key应报错', async () => {
    const p = new DoubaoParser({ apiKey: '' });
    const result = await p.inspire('瓶颈', [{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('非JSON响应应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '不是JSON' } }] })) });
    const result = await p.inspire('瓶颈', [{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('缺少insight字段应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"implicit_tags":["解耦"]}' } }] })) });
    const result = await p.inspire('瓶颈', [{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
  it('HTTP错误应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch('err', 500) });
    const result = await p.inspire('瓶颈', [{ axis: '业', state: '实', summary: 'x' }]);
    assert.strictEqual(result.ok, false);
  });
});

describe('DoubaoParser.growExtension', () => {
  it('正常延伸应返回extensions数组', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"extensions":[{"summary":"延伸点1","implicit_tags":["一致性"]},{"summary":"延伸点2","implicit_tags":["性能"]}]}' } }] })) });
    const result = await p.growExtension({ summary: 'ODDM框架', axis: '业', state: '实', implicit_tags: ['解耦'] });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.extensions.length, 2);
    assert.strictEqual(result.extensions[0].summary, '延伸点1');
  });
  it('空节点应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.growExtension(null);
    assert.strictEqual(result.ok, false);
  });
  it('无summary应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test' });
    const result = await p.growExtension({ axis: '业', state: '实' });
    assert.strictEqual(result.ok, false);
  });
  it('无API Key应报错', async () => {
    const p = new DoubaoParser({ apiKey: '' });
    const result = await p.growExtension({ summary: 'x', axis: '业', state: '实' });
    assert.strictEqual(result.ok, false);
  });
  it('非JSON响应应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '不是JSON' } }] })) });
    const result = await p.growExtension({ summary: 'x', axis: '业', state: '实' });
    assert.strictEqual(result.ok, false);
  });
  it('缺少extensions数组应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch(JSON.stringify({ choices: [{ message: { content: '{"other":"field"}' } }] })) });
    const result = await p.growExtension({ summary: 'x', axis: '业', state: '实' });
    assert.strictEqual(result.ok, false);
  });
  it('HTTP错误应报错', async () => {
    const p = new DoubaoParser({ apiKey: 'test', fetchImpl: mockFetch('err', 500) });
    const result = await p.growExtension({ summary: 'x', axis: '业', state: '实' });
    assert.strictEqual(result.ok, false);
  });
});

describe('forceFetch', () => {
  it('应是函数', () => {
    assert.strictEqual(typeof forceFetch, 'function');
  });
});
