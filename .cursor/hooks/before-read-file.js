#!/usr/bin/env node
/**
 * Before reading a file: warn if it looks like a secret/env file.
 */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.path || input.file || '';
    if (/\.(env|key|pem)$|\.env\.|credentials|secret/i.test(filePath)) {
      console.error('[MODA] WARNING: Reading sensitive file: ' + filePath);
      console.error('[MODA] Ensure secrets are not exposed in outputs');
    }
  } catch {}
  process.stdout.write(data);
});
