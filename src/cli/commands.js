/**
 * commands.js - CLI 命令实现集合
 *
 * 【架构定位】
 * 应用层（Application），负责将用户命令翻译为领域层操作。
 * 从 cli.js 抽离，每个命令是独立函数，通过 CommandContext 注入依赖。
 *
 * 【设计原则】
 *   - 单一职责：每个命令函数只做一件事
 *   - 依赖注入：通过 context 传递 tree/parser/store/renderer，便于测试
 *   - 异步统一：所有 IO 操作使用 await
 *   - 纯逻辑可测：stripQuotes 等工具函数独立导出
 *
 * 【命令清单】
 *   快速通道: note, idea, parse
 *   查看: list, view, inspect
 *   热力: touch, decay
 *   结晶: crystal, crystallize
 *   跨干: cross, inspire
 *   扩展: grow
 *   数据: seed, export-md, export-html, clear
 */
const fs = require('fs');
const path = require('path');
const { KnowledgeNode } = require('../KnowledgeNode');
const { KnowledgeTree } = require('../KnowledgeTree');
const { HtmlRenderer } = require('../renderer/html-renderer');

/**
 * 剥离字符串首尾的成对引号
 * @param {string} text - 输入文本
 * @returns {string} 剥离后的文本
 */
function stripQuotes(text) {
  if (!text) return text;
  let t = text.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  return t;
}

/**
 * 命令上下文——封装所有命令需要的依赖
 * 避免每个命令函数都传一长串参数
 */
class CommandContext {
  /**
   * @param {Object} deps
   * @param {KnowledgeTree} deps.tree - 认知树实例
   * @param {Object} deps.parser - AI 解析器实例
   * @param {Object} deps.store - 持久化存储实例
   * @param {string} deps.seedDir - 种子数据目录
   */
  constructor({ tree, parser, store, seedDir }) {
    this.tree = tree;
    this.parser = parser;
    this.store = store;
    this.seedDir = seedDir;
  }

  /** 异步保存当前树状态 */
  async save() {
    await this.store.save(this.tree.toJSON());
  }
}

/**
 * 交互式提问
 * @param {Object} rl - readline 接口
 * @param {string} question - 问题文本
 * @returns {Promise<string>} 用户回答（已 trim）
 */
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

// ─── 查看类命令 ───────────────────────────────────────────

function cmdHelp() {
  console.log(`
  🌳 ODDM 认知树 CLI v0.3.0 (tree-cli)
  ─────────────────────────────────
  【快速通道】
    note "内容"          存一条笔记（实节点，默认业主干）
    idea "内容"          存一个想法（虚节点，思主干）
    parse "内容"         AI 解析对话/笔记为知识节点

  【查看】
    list                 显示完整认知树
    view <id>            查看节点详情（含完整原文）
    inspect              系统自省快照

  【热力操作】
    touch <id>           增加节点热力（注意力上升）
    decay                全局衰减（时间流逝）

  【认知结晶】
    crystal              查看可结晶节点并提议归纳
    crystallize <id> "高阶表述"  执行结晶

  【跨干启发】
    cross                自动发现跨干关联
    inspire "瓶颈描述"   AI 跨界启发（基于跨干经验）

  【主动扩展】
    grow [N]             AI 主动扩展学习（空白检测+虚叶引力+高热力延伸）

  【数据】
    seed <name>          导入种子数据（如: oddm-knowledge）
    export-md [file]     导出完整 Markdown 文档
    export-html [file]   导出 H5 SVG 页面
    clear                清空所有数据

  【其他】
    help                 显示帮助
    exit                 退出
  `);
}

function cmdList(ctx) {
  console.log(ctx.tree.renderASCII());
}

function cmdView(ctx, id) {
  const node = ctx.tree.getNode(id);
  if (!node) { console.log('节点不存在:', id); return; }
  console.log('═══════════════════════════════════════');
  console.log(`  ID:     ${node.node_id}`);
  console.log(`  主干:   ${node.axis} | 状态: ${node.state} | 层级: L${node.level}`);
  console.log(`  热力:   ${node.heat_score.toFixed(1)}`);
  console.log(`  主旨:   ${node.summary}`);
  console.log(`  显性:   ${node.explicit_tags.join(', ') || '(无)'}`);
  console.log(`  隐性:   ${node.implicit_tags.join(', ') || '(无)'}`);
  console.log(`  跨干:   ${node.cross_links.join(', ') || '(无)'}`);
  if (node.raw_source) {
    console.log('  ─── 完整原文 ───');
    console.log(`  ${node.raw_source}`);
  }
  console.log('═══════════════════════════════════════');
}

