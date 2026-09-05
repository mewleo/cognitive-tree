const { describe, it } = require('node:test');
const assert = require('node:assert');
const { KnowledgeNode } = require('../src/KnowledgeNode');

describe('KnowledgeNode', () => {
  describe('创建与属性', () => {
    it('应创建节点并正确设置核心属性', () => {
      const node = new KnowledgeNode({
        node_id: 'n1', axis: '业', state: '实',
        summary: 'ODDM框架无图数据库设计', raw_source: '对话原文...',
        explicit_tags: ['ODDM', '数据库'], implicit_tags: ['解耦', '边界'],
      });
      assert.strictEqual(node.node_id, 'n1');
      assert.strictEqual(node.axis, '业');
      assert.strictEqual(node.state, '实');
      assert.strictEqual(node.heat_score, 1.0);
      assert.strictEqual(node.level, 1);
      assert.deepStrictEqual(node.children_ids, []);
      assert.deepStrictEqual(node.cross_links, []);
    });
    it('应只允许生/业/思三个主干坐标', () => {
      assert.throws(() => {
        new KnowledgeNode({ node_id: 'n2', axis: '错误', state: '虚', summary: 'test' });
      }, /axis 必须为生\/业\/思/);
    });
    it('应只允许虚/实两种状态', () => {
      assert.throws(() => {
        new KnowledgeNode({ node_id: 'n3', axis: '思', state: '半虚半实', summary: 'test' });
      }, /state 必须为虚\/实/);
    });
  });
  describe('热力机制', () => {
    it('touch() 应增加热力值', () => {
      const node = new KnowledgeNode({ node_id: 'n4', axis: '生', state: '实', summary: 'test' });
      node.touch();
      assert.ok(node.heat_score > 1.0);
    });
    it('decay() 应减少热力值但不低于0', () => {
      const node = new KnowledgeNode({ node_id: 'n5', axis: '生', state: '实', summary: 'test', heat_score: 0.5 });
      node.decay();
      assert.ok(node.heat_score < 0.5);
      assert.ok(node.heat_score >= 0);
    });
    it('热力值应有上限', () => {
      const node = new KnowledgeNode({ node_id: 'n6', axis: '业', state: '实', summary: 'test' });
      for (let i = 0; i < 100; i++) node.touch();
      assert.ok(node.heat_score <= 10);
    });
  });
  describe('虚实转换', () => {
    it('虚节点可通过 promoteToSolid() 转为实', () => {
      const node = new KnowledgeNode({ node_id: 'n7', axis: '思', state: '虚', summary: '一个构想' });
      assert.strictEqual(node.state, '虚');
      node.promoteToSolid();
      assert.strictEqual(node.state, '实');
    });
    it('实节点不应被 promoteToSolid 改变', () => {
      const node = new KnowledgeNode({ node_id: 'n8', axis: '业', state: '实', summary: '已验证' });
      node.promoteToSolid();
      assert.strictEqual(node.state, '实');
    });
  });
  describe('跨干关联', () => {
    it('addCrossLink 应添加关联且去重', () => {
      const node = new KnowledgeNode({ node_id: 'n9', axis: '业', state: '实', summary: 'test' });
      node.addCrossLink('other_1');
      node.addCrossLink('other_1');
      node.addCrossLink('other_2');
      assert.deepStrictEqual(node.cross_links, ['other_1', 'other_2']);
    });
  });
  describe('结晶条件', () => {
    it('level=1 且有足够子节点时 canCrystallize 为 true', () => {
      const node = new KnowledgeNode({
        node_id: 'n10', axis: '业', state: '实', summary: '底层碎片',
        children_ids: ['c1', 'c2', 'c3'],
      });
      assert.strictEqual(node.canCrystallize(3), true);
    });
    it('level 已经较高时不应再结晶', () => {
      const node = new KnowledgeNode({
        node_id: 'n11', axis: '业', state: '实', summary: '高阶原理',
        level: 3, children_ids: ['c1', 'c2', 'c3'],
      });
      assert.strictEqual(node.canCrystallize(3), false);
    });
    it('子节点不足时不应结晶', () => {
      const node = new KnowledgeNode({
        node_id: 'n12', axis: '业', state: '实', summary: '碎片',
        children_ids: ['c1'],
      });
      assert.strictEqual(node.canCrystallize(3), false);
    });
  });
});
