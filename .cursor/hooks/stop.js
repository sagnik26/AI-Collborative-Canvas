#!/usr/bin/env node
/**
 * On stop: audit recent files for console.log statements.
 */
const { execSync } = require('child_process');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const result = execSync(
      'git diff --cached --name-only 2>/dev/null || git diff --name-only HEAD 2>/dev/null',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (result) {
      const tsFiles = result.split('\n').filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
      for (const file of tsFiles) {
        try {
          const content = require('fs').readFileSync(file, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (/console\.log\(/.test(line) && !/\/\/\s*debug|\/\/\s*TODO/.test(line)) {
              console.error(`[MODA] console.log found: ${file}:${i + 1}`);
            }
          });
        } catch {}
      }
    }
  } catch {}
  process.stdout.write(data);
});