function cmdInspect(ctx) {
  const info = ctx.tree.introspect();
  console.log(JSON.stringify({
    total_nodes: info.total_nodes,
    by_axis: info.by_axis,
    by_state: info.by_state,
    cross_link_count: info.cross_link_count,
  }, null, 2));
}

// ─── 热力操作 ─────────────────────────────────────────────

async function cmdTouch(ctx, id) {
  const n = ctx.tree.touchNode(id);
  if (n) {
    console.log(`热力+ → ${n.heat_score.toFixed(1)}`);
    await ctx.save();
  } else {
    console.log('节点不存在');
  }
}

async function cmdDecay(ctx) {
  ctx.tree.decayAll();
  console.log('全局衰减完成');
  await ctx.save();
}

// ─── 快速通道 ─────────────────────────────────────────────

async function cmdNote(ctx, content) {
  if (!content) { console.log('用法: note "内容"'); return; }
  const node = ctx.tree.addNote(stripQuotes(content));
  await ctx.save();
  console.log(`笔记已存: ${node.node_id} [业/实] ${node.summary}`);
}

async function cmdIdea(ctx, content) {
  if (!content) { console.log('用法: idea "内容"'); return; }
  const node = ctx.tree.addIdea(stripQuotes(content));
  await ctx.save();
  console.log(`想法已存: ${node.node_id} [思/虚] ${node.summary}`);
}

async function cmdAdd(ctx, args) {
  if (args.length < 3) { console.log('用法: add <生|业|思> <虚|实> "主旨" [隐性标签...]'); return; }
  const [axis, state, summary, ...tags] = args;
  if (!['生', '业', '思'].includes(axis)) { console.log('主干必须是 生/业/思'); return; }
  if (!['虚', '实'].includes(state)) { console.log('状态必须是 虚/实'); return; }
  const id = 'node_' + Date.now().toString(36);
  const node = new KnowledgeNode({
    node_id: id, axis, state,
    summary: stripQuotes(summary),
    implicit_tags: tags,
  });
  ctx.tree.addNode(node);
  ctx.tree.discoverCrossLinks();
  await ctx.save();
  console.log(`已添加: ${id} [${axis}/${state}] ${node.summary}`);
}

// ─── AI 解析 ──────────────────────────────────────────────

async function cmdParse(ctx, rl, content) {
  if (!content) { console.log('用法: parse "对话或笔记内容"'); return; }
  const raw = stripQuotes(content);
  console.log('正在调用 AI 解析...');
  const result = await ctx.parser.parse(raw);
  if (!result.ok) { console.log('解析失败:', result.error); return; }
  const d = result.data;
  console.log('\n  AI 解析结果:');
  console.log(`  主干: ${d.axis} | 状态: ${d.state}`);
  console.log(`  主旨: ${d.summary}`);
  console.log(`  显性: ${d.explicit_tags.join(', ') || '(无)'}`);
  console.log(`  隐性: ${d.implicit_tags.join(', ') || '(无)'}`);
  const ans = await ask(rl, '\n  确认写入? [Y/n] ');
  if (ans.toLowerCase() === 'n') { console.log('已取消'); return; }
  const node = ctx.tree.addFromAI(d, raw);
  await ctx.save();
  console.log(`\n  已写入: ${node.node_id} [${node.axis}/${node.state}] ${node.summary}`);
  if (process.env.AUTO_CRYSTALLIZE_PROPOSE === '1') {
    const candidates = ctx.tree.suggestCrystallization(3);
    if (candidates.length > 0) {
      console.log(`\n  💡 检测到 ${candidates.length} 个可结晶节点，运行 crystal 查看详情`);
    }
  }
}

// ─── 认知结晶 ─────────────────────────────────────────────

