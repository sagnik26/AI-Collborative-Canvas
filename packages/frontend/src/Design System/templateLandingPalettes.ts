import { TEMPLATE_THEMES_BY_PACK } from '../constants/templateRegistry';

export type LandingV1Theme = (typeof TEMPLATE_THEMES_BY_PACK)['landing.v1'][number];

/**
 * All landing.v1 Fabric/HTML colors for one hue family. Surfaces stay light; text stays dark on light
 * fills; CTA fills are saturated with {@link textOnCta} on top for contrast.
 */
export type LandingV1Palette = {
  connector: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaFinal: string;
  pillHeroBadge: string;
  pillStep: string;
  pillDefault: string;
  heroVisual: string;
  mathBox: string;
  stepCardBg: string;
  boxSurface: string;
  pageWash: string;
  textHeroHeadline: string;
  textHeroSub: string;
  textBadge: string;
  textSocial: string;
  textStepPill: string;
  textStepDesc: string;
  textLogo: string;
  textMathTitle: string;
  textMathFormula: string;
  textMathFootnote: string;
  textFinalHeadline: string;
  textOnCta: string;
  borderHeroBadge: string;
  borderStepPill: string;
  borderPill: string;
  borderHeroVisual: string;
  borderMathBox: string;
  borderStepCard: string;
  borderDefault: string;
  shadowCta: string;
  shadowStepCard: string;
};

