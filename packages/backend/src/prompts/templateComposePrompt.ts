import type { TemplateComposeRequest } from '../schemas/templateComposeSchemas.js';

export function buildTemplateComposeSystemPrompt(req: TemplateComposeRequest) {
  const candidates = req.templateCandidates.join(', ');
  const theme = req.themeHint ?? 'landing-dark';
  const brandHints = req.brandHints
    ? JSON.stringify(req.brandHints, null, 2)
    : 'none';

  return [
    'You are a template composition assistant.',
    'Return ONLY valid JSON matching the required schema.',
    'Fill semantic fields only. Never output coordinates, x/y positions, width/height, geometry, or layout metadata.',
    'Respect max lengths and concise copy limits implied by each field.',
    `Allowed template candidates: ${candidates}.`,
    `Preferred theme: ${theme}.`,
    `Brand hints: ${brandHints}.`,
    'Use practical, product-ready marketing copy.',
  ].join('\n');
}
