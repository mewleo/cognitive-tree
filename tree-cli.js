#!/usr/bin/env node
/**
 * tree-cli.js - ODDM 认知树 CLI 入口（优化版）
 *
 * 【架构定位】
 * 组合根（Composition Root），负责组装所有依赖并启动交互循环。
 * 这是优化后的 CLI 入口，替代旧版 cli.js 的单体架构。
 *
 * 【与旧版 cli.js 的区别】
 *   1. 入口精简：本文件只做依赖组装和 readline 初始化，~80行
 *   2. 模块拆分：命令实现 → src/cli/commands.js，持久化 → src/storage/json-store.js，HTML渲染 → src/renderer/html-renderer.js
 *   3. 全异步：持久化使用 fs.promises，不阻塞事件循环
 *   4. 依赖注入：通过 CommandContext 传递依赖，便于测试
 *
 * 【启动流程】
 *   1. 初始化 JsonStore（数据文件路径）
 *   2. 异步加载数据 → 构建 KnowledgeTree
 *   3. 初始化 DoubaoParser
 *   4. 组装 CommandContext
 *   5. 启动 readline 交互循环
 */
const readline = require('readline');
const path = require('path');
const { KnowledgeTree } = require('./src/KnowledgeTree');
const { DoubaoParser } = require('./src/ai-parser');
const { JsonStore } = require('./src/storage/json-store');
const { CommandContext, executeCommand } = require('./src/cli/commands');

/** 数据文件路径（运行目录下） */
const DATA_FILE = path.join(process.cwd(), 'ctree_data.json');

/** 种子数据目录 */
const SEED_DIR = path.join(__dirname, 'seed');

/**
 * 主入口——异步启动，确保数据加载完成后再进入交互
 */
async function main() {
  console.log('🌳 ODDM 认知树 CLI v0.3.0 (tree-cli)');
  console.log('输入 help 查看命令，exit 退出');

  // 1. 初始化存储并加载数据
  const store = new JsonStore(DATA_FILE);
  const data = await store.load();
  const tree = KnowledgeTree.fromJSON(data);

  // 2. 初始化 AI 解析器
  const parser = new DoubaoParser();

  // 3. 组装命令上下文
  const ctx = new CommandContext({ tree, parser, store, seedDir: SEED_DIR });

  if (tree.nodes.size === 0) {
    console.log('提示: 树为空，可运行 "seed oddm-knowledge" 导入示例数据');
  }

  // 4. 启动 readline 交互循环
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'ctree> ',
  });

  rl.prompt();

  rl.on('line', async line => {
    const running = await executeCommand(ctx, rl, line);
    if (running) {
      rl.prompt();
    } else {
      rl.close();
    }
  });

  rl.on('close', async () => {
    await ctx.save();
    console.log('数据已保存');
    process.exit(0);
  });
}

// 启动
main().catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