export const LANDING_V1_PALETTES: Record<LandingV1Theme, LandingV1Palette> = {
  'landing-dark': {
    connector: 'rgba(12, 86, 208, 0.34)',
    ctaPrimary: '#0c56d0',
    ctaSecondary: '#003d9b',
    ctaFinal: '#0a4ab8',
    pillHeroBadge: '#e3ebff',
    pillStep: '#edf3ff',
    pillDefault: '#dae2fd',
    heroVisual: '#eff4ff',
    mathBox: '#eaf2ff',
    stepCardBg: '#ffffff',
    boxSurface: '#f8f9ff',
    pageWash: '#e6edff',
    textHeroHeadline: '#0b1c30',
    textHeroSub: '#565e74',
    textBadge: '#1d4ed8',
    textSocial: '#5a6782',
    textStepPill: '#0f172a',
    textStepDesc: '#26344f',
    textLogo: '#4b5f7a',
    textMathTitle: '#27406b',
    textMathFormula: '#142b52',
    textMathFootnote: '#3f567e',
    textFinalHeadline: '#0d1f3d',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(12, 86, 208, 0.14)',
    borderStepPill: '#e2e8f0',
    borderPill: 'rgba(12, 86, 208, 0.1)',
    borderHeroVisual: 'rgba(12, 86, 208, 0.12)',
    borderMathBox: 'rgba(12, 86, 208, 0.16)',
    borderStepCard: 'rgba(12, 86, 208, 0.12)',
    borderDefault: 'rgba(12, 86, 208, 0.1)',
    shadowCta: 'rgba(12, 86, 208, 0.34)',
    shadowStepCard: 'rgba(15, 33, 74, 0.09)',
  },
  'landing-slate': {
    connector: 'rgba(71, 85, 105, 0.34)',
    ctaPrimary: '#334155',
    ctaSecondary: '#1e293b',
    ctaFinal: '#0f172a',
    pillHeroBadge: '#f1f5f9',
    pillStep: '#e8eef4',
    pillDefault: '#e2e8f0',
    heroVisual: '#f8fafc',
    mathBox: '#f1f5f9',
    stepCardBg: '#ffffff',
    boxSurface: '#f8fafc',
    pageWash: '#e2e8f0',
    textHeroHeadline: '#0f172a',
    textHeroSub: '#475569',
    textBadge: '#334155',
    textSocial: '#64748b',
    textStepPill: '#0f172a',
    textStepDesc: '#1e293b',
    textLogo: '#475569',
    textMathTitle: '#1e293b',
    textMathFormula: '#0f172a',
    textMathFootnote: '#475569',
    textFinalHeadline: '#0f172a',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(51, 65, 85, 0.16)',
    borderStepPill: '#e2e8f0',
    borderPill: 'rgba(51, 65, 85, 0.12)',
    borderHeroVisual: 'rgba(51, 65, 85, 0.12)',
    borderMathBox: 'rgba(51, 65, 85, 0.16)',
    borderStepCard: 'rgba(51, 65, 85, 0.12)',
    borderDefault: 'rgba(51, 65, 85, 0.1)',
    shadowCta: 'rgba(30, 41, 59, 0.3)',
    shadowStepCard: 'rgba(15, 23, 42, 0.09)',
  },
  'landing-emerald': {
    connector: 'rgba(5, 150, 105, 0.34)',
    ctaPrimary: '#059669',
    ctaSecondary: '#047857',
    ctaFinal: '#065f46',
    pillHeroBadge: '#d1fae5',
    pillStep: '#ecfdf5',
    pillDefault: '#a7f3d0',
    heroVisual: '#ecfdf5',
    mathBox: '#d1fae5',
    stepCardBg: '#ffffff',
    boxSurface: '#f0fdf4',
    pageWash: '#dcfce7',
    textHeroHeadline: '#064e3b',
    textHeroSub: '#047857',
    textBadge: '#059669',
    textSocial: '#0f766e',
    textStepPill: '#064e3b',
    textStepDesc: '#115e59',
    textLogo: '#0f766e',
    textMathTitle: '#115e59',
    textMathFormula: '#064e3b',
    textMathFootnote: '#0d9488',
    textFinalHeadline: '#064e3b',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(5, 150, 105, 0.18)',
    borderStepPill: '#bbf7d0',
    borderPill: 'rgba(5, 150, 105, 0.12)',
    borderHeroVisual: 'rgba(5, 150, 105, 0.12)',
    borderMathBox: 'rgba(5, 150, 105, 0.16)',
    borderStepCard: 'rgba(5, 150, 105, 0.12)',
    borderDefault: 'rgba(5, 150, 105, 0.1)',
    shadowCta: 'rgba(5, 150, 105, 0.32)',
    shadowStepCard: 'rgba(6, 78, 59, 0.08)',
  },
  'landing-rose': {
    connector: 'rgba(225, 29, 72, 0.32)',
    ctaPrimary: '#e11d48',
    ctaSecondary: '#be123c',
    ctaFinal: '#9f1239',
    pillHeroBadge: '#ffe4e6',
    pillStep: '#fff1f2',
    pillDefault: '#fecdd3',
    heroVisual: '#fff1f2',
    mathBox: '#ffe4e6',
    stepCardBg: '#ffffff',
    boxSurface: '#fff1f2',
    pageWash: '#fecdd3',
    textHeroHeadline: '#881337',
    textHeroSub: '#9f1239',
    textBadge: '#be123c',
    textSocial: '#be123c',
    textStepPill: '#881337',
    textStepDesc: '#9f1239',
    textLogo: '#be123c',
    textMathTitle: '#9f1239',
    textMathFormula: '#881337',
    textMathFootnote: '#be123c',
    textFinalHeadline: '#881337',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(225, 29, 72, 0.16)',
    borderStepPill: '#fecdd3',
    borderPill: 'rgba(225, 29, 72, 0.12)',
    borderHeroVisual: 'rgba(225, 29, 72, 0.12)',
    borderMathBox: 'rgba(225, 29, 72, 0.16)',
    borderStepCard: 'rgba(225, 29, 72, 0.12)',
    borderDefault: 'rgba(225, 29, 72, 0.1)',
    shadowCta: 'rgba(190, 18, 60, 0.3)',
    shadowStepCard: 'rgba(136, 19, 55, 0.08)',
  },
  'landing-amber': {
    connector: 'rgba(217, 119, 6, 0.32)',
    ctaPrimary: '#d97706',
    ctaSecondary: '#b45309',
    ctaFinal: '#92400e',
    pillHeroBadge: '#fef3c7',
    pillStep: '#fffbeb',
    pillDefault: '#fde68a',
    heroVisual: '#fffbeb',
    mathBox: '#fef3c7',
    stepCardBg: '#ffffff',
    boxSurface: '#fffbeb',
    pageWash: '#fde68a',
    textHeroHeadline: '#78350f',
    textHeroSub: '#92400e',
    textBadge: '#b45309',
    textSocial: '#a16207',
    textStepPill: '#78350f',
    textStepDesc: '#92400e',
    textLogo: '#a16207',
    textMathTitle: '#92400e',
    textMathFormula: '#78350f',
    textMathFootnote: '#b45309',
    textFinalHeadline: '#78350f',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(217, 119, 6, 0.2)',
    borderStepPill: '#fcd34d',
    borderPill: 'rgba(217, 119, 6, 0.14)',
    borderHeroVisual: 'rgba(217, 119, 6, 0.14)',
    borderMathBox: 'rgba(217, 119, 6, 0.18)',
    borderStepCard: 'rgba(217, 119, 6, 0.14)',
    borderDefault: 'rgba(217, 119, 6, 0.12)',
    shadowCta: 'rgba(180, 83, 9, 0.3)',
    shadowStepCard: 'rgba(120, 53, 15, 0.08)',
  },
  'landing-violet': {
    connector: 'rgba(124, 58, 237, 0.32)',
    ctaPrimary: '#7c3aed',
    ctaSecondary: '#6d28d9',
    ctaFinal: '#5b21b6',
    pillHeroBadge: '#ede9fe',
    pillStep: '#f5f3ff',
    pillDefault: '#ddd6fe',
    heroVisual: '#f5f3ff',
    mathBox: '#ede9fe',
    stepCardBg: '#ffffff',
    boxSurface: '#faf5ff',
    pageWash: '#e9d5ff',
    textHeroHeadline: '#4c1d95',
    textHeroSub: '#5b21b6',
    textBadge: '#6d28d9',
    textSocial: '#6d28d9',
    textStepPill: '#4c1d95',
    textStepDesc: '#5b21b6',
    textLogo: '#6d28d9',
    textMathTitle: '#5b21b6',
    textMathFormula: '#4c1d95',
    textMathFootnote: '#7c3aed',
    textFinalHeadline: '#4c1d95',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(124, 58, 237, 0.16)',
    borderStepPill: '#ddd6fe',
    borderPill: 'rgba(124, 58, 237, 0.12)',
    borderHeroVisual: 'rgba(124, 58, 237, 0.12)',
    borderMathBox: 'rgba(124, 58, 237, 0.16)',
    borderStepCard: 'rgba(124, 58, 237, 0.12)',
    borderDefault: 'rgba(124, 58, 237, 0.1)',
    shadowCta: 'rgba(109, 40, 217, 0.32)',
    shadowStepCard: 'rgba(76, 29, 149, 0.08)',
  },
  'landing-teal': {
    connector: 'rgba(13, 148, 136, 0.34)',
    ctaPrimary: '#0d9488',
    ctaSecondary: '#0f766e',
    ctaFinal: '#115e59',
    pillHeroBadge: '#ccfbf1',
    pillStep: '#f0fdfa',
    pillDefault: '#99f6e4',
    heroVisual: '#f0fdfa',
    mathBox: '#ccfbf1',
    stepCardBg: '#ffffff',
    boxSurface: '#f0fdfa',
    pageWash: '#99f6e4',
    textHeroHeadline: '#134e4a',
    textHeroSub: '#115e59',
    textBadge: '#0f766e',
    textSocial: '#0f766e',
    textStepPill: '#134e4a',
    textStepDesc: '#115e59',
    textLogo: '#0f766e',
    textMathTitle: '#115e59',
    textMathFormula: '#134e4a',
    textMathFootnote: '#0d9488',
    textFinalHeadline: '#134e4a',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(13, 148, 136, 0.18)',
    borderStepPill: '#5eead4',
    borderPill: 'rgba(13, 148, 136, 0.12)',
    borderHeroVisual: 'rgba(13, 148, 136, 0.12)',
    borderMathBox: 'rgba(13, 148, 136, 0.16)',
    borderStepCard: 'rgba(13, 148, 136, 0.12)',
    borderDefault: 'rgba(13, 148, 136, 0.1)',
    shadowCta: 'rgba(15, 118, 110, 0.32)',
    shadowStepCard: 'rgba(19, 78, 74, 0.08)',
  },
  'landing-crimson': {
    connector: 'rgba(220, 38, 38, 0.32)',
    ctaPrimary: '#dc2626',
    ctaSecondary: '#b91c1c',
    ctaFinal: '#991b1b',
    pillHeroBadge: '#fee2e2',
    pillStep: '#fef2f2',
    pillDefault: '#fecaca',
    heroVisual: '#fef2f2',
    mathBox: '#fee2e2',
    stepCardBg: '#ffffff',
    boxSurface: '#fef2f2',
    pageWash: '#fecaca',
    textHeroHeadline: '#7f1d1d',
    textHeroSub: '#991b1b',
    textBadge: '#b91c1c',
    textSocial: '#b91c1c',
    textStepPill: '#7f1d1d',
    textStepDesc: '#991b1b',
    textLogo: '#b91c1c',
    textMathTitle: '#991b1b',
    textMathFormula: '#7f1d1d',
    textMathFootnote: '#dc2626',
    textFinalHeadline: '#7f1d1d',
    textOnCta: '#ffffff',
    borderHeroBadge: 'rgba(220, 38, 38, 0.16)',
    borderStepPill: '#fecaca',
    borderPill: 'rgba(220, 38, 38, 0.12)',
    borderHeroVisual: 'rgba(220, 38, 38, 0.12)',
    borderMathBox: 'rgba(220, 38, 38, 0.16)',
    borderStepCard: 'rgba(220, 38, 38, 0.12)',
    borderDefault: 'rgba(220, 38, 38, 0.1)',
    shadowCta: 'rgba(185, 28, 28, 0.3)',
    shadowStepCard: 'rgba(127, 29, 29, 0.08)',
  },
};

