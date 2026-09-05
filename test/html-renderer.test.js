/**
 * html-renderer.test.js - H5 SVG 页面渲染器测试
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { HtmlRenderer } = require('../src/renderer/html-renderer');

describe('HtmlRenderer', () => {
  describe('generateHtmlPage', () => {
    it('应输出完整的 HTML 文档结构', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.startsWith('<!DOCTYPE html>'));
      assert.ok(html.includes('<html'));
      assert.ok(html.includes('<head>'));
      assert.ok(html.includes('<body>'));
      assert.ok(html.includes('</html>'));
    });

    it('应包含 SVG 容器元素', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.includes('<svg'));
      assert.ok(html.includes('id="tree"'));
    });

    it('应正确注入 DATA 变量', () => {
      const testData = JSON.stringify([{ node_id: 'n1', axis: '业' }]);
      const html = HtmlRenderer.generateHtmlPage(testData);
      assert.ok(html.includes('const DATA='));
      assert.ok(html.includes('n1'));
    });

    it('应包含三大主干的颜色定义', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.includes("'生'"));
      assert.ok(html.includes("'业'"));
      assert.ok(html.includes("'思'"));
    });

    it('应包含 tooltip 元素', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.includes('id="tooltip"'));
    });

    it('空数据不应报错', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.length > 100);
    });

    it('应包含页面标题', () => {
      const html = HtmlRenderer.generateHtmlPage('[]');
      assert.ok(html.includes('<title>'));
      assert.ok(html.includes('ODDM'));
    });
  });
});
