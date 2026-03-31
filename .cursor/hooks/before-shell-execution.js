#!/usr/bin/env node
/**
 * Before shell execution:
 * - Block `npm run dev` / `nx serve` outside tmux (hangs the agent)
 * - Remind about tmux for long-running commands
 */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    const cmd = String(input.command || input.args?.command || '');

    const devPatterns = /\b(npm\s+run\s+(dev|start|serve)|pnpm\s+(dev|start|serve)|nx\s+serve)\b/;
    const isTmux = /^\s*tmux\s+/.test(cmd);

    if (devPatterns.test(cmd) && !isTmux && !process.env.TMUX) {
      console.error('[MODA] BLOCKED: Dev server must run in tmux to avoid hanging the agent');
      console.error('[MODA] Use: tmux new-session -d -s dev "nx serve canvas-fe"');
      process.exit(2);
    }
  } catch {}
  process.stdout.write(data);
});
