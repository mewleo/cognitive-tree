/**
 * commands.test.js - CLI 命令层纯逻辑测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { KnowledgeTree } = require('../src/KnowledgeTree');
const { KnowledgeNode } = require('../src/KnowledgeNode');
const { JsonStore } = require('../src/storage/json-store');
const { stripQuotes, CommandContext, executeCommand } = require('../src/cli/commands');

describe('stripQuotes', () => {
  it('应剥离双引号', () => {
    assert.strictEqual(stripQuotes('"hello"'), 'hello');
  });
  it('应剥离单引号', () => {
    assert.strictEqual(stripQuotes("'hello'"), 'hello');
  });
  it('无引号应原样返回', () => {
    assert.strictEqual(stripQuotes('hello'), 'hello');
  });
  it('空字符串应返回空字符串', () => {
    assert.strictEqual(stripQuotes(''), '');
  });
  it('null/undefined 应原样返回', () => {
    assert.strictEqual(stripQuotes(null), null);
    assert.strictEqual(stripQuotes(undefined), undefined);
  });
  it('只有开头引号不应剥离', () => {
    assert.strictEqual(stripQuotes('"hello'), '"hello');
  });
  it('应先 trim 再判断引号', () => {
    assert.strictEqual(stripQuotes('  "hello"  '), 'hello');
  });
});

describe('CommandContext', () => {
  let tmpDir;
  let store;
  let tree;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctree-cmd-'));
    store = new JsonStore(path.join(tmpDir, 'data.json'));
    tree = new KnowledgeTree();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('应正确构造上下文', () => {
    const ctx = new CommandContext({ tree, parser: {}, store, seedDir: '/tmp' });
    assert.strictEqual(ctx.tree, tree);
    assert.strictEqual(ctx.store, store);
    assert.strictEqual(ctx.seedDir, '/tmp');
  });

  it('save 应异步保存树数据', async () => {
    tree.addNode(new KnowledgeNode({ node_id: 'n1', axis: '业', state: '实', summary: '测试' }));
    const ctx = new CommandContext({ tree, parser: {}, store, seedDir: '/tmp' });
    await ctx.save();
    const loaded = await store.load();
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].node_id, 'n1');
  });
});

describe('executeCommand 分发', () => {
  let ctx;
  let rlMock;

  beforeEach(() => {
    const tree = new KnowledgeTree();
    tree.addNode(new KnowledgeNode({ node_id: 'n1', axis: '业', state: '实', summary: '测试节点' }));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctree-exec-'));
    const store = new JsonStore(path.join(tmpDir, 'data.json'));
    ctx = new CommandContext({ tree, parser: { apiKey: '' }, store, seedDir: tmpDir });
    rlMock = { question: () => {}, close: () => {} };
  });

  it('help 命令应返回 true（继续运行）', async () => {
    const result = await executeCommand(ctx, rlMock, 'help');
    assert.strictEqual(result, true);
  });

  it('list 命令应返回 true', async () => {
    const result = await executeCommand(ctx, rlMock, 'list');
    assert.strictEqual(result, true);
  });

  it('exit 命令应返回 false（退出）', async () => {
    const result = await executeCommand(ctx, rlMock, 'exit');
    assert.strictEqual(result, false);
  });

  it('quit 命令应返回 false', async () => {
    const result = await executeCommand(ctx, rlMock, 'quit');
    assert.strictEqual(result, false);
  });

  it('q 命令应返回 false', async () => {
    const result = await executeCommand(ctx, rlMock, 'q');
    assert.strictEqual(result, false);
  });

  it('未知命令应返回 true 并不报错', async () => {
    const result = await executeCommand(ctx, rlMock, 'unknowncommand');
    assert.strictEqual(result, true);
  });

  it('空输入应返回 true', async () => {
    const result = await executeCommand(ctx, rlMock, '   ');
    assert.strictEqual(result, true);
  });

  it('命令大小写不敏感', async () => {
    const result = await executeCommand(ctx, rlMock, 'LIST');
    assert.strictEqual(result, true);
  });
});
