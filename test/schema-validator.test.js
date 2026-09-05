/**
 * schema-validator.test.js - Schema 校验器单元测试
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SchemaValidator } = require('../src/schema-validator');

test('合法节点 JSON 通过校验', () => {
  const result = SchemaValidator.validateNode({
    axis: '业',
    state: '实',
    summary: 'Rust内存释放验证：单播原则下无泄漏',
    explicit_tags: ['Rust', '内存管理'],
    implicit_tags: ['所有权', '单播原则'],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.data.axis, '业');
});

test('axis 非法值被拒绝（红线1：禁止兜底分类）', () => {
  const result = SchemaValidator.validateNode({
    axis: '其他',
    state: '实',
    summary: '测试',
    explicit_tags: [],
    implicit_tags: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('axis 必须为 生/业/思')));
});

test('axis 缺失被拒绝', () => {
  const result = SchemaValidator.validateNode({
    state: '实',
    summary: '测试',
  });
  assert.equal(result.ok, false);
});

test('state 非法值被拒绝', () => {
  const result = SchemaValidator.validateNode({
    axis: '生',
    state: '半虚',
    summary: '测试',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('state 必须为 虚/实')));
});

test('summary 为空被拒绝', () => {
  const result = SchemaValidator.validateNode({
    axis: '思',
    state: '虚',
    summary: '   ',
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('summary 必须为非空字符串')));
});

test('summary 超过50字被拒绝', () => {
  const result = SchemaValidator.validateNode({
    axis: '思',
    state: '虚',
    summary: '超'.repeat(51),
    explicit_tags: [],
    implicit_tags: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('长度超限')));
});

test('标签不是数组被拒绝', () => {
  const result = SchemaValidator.validateNode({
    axis: '业',
    state: '实',
    summary: '测试',
    explicit_tags: 'Rust',
    implicit_tags: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('explicit_tags 必须为非空字符串数组')));
});

test('隐性标签包含显性业务词被拒绝（红线3）', () => {
  const result = SchemaValidator.validateNode({
    axis: '业',
    state: '实',
    summary: '测试',
    explicit_tags: ['Python'],
    implicit_tags: ['Python', '解耦'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('隐性标签不得包含显性业务词')));
});

test('显性隐性标签正常分离可通过（红线3通过案例）', () => {
  const result = SchemaValidator.validateNode({
    axis: '业',
    state: '实',
    summary: '测试',
    explicit_tags: ['Python'],
    implicit_tags: ['解耦', '极简'],
  });
  assert.equal(result.ok, true);
});

test('非对象输入被拒绝', () => {
  assert.equal(SchemaValidator.validateNode(null).ok, false);
  assert.equal(SchemaValidator.validateNode('string').ok, false);
  assert.equal(SchemaValidator.validateNode([1, 2]).ok, false);
});

test('parent_hint 非字符串被拒绝', () => {
  const result = SchemaValidator.validateNode({
    axis: '业',
    state: '实',
    summary: '测试',
    explicit_tags: [],
    implicit_tags: [],
    parent_hint: 123,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('parent_hint')));
});

test('输入文本校验：空文本被拒绝', () => {
  assert.equal(SchemaValidator.validateText('').ok, false);
  assert.equal(SchemaValidator.validateText('   ').ok, false);
});

test('输入文本校验：超长文本被拒绝', () => {
  assert.equal(SchemaValidator.validateText('a'.repeat(8001)).ok, false);
});

test('输入文本校验：正常文本通过', () => {
  assert.equal(SchemaValidator.validateText('今天调通了 Rust 的内存释放').ok, true);
});
