import type { TemplateFields, TemplateId } from '../types/template';

export const VISUAL_TEMPLATE_IDS: TemplateId[] = ['landing.v1'];

export const DEFAULT_LENGTH_TEMPLATE_FIELDS: TemplateFields = {
  heroBadge: 'Q2 Growth',
  heroHeadline: 'Improve cross-team delivery velocity with a repeatable metrics operating cadence',
  heroSubheadline:
    'Unify product, design, and engineering around measurable outcomes, decision logs, and rapid feedback loops.',
  heroPrimaryCta: 'Start rollout',
  heroSecondaryCta: 'Review benchmark',
  socialProofTitle: 'Trusted by outcome-driven teams',
  logos: ['Acme', 'Northstar', 'Helios', 'Radian', 'Summit', 'Atlas'],
  steps: [
    {
      title: 'Instrument',
      description: 'Capture baseline conversion, latency, and quality KPIs for every release train.',
    },
    {
      title: 'Prioritize',
      description: 'Sequence experiments by expected impact and confidence to reduce planning waste.',
    },
    {
      title: 'Scale',
      description: 'Promote winning playbooks to org standards and automate recurring reporting.',
    },
  ],
  mathTitle: 'Performance snapshot',
  mathFormula: 'Revenue lift = baseline x activation rate x retention improvement',
  mathFootnote: 'Last 90 days, normalized for seasonality.',
  finalCtaHeadline: 'Teams using this workflow ship faster with fewer production rollbacks.',
  finalCtaLabel: 'Book strategy session',
};

export const TEMPLATE_FIELDS_BY_ID: Partial<Record<TemplateId, TemplateFields>> = {
  'landing.v1': {
    heroBadge: 'DATA-DRIVEN INSIGHTS',
    heroHeadline: 'Unlock Your Growth Potential with Precision Analytics',
    heroSubheadline:
      'Transform complex datasets into actionable narratives. Our platform provides the editorial intelligence needed to make authoritative decisions in real-time.',
    heroPrimaryCta: 'Get Started Free',
    heroSecondaryCta: 'Request Demo',
    socialProofTitle: 'Trusted by',
    logos: ['TechCorp', 'SaaSPlus', 'Vortex.io', 'Documentation', 'Privacy', 'Security'],
    steps: [
      {
        title: 'Connect',
        description: 'Seamlessly integrate your existing data lakes with a single click.',
      },
      {
        title: 'Analyze',
        description: 'AI translates raw numbers into actionable editorial narratives.',
      },
      {
        title: 'Grow',
        description: 'Monitor the impact of decisions with high-fidelity tracking.',
      },
    ],
    mathTitle: 'Physics of Profitable Growth',
    mathFormula: 'Data + AI = Growth',
    mathFootnote: 'Q1 FY24 -> Projected',
    finalCtaHeadline: 'Analytica | Precise Intelligence for Modern Business',
    finalCtaLabel: 'Login',
  },
};

export function fixtureForTemplate(templateId: TemplateId): TemplateFields {
  return TEMPLATE_FIELDS_BY_ID[templateId] ?? DEFAULT_LENGTH_TEMPLATE_FIELDS;
}
