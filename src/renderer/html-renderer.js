/**
 * html-renderer.js - H5 SVG 认知树页面渲染器
 *
 * 【架构定位】
 * 表现层（Presentation），负责将认知树数据渲染为可交互的 H5 页面。
 * 从 cli.js 的 generateHtmlPage 抽离，独立维护。
 *
 * 【职责】
 *   - generateHtmlPage(dataJson): 生成完整的单文件 HTML 页面
 *   - 页面包含：树状布局 SVG、节点卡片、hover tooltip、热力可视化
 *
 * 【渲染协议】
 *   - 布局：自上而下树状布局（非放射状脑图）
 *   - 节点：矩形卡片 190×52px，实叶实心、虚叶虚线边框
 *   - 热力：🔥 图标，最多3个
 *   - 交互：hover 显示完整内容 tooltip
 *
 * 【设计原则】
 *   - 零依赖：纯原生 HTML/CSS/JS，无框架
 *   - 单文件：所有内联，导出即可用浏览器打开
 *   - 可读性优先：浅色背景、13px 字体、卡片式节点
 */
class HtmlRenderer {
  /**
   * 生成完整的 H5 认知树页面
   * @param {string} dataJson - 认知树节点的 JSON 字符串
   * @returns {string} 完整的 HTML 文档
   */
  static generateHtmlPage(dataJson) {
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
}

module.exports = { HtmlRenderer };
