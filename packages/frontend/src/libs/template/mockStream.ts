import type { TemplatePatch } from '../../types/template';

function normalizePrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ');
}

function buildPatches(prompt: string): TemplatePatch[] {
  const p = normalizePrompt(prompt);
  const headline =
    p.length > 0
      ? `Design concept: ${p}`
      : 'Launch faster with AI-powered creative workflows';

  return [
    {
      opId: 'mock-1',
      stage: 'meta_header',
      meta: { status: 'streaming' },
      fields: {
        heroBadge: 'BETA',
        heroHeadline: headline,
        heroSubheadline:
          'Template-first generation keeps layout deterministic while teams edit together in real-time.',
        heroPrimaryCta: 'Start free',
        heroSecondaryCta: 'Book demo',
        socialProofTitle: 'Trusted by teams shipping every week',
      },
    },
    {
      opId: 'mock-2',
      stage: 'steps',
      fields: {
        logos: ['Acme', 'Nimbus', 'Atlas', 'Arc', 'Pulse', 'Nova'],
        steps: [
          { title: 'Prompt', description: 'Capture message, audience, and offer.' },
          { title: 'Generate', description: 'Stream semantic patches into shared state.' },
          { title: 'Iterate', description: 'Polish copy with collaborators live.' },
        ],
      },
    },
    {
      opId: 'mock-3',
      stage: 'math',
      fields: {
        mathTitle: 'Expected output gain',
        mathFormula: '4 campaigns x 2 hrs saved each = 8 hrs saved/week',
        mathFootnote: 'Estimated from deterministic template composition.',
        finalCtaHeadline: 'Ship your next landing page in minutes',
        finalCtaLabel: 'Generate now',
      },
    },
    {
      opId: 'mock-4',
      stage: 'complete',
      meta: { status: 'complete' },
    },
  ];
}

export function startMockTemplateStream(opts: {
  prompt: string;
  onPatch: (patch: TemplatePatch) => void;
  onError?: (message: string) => void;
}) {
  const patches = buildPatches(opts.prompt);
  const timers: number[] = [];

  patches.forEach((patch, index) => {
    const timer = window.setTimeout(() => {
      try {
        opts.onPatch(patch);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'mock stream failed';
        opts.onError?.(msg);
      }
    }, index * 700);
    timers.push(timer);
  });

  return () => {
    timers.forEach((t) => window.clearTimeout(t));
  };
}
