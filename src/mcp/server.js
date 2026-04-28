#!/usr/bin/env node
// acg MCP server — JSON-RPC 2.0 over stdio, zero deps.
// Tools: run, log, list_langs.

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_NAME = 'acg';
const SERVER_VERSION = '0.1.0';
const LOG_FILE = path.join(__dirname, '..', 'logs.txt');

const RUNNERS = {
  bash:       { ext: '.sh',   exec: (f) => ['bash',    [f]] },
  sh:         { ext: '.sh',   exec: (f) => ['sh',      [f]] },
  python:     { ext: '.py',   exec: (f) => ['python3', [f]] },
  python3:    { ext: '.py',   exec: (f) => ['python3', [f]] },
  node:       { ext: '.js',   exec: (f) => ['node',    [f]] },
  js:         { ext: '.js',   exec: (f) => ['node',    [f]] },
  javascript: { ext: '.js',   exec: (f) => ['node',    [f]] },
  ruby:       { ext: '.rb',   exec: (f) => ['ruby',    [f]] },
  perl:       { ext: '.pl',   exec: (f) => ['perl',    [f]] },
  php:        { ext: '.php',  exec: (f) => ['php',     [f]] },
  deno:       { ext: '.ts',   exec: (f) => ['deno',    ['run', '-A', f]] },
  go:         { ext: '.go',   exec: (f) => ['go',      ['run', f]] },
  awk:        { ext: '.awk',  exec: (f) => ['awk',     ['-f', f]] },
  lua:        { ext: '.lua',  exec: (f) => ['lua',     [f]] },
};

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

function runTool({ lang, code, stdin, timeout_ms }) {
  return new Promise((resolve) => {
    if (typeof lang !== 'string' || !RUNNERS[lang]) {
      resolve({
        text: `unknown lang: ${JSON.stringify(lang)}\nknown: ${Object.keys(RUNNERS).join(', ')}`,
        isError: true,
      });
      return;
    }
    if (typeof code !== 'string' || code.length === 0) {
      resolve({ text: 'code must be a non-empty string', isError: true });
      return;
    }
    const timeout = Number.isFinite(timeout_ms) && timeout_ms > 0 ? timeout_ms : 10000;
    const r = RUNNERS[lang];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acg-mcp-'));
    const file = path.join(dir, 'snippet' + r.ext);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let proc;

    const cleanup = () => rmrf(dir);

    try {
      fs.writeFileSync(file, code);
      const [cmd, args] = r.exec(file);
      proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      const killer = setTimeout(() => {
        timedOut = true;
        try { proc.kill('SIGKILL'); } catch (_) {}
      }, timeout);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('error', (err) => {
        clearTimeout(killer);
        cleanup();
        resolve({
          text: `$ ${cmd} ${args.join(' ')}\nspawn error: ${err.message}`,
          isError: true,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(killer);
        cleanup();
        const header = `$ ${cmd} ${args.join(' ')}\nexitCode=${code}${timedOut ? ` (timeout after ${timeout}ms)` : ''}`;
        const text = `${header}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`;
        resolve({ text, isError: code !== 0 || timedOut });
      });

      if (typeof stdin === 'string' && stdin.length > 0) {
        proc.stdin.write(stdin);
      }
      proc.stdin.end();
    } catch (err) {
      cleanup();
      resolve({ text: `internal error: ${err.message}`, isError: true });
    }
  });
}

function logTool({ entry }) {
  if (typeof entry !== 'string') {
    return { text: 'entry must be a string', isError: true };
  }
  const line = JSON.stringify({ time: new Date().toISOString(), body: entry }) + '\n';
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, line);
  return { text: `appended ${Buffer.byteLength(line)} bytes to ${LOG_FILE}` };
}

function listLangsTool() {
  return { text: Object.keys(RUNNERS).join(', ') };
}

const TOOLS = [
  {
    name: 'run',
    description: 'Run a code snippet in any supported language. Writes the snippet to a temp file and shells out to the matching interpreter. Captures stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object',
      properties: {
        lang: { type: 'string', description: 'Language key. Use list_langs to enumerate.' },
        code: { type: 'string', description: 'Source code to execute.' },
        stdin: { type: 'string', description: 'Optional standard input.' },
        timeout_ms: { type: 'number', description: 'Kill after this many ms (default 10000).' },
      },
      required: ['lang', 'code'],
    },
    handler: runTool,
  },
  {
    name: 'log',
    description: 'Append a single JSON line {time, body} to src/logs.txt.',
    inputSchema: {
      type: 'object',
      properties: {
        entry: { type: 'string', description: 'Free-form log body.' },
      },
      required: ['entry'],
    },
    handler: logTool,
  },
  {
    name: 'list_langs',
    description: 'List the language keys recognised by the run tool.',
    inputSchema: { type: 'object', properties: {} },
    handler: listLangsTool,
  },
];

const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function diag(msg) {
  process.stderr.write(`[${SERVER_NAME}-mcp] ${msg}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: (params && params.protocolVersion) || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return; // notification — no response
  }

  if (method === 'ping') {
    reply(id, {});
    return;
  }

  if (method === 'tools/list') {
    reply(id, {
      tools: TOOLS.map(({ handler, ...t }) => t),
    });
    return;
  }

  if (method === 'tools/call') {
    const name = params && params.name;
    const tool = TOOL_BY_NAME[name];
    if (!tool) {
      reply(id, {
        content: [{ type: 'text', text: `unknown tool: ${name}` }],
        isError: true,
      });
      return;
    }
    try {
      const out = await tool.handler((params && params.arguments) || {});
      reply(id, {
        content: [{ type: 'text', text: out.text }],
        isError: !!out.isError,
      });
    } catch (err) {
      reply(id, {
        content: [{ type: 'text', text: `tool threw: ${err && err.message ? err.message : String(err)}` }],
        isError: true,
      });
    }
    return;
  }

  if (id !== undefined) {
    replyError(id, -32601, `Method not found: ${method}`);
  }
}

diag(`starting ${SERVER_NAME} v${SERVER_VERSION}`);

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (err) {
    diag(`bad json on stdin: ${err.message}`);
    return;
  }
  Promise.resolve(handle(msg)).catch((err) => diag(`handler error: ${err.message}`));
});
rl.on('close', () => process.exit(0));
