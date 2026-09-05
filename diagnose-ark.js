#!/usr/bin/env node
/**
 * 火山方舟连接诊断脚本
 * 用法: node diagnose-ark.js
 *
 * 逐步检测：DNS → TCP → TLS → HTTP GET → 完整 POST
 * 每步都有超时，不会挂死。
 */
const dns = require('dns');
const net = require('net');
const https = require('https');

const HOST = 'ark.cn-beijing.volces.com';
const PORT = 443;
const API_KEY = process.env.ARK_API_KEY || '(未设置 ARK_API_KEY)';
const MODEL = process.env.ARK_MODEL_ID || 'doubao-seed-2-1-pro-260628';
const STEP_TIMEOUT = 15000; // 每步 15s 超时

function timeout(ms, label) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms)
  );
}

async function step(name, fn) {
  process.stdout.write(`  [${name}] ... `);
  try {
    const result = await Promise.race([fn(), timeout(STEP_TIMEOUT, name)]);
    console.log('✅ ' + result);
    return true;
  } catch (e) {
    console.log('❌ ' + e.message);
    return false;
  }
}

(async () => {
  console.log('=== 火山方舟连接诊断 ===');
  console.log(`  主机: ${HOST}:${PORT}`);
  console.log(`  模型: ${MODEL}`);
  console.log(`  API Key: ${API_KEY.length > 10 ? API_KEY.slice(0, 6) + '...' + API_KEY.slice(-4) : API_KEY}`);
  console.log(`  Node: ${process.version}`);
  console.log('');

  // 1. DNS 解析
  await step('DNS A (IPv4)', () => new Promise((resolve, reject) => {
    dns.resolve4(HOST, (err, addrs) => {
      if (err) reject(err);
      else resolve(`解析到 ${addrs.length} 个: ${addrs.join(', ')}`);
    });
  }));

  await step('DNS AAAA (IPv6)', () => new Promise((resolve, reject) => {
    dns.resolve6(HOST, (err, addrs) => {
      if (err) reject(err);
      else resolve(`解析到 ${addrs.length} 个: ${addrs.join(', ')}`);
    });
  }));

  // 2. dns.lookup（Node fetch 实际用的方式，看默认返回 IPv4 还是 IPv6）
  await step('dns.lookup (Node默认)', () => new Promise((resolve, reject) => {
    dns.lookup(HOST, { all: true }, (err, addrs) => {
      if (err) reject(err);
      else {
        const info = addrs.map(a => `${a.address}(${a.family === 4 ? 'IPv4' : 'IPv6'})`).join(', ');
        resolve(`返回: ${info}（第一个会被优先使用）`);
      }
    });
  }));

  // 3. TCP 连接（IPv4）
  await step('TCP 连接 (IPv4)', () => new Promise((resolve, reject) => {
    dns.resolve4(HOST, (err, addrs) => {
      if (err) return reject(err);
      const sock = net.connect(PORT, addrs[0], () => {
        sock.destroy();
        resolve(`连接成功 ${addrs[0]}:${PORT}`);
      });
      sock.on('error', reject);
    });
  }));

  // 4. TLS 握手（用 https 模块，强制 IPv4）
  await step('TLS 握手 (IPv4)', () => new Promise((resolve, reject) => {
    dns.resolve4(HOST, (err, addrs) => {
      if (err) return reject(err);
      const req = https.request({
        host: addrs[0],
        servername: HOST, // SNI
        port: PORT,
        method: 'GET',
        path: '/',
        timeout: STEP_TIMEOUT,
      }, (res) => {
        res.resume();
        resolve(`TLS 成功，HTTP ${res.statusCode}`);
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('TLS 超时')));
      req.end();
    });
  }));

  // 5. fetch GET（Node 内置 fetch，看默认行为）
  await step('fetch GET (Node默认)', () =>
    fetch(`https://${HOST}/`, { signal: AbortSignal.timeout(STEP_TIMEOUT) })
      .then(r => `HTTP ${r.status}`)
  );

  // 6. fetch 强制 IPv4（用自定义 dispatcher，如果 undici 可用）
  let undiciAvailable = false;
  try {
    require('undici');
    undiciAvailable = true;
  } catch (e) { /* undici 是 Node 内置，但 require 可能不暴露 */ }

  if (undiciAvailable) {
    await step('fetch GET (强制IPv4)', () => {
      const { Agent, fetch: undiciFetch } = require('undici');
      const agent = new Agent({ connect: { family: 4 } });
      return undiciFetch(`https://${HOST}/`, {
        dispatcher: agent,
        signal: AbortSignal.timeout(STEP_TIMEOUT),
      }).then(r => `HTTP ${r.status}`);
    });
  } else {
    console.log('  [fetch 强制IPv4] ⏭️  undici 不可直接 require，跳过');
  }

  // 7. 完整 API 调用（如果有 Key）
  if (API_KEY !== '(未设置 ARK_API_KEY)') {
    await step('完整 API POST (Node默认)', () =>
      fetch(`https://${HOST}/api/v3/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(STEP_TIMEOUT),
      }).then(async r => {
        const text = await r.text();
        return `HTTP ${r.status}: ${text.slice(0, 80)}`;
      })
    );
  } else {
    console.log('  [完整 API POST] ⏭️  未设置 ARK_API_KEY，跳过');
  }

  console.log('');
  console.log('=== 诊断结束 ===');
  console.log('如果 DNS AAAA 有记录且 dns.lookup 优先返回 IPv6，而 TCP IPv6 不通，');
  console.log('就是 IPv6 问题。解决方案：运行前 export NODE_OPTIONS="--dns-result-order=ipv4first"');
})();