async function cmdCrystal(ctx, rl) {
  const candidates = ctx.tree.suggestCrystallization(3);
  if (candidates.length === 0) {
    console.log('当前没有可结晶的节点（需要 level≤1 且 ≥3 个子节点）');
    return;
  }
  console.log(`\n  可结晶节点: ${candidates.length} 个`);
  candidates.forEach((n, i) => {
    const children = ctx.tree.getChildren(n.node_id);
    console.log(`  ${i + 1}. ${n.node_id} [${n.axis}/${n.state}] ${n.summary} (${children.length}子节点)`);
    children.forEach(c => console.log(`     └ ${c.summary}`));
  });
  const idx = await ask(rl, '\n  选择结晶哪个? (输入序号，回车跳过) ');
  const num = parseInt(idx);
  if (!num || num < 1 || num > candidates.length) { console.log('已跳过'); return; }
  const target = candidates[num - 1];
  const children = ctx.tree.getChildren(target.node_id);
  let highSummary = '';
  if (ctx.parser.apiKey) {
    console.log('  正在调用 AI 生成高阶表述...');
    const cr = await ctx.parser.summarizeForCrystallization(children);
    if (cr.ok) {
      console.log(`  AI 提议: ${cr.summary}`);
      const choice = await ask(rl, '  [y=用AI表述 / n=跳过 / m=手动输入] ');
      if (choice.toLowerCase() === 'y') highSummary = cr.summary;
      else if (choice.toLowerCase() === 'm') highSummary = await ask(rl, '  输入高阶表述: ');
      else { console.log('已跳过'); return; }
    } else {
      console.log(`  AI 归纳失败: ${cr.error}`);
      highSummary = await ask(rl, '  手动输入高阶表述: ');
    }
  } else {
    highSummary = await ask(rl, '  输入高阶表述（结晶后的第一性原理）: ');
  }
  if (!highSummary.trim()) { console.log('已取消'); return; }
  const result = ctx.tree.crystallize(target.node_id, highSummary.trim());
  if (result) {
    await ctx.save();
    console.log(`\n  ✨ 结晶完成! ${result.node_id} → L${result.level}: ${result.summary}`);
  }
}

function cmdCrystallize(ctx, args) {
  if (args.length < 2) { console.log('用法: crystallize <id> "高阶表述"'); return; }
  const [id, ...summaryParts] = args;
  const summary = stripQuotes(summaryParts.join(' '));
  const result = ctx.tree.crystallize(id, summary);
  if (result) {
    ctx.save();
    console.log(`结晶完成: ${result.node_id} → L${result.level}`);
  } else {
    console.log('结晶失败（节点不存在或不满足条件）');
  }
}

// ─── 跨干启发 ─────────────────────────────────────────────

async function cmdCross(ctx) {
  const linked = ctx.tree.discoverCrossLinks();
  await ctx.save();
  console.log(`发现 ${linked.length} 个节点有跨干关联`);
  linked.forEach(n => console.log(`  ${n.node_id} [${n.axis}] ↔ ${n.cross_links.join(', ')}`));
}

async function cmdInspire(ctx, rl, bottleneck) {
  if (!bottleneck) { console.log('用法: inspire "瓶颈描述"'); return; }
  const raw = stripQuotes(bottleneck);
  console.log('正在解析瓶颈...');
  const parsed = await ctx.parser.parse(raw);
  if (!parsed.ok) { console.log('瓶颈解析失败:', parsed.error); return; }
  const tags = parsed.data.implicit_tags;
  if (tags.length === 0) { console.log('瓶颈未提取到隐性标签，无法跨界启发'); return; }
  console.log(`  瓶颈标签: ${tags.join(', ')}`);
  const crossNodes = ctx.tree.findCrossNodesByTags(tags, parsed.data.axis, 5);
  if (crossNodes.length === 0) { console.log('其他主干中没有同标签的经验节点'); return; }
  console.log(`  找到 ${crossNodes.length} 个跨干相关节点:`);
  crossNodes.forEach(n => console.log(`    [${n.axis}/${n.state}] ${n.summary}`));
  console.log('正在生成跨界启发...');
  const result = await ctx.parser.inspire(raw, crossNodes);
  if (!result.ok) { console.log('启发生成失败:', result.error); return; }
  console.log(`\n  💡 跨界启发: ${result.insight}`);
  if (result.implicit_tags.length > 0) console.log(`  底层标签: ${result.implicit_tags.join(', ')}`);
  const save = await ask(rl, '\n  存为思主干虚节点? [y/N] ');
  if (save.toLowerCase() === 'y') {
    const node = ctx.tree.addIdea(result.insight, result.implicit_tags);
    await ctx.save();
    console.log(`  已存: ${node.node_id} [思/虚] ${node.summary}`);
  }
}

// ─── 主动扩展学习 ─────────────────────────────────────────

