const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { KnowledgeNode } = require('../src/KnowledgeNode');
const { KnowledgeTree } = require('../src/KnowledgeTree');

describe('KnowledgeTree', () => {
  let tree;

  beforeEach(() => {
    tree = new KnowledgeTree();
  });

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
      const child1 = new KnowledgeNode({ node_id: 'c1', axis: '业', state: '实', summary: '子1' });
      const child2 = new KnowledgeNode({ node_id: 'c2', axis: '业', state: '实', summary: '子2' });
      tree.addNode(parent);
      tree.addNode(child1);
      tree.addNode(child2);
      const children = tree.getChildren('p1');
      assert.strictEqual(children.length, 2);
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
      const parent = new KnowledgeNode({
        node_id: 'cry1', axis: '业', state: '实', summary: '可结晶节点',
        children_ids: ['x1', 'x2', 'x3'],
      });
      tree.addNode(parent);
      tree.addNode(new KnowledgeNode({ node_id: 'x1', axis: '业', state: '实', summary: '碎片1' }));
      tree.addNode(new KnowledgeNode({ node_id: 'x2', axis: '业', state: '实', summary: '碎片2' }));
      tree.addNode(new KnowledgeNode({ node_id: 'x3', axis: '业', state: '实', summary: '碎片3' }));

      const suggestions = tree.suggestCrystallization(3);
      assert.strictEqual(suggestions.length, 1);
      assert.strictEqual(suggestions[0].node_id, 'cry1');
    });

    it('不应提议高阶节点结晶', () => {
      const high = new KnowledgeNode({
        node_id: 'high1', axis: '思', state: '实', summary: '高阶原理',
        level: 3, children_ids: ['y1', 'y2', 'y3'],
      });
      tree.addNode(high);
      assert.strictEqual(tree.suggestCrystallization(3).length, 0);
    });
  });

  describe('跨干关联发现', () => {
    it('应发现不同主干但有相同隐性标签的节点', () => {
      tree.addNode(new KnowledgeNode({
        node_id: 'work1', axis: '业', state: '实', summary: '代码模块分离',
        implicit_tags: ['解耦'],
      }));
      tree.addNode(new KnowledgeNode({
        node_id: 'life1', axis: '生', state: '实', summary: '家庭分工明确',
        implicit_tags: ['解耦', '边界'],
      }));
      tree.addNode(new KnowledgeNode({
        node_id: 'thought1', axis: '思', state: '虚', summary: '哲学中的分与合',
        implicit_tags: ['解耦'],
      }));

      const links = tree.discoverCrossLinks();
      // work1, life1, thought1 都有"解耦"标签，应互相建立跨干关联
      const workNode = tree.getNode('work1');
      const lifeNode = tree.getNode('life1');
      assert.ok(workNode.cross_links.includes('life1') || workNode.cross_links.includes('thought1'));
      assert.ok(lifeNode.cross_links.includes('work1') || lifeNode.cross_links.includes('thought1'));
    });
  });

  describe('快速通道', () => {
    it('addNote 应快速创建实节点（默认业主干）', () => {
      const node = tree.addNote('今天调试了ODDM的ref懒引用');
      assert.strictEqual(node.axis, '业');
      assert.strictEqual(node.state, '实');
      assert.strictEqual(node.summary, '今天调试了ODDM的ref懒引用');
      assert.ok(tree.getNode(node.node_id));
    });

    it('addNote 应支持指定主干', () => {
      const node = tree.addNote('作息调理经验', '生');
      assert.strictEqual(node.axis, '生');
      assert.strictEqual(node.state, '实');
    });

    it('addIdea 应快速创建虚节点（思主干）', () => {
      const node = tree.addIdea('认知树可以用热力驱动应季显隐');
      assert.strictEqual(node.axis, '思');
      assert.strictEqual(node.state, '虚');
      assert.ok(tree.getNode(node.node_id));
    });

    it('大内容应完整存 raw_source，summary 自动截断', () => {
      const longContent = '这是一段很长的笔记内容，包含了很多细节和思考过程，用于测试大内容索引机制是否正常工作，raw_source应该保存完整内容而summary只显示前30个字';
      const node = tree.addNote(longContent);
      assert.strictEqual(node.raw_source, longContent);
      assert.ok(node.summary.length <= 33); // 30字 + '...'
      assert.ok(node.summary.endsWith('...'));
    });

    it('短内容 summary 不截断', () => {
      const node = tree.addNote('短笔记');
      assert.strictEqual(node.summary, '短笔记');
      assert.strictEqual(node.raw_source, '短笔记');
    });
  });

  describe('大内容渲染', () => {
    it('长内容节点应显示 📄 标记', () => {
      const longContent = 'A'.repeat(150);
      const node = tree.addNote(longContent);
      const output = tree.renderASCII();
      assert.ok(output.includes('📄'));
    });
  });

  describe('ASCII 渲染', () => {
    it('应输出包含三大主干的树形结构', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'r1', axis: '生', state: '实', summary: '作息调理', heat_score: 0.8 }));
      tree.addNode(new KnowledgeNode({ node_id: 'r2', axis: '业', state: '实', summary: 'ODDM设计', heat_score: 1.0, level: 2 }));
      tree.addNode(new KnowledgeNode({ node_id: 'r3', axis: '思', state: '虚', summary: '认知树构想', heat_score: 0.7 }));

      const output = tree.renderASCII();
      assert.ok(output.includes('【生】'));
      assert.ok(output.includes('【业】'));
      assert.ok(output.includes('【思】'));
      assert.ok(output.includes('作息调理'));
      assert.ok(output.includes('ODDM设计'));
    });

    it('应展示干支叶层级关系（父节点下递归显示子节点）', () => {
      tree.addNode(new KnowledgeNode({
        node_id: 'parent1', axis: '业', state: '实', summary: '父节点',
        children_ids: ['child1', 'child2'],
      }));
      tree.addNode(new KnowledgeNode({ node_id: 'child1', axis: '业', state: '实', summary: '子节点1' }));
      tree.addNode(new KnowledgeNode({ node_id: 'child2', axis: '业', state: '实', summary: '子节点2' }));

      const output = tree.renderASCII();
      assert.ok(output.includes('父节点'));
      assert.ok(output.includes('子节点1'));
      assert.ok(output.includes('子节点2'));
      // 子节点应该有树形缩进符号
      const childLine = output.split('\n').find(l => l.includes('子节点1'));
      assert.ok(childLine.includes('└') || childLine.includes('├') || childLine.includes('│'));
    });
  });

  describe('AI 解析摄入 addFromAI', () => {
    it('应写入完整字段节点（轴/状态/摘要/显隐标签）', () => {
      const node = tree.addFromAI({
        axis: '业',
        state: '实',
        summary: 'Rust内存释放验证：单播原则下无泄漏',
        explicit_tags: ['Rust', '内存管理'],
        implicit_tags: ['所有权', '单播原则'],
      }, '今天调通了 Rust 的内存释放...');
      assert.ok(node.node_id.startsWith('ai_'));
      assert.strictEqual(node.axis, '业');
      assert.strictEqual(node.state, '实');
      assert.strictEqual(node.raw_source, '今天调通了 Rust 的内存释放...');
      assert.deepEqual(node.explicit_tags, ['Rust', '内存管理']);
      assert.deepEqual(node.implicit_tags, ['所有权', '单播原则']);
    });

    it('超长 summary 自动截断到30字', () => {
      const node = tree.addFromAI({
        axis: '思',
        state: '虚',
        summary: '超'.repeat(40),
        explicit_tags: [],
        implicit_tags: [],
      }, '原文');
      assert.ok(node.summary.length <= 31); // 30字 + '…'
      assert.ok(node.summary.endsWith('…'));
    });

    it('parent_hint 指向同主干已存在节点时挂载为子节点', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'p_oddm', axis: '业', state: '实', summary: 'ODDM设计' }));
      const node = tree.addFromAI({
        axis: '业',
        state: '实',
        summary: 'ODL路径寻址',
        explicit_tags: [],
        implicit_tags: [],
        parent_hint: 'p_oddm',
      }, '原文');
      assert.ok(tree.getNode('p_oddm').children_ids.includes(node.node_id));
    });

    it('parent_hint 指向不存在的节点时静默忽略（悬空不报错）', () => {
      const node = tree.addFromAI({
        axis: '业',
        state: '实',
        summary: '测试',
        explicit_tags: [],
        implicit_tags: [],
        parent_hint: 'not_exist',
      }, '原文');
      assert.ok(node);
      assert.strictEqual(node.children_ids.length, 0);
    });

    it('parent_hint 跨主干时不挂载（尊重三轴独立）', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'p_life', axis: '生', state: '实', summary: '生活' }));
      const node = tree.addFromAI({
        axis: '业',
        state: '实',
        summary: '测试',
        explicit_tags: [],
        implicit_tags: [],
        parent_hint: 'p_life',
      }, '原文');
      assert.ok(!tree.getNode('p_life').children_ids.includes(node.node_id));
    });

    it('隐性标签与既有节点同标签跨干时自动建立关联', () => {
      tree.addNode(new KnowledgeNode({ node_id: 'life_x', axis: '生', state: '实', summary: '家庭分工', implicit_tags: ['解耦'] }));
      const node = tree.addFromAI({
        axis: '业',
        state: '实',
        summary: '模块解耦设计',
        explicit_tags: [],
        implicit_tags: ['解耦'],
      }, '原文');
      assert.ok(node.cross_links.includes('life_x'));
    });
  });

  describe('序列化与反序列化', () => {
    it('toJSON 应导出节点数组', () => {
      tree.addNode(new KnowledgeNode({ node_id: 's1', axis: '业', state: '实', summary: '测试序列化' }));
      const data = tree.toJSON();
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].node_id, 's1');
      assert.strictEqual(data[0].summary, '测试序列化');
    });

    it('fromJSON 应从数据重建完整树', () => {
      const original = new KnowledgeTree();
      original.addNode(new KnowledgeNode({ node_id: 'r1', axis: '生', state: '实', summary: '节点A', heat_score: 2.0 }));
      original.addNode(new KnowledgeNode({ node_id: 'r2', axis: '思', state: '虚', summary: '节点B', implicit_tags: ['解耦'] }));
      const data = original.toJSON();

      const restored = KnowledgeTree.fromJSON(data);
      assert.strictEqual(restored.nodes.size, 2);
      assert.strictEqual(restored.getNode('r1').heat_score, 2.0);
      assert.strictEqual(restored.getNode('r2').implicit_tags[0], '解耦');
    });

    it('fromJSON 空数据应返回空树', () => {
      const tree = KnowledgeTree.fromJSON([]);
      assert.strictEqual(tree.nodes.size, 0);
    });
  });
});