#!/usr/bin/env node
/**
 * After shell execution: log build completions and PR URLs.
 */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    const cmd = String(input.command || input.args?.command || '');
    const output = String(input.output || input.result || '');

    if (/nx\s+(build|run-many.*build)|npm\s+run\s+build|pnpm\s+build/.test(cmd)) {
      console.error('[MODA] Build completed');
    }

    if (/\bgh\s+pr\s+create\b/.test(cmd)) {
      const m = output.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
      if (m) console.error('[MODA] PR created: ' + m[0]);
    }
  } catch {}
  process.stdout.write(data);
});
