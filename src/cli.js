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
const { DoubaoParser } = require('./ai-parser');

const DATA_FILE = path.join(process.cwd(), 'ctree_data.json');

let tree = new KnowledgeTree();

// ── 持久化 ──
function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tree.toJSON(), null, 2), 'utf-8');
  } catch (e) {
    console.error('保存失败:', e.message);
  }
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      tree = KnowledgeTree.fromJSON(data);
      return true;
    }
  } catch (e) {
    console.error('加载失败，使用示例数据:', e.message);
  }
  return false;
}

// ── 预置示例数据：模拟一段真实认知积累 ──
function seedDemoData() {
  // 业：工作实践
  tree.addNode(new KnowledgeNode({
    node_id: 'work_oddm',
    axis: '业', state: '实',
    summary: 'ODDM框架无图数据库设计',
    explicit_tags: ['ODDM', '数据库'],
    implicit_tags: ['解耦', '边界'],
    heat_score: 2.5, level: 2,
    children_ids: ['work_oddm_path', 'work_oddm_ref'],
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'work_oddm_path',
    axis: '业', state: '实',
    summary: 'ODL路径寻址即拓扑',
    implicit_tags: ['解耦'],
    heat_score: 1.8,
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'work_oddm_ref',
    axis: '业', state: '实',
    summary: 'ref懒引用按需加载',
    implicit_tags: ['解耦', '惰性'],
    heat_score: 1.5,
  }));

  // 生：生活
  tree.addNode(new KnowledgeNode({
    node_id: 'life_sleep',
    axis: '生', state: '实',
    summary: '作息调理与褪黑素影响',
    implicit_tags: ['生理节律', '复利'],
    heat_score: 1.2,
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'life_family',
    axis: '生', state: '实',
    summary: '家庭分工明确减少内耗',
    implicit_tags: ['解耦', '边界'],
    heat_score: 0.9,
  }));

  // 思：构想
  tree.addNode(new KnowledgeNode({
    node_id: 'thought_tree',
    axis: '思', state: '虚',
    summary: 'AI自增长个人知识库构想',
    explicit_tags: ['AI', '知识库'],
    implicit_tags: ['自组织', '涌现'],
    heat_score: 2.0,
    children_ids: ['thought_axis', 'thought_heat', 'thought_crystal'],
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'thought_axis',
    axis: '思', state: '虚',
    summary: '生业思三主干模型',
    implicit_tags: ['极简'],
    heat_score: 1.6,
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'thought_heat',
    axis: '思', state: '虚',
    summary: '热力驱动应季显隐',
    implicit_tags: ['自组织'],
    heat_score: 1.4,
  }));
  tree.addNode(new KnowledgeNode({
    node_id: 'thought_crystal',
    axis: '思', state: '虚',
    summary: '认知结晶升维第一性原理',
    implicit_tags: ['涌现', '极简'],
    heat_score: 1.3,
  }));

  // 自动发现跨干关联
  tree.discoverCrossLinks();
}

