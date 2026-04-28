#!/usr/bin/env node
// Smoke test: drive src/mcp/server.js through a JSON-RPC handshake and
// exercise every tool. Exits non-zero on the first failure.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER = path.join(__dirname, 'server.js');
const LOG_FILE = path.join(__dirname, '..', 'logs.txt');

let nextId = 1;
const pending = new Map();
let buffer = '';
const failures = [];

const proc = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
proc.stderr.on('data', (d) => process.stderr.write(d));
proc.stdout.on('data', (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); }
    catch (err) { console.error('bad json from server:', line); continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function assert(cond, label) {
  if (cond) {
    console.log(`  PASS ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

function textOf(resp) {
  return resp && resp.result && resp.result.content && resp.result.content[0] && resp.result.content[0].text || '';
}

async function call(name, args) {
  return send('tools/call', { name, arguments: args || {} });
}

async function main() {
  // clean log file before logging tests
  try { fs.unlinkSync(LOG_FILE); } catch (_) {}

  console.log('initialize');
  const init = await send('initialize', { protocolVersion: '2024-11-05', capabilities: {} });
  assert(init.result && init.result.serverInfo && init.result.serverInfo.name === 'acg', 'serverInfo.name = acg');
  assert(init.result && init.result.capabilities && init.result.capabilities.tools, 'capabilities.tools present');
  notify('notifications/initialized', {});

  console.log('tools/list');
  const list = await send('tools/list', {});
  const names = (list.result && list.result.tools || []).map((t) => t.name).sort();
  assert(JSON.stringify(names) === JSON.stringify(['list_langs', 'log', 'run']), `tools = ${JSON.stringify(names)}`);

  console.log('run bash');
  const r1 = await call('run', { lang: 'bash', code: 'echo hello-bash' });
  assert(textOf(r1).includes('hello-bash'), 'bash stdout includes hello-bash');
  assert(textOf(r1).includes('exitCode=0'), 'bash exitCode=0');

  console.log('run python');
  const r2 = await call('run', { lang: 'python', code: 'print(2+2)' });
  assert(textOf(r2).includes('4'), 'python prints 4');

  console.log('run node');
  const r3 = await call('run', { lang: 'node', code: 'console.log(typeof process)' });
  assert(textOf(r3).includes('object'), 'node typeof process = object');

  console.log('run with stdin');
  const r4 = await call('run', { lang: 'bash', code: 'cat', stdin: 'fed-via-stdin\n' });
  assert(textOf(r4).includes('fed-via-stdin'), 'stdin propagates to child');

  console.log('run timeout');
  const r5 = await call('run', { lang: 'bash', code: 'sleep 5', timeout_ms: 200 });
  assert(textOf(r5).includes('timeout after 200ms'), 'timeout fires and is labeled');
  assert(r5.result && r5.result.isError === true, 'timeout flagged isError');

  console.log('run unknown lang');
  const r6 = await call('run', { lang: 'cobol', code: 'whatever' });
  assert(r6.result && r6.result.isError === true, 'unknown lang flagged isError');
  assert(textOf(r6).includes('unknown lang'), 'unknown lang surfaces message');

  console.log('list_langs');
  const r7 = await call('list_langs', {});
  assert(textOf(r7).includes('bash'), 'list_langs includes bash');
  assert(textOf(r7).includes('python'), 'list_langs includes python');

  console.log('log');
  const r8 = await call('log', { entry: 'smoke-test-entry' });
  assert(textOf(r8).includes('appended'), 'log reports bytes appended');
  const logged = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
  assert(logged.includes('smoke-test-entry'), 'log file contains entry body');
  let parsed = null;
  try { parsed = JSON.parse(logged.trim().split('\n').pop()); } catch (_) {}
  assert(parsed && parsed.time && parsed.body === 'smoke-test-entry', 'log line is valid JSON {time, body}');

  console.log('ping');
  const r9 = await send('ping', {});
  assert(r9.result && Object.keys(r9.result).length === 0, 'ping returns {}');

  console.log('unknown method');
  const r10 = await send('does/not/exist', {});
  assert(r10.error && r10.error.code === -32601, 'unknown method returns -32601');

  proc.stdin.end();
  await new Promise((r) => proc.on('close', r));

  if (failures.length) {
    console.log(`\n${failures.length} FAILED:`);
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  } else {
    console.log('\nALL PASS');
  }
}

main().catch((err) => {
  console.error('test runner crashed:', err);
  try { proc.kill('SIGKILL'); } catch (_) {}
  process.exit(2);
});
