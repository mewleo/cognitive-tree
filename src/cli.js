#!/usr/bin/env node
/**
 * ODDM 认知树 - CLI 交互工具
 *
 * 用法: node src/cli.js
 * 持久化: 自动保存到 ctree_data.json
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { KnowledgeNode } = require('./KnowledgeNode');
const { KnowledgeTree } = require('./KnowledgeTree');

const DATA_FILE = path.join(process.cwd(), 'ctree_data.json');

let tree = new KnowledgeTree();

function save() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(tree.toJSON(), null, 2), 'utf-8'); }
  catch (e) { console.error('保存失败:', e.message); }
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      tree = KnowledgeTree.fromJSON(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
      return true;
    }
  } catch (e) { console.error('加载失败，使用示例数据:', e.message); }
  return false;
}

function seedDemoData() {
  tree.addNode(new KnowledgeNode({ node_id: 'work_oddm', axis: '业', state: '实', summary: 'ODDM框架无图数据库设计', explicit_tags: ['ODDM', '数据库'], implicit_tags: ['解耦', '边界'], heat_score: 2.5, level: 2, children_ids: ['work_oddm_path', 'work_oddm_ref'] }));
  tree.addNode(new KnowledgeNode({ node_id: 'work_oddm_path', axis: '业', state: '实', summary: 'ODL路径寻址即拓扑', implicit_tags: ['解耦'], heat_score: 1.8 }));
  tree.addNode(new KnowledgeNode({ node_id: 'work_oddm_ref', axis: '业', state: '实', summary: 'ref懒引用按需加载', implicit_tags: ['解耦', '惰性'], heat_score: 1.5 }));
  tree.addNode(new KnowledgeNode({ node_id: 'life_sleep', axis: '生', state: '实', summary: '作息调理与褪黑素影响', implicit_tags: ['生理节律', '复利'], heat_score: 1.2 }));
  tree.addNode(new KnowledgeNode({ node_id: 'life_family', axis: '生', state: '实', summary: '家庭分工明确减少内耗', implicit_tags: ['解耦', '边界'], heat_score: 0.9 }));
  tree.addNode(new KnowledgeNode({ node_id: 'thought_tree', axis: '思', state: '虚', summary: 'AI自增长个人知识库构想', explicit_tags: ['AI', '知识库'], implicit_tags: ['自组织', '涌现'], heat_score: 2.0, children_ids: ['thought_axis', 'thought_heat', 'thought_crystal'] }));
  tree.addNode(new KnowledgeNode({ node_id: 'thought_axis', axis: '思', state: '虚', summary: '生业思三主干模型', implicit_tags: ['极简'], heat_score: 1.6 }));
  tree.addNode(new KnowledgeNode({ node_id: 'thought_heat', axis: '思', state: '虚', summary: '热力驱动应季显隐', implicit_tags: ['自组织'], heat_score: 1.4 }));
  tree.addNode(new KnowledgeNode({ node_id: 'thought_crystal', axis: '思', state: '虚', summary: '认知结晶升维第一性原理', implicit_tags: ['涌现', '极简'], heat_score: 1.3 }));
  tree.discoverCrossLinks();
}

function generateHtmlPage(dataJson) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>🌳 ODDM 认知树</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#1a1a2e;color:#e0e0e0;min-height:100vh}.header{text-align:center;padding:20px 10px 10px}.header h1{font-size:22px;color:#a8d8ea}.header .stats{font-size:13px;color:#888;margin-top:6px}.tree-wrap{display:flex;justify-content:center;align-items:flex-start;padding:10px;overflow:auto}svg{max-width:100%}.node-circle{cursor:pointer;transition:opacity .2s}.node-circle:hover{opacity:.8}.node-label{font-size:11px;fill:#ddd;pointer-events:none;text-anchor:middle}.axis-label{font-size:16px;font-weight:bold;fill:#a8d8ea;text-anchor:middle}.link{stroke:#444;stroke-width:1.5;fill:none}.cross-link{stroke:#6a5acd;stroke-width:1;stroke-dasharray:4,3;fill:none;opacity:.5}.tooltip{position:fixed;background:#16213e;border:1px solid #0f3460;border-radius:8px;padding:12px 16px;font-size:13px;max-width:280px;pointer-events:none;z-index:100;display:none;box-shadow:0 4px 20px rgba(0,0,0,.5)}.tooltip .t-title{font-weight:bold;color:#a8d8ea;margin-bottom:6px;font-size:14px}.tooltip .t-row{margin:3px 0;color:#bbb}.tooltip .t-content{margin-top:8px;padding-top:8px;border-top:1px solid #333;color:#999;line-height:1.5}.legend{text-align:center;padding:10px;font-size:12px;color:#666}.legend span{margin:0 12px}</style>
</head><body>
<div class="header"><h1>🌳 ODDM 认知树</h1><div class="stats" id="stats"></div></div>
<div class="tree-wrap"><svg id="tree" width="900" height="600"></svg></div>
<div class="legend"><span>● 实叶（已验证）</span><span>○ 虚叶（构想）</span><span>— 父子连接</span><span style="color:#6a5acd">┄ 跨干关联</span></div>
<div class="tooltip" id="tooltip"></div>
<script>
const DATA=${dataJson};const svg=document.getElementById('tree');const tooltip=document.getElementById('tooltip');const W=900,H=600,CX=W/2,CY=H/2;const axes=['生','业','思'];const axisAngle={'生':-90,'业':30,'思':150};const axisNodes={};for(const a of axes)axisNodes[a]=DATA.filter(n=>n.axis===a);const positions={};const nodeMap={};DATA.forEach(n=>nodeMap[n.node_id]=n);
for(const a of axes){const nodes=axisNodes[a];const angle=axisAngle[a]*Math.PI/180;const childIds=new Set();nodes.forEach(n=>n.children_ids.forEach(cid=>{if(nodes.find(x=>x.node_id===cid))childIds.add(cid);}));const roots=nodes.filter(n=>!childIds.has(n.node_id));const layoutNode=(node,depth,idx,total)=>{const baseR=100+depth*110;const spread=total>1?(idx-(total-1)/2)*80:0;const perpAngle=angle+Math.PI/2;const x=CX+Math.cos(angle)*baseR+Math.cos(perpAngle)*spread;const y=CY+Math.sin(angle)*baseR+Math.sin(perpAngle)*spread;positions[node.node_id]={x,y,node};const children=node.children_ids.map(cid=>nodeMap[cid]).filter(Boolean);children.forEach((c,i)=>layoutNode(c,depth+1,i,children.length));};roots.forEach((r,i)=>layoutNode(r,0,i,roots.length));}
DATA.forEach(n=>{n.children_ids.forEach(cid=>{if(positions[n.node_id]&&positions[cid]){const p1=positions[n.node_id],p2=positions[cid];const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',p1.x);line.setAttribute('y1',p1.y);line.setAttribute('x2',p2.x);line.setAttribute('y2',p2.y);line.setAttribute('class','link');svg.appendChild(line);}});});
const drawnCross=new Set();DATA.forEach(n=>{n.cross_links.forEach(tid=>{const key=[n.node_id,tid].sort().join('-');if(drawnCross.has(key))return;drawnCross.add(key);if(positions[n.node_id]&&positions[tid]){const p1=positions[n.node_id],p2=positions[tid];const mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;const dx=p2.x-p1.x,dy=p2.y-p1.y;const curve=document.createElementNS('http://www.w3.org/2000/svg','path');curve.setAttribute('d',\`M\${p1.x},\${p1.y} Q\${mx-dy*0.3},\${my+dx*0.3} \${p2.x},\${p2.y}\`);curve.setAttribute('class','cross-link');svg.appendChild(curve);}});});
for(const a of axes){const angle=axisAngle[a]*Math.PI/180;const x=CX+Math.cos(angle)*60,y=CY+Math.sin(angle)*60;const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('class','axis-label');t.textContent='【'+a+'】';svg.appendChild(t);}
Object.values(positions).forEach(({x,y,node})=>{const r=8+node.heat_score*3;const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',r);c.setAttribute('class','node-circle');if(node.state==='实'){c.setAttribute('fill',node.axis==='生'?'#52b788':node.axis==='业'?'#4ea8de':'#cdb4db');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','1');}else{c.setAttribute('fill','none');c.setAttribute('stroke',node.axis==='生'?'#52b788':node.axis==='业'?'#4ea8de':'#cdb4db');c.setAttribute('stroke-width','2');c.setAttribute('stroke-dasharray','3,2');}c.addEventListener('mouseenter',e=>showTooltip(e,node));c.addEventListener('mousemove',e=>moveTooltip(e));c.addEventListener('mouseleave',hideTooltip);svg.appendChild(c);const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x',x);label.setAttribute('y',y+r+14);label.setAttribute('class','node-label');label.textContent=node.summary.length>12?node.summary.slice(0,12)+'..':node.summary;svg.appendChild(label);});
const real=DATA.filter(n=>n.state==='实').length;const virt=DATA.filter(n=>n.state==='虚').length;const cross=DATA.filter(n=>n.cross_links.length>0).length;document.getElementById('stats').textContent=\`节点 \${DATA.length} | 实 \${real} 虚 \${virt} | 跨干关联 \${cross}\`;
function showTooltip(e,node){tooltip.style.display='block';tooltip.innerHTML=\`<div class="t-title">\${node.summary}</div><div class="t-row">主干: \${node.axis} | 状态: \${node.state} | 层级: L\${node.level}</div><div class="t-row">热力: \${node.heat_score.toFixed(1)}</div>\${node.implicit_tags.length?'<div class="t-row">隐性标签: '+node.implicit_tags.join(', ')+'</div>':''}\${node.raw_source?'<div class="t-content">'+node.raw_source+'</div>':''}\`;moveTooltip(e);}
function moveTooltip(e){tooltip.style.left=(e.clientX+15)+'px';tooltip.style.top=(e.clientY+15)+'px';}
function hideTooltip(){tooltip.style.display='none';}
</script></body></html>`;
}

const commands = {
  help() {
    console.log(`
  可用命令:
    note "内容"   快速存笔记（实节点，默认业主干）
    note 生 "内容"  指定主干存笔记
    idea "内容"   快速存想法（虚节点，思主干）
    list          渲染认知树（干支叶层级）
    view <id>     查看节点完整内容（含原文）
    add           添加新节点（交互式完整字段）
    touch <id>    注意某个节点（热力+）
    decay         全树自然衰减（模拟时间流逝）
    crystal       查看结晶提议
    crystallize <id> <新表述>  执行结晶升维
    cross         重新发现跨干关联
    inspect       全树自省快照（JSON摘要）
    seed [名称]   导入种子知识库（默认 oddm-knowledge，33个ODDM知识点）
    export-md [文件名]  导出为 Markdown 文件
    export-html [文件名] 导出为 H5 SVG 页面
    clear         清屏
    help          显示此帮助
    exit          退出
`);
  },
  list() { console.log(tree.renderASCII()); },
  view(id) {
    if (!id) { console.log('用法: view <node_id>'); return; }
    const node = tree.getNode(id);
    if (!node) { console.log('❌ 节点不存在'); return; }
    console.log('─────────────────────────────────────────');
    console.log(`📌 ${node.summary}`);
    console.log('─────────────────────────────────────────');
    console.log(`  ID:     ${node.node_id}`);
    console.log(`  主干:   ${node.axis} | 状态: ${node.state} | 层级: L${node.level}`);
    console.log(`  热力:   ${node.heat_score.toFixed(1)}`);
    console.log(`  显标签: ${node.explicit_tags.join(', ') || '(无)'}`);
    console.log(`  隐标签: ${node.implicit_tags.join(', ') || '(无)'}`);
    console.log(`  子节点: ${node.children_ids.join(', ') || '(无)'}`);
    console.log(`  跨干:   ${node.cross_links.join(', ') || '(无)'}`);
    console.log('─────────────────────────────────────────');
    console.log(`  📄 完整内容:`);
    console.log(`  ${node.raw_source || node.summary}`);
    console.log('─────────────────────────────────────────');
  },
  note(axisOrContent, ...rest) {
    let axis = '业'; let content;
    if (['生', '业', '思'].includes(axisOrContent)) { axis = axisOrContent; content = rest.join(' '); }
    else { content = [axisOrContent, ...rest].join(' '); }
    if (!content || !content.trim()) { console.log('用法: note "内容" 或 note 生 "内容"'); return; }
    const node = tree.addNote(content.trim(), axis);
    console.log(`📝 已存笔记 [${axis}/实]: ${node.summary} [${node.node_id}]`);
    save();
  },
  idea(...args) {
    const content = args.join(' ');
    if (!content || !content.trim()) { console.log('用法: idea "内容"'); return; }
    const node = tree.addIdea(content.trim());
    console.log(`💡 已存想法 [思/虚]: ${node.summary} [${node.node_id}]`);
    save();
  },
  async add(rl) {
    const axis = await ask(rl, '主干 (生/业/思): ');
    const state = await ask(rl, '状态 (虚/实): ');
    const summary = await ask(rl, '主旨: ');
    const implicit = await ask(rl, '隐性标签 (逗号分隔, 可空): ');
    const id = 'node_' + Date.now().toString(36);
    try {
      const node = new KnowledgeNode({ node_id: id, axis, state, summary, implicit_tags: implicit ? implicit.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [] });
      tree.addNode(node); tree.discoverCrossLinks();
      console.log(`✅ 已添加: ${id}`); save();
    } catch (e) { console.log(`❌ ${e.message}`); }
  },
  touch(id) {
    if (!id) { console.log('用法: touch <node_id>'); return; }
    const node = tree.touchNode(id);
    if (node) { console.log(`👆 注意了 "${node.summary}"，热力 → ${node.heat_score.toFixed(1)}`); save(); }
    else { console.log('❌ 节点不存在'); }
  },
  decay() { tree.decayAll(); console.log('🍂 全树自然衰减（时间流逝）'); save(); },
  crystal() {
    const suggestions = tree.suggestCrystallization(3);
    if (suggestions.length === 0) { console.log('暂无满足结晶条件的节点（需要3个以上子节点的底层碎片）'); return; }
    console.log('💎 结晶提议:');
    suggestions.forEach(n => console.log(`  ${n.node_id}: "${n.summary}" (子节点: ${n.children_ids.length})`));
  },
  crystallize(id, ...rest) {
    if (!id || rest.length === 0) { console.log('用法: crystallize <node_id> <新的高阶原理表述>'); return; }
    const node = tree.crystallize(id, rest.join(' '));
    if (node) { console.log(`✨ 结晶完成: "${node.summary}" (层级 L${node.level})`); save(); }
    else { console.log('❌ 不满足结晶条件或节点不存在'); }
  },
  cross() {
    const linked = tree.discoverCrossLinks();
    console.log(`🔗 发现 ${linked.length} 个有跨干关联的节点`);
    linked.forEach(n => console.log(`  ${n.node_id} (${n.axis}): ──> ${n.cross_links.join(', ')}`));
    save();
  },
  inspect() {
    const snap = tree.introspect();
    console.log(JSON.stringify({ total: snap.total_nodes, by_axis: snap.by_axis, by_state: snap.by_state, cross_linked: snap.cross_link_count }, null, 2));
  },
  clear() { console.clear(); },
  seed(name) {
    const seedName = name || 'oddm-knowledge';
    const seedFile = path.join(__dirname, '..', 'seed', `${seedName}.json`);
    if (!fs.existsSync(seedFile)) { console.log(`❌ 找不到种子文件: ${seedFile}`); console.log('可用种子: oddm-knowledge'); return; }
    try {
      tree = KnowledgeTree.fromJSON(JSON.parse(fs.readFileSync(seedFile, 'utf-8')));
      tree.discoverCrossLinks();
      save();
      console.log(`🌱 已导入种子数据: ${seedName} (${tree.nodes.size} 个节点)`);
      console.log(tree.renderASCII());
    } catch (e) { console.log(`❌ 导入失败: ${e.message}`); }
  },
  'export-md'(filename) {
    const file = filename || 'cognitive-tree-export.md';
    const lines = [];
    const now = new Date().toISOString().slice(0, 10);
    lines.push('# ODDM 认知树导出', '', `> 导出时间: ${now}`, `> 节点总数: ${tree.nodes.size} | 实: ${tree._countByState('实')} 虚: ${tree._countByState('虚')}`, '');
    for (const axis of ['生', '业', '思']) {
      const axisNodes = tree.getByAxis(axis);
      if (axisNodes.length === 0) continue;
      lines.push(`## ${axis}`, '');
      const childrenMap = new Map(); const allChildIds = new Set();
      for (const n of axisNodes) {
        const children = n.children_ids.map(id => tree.getNode(id)).filter(Boolean);
        childrenMap.set(n.node_id, children);
        for (const c of children) allChildIds.add(c.node_id);
      }
      const roots = axisNodes.filter(n => !allChildIds.has(n.node_id));
      const renderMdNode = (node, depth) => {
        const prefix = '#'.repeat(depth + 3);
        const levelMark = node.level > 1 ? `[L${node.level}] ` : '';
        const stateMark = node.state === '实' ? '●' : '○';
        lines.push(`${prefix} ${stateMark} ${levelMark}${node.summary}`, '');
        lines.push(`- **状态**: ${node.state} | **热力**: ${node.heat_score.toFixed(1)} | **层级**: L${node.level}`);
        if (node.explicit_tags.length) lines.push(`- **显性标签**: ${node.explicit_tags.join(', ')}`);
        if (node.implicit_tags.length) lines.push(`- **隐性标签**: ${node.implicit_tags.join(', ')}`);
        if (node.raw_source) lines.push(`- **完整内容**: ${node.raw_source}`);
        if (node.cross_links.length) lines.push(`- **跨干关联**: ${node.cross_links.join(', ')}`);
        lines.push(`- **ID**: ${node.node_id}`, '');
        const children = childrenMap.get(node.node_id) || [];
        for (const child of children) renderMdNode(child, depth + 1);
      };
      for (const root of roots) renderMdNode(root, 0);
    }
    try { fs.writeFileSync(file, lines.join('\n'), 'utf-8'); console.log(`📄 已导出 Markdown: ${file}`); }
    catch (e) { console.log(`❌ 导出失败: ${e.message}`); }
  },
  'export-html'(filename) {
    const file = filename || 'cognitive-tree.html';
    try { fs.writeFileSync(file, generateHtmlPage(JSON.stringify(tree.toJSON())), 'utf-8'); console.log(`🌐 已导出 H5 页面: ${file}（浏览器打开即可查看 SVG 认知树）`); }
    catch (e) { console.log(`❌ 导出失败: ${e.message}`); }
  },
};

function ask(rl, question) { return new Promise(resolve => rl.question(question, resolve)); }

async function main() {
  if (!load()) { seedDemoData(); save(); }
  console.clear();
  console.log('🌳 ODDM 认知树 CLI');
  console.log(`   数据文件: ${DATA_FILE}`);
  console.log('   输入 help 查看命令\n');
  console.log(tree.renderASCII());
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('\nctree> ');
  rl.prompt();
  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    if (cmd === 'exit' || cmd === 'quit') { console.log('👋 再见。认知树随内存消散，如露亦如电。'); rl.close(); return; }
    if (commands[cmd]) {
      if (cmd === 'add') await commands.add(rl);
      else commands[cmd](...args);
    } else if (cmd) { console.log(`未知命令: ${cmd}（输入 help 查看可用命令）`); }
    rl.prompt();
  });
}

main();