async function cmdGrow(ctx, rl, nStr) {
  const n = parseInt(nStr) || 3;
  console.log('\n  🌱 AI 主动扩展学习');
  console.log('  ─────────────────────');

  // 子能力2: 知识空白检测
  const islands = ctx.tree.findKnowledgeIslands();
  if (islands.length > 0) {
    console.log(`\n  🔍 知识空白检测: 发现 ${islands.length} 个知识孤岛标签`);
    islands.slice(0, 10).forEach(t => console.log(`     - ${t}（只有1个节点，建议补充）`));
  } else {
    console.log('\n  🔍 知识空白检测: 无明显孤岛');
  }

  // 子能力3: 虚叶引力
  const noSupport = ctx.tree.findVirtualLeavesWithoutSupport();
  if (noSupport.length > 0) {
    console.log(`\n  🍃 无支撑虚节点: ${noSupport.length} 个（没有同标签实节点）`);
    noSupport.slice(0, 5).forEach(n => console.log(`     - ${n.node_id}: ${n.summary}`));
  }
  const attracted = ctx.tree.attractVirtualLeaves();
  if (attracted.length > 0) {
    await ctx.save();
    console.log(`  🔗 虚叶引力: 为 ${attracted.length} 个虚节点建立了跨干关联`);
  }

  // 子能力1: 高热力延伸
  const topNodes = ctx.tree.getTopHeatNodes(n);
  if (topNodes.length === 0) { console.log('\n  树为空，无法延伸'); return; }
  console.log(`\n  🔥 高热力节点 Top ${topNodes.length}:`);
  topNodes.forEach((node, i) => console.log(`     ${i + 1}. [${node.axis}/${node.state}] ${node.summary} (热力${node.heat_score.toFixed(1)})`));

  for (const node of topNodes) {
    console.log(`\n  ── 延伸: ${node.summary} ──`);
    console.log('  正在生成延伸点...');
    const result = await ctx.parser.growExtension(node);
    if (!result.ok) { console.log(`  延伸失败: ${result.error}`); continue; }
    result.extensions.forEach((ext, i) => {
      console.log(`     ${i + 1}. ${ext.summary} [${ext.implicit_tags.join(',')}]`);
    });
    const choice = await ask(rl, '  存入哪个? (序号，多个用逗号，回车跳过) ');
    if (!choice.trim()) continue;
    const indices = choice.split(',').map(s => parseInt(s.trim())).filter(i => i >= 1 && i <= result.extensions.length);
    for (const idx of indices) {
      const ext = result.extensions[idx - 1];
      const newNode = ctx.tree.addIdea(ext.summary, ext.implicit_tags);
      newNode.addCrossLink(node.node_id);
      node.addCrossLink(newNode.node_id);
      await ctx.save();
      console.log(`     ✅ 已存: ${newNode.node_id} [思/虚] ${newNode.summary}`);
    }
  }
  console.log('\n  🌱 主动扩展学习完成');
}

// ─── 数据管理 ─────────────────────────────────────────────

async function cmdSeed(ctx, name) {
  if (!name) { console.log('用法: seed <name>（可用: oddm-knowledge）'); return; }
  const file = path.join(ctx.seedDir, `${name}.json`);
  if (!fs.existsSync(file)) { console.log('种子文件不存在:', file); return; }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let count = 0;
    for (const item of data) {
      if (!ctx.tree.getNode(item.node_id)) {
        ctx.tree.addNode(new KnowledgeNode(item));
        count++;
      }
    }
    ctx.tree.discoverCrossLinks();
    await ctx.save();
    console.log(`导入 ${count} 个节点（跳过 ${data.length - count} 个已存在）`);
  } catch (e) {
    console.log('导入失败:', e.message);
  }
}