export function isLandingV1Theme(theme: string): theme is LandingV1Theme {
  return (TEMPLATE_THEMES_BY_PACK['landing.v1'] as readonly string[]).includes(theme);
}

export function landingV1PaletteForTheme(theme: string | undefined): LandingV1Palette {
  if (theme && isLandingV1Theme(theme)) {
    return LANDING_V1_PALETTES[theme];
  }
  return LANDING_V1_PALETTES['landing-dark'];
}

export type LandingSlotRef = {
  id: string;
  type: 'text' | 'pill' | 'box' | 'connector' | 'logo' | 'cta';
};

export function landingFabricFillForSlot(palette: LandingV1Palette, slot: LandingSlotRef): string {
  if (slot.type === 'connector') return palette.connector;
  if (slot.id === 'slot:hero:cta:primary') return palette.ctaPrimary;
  if (slot.id === 'slot:hero:cta:secondary') return palette.ctaSecondary;
  if (slot.id === 'slot:final:cta') return palette.ctaFinal;
  if (slot.type === 'pill' && slot.id === 'slot:hero:badge') return palette.pillHeroBadge;
  if (slot.type === 'pill' && slot.id.startsWith('slot:steps:pill:')) return palette.pillStep;
  if (slot.type === 'pill') return palette.pillDefault;
  if (slot.type === 'logo') return 'rgba(255,255,255,0)';
  if (slot.id === 'slot:hero:visual') return palette.heroVisual;
  if (slot.id === 'slot:math:box') return palette.mathBox;
  if (slot.id.startsWith('slot:steps:desc:')) return palette.stepCardBg;
  if (slot.type === 'box') return palette.boxSurface;
  return palette.pageWash;
}

