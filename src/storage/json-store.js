/**
 * json-store.js - 异步 JSON 文件持久化层
 *
 * 【架构定位】
 * 基础设施层（Infrastructure），负责认知树数据的异步读写。
 * 从 cli.js 中抽离，统一使用 fs.promises，不阻塞事件循环。
 *
 * 【职责】
 *   - load(filePath): 异步加载 JSON 文件，不存在时返回空数组
 *   - save(filePath, data): 异步保存数据，缩进格式便于阅读
 *
 * 【设计原则】
 *   - 单一职责：只做文件 IO，不包含业务逻辑
 *   - 异步优先：全部使用 fs.promises
 *   - 容错：文件不存在是正常情况，返回空数组而非报错
 */
const fs = require('fs');
const path = require('path');

class JsonStore {
  /**
   * @param {string} filePath - 数据文件的绝对路径
   */
  constructor(filePath) {
    /** @type {string} 数据文件路径 */
    this.filePath = filePath;
  }

  /**
   * 异步加载数据文件
   * @returns {Promise<Array>} 解析后的节点数组；文件不存在时返回空数组
   * @throws {Error} JSON 解析失败时抛出
   */
  async load() {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * 异步保存数据到文件
   * @param {Array} data - 要保存的节点数组
   * @returns {Promise<void>}
   */
  async save(data) {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

module.exports = { JsonStore };