function cmdExportMd(ctx, file) {
  const out = file || 'cognitive-tree-export.md';
  const lines = ['# ODDM 认知树导出', '', `导出时间: ${new Date().toISOString()}`, `节点总数: ${ctx.tree.nodes.size}`, ''];
  for (const axis of ['生', '业', '思']) {
    const nodes = ctx.tree.getByAxis(axis);
    if (nodes.length === 0) continue;
    lines.push(`## 【${axis}】`, '');
    const allChildIds = new Set();
    for (const n of nodes) {
      for (const cid of n.children_ids) {
        if (nodes.find(x => x.node_id === cid)) allChildIds.add(cid);
      }
    }
    const roots = nodes.filter(n => !allChildIds.has(n.node_id));
    const render = (node, depth) => {
      const prefix = '#'.repeat(Math.min(depth + 3, 6));
      lines.push(`${prefix} [${node.state}] ${node.summary}`);
      lines.push(`- 热力: ${node.heat_score.toFixed(1)} | 层级: L${node.level} | ID: ${node.node_id}`);
      if (node.implicit_tags.length) lines.push(`- 隐性标签: ${node.implicit_tags.join(', ')}`);
      if (node.raw_source) lines.push(`- 原文: ${node.raw_source}`);
      lines.push('');
      const children = node.children_ids.map(id => ctx.tree.getNode(id)).filter(n => n && n.axis === axis);
      children.forEach(c => render(c, depth + 1));
    };
    roots.forEach(r => render(r, 0));
  }
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log('已导出:', out);
}

function cmdExportHtml(ctx, file) {
  const out = file || 'cognitive-tree.html';
  const dataJson = JSON.stringify(ctx.tree.toJSON());
  const html = HtmlRenderer.generateHtmlPage(dataJson);
  fs.writeFileSync(out, html, 'utf8');
  console.log('已导出 H5 页面:', out);
}

function cmdClear(ctx, rl) {
  rl.question('确认清空所有数据? [y/N] ', async ans => {
    if (ans.toLowerCase() === 'y') {
      ctx.tree = new KnowledgeTree();
      await ctx.save();
      console.log('已清空');
    } else {
      console.log('已取消');
    }
  });
}

/**
 * 命令分发表——将命令名映射到处理函数
 * 每个处理函数签名: (ctx, rl, args) => Promise<void> | void
 */
const COMMANDS = {
  help: () => cmdHelp(),
  '?': () => cmdHelp(),
  list: (ctx) => cmdList(ctx),
  ls: (ctx) => cmdList(ctx),
  tree: (ctx) => cmdList(ctx),
  view: (ctx, rl, args) => cmdView(ctx, args[0]),
  show: (ctx, rl, args) => cmdView(ctx, args[0]),
  touch: (ctx, rl, args) => cmdTouch(ctx, args[0]),
  decay: (ctx) => cmdDecay(ctx),
  add: (ctx, rl, args) => cmdAdd(ctx, args),
  note: (ctx, rl, args) => cmdNote(ctx, args.join(' ')),
  idea: (ctx, rl, args) => cmdIdea(ctx, args.join(' ')),
  parse: (ctx, rl, args) => cmdParse(ctx, rl, args.join(' ')),
  crystal: (ctx, rl) => cmdCrystal(ctx, rl),
  crystallize: (ctx, rl, args) => cmdCrystallize(ctx, args),
  cross: (ctx) => cmdCross(ctx),
  inspire: (ctx, rl, args) => cmdInspire(ctx, rl, args.join(' ')),
  grow: (ctx, rl, args) => cmdGrow(ctx, rl, args[0]),
  seed: (ctx, rl, args) => cmdSeed(ctx, args[0]),
  'export-md': (ctx, rl, args) => cmdExportMd(ctx, args[0]),
  'export-html': (ctx, rl, args) => cmdExportHtml(ctx, args[0]),
  inspect: (ctx) => cmdInspect(ctx),
  clear: (ctx, rl) => cmdClear(ctx, rl),
};

/**
 * 执行一条命令
 * @param {CommandContext} ctx - 命令上下文
 * @param {Object} rl - readline 接口
 * @param {string} input - 原始输入行
 * @returns {Promise<boolean>} 是否继续运行（false 表示退出）
 */
async function executeCommand(ctx, rl, input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
    console.log('再见 🌳');
    return false;
  }

  const handler = COMMANDS[cmd];
  if (handler) {
    await handler(ctx, rl, args);
  } else {
    console.log('未知命令:', cmd, '（输入 help 查看命令列表）');
  }
  return true;
}

module.exports = {
  stripQuotes,
  CommandContext,
  ask,
  executeCommand,
  COMMANDS,
  // 导出各命令函数便于单独测试
  cmdHelp, cmdList, cmdView, cmdInspect,
  cmdTouch, cmdDecay, cmdNote, cmdIdea, cmdAdd,
  cmdParse, cmdCrystal, cmdCrystallize, cmdCross, cmdInspire, cmdGrow,
  cmdSeed, cmdExportMd, cmdExportHtml, cmdClear,
};
