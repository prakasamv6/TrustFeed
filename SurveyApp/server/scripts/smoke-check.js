#!/usr/bin/env node

/*
 * Smoke check runner:
 * 1) Runs server tests
 * 2) Starts API server on an isolated port
 * 3) Verifies /api/health, /api/dataset-health, and /api/content/fetch contract
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '..');
const API_PORT = process.env.SMOKE_API_PORT || String(3200 + Math.floor(Math.random() * 400));
const BASE_URL = `http://127.0.0.1:${API_PORT}`;
const JSON_MODE = process.argv.includes('--json');

const summary = {
  ok: false,
  timestamp: new Date().toISOString(),
  apiPort: Number(API_PORT),
  steps: {
    tests: { ok: false },
    apiStart: { ok: false },
    endpointChecks: { ok: false },
  },
  endpoints: {
    health: null,
    datasetHealth: null,
    contentFetch: null,
  },
  errors: [],
};

function log(message) {
  if (!JSON_MODE) {
    console.log(message);
  }
}

function emitJsonAndExit(code) {
  if (JSON_MODE) {
    // Stable prefix helps CI parse the result from mixed logs.
    console.log(`SMOKE_RESULT_JSON:${JSON.stringify(summary)}`);
  }
  process.exit(code);
}

function runCommand(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });

    child.on('error', reject);
  });
}

function startServer() {
  const server = spawn('node', ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, API_PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  server.stdout.on('data', (chunk) => {
    process.stdout.write(chunk.toString());
  });

  server.stderr.on('data', (chunk) => {
    process.stderr.write(chunk.toString());
  });

  return server;
}

async function waitForApi(server, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`API process exited before readiness check (exit code ${server.exitCode})`);
    }
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch (_err) {
      // Keep retrying until timeout.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API did not become healthy within ${timeoutMs}ms`);
}

async function readJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${url} (${res.status})`);
  }
  return res.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runEndpointChecks() {
  const health = await readJson(`${BASE_URL}/api/health`);
  assert(health && health.status === 'ok', 'Health endpoint must return status=ok');
  assert(health.dataset, 'Health endpoint must include dataset payload');
  summary.endpoints.health = {
    status: health.status,
    database: health.database,
    datasetReady: Boolean(health?.dataset?.ready),
  };

  const datasetHealth = await readJson(`${BASE_URL}/api/dataset-health`);
  assert(datasetHealth && datasetHealth.dataset, 'Dataset health endpoint must return dataset payload');
  assert(datasetHealth.dataset.ready === true, 'Dataset must be ready for balanced session generation');
  assert(datasetHealth.dataset.requiredSessionSize === 14, 'Required session size must remain 14');
  assert(datasetHealth.dataset.mediaCounts?.text > 0, 'Dataset must include text content');
  assert(datasetHealth.dataset.mediaCounts?.image > 0, 'Dataset must include image content');
  assert(datasetHealth.dataset.mediaCounts?.video > 0, 'Dataset must include video content');
  summary.endpoints.datasetHealth = {
    status: datasetHealth.status,
    ready: datasetHealth.dataset.ready,
    requiredSessionSize: datasetHealth.dataset.requiredSessionSize,
    totalItems: datasetHealth.dataset.totalItems,
    mediaCounts: datasetHealth.dataset.mediaCounts,
    truthCounts: datasetHealth.dataset.truthCounts,
  };

  const content = await readJson(`${BASE_URL}/api/content/fetch?count=14`);
  assert(Array.isArray(content.items), 'Content fetch must return items array');
  assert(content.items.length === 14, 'Content fetch must return 14 items for count=14');
  summary.endpoints.contentFetch = {
    requestedCount: 14,
    actualCount: content.items.length,
    sourceCount: Array.isArray(content.sources) ? content.sources.length : 0,
  };

  for (const item of content.items) {
    assert(item.source && String(item.source).startsWith('dataset-'), 'Each item source must be dataset-backed');
    assert(!!item.continent, 'Each item must include continent metadata');
    assert(['text', 'image', 'video'].includes(item.contentType), 'Each item contentType must be text/image/video');
    assert(['ai', 'human'].includes(item.groundTruth), 'Each item groundTruth must be ai/human');
  }
}

async function shutdown(server) {
  if (!server || server.killed) return;

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: true,
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 5000);

    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    server.kill('SIGTERM');
  });
}

async function main() {
  let server;
  try {
    log('> Running server unit tests');
    await runCommand('npm', ['test'], SERVER_DIR);
    summary.steps.tests.ok = true;

    log(`> Starting API on port ${API_PORT} for smoke checks`);
    server = startServer();
    await waitForApi(server);
    summary.steps.apiStart.ok = true;

    log('> Verifying API health and dataset readiness contract');
    await runEndpointChecks();
    summary.steps.endpointChecks.ok = true;

    summary.ok = true;
    log('Smoke check passed: tests and endpoint contract are healthy.');
  } finally {
    await shutdown(server);
  }
}

async function run() {
  try {
    await main();
    emitJsonAndExit(0);
  } catch (err) {
    summary.ok = false;
    summary.errors.push(err?.message || String(err));
    if (!JSON_MODE) {
      console.error(`Smoke check failed: ${err?.message || String(err)}`);
    }
    emitJsonAndExit(1);
  }
}

run();