// ── H5 SVG 页面生成 ──
function generateHtmlPage(dataJson) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🌳 ODDM 认知树</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f5f5f0;color:#333;min-height:100vh}
.header{text-align:center;padding:24px 16px 8px}
.header h1{font-size:24px;color:#2d5a27}
.header .stats{font-size:14px;color:#888;margin-top:8px}
.tree-scroll{overflow:auto;padding:20px}
svg{display:block;margin:0 auto}
.node-card{cursor:pointer;transition:filter .15s}
.node-card:hover{filter:brightness(0.96)}
.node-text{font-size:13px;fill:#222;pointer-events:none}
.node-sub{font-size:11px;fill:#999;pointer-events:none}
.axis-title{font-size:18px;font-weight:bold;fill:#2d5a27;text-anchor:middle}
.link{stroke:#bbb;stroke-width:1.5;fill:none}
.cross-link{stroke:#c9a0dc;stroke-width:1;stroke-dasharray:5,4;fill:none;opacity:.4}
.tooltip{position:fixed;background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px 18px;font-size:13px;max-width:320px;pointer-events:none;z-index:100;display:none;box-shadow:0 4px 24px rgba(0,0,0,.12);line-height:1.6}
.tooltip .t-title{font-weight:bold;color:#2d5a27;margin-bottom:8px;font-size:15px}
.tooltip .t-row{margin:3px 0;color:#555}
.tooltip .t-content{margin-top:10px;padding-top:10px;border-top:1px solid #eee;color:#666}
.legend{text-align:center;padding:12px;font-size:12px;color:#888}
.legend span{margin:0 16px}
</style>
</head>
<body>
<div class="header"><h1>🌳 ODDM 认知树</h1><div class="stats" id="stats"></div></div>
<div class="tree-scroll"><svg id="tree"></svg></div>
<div class="legend"><span>● 实叶（已验证）</span><span>○ 虚叶（构想）</span><span>─ 父子连接</span><span style="color:#c9a0dc">┄ 跨干关联</span></div>
<div class="tooltip" id="tooltip"></div>
<script>
const DATA=${dataJson};
const svg=document.getElementById('tree');
const tooltip=document.getElementById('tooltip');
const nodeMap={};DATA.forEach(n=>nodeMap[n.node_id]=n);
const NODE_W=190,NODE_H=52,VGAP=60,HGAP=24,TOP_PAD=50,LEFT_PAD=30;
const axes=['生','业','思'];
const axisColor={'生':'#52b788','业':'#4ea8de','思':'#cdb4db'};

// 按主干分组，构建每棵子树
const axisTrees={};
for(const a of axes){
  const nodes=DATA.filter(n=>n.axis===a);
  const childIds=new Set();
  nodes.forEach(n=>n.children_ids.forEach(cid=>{if(nodes.find(x=>x.node_id===cid))childIds.add(cid);}));
  const roots=nodes.filter(n=>!childIds.has(n.node_id));
  axisTrees[a]={nodes,roots};
}

// 递归计算子树宽度（叶子数）
function treeWidth(node){
  const children=(node.children_ids||[]).map(id=>nodeMap[id]).filter(n=>n&&n.axis===node.axis);
  if(children.length===0)return 1;
  return children.reduce((s,c)=>s+treeWidth(c),0);
}

// 递归布局，返回节点位置映射
const positions={};
function layout(node,x,depth){
  const y=TOP_PAD+depth*(NODE_H+VGAP);
  positions[node.node_id]={x,y,node};
  const children=(node.children_ids||[]).map(id=>nodeMap[id]).filter(n=>n&&n.axis===node.axis);
  if(children.length>0){
    let curX=x;
    children.forEach(c=>{
      const w=treeWidth(c);
      layout(c,curX,depth+1);
      curX+=w*(NODE_W+HGAP);
    });
  }
}

// 计算每个主干的总宽度和起始x
let curX=LEFT_PAD;
const axisStart={};
for(const a of axes){
  const {roots}=axisTrees[a];
  let totalW=0;
  roots.forEach(r=>totalW+=treeWidth(r)*(NODE_W+HGAP));
  if(totalW>0){
    axisStart[a]=curX;
    roots.forEach(r=>{
      const w=treeWidth(r)*(NODE_W+HGAP);
      layout(r,curX,0);
      curX+=w;
    });
    curX+=HGAP*2; // 主干之间额外间距
  }
}

// 计算画布尺寸
let maxX=0,maxY=0;
Object.values(positions).forEach(p=>{
  maxX=Math.max(maxX,p.x+NODE_W);
  maxY=Math.max(maxY,p.y+NODE_H);
});
const SVG_W=Math.max(maxX+LEFT_PAD,800);
const SVG_H=maxY+80;
svg.setAttribute('width',SVG_W);
svg.setAttribute('height',SVG_H);

// 画主干标题
for(const a of axes){
  if(axisStart[a]!==undefined){
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',axisStart[a]+40);
    t.setAttribute('y',28);
    t.setAttribute('class','axis-title');
    t.textContent='【'+a+'】';
    svg.appendChild(t);
  }
}

// 画父子连线
DATA.forEach(n=>{
  if(!positions[n.node_id])return;
  const p1=positions[n.node_id];
  (n.children_ids||[]).forEach(cid=>{
    if(positions[cid]){
      const p2=positions[cid];
      const x1=p1.x+NODE_W/2,y1=p1.y+NODE_H;
      const x2=p2.x+NODE_W/2,y2=p2.y;
      const my=(y1+y2)/2;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',\`M\${x1},\${y1} C\${x1},\${my} \${x2},\${my} \${x2},\${y2}\`);
      path.setAttribute('class','link');
      svg.appendChild(path);
    }
  });
});

// 画跨干关联（虚线弧线）
const drawnCross=new Set();
DATA.forEach(n=>{
  (n.cross_links||[]).forEach(tid=>{
    const key=[n.node_id,tid].sort().join('-');
    if(drawnCross.has(key))return;
    drawnCross.add(key);
    if(positions[n.node_id]&&positions[tid]){
      const p1=positions[n.node_id],p2=positions[tid];
      const x1=p1.x+NODE_W/2,y1=p1.y+NODE_H/2;
      const x2=p2.x+NODE_W/2,y2=p2.y+NODE_H/2;
      const mx=(x1+x2)/2,my=(y1+y2)/2-40;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',\`M\${x1},\${y1} Q\${mx},\${my} \${x2},\${y2}\`);
      path.setAttribute('class','cross-link');
      svg.appendChild(path);
    }
  });
});

// 画节点卡片
Object.values(positions).forEach(({x,y,node})=>{
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('class','node-card');
  const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('x',x);rect.setAttribute('y',y);
  rect.setAttribute('width',NODE_W);rect.setAttribute('height',NODE_H);
  rect.setAttribute('rx',8);rect.setAttribute('ry',8);
  rect.setAttribute('fill','#fff');
  const color=axisColor[node.axis]||'#999';
  if(node.state==='实'){
    rect.setAttribute('stroke',color);rect.setAttribute('stroke-width','2');
  }else{
    rect.setAttribute('stroke',color);rect.setAttribute('stroke-width','1.5');
    rect.setAttribute('stroke-dasharray','4,3');
  }
  g.appendChild(rect);
  // 状态标记
  const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx',x+14);dot.setAttribute('cy',y+18);dot.setAttribute('r',4);
  dot.setAttribute('fill',node.state==='实'?color:'none');
  dot.setAttribute('stroke',color);dot.setAttribute('stroke-width','1.5');
  g.appendChild(dot);
  // 标题（截断到16字）
  const title=document.createElementNS('http://www.w3.org/2000/svg','text');
  title.setAttribute('x',x+26);title.setAttribute('y',y+22);
  title.setAttribute('class','node-text');
  title.textContent=node.summary.length>16?node.summary.slice(0,16)+'..':node.summary;
  g.appendChild(title);
  // 副标题：标签+热力
  const tags=(node.implicit_tags||[]).slice(0,2).join('·');
  const heat='🔥'.repeat(Math.min(3,Math.ceil(node.heat_score)));
  const sub=document.createElementNS('http://www.w3.org/2000/svg','text');
  sub.setAttribute('x',x+10);sub.setAttribute('y',y+40);
  sub.setAttribute('class','node-sub');
  sub.textContent=(tags?tags+' ':'')+heat+(node.level>1?' L'+node.level:'');
  g.appendChild(sub);
  g.addEventListener('mouseenter',e=>showTooltip(e,node));
  g.addEventListener('mousemove',e=>moveTooltip(e));
  g.addEventListener('mouseleave',hideTooltip);
  svg.appendChild(g);
});

// 统计
const real=DATA.filter(n=>n.state==='实').length;
const virt=DATA.filter(n=>n.state==='虚').length;
const cross=DATA.filter(n=>(n.cross_links||[]).length>0).length;
document.getElementById('stats').textContent=\`节点 \${DATA.length} | 实 \${real} 虚 \${virt} | 跨干关联 \${cross}\`;

function showTooltip(e,node){
  tooltip.style.display='block';
  tooltip.innerHTML=\`<div class="t-title">\${node.summary}</div>
  <div class="t-row">主干: \${node.axis} | 状态: \${node.state} | 层级: L\${node.level}</div>
  <div class="t-row">热力: \${node.heat_score.toFixed(1)}</div>
  \${node.implicit_tags&&node.implicit_tags.length?'<div class="t-row">隐性标签: '+node.implicit_tags.join(', ')+'</div>':''}
  \${node.explicit_tags&&node.explicit_tags.length?'<div class="t-row">显性标签: '+node.explicit_tags.join(', ')+'</div>':''}
  \${node.raw_source?'<div class="t-content">'+node.raw_source+'</div>':''}\`;
  moveTooltip(e);
}
function moveTooltip(e){tooltip.style.left=(e.clientX+15)+'px';tooltip.style.top=(e.clientY+15)+'px';}
function hideTooltip(){tooltip.style.display='none';}
</script>
</body>
</html>`;
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
    parse "内容"  AI 解析对话/笔记为知识点（需配置 ARK_API_KEY 环境变量）
    export-md [文件名]  导出为 Markdown 文件
    export-html [文件名] 导出为 H5 SVG 页面（浏览器打开查看）
    clear         清屏
    help          显示此帮助
    exit          退出
`);
  },

  list() {
    console.log(tree.renderASCII());
  },

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
    // note "内容" 或 note 生 "内容"
    let axis = '业';
    let content;
    if (['生', '业', '思'].includes(axisOrContent)) {
      axis = axisOrContent;
      content = rest.join(' ');
    } else {
      content = [axisOrContent, ...rest].join(' ');
    }
    if (!content || !content.trim()) {
      console.log('用法: note "内容" 或 note 生 "内容"');
      return;
    }
    const node = tree.addNote(stripQuotes(content), axis);
    console.log(`📝 已存笔记 [${axis}/实]: ${node.summary} [${node.node_id}]`);
    save();
  },

  idea(...args) {
    const content = args.join(' ');
    if (!content || !content.trim()) {
      console.log('用法: idea "内容"');
      return;
    }
    const node = tree.addIdea(stripQuotes(content));
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
      const node = new KnowledgeNode({
        node_id: id,
        axis,
        state,
        summary,
        implicit_tags: implicit ? implicit.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
      });
      tree.addNode(node);
      tree.discoverCrossLinks();
      console.log(`✅ 已添加: ${id}`);
      save();
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  },

  touch(id) {
    if (!id) { console.log('用法: touch <node_id>'); return; }
    const node = tree.touchNode(id);
    if (node) {
      console.log(`👆 注意了 "${node.summary}"，热力 → ${node.heat_score.toFixed(1)}`);
      save();
    } else {
      console.log('❌ 节点不存在');
    }
  },

  decay() {
    tree.decayAll();
    console.log('🍂 全树自然衰减（时间流逝）');
    save();
  },

  crystal() {
    const suggestions = tree.suggestCrystallization(3);
    if (suggestions.length === 0) {
      console.log('暂无满足结晶条件的节点（需要3个以上子节点的底层碎片）');
      return;
    }
    console.log('💎 结晶提议:');
    suggestions.forEach(n => {
      console.log(`  ${n.node_id}: "${n.summary}" (子节点: ${n.children_ids.length})`);
    });
  },

  crystallize(id, ...rest) {
    if (!id || rest.length === 0) {
      console.log('用法: crystallize <node_id> <新的高阶原理表述>');
      return;
    }
    const newSummary = rest.join(' ');
    const node = tree.crystallize(id, newSummary);
    if (node) {
      console.log(`✨ 结晶完成: "${node.summary}" (层级 L${node.level})`);
      save();
    } else {
      console.log('❌ 不满足结晶条件或节点不存在');
    }
  },

  cross() {
    const linked = tree.discoverCrossLinks();
    console.log(`🔗 发现 ${linked.length} 个有跨干关联的节点`);
    linked.forEach(n => {
      console.log(`  ${n.node_id} (${n.axis}): ──> ${n.cross_links.join(', ')}`);
    });
    save();
  },

  inspect() {
    const snap = tree.introspect();
    console.log(JSON.stringify({
      total: snap.total_nodes,
      by_axis: snap.by_axis,
      by_state: snap.by_state,
      cross_linked: snap.cross_link_count,
    }, null, 2));
  },

  clear() {
    console.clear();
  },

  seed(name) {
    const seedName = name || 'oddm-knowledge';
    const seedFile = path.join(__dirname, '..', 'seed', `${seedName}.json`);
    if (!fs.existsSync(seedFile)) {
      console.log(`❌ 找不到种子文件: ${seedFile}`);
      console.log('可用种子: oddm-knowledge');
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      tree = KnowledgeTree.fromJSON(data);
      tree.discoverCrossLinks();
      save();
      console.log(`🌱 已导入种子数据: ${seedName} (${tree.nodes.size} 个节点)`);
      console.log(tree.renderASCII());
    } catch (e) {
      console.log(`❌ 导入失败: ${e.message}`);
    }
  },

  // ── AI 解析层（白皮书 Phase 1：对话文本 → KnowledgeNode JSON）──
  async parse(rl, ...args) {
    const text = stripQuotes(args.join(' '));
    if (!text.trim()) {
      console.log('用法: parse "对话或笔记内容"');
      return;
    }
    const parser = new DoubaoParser();
    const keyCheck = parser.checkKey();
    if (!keyCheck.ok) {
      console.log(`❌ ${keyCheck.error}`);
      return;
    }
    const cfg = parser.getConfig();
    console.log(`🤖 AI 解析中…（模型: ${cfg.model}，超时: ${cfg.timeoutSec}s）`);
    const result = await parser.parse(text);
    if (!result.ok) {
      console.log(`❌ ${result.error}`);
      return;
    }
    const d = result.data;
    console.log('─────────────────────────────────────────');
    console.log('🧠 AI 解析结果（待确认，主权在你）');
    console.log('─────────────────────────────────────────');
    console.log(`  主干:   ${d.axis}`);
    console.log(`  状态:   ${d.state}${d.state === '虚' ? '（待验证构想）' : '（已验证经验）'}`);
    console.log(`  摘要:   ${d.summary}`);
    console.log(`  显标签: ${d.explicit_tags.join(', ') || '(无)'}`);
    console.log(`  隐标签: ${d.implicit_tags.join(', ') || '(无)'}`);
    console.log('─────────────────────────────────────────');
    const ans = await ask(rl, '写入认知树？[y=写入 / n=放弃 / e=修改后写入] ');
    const lower = ans.trim().toLowerCase();
    if (lower === 'y' || lower === 'e') {
      if (lower === 'e') {
        const axisAns = await ask(rl, `主干[${d.axis}]改为（生/业/思，回车不变）: `);
        if (['生', '业', '思'].includes(axisAns.trim())) d.axis = axisAns.trim();
        const stateAns = await ask(rl, `状态[${d.state}]改为（虚/实，回车不变）: `);
        if (['虚', '实'].includes(stateAns.trim())) d.state = stateAns.trim();
      }
      const node = tree.addFromAI(d, text);
      save();
      console.log(`🌱 已写入 [${d.axis}/${d.state}]: ${node.summary} [${node.node_id}]`);
      console.log('  输入 list 查看树；点击 touch 可提升热力');
    } else {
      console.log('已放弃，未写入。');
    }
  },

  'export-md'(filename) {
    const file = filename || 'cognitive-tree-export.md';
    const lines = [];
    const now = new Date().toISOString().slice(0, 10);
    lines.push('# ODDM 认知树导出');
    lines.push('');
    lines.push(`> 导出时间: ${now}`);
    lines.push(`> 节点总数: ${tree.nodes.size} | 实: ${tree._countByState('实')} 虚: ${tree._countByState('虚')}`);
    lines.push('');

    for (const axis of ['生', '业', '思']) {
      const axisNodes = tree.getByAxis(axis);
      if (axisNodes.length === 0) continue;

      lines.push(`## ${axis}`);
      lines.push('');

      // 构建层级
      const childrenMap = new Map();
      const allChildIds = new Set();
      for (const n of axisNodes) {
        const children = n.children_ids.map(id => tree.getNode(id)).filter(Boolean);
        childrenMap.set(n.node_id, children);
        for (const c of children) allChildIds.add(c.node_id);
      }
      const roots = axisNodes.filter(n => !allChildIds.has(n.node_id));

      const renderMdNode = (node, depth) => {
        const prefix = '#'.repeat(depth + 3); // ###, ####, #####
        const levelMark = node.level > 1 ? `[L${node.level}] ` : '';
        const stateMark = node.state === '实' ? '●' : '○';
        lines.push(`${prefix} ${stateMark} ${levelMark}${node.summary}`);
        lines.push('');
        lines.push(`- **状态**: ${node.state} | **热力**: ${node.heat_score.toFixed(1)} | **层级**: L${node.level}`);
        if (node.explicit_tags.length) lines.push(`- **显性标签**: ${node.explicit_tags.join(', ')}`);
        if (node.implicit_tags.length) lines.push(`- **隐性标签**: ${node.implicit_tags.join(', ')}`);
        if (node.raw_source) lines.push(`- **完整内容**: ${node.raw_source}`);
        if (node.cross_links.length) lines.push(`- **跨干关联**: ${node.cross_links.join(', ')}`);
        lines.push(`- **ID**: ${node.node_id}`);
        lines.push('');

        const children = childrenMap.get(node.node_id) || [];
        for (const child of children) {
          renderMdNode(child, depth + 1);
        }
      };

      for (const root of roots) {
        renderMdNode(root, 0);
      }
    }

    try {
      fs.writeFileSync(file, lines.join('\n'), 'utf-8');
      console.log(`📄 已导出 Markdown: ${file}`);
    } catch (e) {
      console.log(`❌ 导出失败: ${e.message}`);
    }
  },

  'export-html'(filename) {
    const file = filename || 'cognitive-tree.html';
    const data = JSON.stringify(tree.toJSON());
    const html = generateHtmlPage(data);
    try {
      fs.writeFileSync(file, html, 'utf-8');
      console.log(`🌐 已导出 H5 页面: ${file}（浏览器打开即可查看 SVG 认知树）`);
    } catch (e) {
      console.log(`❌ 导出失败: ${e.message}`);
    }
  },
};

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

/**
 * 剥离成对引号："内容" 或 '内容' → 内容
 * 用户习惯在命令里用引号包裹长文本，存储与解析时不应保留引号本身
 */
function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

// ── 主循环 ──
async function main() {
  const loaded = load();
  if (!loaded) {
    seedDemoData();
    save();
  }

  console.clear();
  console.log('🌳 ODDM 认知树 CLI');
  console.log(`   数据文件: ${DATA_FILE}`);
  console.log('   输入 help 查看命令\n');
  console.log(tree.renderASCII());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.setPrompt('\nctree> ');
  rl.prompt();

  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === 'exit' || cmd === 'quit') {
      console.log('👋 再见。认知树随内存消散，如露亦如电。');
      rl.close();
      return;
    }

    if (commands[cmd]) {
      if (cmd === 'add' || cmd === 'parse') {
        await commands[cmd](rl, ...args);
      } else {
        commands[cmd](...args);
      }
    } else if (cmd) {
      console.log(`未知命令: ${cmd}（输入 help 查看可用命令）`);
    }

    rl.prompt();
  });
}

main();
