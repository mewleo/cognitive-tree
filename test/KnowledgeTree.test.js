const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { KnowledgeNode } = require('../src/KnowledgeNode');
const { KnowledgeTree } = require('../src/KnowledgeTree');

describe('KnowledgeTree', () => {
  let tree;
  beforeEach(() => { tree = new KnowledgeTree(); });

  describe('节点管理', () => {
    it('应能添加和获取节点', () => {
      const node = new KnowledgeNode({ node_id: 'n1', axis: '业', state: '实', summary: '测试' });
      tree.addNode(node);
      assert.strictEqual(tree.getNode('n1'), node);
    });
    it('应能按主干 axis 查询节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'a1', axis: '生', state: '实', summary: '生活' }));
      tree.addNode(new KnowledgeNode({ node_id: 'a2', axis: '业', state: '实', summary: '工作' }));
      tree.addNode(new KnowledgeNode({ node_id: 'a3', axis: '业', state: '虚', summary: '构想' }));
      assert.strictEqual(tree.getByAxis('生').length, 1);
      assert.strictEqual(tree.getByAxis('业').length, 2);
    });
    it('应能获取子节点', () => {
      const parent = new KnowledgeNode({ node_id: 'p1', axis: '业', state: '实', summary: '父节点', children_ids: ['c1', 'c2'] });
      tree.addNode(parent);
      tree.addNode(new KnowledgeNode({ node_id: 'c1', axis: '业', state: '实', summary: '子1' }));
      tree.addNode(new KnowledgeNode({ node_id: 'c2', axis: '业', state: '实', summary: '子2' }));
      assert.strictEqual(tree.getChildren('p1').length, 2);
    });
  });

  describe('热力与衰减', () => {
    it('touchNode 应增加指定节点热力', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'h1', axis: '思', state: '虚', summary: '想法' }));
      const before = tree.getNode('h1').heat_score;
      tree.touchNode('h1');
      assert.ok(tree.getNode('h1').heat_score > before);
    });
    it('decayAll 应对所有节点衰减', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'd1', axis: '生', state: '实', summary: 'a', heat_score: 2.0 }));
      tree.addNode(new KnowledgeNode({ node_id: 'd2', axis: '业', state: '实', summary: 'b', heat_score: 2.0 }));
      tree.decayAll();
      assert.ok(tree.getNode('d1').heat_score < 2.0);
      assert.ok(tree.getNode('d2').heat_score < 2.0);
    });
  });

  describe('结晶提议', () => {
    it('应找到满足结晶条件的节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'cry1', axis: '业', state: '实', summary: '可结晶', children_ids: ['x1', 'x2', 'x3'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'x1', axis: '业', state: '实', summary: '碎片1' }));
      tree.addNode(new KnowledgeNode({ node_id: 'x2', axis: '业', state: '实', summary: '碎片2' }));
      tree.addNode(new KnowledgeNode({ node_id: 'x3', axis: '业', state: '实', summary: '碎片3' }));
      assert.strictEqual(tree.suggestCrystallization(3).length, 1);
    });
    it('不应提议高阶节点结晶', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'high1', axis: '思', state: '实', summary: '高阶', level: 3, children_ids: ['y1', 'y2', 'y3'] }));
      assert.strictEqual(tree.suggestCrystallization(3).length, 0);
    });
  });

  describe('跨干关联发现', () => {
    it('应发现不同主干但有相同隐性标签的节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'work1', axis: '业', state: '实', summary: '代码分离', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'life1', axis: '生', state: '实', summary: '家庭分工', implicit_tags: ['解耦', '边界'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'thought1', axis: '思', state: '虚', summary: '哲学分合', implicit_tags: ['解耦'] }));
      tree.discoverCrossLinks();
      assert.ok(tree.getNode('work1').cross_links.includes('life1') || tree.getNode('work1').cross_links.includes('thought1'));
    });
  });

  describe('findCrossNodesByTags', () => {
    it('应返回其他主干中同隐性标签的节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'w1', axis: '业', state: '实', summary: '模块', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'l1', axis: '生', state: '实', summary: '家庭', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 't1', axis: '思', state: '虚', summary: '哲学', implicit_tags: ['解耦'] }));
      const result = tree.findCrossNodesByTags(['解耦'], '业');
      assert.strictEqual(result.length, 2);
    });
    it('应排除指定主干', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'w1', axis: '业', state: '实', summary: '工作', implicit_tags: ['复利'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'l1', axis: '生', state: '实', summary: '生活', implicit_tags: ['复利'] }));
      assert.strictEqual(tree.findCrossNodesByTags(['复利'], '生').length, 1);
    });
    it('应按热力降序', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'l1', axis: '生', state: '实', summary: '低', implicit_tags: ['边界'], heat_score: 0.5 }));
      tree.addNode(new KnowledgeNode({ node_id: 't1', axis: '思', state: '虚', summary: '高', implicit_tags: ['边界'], heat_score: 3.0 }));
      assert.strictEqual(tree.findCrossNodesByTags(['边界'], '业')[0].node_id, 't1');
    });
    it('应限制返回数量', () => {
      for (let i = 0; i < 8; i++) tree.addNode(new KnowledgeNode({ node_id: `n${i}`, axis: i % 2 ? '生' : '思', state: '实', summary: `节点${i}`, implicit_tags: ['熵增'], heat_score: i }));
      assert.strictEqual(tree.findCrossNodesByTags(['熵增'], '业', 3).length, 3);
    });
    it('无匹配返回空数组', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'w1', axis: '业', state: '实', summary: '工作', implicit_tags: ['解耦'] }));
      assert.strictEqual(tree.findCrossNodesByTags(['不存在'], '业').length, 0);
    });
  });

  describe('功能四：getTopHeatNodes', () => {
    it('应返回热力最高的n个节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'h1', axis: '业', state: '实', summary: '低', heat_score: 0.5 }));
      tree.addNode(new KnowledgeNode({ node_id: 'h2', axis: '业', state: '实', summary: '中', heat_score: 2.0 }));
      tree.addNode(new KnowledgeNode({ node_id: 'h3', axis: '思', state: '虚', summary: '高', heat_score: 5.0 }));
      const top = tree.getTopHeatNodes(2);
      assert.strictEqual(top.length, 2);
      assert.strictEqual(top[0].node_id, 'h3');
    });
    it('n大于节点总数时返回所有', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'a1', axis: '业', state: '实', summary: 'a', heat_score: 1.0 }));
      assert.strictEqual(tree.getTopHeatNodes(10).length, 1);
    });
    it('空树返回空数组', () => { assert.strictEqual(tree.getTopHeatNodes(5).length, 0); });
  });

  describe('功能四：findKnowledgeIslands', () => {
    it('应返回只有1个节点的隐性标签', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'i1', axis: '业', state: '实', summary: '孤岛', implicit_tags: ['熵增'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'i2', axis: '生', state: '实', summary: '共享1', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'i3', axis: '思', state: '虚', summary: '共享2', implicit_tags: ['解耦'] }));
      const islands = tree.findKnowledgeIslands();
      assert.ok(islands.includes('熵增'));
      assert.ok(!islands.includes('解耦'));
    });
    it('所有标签多节点时返回空', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'a1', axis: '业', state: '实', summary: 'a', implicit_tags: ['复利'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'a2', axis: '生', state: '实', summary: 'b', implicit_tags: ['复利'] }));
      assert.strictEqual(tree.findKnowledgeIslands().length, 0);
    });
    it('空树返回空', () => { assert.strictEqual(tree.findKnowledgeIslands().length, 0); });
  });

  describe('功能四：findVirtualLeavesWithoutSupport', () => {
    it('应返回无实节点支撑的虚节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'v1', axis: '思', state: '虚', summary: '无支撑', implicit_tags: ['涌现'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'v2', axis: '思', state: '虚', summary: '有支撑', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '实', implicit_tags: ['解耦'] }));
      assert.strictEqual(tree.findVirtualLeavesWithoutSupport().length, 1);
      assert.strictEqual(tree.findVirtualLeavesWithoutSupport()[0].node_id, 'v1');
    });
    it('所有虚节点有支撑时返回空', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'v1', axis: '思', state: '虚', summary: '构想', implicit_tags: ['复利'] }));
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '生', state: '实', summary: '经验', implicit_tags: ['复利'] }));
      assert.strictEqual(tree.findVirtualLeavesWithoutSupport().length, 0);
    });
    it('无虚节点返回空', () => {
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '实', implicit_tags: ['解耦'] }));
      assert.strictEqual(tree.findVirtualLeavesWithoutSupport().length, 0);
    });
  });

  describe('功能四：attractVirtualLeaves', () => {
    it('应为虚节点建立同标签实节点的cross_link', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'v1', axis: '思', state: '虚', summary: '构想', implicit_tags: ['解耦'] }));
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '经验', implicit_tags: ['解耦'] }));
      const result = tree.attractVirtualLeaves();
      assert.strictEqual(result.length, 1);
      assert.ok(tree.getNode('v1').cross_links.includes('s1'));
    });
    it('已有关联不重复建立', () => {
      const v = new KnowledgeNode({ node_id: 'v1', axis: '思', state: '虚', summary: '构想', implicit_tags: ['解耦'], cross_links: ['s1'] });
      const s = new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '经验', implicit_tags: ['解耦'], cross_links: ['v1'] });
      tree.addNode(v); tree.addNode(s);
      assert.strictEqual(tree.attractVirtualLeaves().length, 0);
    });
    it('无实节点支撑不建立关联', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'v1', axis: '思', state: '虚', summary: '构想', implicit_tags: ['涌现'] }));
      assert.strictEqual(tree.attractVirtualLeaves().length, 0);
    });
  });

  describe('快速通道', () => {
    it('addNote 应创建实节点默认业主干', () => {
      const node = tree.addNote('测试笔记');
      assert.strictEqual(node.axis, '业');
      assert.strictEqual(node.state, '实');
    });
    it('addNote 应支持指定主干', () => {
      assert.strictEqual(tree.addNote('生活', '生').axis, '生');
    });
    it('addIdea 应创建虚节点思主干', () => {
      const node = tree.addIdea('想法');
      assert.strictEqual(node.axis, '思');
      assert.strictEqual(node.state, '虚');
    });
    it('大内容应完整存raw_source summary截断', () => {
      const long = 'A'.repeat(150);
      const node = tree.addNote(long);
      assert.strictEqual(node.raw_source, long);
      assert.ok(node.summary.endsWith('...'));
    });
    it('短内容不截断', () => {
      const node = tree.addNote('短');
      assert.strictEqual(node.summary, '短');
    });
  });

  describe('大内容渲染', () => {
    it('长内容节点应显示📄标记', () => {
      tree.addNote('A'.repeat(150));
      assert.ok(tree.renderASCII().includes('📄'));
    });
  });

  describe('ASCII渲染', () => {
    it('应输出三大主干', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'r1', axis: '生', state: '实', summary: '作息' }));
      tree.addNode(new KnowledgeNode({ node_id: 'r2', axis: '业', state: '实', summary: '工作' }));
      tree.addNode(new KnowledgeNode({ node_id: 'r3', axis: '思', state: '虚', summary: '构想' }));
      const out = tree.renderASCII();
      assert.ok(out.includes('【生】') && out.includes('【业】') && out.includes('【思】'));
    });
    it('应展示干支叶层级', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'p1', axis: '业', state: '实', summary: '父', children_ids: ['c1'] }));
      tree.addNode(new KnowledgeNode({ node_id: 'c1', axis: '业', state: '实', summary: '子' }));
      const out = tree.renderASCII();
      assert.ok(out.includes('父') && out.includes('子'));
    });
    it('化土节点应显示🍂', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'cold', axis: '业', state: '实', summary: '化土', heat_score: 0.1 }));
      const line = tree.renderASCII().split('\n').find(l => l.includes('化土'));
      assert.ok(line.includes('🍂'));
    });
  });

  describe('AI解析摄入addFromAI', () => {
    it('应写入完整字段', () => {
      const node = tree.addFromAI({ axis: '业', state: '实', summary: '测试', explicit_tags: ['Rust'], implicit_tags: ['所有权'] }, '原文');
      assert.ok(node.node_id.startsWith('ai_'));
      assert.deepEqual(node.implicit_tags, ['所有权']);
    });
    it('超长summary截断', () => {
      const node = tree.addFromAI({ axis: '思', state: '虚', summary: '超'.repeat(40), explicit_tags: [], implicit_tags: [] }, '原文');
      assert.ok(node.summary.endsWith('…'));
    });
    it('parent_hint同主干挂载', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'p', axis: '业', state: '实', summary: '父' }));
      const node = tree.addFromAI({ axis: '业', state: '实', summary: '子', explicit_tags: [], implicit_tags: [], parent_hint: 'p' }, '原文');
      assert.ok(tree.getNode('p').children_ids.includes(node.node_id));
    });
    it('parent_hint不存在静默忽略', () => {
      const node = tree.addFromAI({ axis: '业', state: '实', summary: '测试', explicit_tags: [], implicit_tags: [], parent_hint: 'no' }, '原文');
      assert.ok(node);
    });
    it('parent_hint跨主干不挂载', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'p', axis: '生', state: '实', summary: '父' }));
      const node = tree.addFromAI({ axis: '业', state: '实', summary: '子', explicit_tags: [], implicit_tags: [], parent_hint: 'p' }, '原文');
      assert.ok(!tree.getNode('p').children_ids.includes(node.node_id));
    });
    it('同标签跨干自动建立关联', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'life', axis: '生', state: '实', summary: '家庭', implicit_tags: ['解耦'] }));
      const node = tree.addFromAI({ axis: '业', state: '实', summary: '模块', explicit_tags: [], implicit_tags: ['解耦'] }, '原文');
      assert.ok(node.cross_links.includes('life'));
    });
  });

  describe('序列化与反序列化', () => {
    it('toJSON应导出数组', () => {
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '测试' }));
      assert.strictEqual(tree.toJSON().length, 1);
    });
    it('fromJSON应重建完整树', () => {
      const orig = new KnowledgeTree();
      orig.addNode(new KnowledgeNode({ node_id: 'r1', axis: '生', state: '实', summary: 'A', heat_score: 2.0 }));
      const restored = KnowledgeTree.fromJSON(orig.toJSON());
      assert.strictEqual(restored.nodes.size, 1);
      assert.strictEqual(restored.getNode('r1').heat_score, 2.0);
    });
    it('fromJSON空数据返回空树', () => {
      assert.strictEqual(KnowledgeTree.fromJSON([]).nodes.size, 0);
    });
  });
});
