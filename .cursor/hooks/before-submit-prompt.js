#!/usr/bin/env node
/**
 * Before submitting a prompt: scan for accidentally pasted secrets.
 */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const prompt = input.prompt || input.content || input.message || '';
    const patterns = [
      /sk-ant-[a-zA-Z0-9-]{20,}/, // Anthropic API keys
      /sk-[a-zA-Z0-9]{20,}/, // OpenAI API keys
      /ghp_[a-zA-Z0-9]{36,}/, // GitHub PATs
      /AKIA[A-Z0-9]{16}/, // AWS access keys
      /xox[bpsa]-[a-zA-Z0-9-]+/, // Slack tokens
      /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
    ];
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        console.error('[MODA] WARNING: Potential secret detected in prompt!');
        console.error(
          '[MODA] Remove secrets before submitting. Use env vars instead.',
        );
        break;
      }
    }
  } catch {}
  process.stdout.write(data);
});
