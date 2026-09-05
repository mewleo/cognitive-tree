#!/usr/bin/env node
/**
 * cli.js - ODDM 认知树 CLI 交互入口
 *
 * 【架构定位】
 * 这是认知树系统的用户交互层（Interface Layer），负责：
 *   1. 命令解析与分发
 *   2. 交互式输入输出（readline）
 *   3. 持久化加载/保存（JSON 文件）
 *   4. 调用 KnowledgeTree（领域层）和 DoubaoParser（AI 层）
 *
 * 【设计原则】
 *   - 单一职责：CLI 只做交互，不包含业务逻辑
 *   - 业务逻辑全部在 KnowledgeTree / KnowledgeNode / DoubaoParser 中
 *   - 所有写操作后自动持久化
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { KnowledgeTree } = require('./KnowledgeTree');
const { KnowledgeNode } = require('./KnowledgeNode');
const { DoubaoParser } = require('./ai-parser');
const { SchemaValidator } = require('./schema-validator');

const DATA_FILE = path.join(process.cwd(), 'ctree_data.json');
const SEED_DIR = path.join(__dirname, '..', 'seed');

let tree = KnowledgeTree.fromJSON(loadData());
const parser = new DoubaoParser();

function loadData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { console.error('加载数据失败:', e.message); }
  return [];
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(tree.toJSON(), null, 2), 'utf8'); } catch (e) { console.error('保存失败:', e.message); }
}

function stripQuotes(text) {
  if (!text) return text;
  let t = text.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1);
  return t;
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function printHelp() {
  console.log(`
  🌳 ODDM 认知树 CLI v0.2.0
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

function cmdList() { console.log(tree.renderASCII()); }

function cmdView(id) {
  const node = tree.getNode(id);
  if (!node) { console.log('节点不存在:', id); return; }
  console.log('═══════════════════════════════════════');
  console.log(`  ID:     ${node.node_id}`);
  console.log(`  主干:   ${node.axis} | 状态: ${node.state} | 层级: L${node.level}`);
  console.log(`  热力:   ${node.heat_score.toFixed(1)}`);
  console.log(`  主旨:   ${node.summary}`);
  console.log(`  显性:   ${node.explicit_tags.join(', ') || '(无)'}`);
  console.log(`  隐性:   ${node.implicit_tags.join(', ') || '(无)'}`);
  console.log(`  跨干:   ${node.cross_links.join(', ') || '(无)'}`);
  if (node.raw_source) { console.log('  ─── 完整原文 ───'); console.log(`  ${node.raw_source}`); }
  console.log('═══════════════════════════════════════');
}

function cmdTouch(id) { const n = tree.touchNode(id); if (n) { console.log(`热力+ → ${n.heat_score.toFixed(1)}`); saveData(); } else console.log('节点不存在'); }

function cmdDecay() { tree.decayAll(); console.log('全局衰减完成'); saveData(); }

function cmdAdd(args) {
  if (args.length < 3) { console.log('用法: add <生|业|思> <虚|实> "主旨" [隐性标签...]'); return; }
  const [axis, state, summary, ...tags] = args;
  if (!['生', '业', '思'].includes(axis)) { console.log('主干必须是 生/业/思'); return; }
  if (!['虚', '实'].includes(state)) { console.log('状态必须是 虚/实'); return; }
  const id = 'node_' + Date.now().toString(36);
  const node = new KnowledgeNode({ node_id: id, axis, state, summary: stripQuotes(summary), implicit_tags: tags });
  tree.addNode(node); tree.discoverCrossLinks(); saveData();
  console.log(`已添加: ${id} [${axis}/${state}] ${node.summary}`);
}

function cmdNote(content) {
  if (!content) { console.log('用法: note "内容"'); return; }
  const node = tree.addNote(stripQuotes(content)); saveData();
  console.log(`笔记已存: ${node.node_id} [业/实] ${node.summary}`);
}

function cmdIdea(content) {
  if (!content) { console.log('用法: idea "内容"'); return; }
  const node = tree.addIdea(stripQuotes(content)); saveData();
  console.log(`想法已存: ${node.node_id} [思/虚] ${node.summary}`);
}

async function cmdParse(rl, content) {
  if (!content) { console.log('用法: parse "对话或笔记内容"'); return; }
  const raw = stripQuotes(content);
  console.log('正在调用 AI 解析...');
  const result = await parser.parse(raw);
  if (!result.ok) { console.log('解析失败:', result.error); return; }
  const d = result.data;
  console.log('\n  AI 解析结果:');
  console.log(`  主干: ${d.axis} | 状态: ${d.state}`);
  console.log(`  主旨: ${d.summary}`);
  console.log(`  显性: ${d.explicit_tags.join(', ') || '(无)'}`);
  console.log(`  隐性: ${d.implicit_tags.join(', ') || '(无)'}`);
  const ans = await ask(rl, '\n  确认写入? [Y/n] ');
  if (ans.toLowerCase() === 'n') { console.log('已取消'); return; }
  const node = tree.addFromAI(d, raw); saveData();
  console.log(`\n  已写入: ${node.node_id} [${node.axis}/${node.state}] ${node.summary}`);
  if (process.env.AUTO_CRYSTALLIZE_PROPOSE === '1') {
    const candidates = tree.suggestCrystallization(3);
    if (candidates.length > 0) {
      console.log(`\n  💡 检测到 ${candidates.length} 个可结晶节点，运行 crystal 查看详情`);
    }
  }
}

async function cmdCrystal(rl) {
  const candidates = tree.suggestCrystallization(3);
  if (candidates.length === 0) { console.log('当前没有可结晶的节点（需要 level≤1 且 ≥3 个子节点）'); return; }
  console.log(`\n  可结晶节点: ${candidates.length} 个`);
  candidates.forEach((n, i) => {
    const children = tree.getChildren(n.node_id);
    console.log(`  ${i + 1}. ${n.node_id} [${n.axis}/${n.state}] ${n.summary} (${children.length}子节点)`);
    children.forEach(c => console.log(`     └ ${c.summary}`));
  });
  const idx = await ask(rl, '\n  选择结晶哪个? (输入序号，回车跳过) ');
  const num = parseInt(idx);
  if (!num || num < 1 || num > candidates.length) { console.log('已跳过'); return; }
  const target = candidates[num - 1];
  const children = tree.getChildren(target.node_id);
  let highSummary = '';
  if (parser.apiKey) {
    console.log('  正在调用 AI 生成高阶表述...');
    const cr = await parser.summarizeForCrystallization(children);
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
  const result = tree.crystallize(target.node_id, highSummary.trim());
  if (result) { saveData(); console.log(`\n  ✨ 结晶完成! ${result.node_id} → L${result.level}: ${result.summary}`); }
}

function cmdCrystallize(args) {
  if (args.length < 2) { console.log('用法: crystallize <id> "高阶表述"'); return; }
  const [id, ...summaryParts] = args;
  const summary = stripQuotes(summaryParts.join(' '));
  const result = tree.crystallize(id, summary);
  if (result) { saveData(); console.log(`结晶完成: ${result.node_id} → L${result.level}`); }
  else console.log('结晶失败（节点不存在或不满足条件）');
}

function cmdCross() {
  const linked = tree.discoverCrossLinks(); saveData();
  console.log(`发现 ${linked.length} 个节点有跨干关联`);
  linked.forEach(n => console.log(`  ${n.node_id} [${n.axis}] ↔ ${n.cross_links.join(', ')}`));
}

async function cmdInspire(rl, bottleneck) {
  if (!bottleneck) { console.log('用法: inspire "瓶颈描述"'); return; }
  const raw = stripQuotes(bottleneck);
  console.log('正在解析瓶颈...');
  const parsed = await parser.parse(raw);
  if (!parsed.ok) { console.log('瓶颈解析失败:', parsed.error); return; }
  const tags = parsed.data.implicit_tags;
  if (tags.length === 0) { console.log('瓶颈未提取到隐性标签，无法跨界启发'); return; }
  console.log(`  瓶颈标签: ${tags.join(', ')}`);
  const crossNodes = tree.findCrossNodesByTags(tags, parsed.data.axis, 5);
  if (crossNodes.length === 0) { console.log('其他主干中没有同标签的经验节点'); return; }
  console.log(`  找到 ${crossNodes.length} 个跨干相关节点:`);
  crossNodes.forEach(n => console.log(`    [${n.axis}/${n.state}] ${n.summary}`));
  console.log('正在生成跨界启发...');
  const result = await parser.inspire(raw, crossNodes);
  if (!result.ok) { console.log('启发生成失败:', result.error); return; }
  console.log(`\n  💡 跨界启发: ${result.insight}`);
  if (result.implicit_tags.length > 0) console.log(`  底层标签: ${result.implicit_tags.join(', ')}`);
  const save = await ask(rl, '\n  存为思主干虚节点? [y/N] ');
  if (save.toLowerCase() === 'y') {
    const node = tree.addIdea(result.insight, result.implicit_tags); saveData();
    console.log(`  已存: ${node.node_id} [思/虚] ${node.summary}`);
  }
}

async function cmdGrow(rl, nStr) {
  const n = parseInt(nStr) || 3;
  console.log('\n  🌱 AI 主动扩展学习');
  console.log('  ─────────────────────');

  // 子能力2: 知识空白检测
  const islands = tree.findKnowledgeIslands();
  if (islands.length > 0) {
    console.log(`\n  🔍 知识空白检测: 发现 ${islands.length} 个知识孤岛标签`);
    islands.slice(0, 10).forEach(t => console.log(`     - ${t}（只有1个节点，建议补充）`));
  } else {
    console.log('\n  🔍 知识空白检测: 无明显孤岛');
  }

  // 子能力3: 虚叶引力
  const noSupport = tree.findVirtualLeavesWithoutSupport();
  if (noSupport.length > 0) {
    console.log(`\n  🍃 无支撑虚节点: ${noSupport.length} 个（没有同标签实节点）`);
    noSupport.slice(0, 5).forEach(n => console.log(`     - ${n.node_id}: ${n.summary}`));
  }
  const attracted = tree.attractVirtualLeaves();
  if (attracted.length > 0) {
    saveData();
    console.log(`  🔗 虚叶引力: 为 ${attracted.length} 个虚节点建立了跨干关联`);
  }

  // 子能力1: 高热力延伸
  const topNodes = tree.getTopHeatNodes(n);
  if (topNodes.length === 0) { console.log('\n  树为空，无法延伸'); return; }
  console.log(`\n  🔥 高热力节点 Top ${topNodes.length}:`);
  topNodes.forEach((node, i) => console.log(`     ${i + 1}. [${node.axis}/${node.state}] ${node.summary} (热力${node.heat_score.toFixed(1)})`));

  for (const node of topNodes) {
    console.log(`\n  ── 延伸: ${node.summary} ──`);
    console.log('  正在生成延伸点...');
    const result = await parser.growExtension(node);
    if (!result.ok) { console.log(`  延伸失败: ${result.error}`); continue; }
    result.extensions.forEach((ext, i) => {
      console.log(`     ${i + 1}. ${ext.summary} [${ext.implicit_tags.join(',')}]`);
    });
    const choice = await ask(rl, '  存入哪个? (序号，多个用逗号，回车跳过) ');
    if (!choice.trim()) continue;
    const indices = choice.split(',').map(s => parseInt(s.trim())).filter(i => i >= 1 && i <= result.extensions.length);
    for (const idx of indices) {
      const ext = result.extensions[idx - 1];
      const newNode = tree.addIdea(ext.summary, ext.implicit_tags);
      newNode.addCrossLink(node.node_id);
      node.addCrossLink(newNode.node_id);
      saveData();
      console.log(`     ✅ 已存: ${newNode.node_id} [思/虚] ${newNode.summary}`);
    }
  }
  console.log('\n  🌱 主动扩展学习完成');
}

function cmdSeed(name) {
  if (!name) { console.log('用法: seed <name>（可用: oddm-knowledge）'); return; }
  const file = path.join(SEED_DIR, `${name}.json`);
  if (!fs.existsSync(file)) { console.log('种子文件不存在:', file); return; }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let count = 0;
    for (const item of data) { if (!tree.getNode(item.node_id)) { tree.addNode(new KnowledgeNode(item)); count++; } }
    tree.discoverCrossLinks(); saveData();
    console.log(`导入 ${count} 个节点（跳过 ${data.length - count} 个已存在）`);
  } catch (e) { console.log('导入失败:', e.message); }
}

function cmdExportMd(file) {
  const out = file || 'cognitive-tree-export.md';
  const lines = ['# ODDM 认知树导出', '', `导出时间: ${new Date().toISOString()}`, `节点总数: ${tree.nodes.size}`, ''];
  for (const axis of ['生', '业', '思']) {
    const nodes = tree.getByAxis(axis);
    if (nodes.length === 0) continue;
    lines.push(`## 【${axis}】`, '');
    const allChildIds = new Set();
    for (const n of nodes) for (const cid of n.children_ids) if (nodes.find(x => x.node_id === cid)) allChildIds.add(cid);
    const roots = nodes.filter(n => !allChildIds.has(n.node_id));
    const render = (node, depth) => {
      const prefix = '#'.repeat(Math.min(depth + 3, 6));
      lines.push(`${prefix} [${node.state}] ${node.summary}`);
      lines.push(`- 热力: ${node.heat_score.toFixed(1)} | 层级: L${node.level} | ID: ${node.node_id}`);
      if (node.implicit_tags.length) lines.push(`- 隐性标签: ${node.implicit_tags.join(', ')}`);
      if (node.raw_source) lines.push(`- 原文: ${node.raw_source}`);
      lines.push('');
      const children = node.children_ids.map(id => tree.getNode(id)).filter(n => n && n.axis === axis);
      children.forEach(c => render(c, depth + 1));
    };
    roots.forEach(r => render(r, 0));
  }
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log('已导出:', out);
}

function cmdExportHtml(file) {
  const out = file || 'cognitive-tree.html';
  const dataJson = JSON.stringify(tree.toJSON());
  const html = generateHtmlPage(dataJson);
  fs.writeFileSync(out, html, 'utf8');
  console.log('已导出 H5 页面:', out);
}

function generateHtmlPage(dataJson) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ODDM 认知树</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f5f0;color:#333;overflow:auto}
.header{padding:20px;text-align:center;background:#fff;border-bottom:1px solid #e0e0d0}
.header h1{font-size:24px;color:#2c5f2d}
.header .stats{margin-top:8px;font-size:13px;color:#888}
.tree-container{padding:20px;min-height:calc(100vh - 80px)}
svg{width:100%;height:auto;display:block}
.node-card{cursor:pointer;transition:all .2s}
.node-card:hover{filter:brightness(1.1)}
.node-text{font-size:13px;fill:#333;pointer-events:none}
.node-tag{font-size:10px;fill:#999;pointer-events:none}
.axis-label{font-size:16px;font-weight:bold;fill:#2c5f2d}
.tooltip{position:fixed;background:#fff;border:1px solid #ddd;border-radius:6px;padding:12px;max-width:300px;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:none;display:none;z-index:100;font-size:13px;line-height:1.6}
</style></head><body>
<div class="header"><h1>🌳 ODDM 认知树</h1><div class="stats" id="stats"></div></div>
<div class="tree-container"><svg id="tree"></svg></div>
<div class="tooltip" id="tooltip"></div>
<script>
const DATA=${dataJson};
const AXES=['生','业','思'];
const AXIS_COLORS={'生':'#4a90d9','业':'#2c5f2d','思':'#8b5cf6'};
const STATE_FILL={'实':'#fff','虚':'none'};
const STATE_STROKE={'实':'#333','虚':'#999'};

function buildTree(axis){
  const nodes=DATA.filter(n=>n.axis===axis);
  const childIds=new Set(nodes.flatMap(n=>n.children_ids));
  const roots=nodes.filter(n=>!childIds.has(n.node_id));
  const map={};
  nodes.forEach(n=>map[n.node_id]=n);
  function build(id){const n=map[id];if(!n)return null;return{...n,children:(n.children_ids||[]).map(cid=>build(cid)).filter(Boolean)};}
  return roots.map(r=>build(r.node_id));
}

function layoutTree(roots,x,y,vgap,hgap){
  const positions=[];
  let curY=y;
  function walk(node,depth){
    const px=x+depth*hgap;
    const py=curY;
    positions.push({...node,x:px,y:py});
    curY+=vgap;
    if(node.children&&node.children.length){node.children.forEach(c=>walk(c,depth+1));}
  }
  roots.forEach(r=>walk(r,0));
  return positions;
}

function render(){
  const svg=document.getElementById('tree');
  const tooltip=document.getElementById('tooltip');
  let allPositions=[];
  let offsetY=0;
  const vgap=70,hgap=220;
  AXES.forEach(axis=>{
    const roots=buildTree(axis);
    const positions=layoutTree(roots,60,offsetY+40,vgap,hgap);
    allPositions=allPositions.concat(positions.map(p=>({...p,axis})));
    offsetY+=Math.max(positions.length,1)*vgap+60;
  });
  const maxX=Math.max(...allPositions.map(p=>p.x))+240;
  const maxY=offsetY+40;
  svg.setAttribute('viewBox',\`0 0 \${maxX} \${maxY}\`);
  svg.setAttribute('width',maxX);
  svg.setAttribute('height',maxY);
  let html='';
  AXES.forEach((axis,i)=>{
    const y=60+i*(Math.ceil(DATA.filter(n=>n.axis===axis).length/1)*vgap+60);
  });
  let axisY=20;
  AXES.forEach(axis=>{
    const count=DATA.filter(n=>n.axis===axis).length;
    html+='<text class="axis-label" x="20" y="'+(axisY+20)+'" fill="'+AXIS_COLORS[axis]+'">【'+axis+'】'+count+'节点</text>';
    axisY+=Math.max(count,1)*vgap+60;
  });
  allPositions.forEach(p=>{
    if(p.children&&p.children.length){
      p.children.forEach(c=>{
        const child=allPositions.find(q=>q.node_id===c.node_id);
        if(child){
          const x1=p.x+190,y1=p.y+26,x2=child.x,y2=child.y+26;
          const my=(y1+y2)/2;
          html+='<path d="M'+x1+','+y1+' C'+x1+','+my+' '+x2+','+my+' '+x2+','+y2+'" fill="none" stroke="#ccc" stroke-width="1.5"/>';
        }
      });
    }
  });
  allPositions.forEach(p=>{
    const color=AXIS_COLORS[p.axis];
    const isSolid=p.state==='实';
    const heat=Math.min(p.heat_score,10);
    const heatBars='🔥'.repeat(Math.min(3,Math.ceil(heat/2)));
    const title=p.summary.length>16?p.summary.slice(0,16)+'…':p.summary;
    const tags=(p.implicit_tags||[]).slice(0,2).join('·');
    const dash=isSolid?'':'stroke-dasharray="4,3"';
    html+='<g class="node-card" data-id="'+p.node_id+'">';
    html+='<rect x="'+p.x+'" y="'+p.y+'" width="190" height="52" rx="6" fill="'+(isSolid?'#fff':'#fafafa')+'" stroke="'+color+'" stroke-width="2" '+dash+'/>';
    html+='<circle cx="'+(p.x+14)+'" cy="'+(p.y+16)+'" r="5" fill="'+(isSolid?color:'none')+'" stroke="'+color+'" stroke-width="2"/>';
    html+='<text class="node-text" x="'+(p.x+26)+'" y="'+(p.y+20)+'">'+title+'</text>';
    html+='<text class="node-tag" x="'+(p.x+26)+'" y="'+(p.y+38)+'">'+(tags||'')+' '+heatBars+' L'+p.level+'</text>';
    html+='</g>';
  });
  svg.innerHTML=html;
  document.getElementById('stats').textContent='共 '+DATA.length+' 个节点 | 实:'+DATA.filter(n=>n.state==='实').length+' 虚:'+DATA.filter(n=>n.state==='虚').length;
  svg.querySelectorAll('.node-card').forEach(card=>{
    card.addEventListener('mouseenter',e=>{
      const id=card.getAttribute('data-id');
      const n=DATA.find(x=>x.node_id===id);
      if(!n)return;
      tooltip.innerHTML='<b>['+n.axis+'/'+n.state+'] '+n.summary+'</b><br>热力:'+n.heat_score.toFixed(1)+' | L'+n.level+'<br>隐性:'+(n.implicit_tags||[]).join(',')+'<br>'+(n.raw_source?'原文:'+n.raw_source:'');
      tooltip.style.display='block';
      tooltip.style.left=(e.clientX+10)+'px';
      tooltip.style.top=(e.clientY+10)+'px';
    });
    card.addEventListener('mousemove',e=>{tooltip.style.left=(e.clientX+10)+'px';tooltip.style.top=(e.clientY+10)+'px';});
    card.addEventListener('mouseleave',()=>{tooltip.style.display='none';});
  });
}
render();
</script></body></html>`;
}

function cmdInspect() {
  const info = tree.introspect();
  console.log(JSON.stringify({ total_nodes: info.total_nodes, by_axis: info.by_axis, by_state: info.by_state, cross_link_count: info.cross_link_count }, null, 2));
}

function cmdClear(rl) {
  rl.question('确认清空所有数据? [y/N] ', ans => {
    if (ans.toLowerCase() === 'y') { tree = new KnowledgeTree(); saveData(); console.log('已清空'); }
    else console.log('已取消');
  });
}

async function processCommand(rl, input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  switch (cmd) {
    case 'help': case '?': printHelp(); break;
    case 'list': case 'ls': case 'tree': cmdList(); break;
    case 'view': case 'show': cmdView(args[0]); break;
    case 'touch': cmdTouch(args[0]); break;
    case 'decay': cmdDecay(); break;
    case 'add': cmdAdd(args); break;
    case 'note': cmdNote(args.join(' ')); break;
    case 'idea': cmdIdea(args.join(' ')); break;
    case 'parse': await cmdParse(rl, args.join(' ')); break;
    case 'crystal': await cmdCrystal(rl); break;
    case 'crystallize': cmdCrystallize(args); break;
    case 'cross': cmdCross(); break;
    case 'inspire': await cmdInspire(rl, args.join(' ')); break;
    case 'grow': await cmdGrow(rl, args[0]); break;
    case 'seed': cmdSeed(args[0]); break;
    case 'export-md': cmdExportMd(args[0]); break;
    case 'export-html': cmdExportHtml(args[0]); break;
    case 'inspect': cmdInspect(); break;
    case 'clear': cmdClear(rl); break;
    case 'exit': case 'quit': case 'q': console.log('再见 🌳'); rl.close(); process.exit(0);
    default: console.log('未知命令:', cmd, '（输入 help 查看命令列表）');
  }
}

function main() {
  console.log('🌳 ODDM 认知树 CLI');
  console.log('输入 help 查看命令，exit 退出');
  if (tree.nodes.size === 0) console.log('提示: 树为空，可运行 "seed oddm-knowledge" 导入示例数据');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'ctree> ' });
  rl.prompt();
  rl.on('line', async line => { await processCommand(rl, line); rl.prompt(); });
  rl.on('close', () => { saveData(); console.log('数据已保存'); });
}

if (require.main === module) main();

module.exports = { processCommand, KnowledgeTree, KnowledgeNode, DoubaoParser, SchemaValidator };
