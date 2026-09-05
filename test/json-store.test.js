/**
 * json-store.test.js - 异步 JSON 持久化层测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { JsonStore } = require('../src/storage/json-store');

describe('JsonStore', () => {
  let tmpDir;
  let store;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctree-test-'));
    store = new JsonStore(path.join(tmpDir, 'test-data.json'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('文件不存在时应返回空数组', async () => {
      const data = await store.load();
      assert.deepStrictEqual(data, []);
    });

    it('应正确解析已存在的 JSON 文件', async () => {
      const testData = [{ node_id: 'n1', axis: '业', state: '实' }];
      fs.writeFileSync(store.filePath, JSON.stringify(testData), 'utf8');
      const data = await store.load();
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].node_id, 'n1');
    });

    it('JSON 格式错误应抛出异常', async () => {
      fs.writeFileSync(store.filePath, '不是合法JSON{{{', 'utf8');
      await assert.rejects(() => store.load(), /JSON|parse|Unexpected/i);
    });
  });

  describe('save', () => {
    it('应正常写入数据到文件', async () => {
      const testData = [{ node_id: 'n1', axis: '生' }];
      await store.save(testData);
      assert.ok(fs.existsSync(store.filePath));
      const loaded = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
      assert.strictEqual(loaded.length, 1);
    });

    it('应使用缩进格式（便于人类阅读）', async () => {
      await store.save([{ a: 1 }]);
      const content = fs.readFileSync(store.filePath, 'utf8');
      assert.ok(content.includes('\n'));
      assert.ok(content.includes('  '));
    });

    it('空数组也应正常保存', async () => {
      await store.save([]);
      const loaded = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
      assert.deepStrictEqual(loaded, []);
    });
  });

  describe('round-trip', () => {
    it('保存后加载数据应完全一致', async () => {
      const original = [
        { node_id: 'n1', axis: '业', state: '实', summary: '测试1', heat_score: 2.5 },
        { node_id: 'n2', axis: '思', state: '虚', summary: '测试2', implicit_tags: ['解耦'] },
      ];
      await store.save(original);
      const loaded = await store.load();
      assert.deepStrictEqual(loaded, original);
    });
  });
});