export function landingTextColorForSlotId(palette: LandingV1Palette, slotId: string): string {
  if (slotId === 'slot:hero:headline') return palette.textHeroHeadline;
  if (slotId === 'slot:hero:subheadline') return palette.textHeroSub;
  if (slotId === 'slot:hero:badge') return palette.textBadge;
  if (slotId === 'slot:social:title') return palette.textSocial;
  if (slotId.startsWith('slot:steps:pill:')) return palette.textStepPill;
  if (slotId.startsWith('slot:steps:desc:')) return palette.textStepDesc;
  if (slotId.startsWith('slot:logo:')) return palette.textLogo;
  if (slotId === 'slot:math:title') return palette.textMathTitle;
  if (slotId === 'slot:math:formula') return palette.textMathFormula;
  if (slotId === 'slot:math:footnote') return palette.textMathFootnote;
  if (slotId === 'slot:final:headline') return palette.textFinalHeadline;
  if (slotId === 'slot:final:cta') return palette.textOnCta;
  return palette.textHeroHeadline;
}

export function landingBorderColorForSlot(palette: LandingV1Palette, slot: LandingSlotRef): string {
  if (slot.type === 'logo') return 'rgba(255,255,255,0)';
  if (slot.type === 'pill' && slot.id === 'slot:hero:badge') return palette.borderHeroBadge;
  if (slot.type === 'pill' && slot.id.startsWith('slot:steps:pill:')) return palette.borderStepPill;
  if (slot.type === 'pill') return palette.borderPill;
  if (slot.id.includes(':cta:') || slot.id === 'slot:final:cta') return 'rgba(255,255,255,0)';
  if (slot.id === 'slot:hero:visual') return palette.borderHeroVisual;
  if (slot.id === 'slot:math:box') return palette.borderMathBox;
  if (slot.id.startsWith('slot:steps:desc:')) return palette.borderStepCard;
  return palette.borderDefault;
}
