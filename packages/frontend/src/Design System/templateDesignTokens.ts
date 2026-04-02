import type { TemplateId } from '../types/template';

export type TemplateTypeToken = {
  size: number;
  weight: number;
  lineHeight: number;
};

export type TemplateDesignTokens = {
  fontFamily: string;
  spacingScale: readonly number[];
  typeRamp: {
    display: TemplateTypeToken;
    h1: TemplateTypeToken;
    h2: TemplateTypeToken;
    body: TemplateTypeToken;
    caption: TemplateTypeToken;
    meta: TemplateTypeToken;
  };
  spacing: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  shadow: {
    none: null;
    low: { color: string; blur: number; offsetX: number; offsetY: number };
    medium: { color: string; blur: number; offsetX: number; offsetY: number };
  };
  colors: {
    surface: string;
    surfaceAlt: string;
    primary: string;
    accent: string;
    muted: string;
    border: string;
    textStrong: string;
    textMuted: string;
  };
  colorVariants: {
    transparent: string;
    textOnStrong: string;
    textSubtle: string;
    textInfo: string;
    textMutedAlt: string;
    borderStrong: string;
    borderSuccess: string;
    borderInfo: string;
  };
};

export const TEMPLATE_DESIGN_TOKENS: TemplateDesignTokens = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  spacingScale: [2, 4, 8, 12, 16, 20, 24],
  typeRamp: {
    display: { size: 44, weight: 700, lineHeight: 1.14 },
    h1: { size: 28, weight: 700, lineHeight: 1.16 },
    h2: { size: 18, weight: 700, lineHeight: 1.18 },
    body: { size: 14, weight: 500, lineHeight: 1.28 },
    caption: { size: 12, weight: 600, lineHeight: 1.24 },
    meta: { size: 11, weight: 500, lineHeight: 1.2 },
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    pill: 999,
  },
  shadow: {
    none: null,
    low: {
      color: 'rgba(15, 23, 42, 0.12)',
      blur: 8,
      offsetX: 0,
      offsetY: 3,
    },
    medium: {
      color: 'rgba(15, 23, 42, 0.16)',
      blur: 14,
      offsetX: 0,
      offsetY: 6,
    },
  },
  colors: {
    surface: 'rgba(255,255,255,0.98)',
    surfaceAlt: 'rgba(248,250,252,0.95)',
    primary: '#2563eb',
    accent: '#7c3aed',
    muted: '#cbd5e1',
    border: 'rgba(15,23,42,0.1)',
    textStrong: '#0f172a',
    textMuted: '#475569',
  },
  colorVariants: {
    transparent: 'rgba(255,255,255,0)',
    textOnStrong: '#ffffff',
    textSubtle: '#334155',
    textInfo: '#1e3a8a',
    textMutedAlt: '#64748b',
    borderStrong: 'rgba(15,23,42,0.14)',
    borderSuccess: 'rgba(5,150,105,0.2)',
    borderInfo: 'rgba(37,99,235,0.2)',
  },
};

export function typeTokenForSlot(
  slotId: string,
  templateId?: TemplateId,
): TemplateTypeToken {
  if (templateId === 'landing.v1' && slotId === 'slot:hero:headline') {
    return { size: 54, weight: 800, lineHeight: 1.08 };
  }
  if (templateId === 'landing.v1' && slotId === 'slot:hero:subheadline') {
    return { size: 22, weight: 500, lineHeight: 1.34 };
  }
  if (templateId === 'landing.v1' && slotId === 'slot:final:headline') {
    return { size: 16, weight: 700, lineHeight: 1.2 };
  }
  if (slotId === 'slot:hero:headline') return TEMPLATE_DESIGN_TOKENS.typeRamp.display;
  if (slotId === 'slot:hero:subheadline') {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.body, size: 21 };
  }
  if (slotId === 'slot:social:title') {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.caption, lineHeight: 1.15 };
  }
  if (slotId.startsWith('slot:steps:desc:')) {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.body, size: 13 };
  }
  if (slotId === 'slot:math:title') {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.body, weight: 700, lineHeight: 1.16 };
  }
  if (slotId === 'slot:math:formula') {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.body, size: 14, weight: 600, lineHeight: 1.18 };
  }
  if (slotId === 'slot:math:footnote') return TEMPLATE_DESIGN_TOKENS.typeRamp.meta;
  if (slotId === 'slot:final:headline') {
    return { ...TEMPLATE_DESIGN_TOKENS.typeRamp.h1, size: 38, weight: 700, lineHeight: 1.12 };
  }
  return TEMPLATE_DESIGN_TOKENS.typeRamp.body;
}

export function templateColorRoleForSlot(slot: {
  id: string;
  type: 'text' | 'pill' | 'box' | 'connector' | 'logo' | 'cta';
}) {
  if (slot.type === 'connector') return TEMPLATE_DESIGN_TOKENS.colors.muted;
  if (slot.id.includes(':cta:') || slot.id === 'slot:final:cta') return TEMPLATE_DESIGN_TOKENS.colors.accent;
  if (slot.type === 'pill') return TEMPLATE_DESIGN_TOKENS.colors.primary;
  if (slot.type === 'logo') return TEMPLATE_DESIGN_TOKENS.colors.surface;
  if (slot.id === 'slot:hero:visual') return TEMPLATE_DESIGN_TOKENS.colors.surfaceAlt;
  if (slot.id === 'slot:math:box') return TEMPLATE_DESIGN_TOKENS.colors.surfaceAlt;
  if (slot.type === 'box') return TEMPLATE_DESIGN_TOKENS.colors.surface;
  return TEMPLATE_DESIGN_TOKENS.colors.border;
}

export function canvasColorForTemplateSlot(slot: {
  id: string;
  type: 'text' | 'pill' | 'box' | 'connector' | 'logo' | 'cta';
}) {
  if (slot.type === 'connector') return 'rgba(148, 163, 184, 0.75)';
  if (slot.id.includes(':cta:') || slot.id === 'slot:final:cta') return TEMPLATE_DESIGN_TOKENS.colors.accent;
  if (slot.type === 'pill') return '#1d4ed8';
  if (slot.type === 'logo') return 'rgba(255,255,255,0.05)';
  if (slot.id === 'slot:hero:visual') return 'rgba(16, 185, 129, 0.18)';
  if (slot.id === 'slot:math:box') return 'rgba(59, 130, 246, 0.16)';
  if (slot.type === 'box') return 'rgba(255,255,255,0.04)';
  return '#f3f4f6';
}

export function fabricColorForTemplateSlot(slot: {
  id: string;
  type: 'text' | 'pill' | 'box' | 'connector' | 'logo' | 'cta';
}, templateId?: TemplateId) {
  if (templateId === 'landing.v1') {
    if (slot.type === 'connector') return 'rgba(11, 31, 74, 0.28)';
    if (slot.id.includes(':cta:')) return '#0d47a1';
    if (slot.id === 'slot:final:cta') return '#f2f4f6';
    if (slot.type === 'pill') return '#94f0df';
    if (slot.type === 'logo') return 'rgba(255,255,255,0.9)';
    if (slot.id === 'slot:hero:visual') return '#eef2f7';
    if (slot.id === 'slot:math:box') return '#f7f9fb';
    if (slot.type === 'box') return '#f7f9fb';
    return '#d8dee8';
  }
  if (slot.type === 'connector') return 'rgba(71, 85, 105, 0.85)';
  if (slot.id.includes(':cta:') || slot.id === 'slot:final:cta') return '#6d28d9';
  if (slot.type === 'pill') return TEMPLATE_DESIGN_TOKENS.colors.primary;
  if (slot.type === 'logo') return 'rgba(255,255,255,0.96)';
  if (slot.id === 'slot:hero:visual') return 'rgba(16, 185, 129, 0.12)';
  if (slot.id === 'slot:math:box') return 'rgba(59, 130, 246, 0.1)';
  if (slot.type === 'box') return TEMPLATE_DESIGN_TOKENS.colors.surfaceAlt;
  return '#e5e7eb';
}

export function textColorForTemplateSlot(
  slotId: string,
  templateId?: TemplateId,
) {
  if (templateId === 'landing.v1') {
    if (slotId === 'slot:hero:headline') return '#191c1e';
    if (slotId === 'slot:hero:subheadline') return '#434652';
    if (slotId === 'slot:hero:badge') return '#005047';
    if (slotId === 'slot:social:title' || slotId === 'slot:math:footnote') return '#737783';
    if (slotId === 'slot:math:title') return '#11278e';
    if (slotId === 'slot:math:formula') return '#191c1e';
    if (slotId === 'slot:final:headline') return '#003178';
    if (slotId === 'slot:final:cta') return '#003178';
  }
  if (slotId === 'slot:hero:headline' || slotId === 'slot:final:headline') {
    return TEMPLATE_DESIGN_TOKENS.colors.textStrong;
  }
  if (slotId === 'slot:hero:subheadline' || slotId.startsWith('slot:steps:desc:')) {
    return TEMPLATE_DESIGN_TOKENS.colorVariants.textSubtle;
  }
  if (slotId === 'slot:social:title' || slotId === 'slot:math:footnote') {
    return TEMPLATE_DESIGN_TOKENS.colorVariants.textMutedAlt;
  }
  if (slotId === 'slot:math:title') return TEMPLATE_DESIGN_TOKENS.colorVariants.textInfo;
  if (slotId === 'slot:math:formula') return TEMPLATE_DESIGN_TOKENS.colors.textStrong;
  return TEMPLATE_DESIGN_TOKENS.colors.textStrong;
}

export function borderColorForTemplateSlot(slot: {
  id: string;
  type: 'text' | 'pill' | 'box' | 'connector' | 'logo' | 'cta';
}, templateId?: TemplateId) {
  if (templateId === 'landing.v1') {
    if (slot.type === 'logo') return 'rgba(67, 70, 82, 0.1)';
    if (slot.type === 'pill') return 'rgba(255,255,255,0)';
    if (slot.id.includes(':cta:')) return 'rgba(255,255,255,0)';
    if (slot.id === 'slot:final:cta') return 'rgba(67, 70, 82, 0.12)';
    if (slot.id === 'slot:hero:visual' || slot.id === 'slot:math:box') return 'rgba(67, 70, 82, 0.14)';
    return 'rgba(67, 70, 82, 0.12)';
  }
  if (slot.type === 'logo') return TEMPLATE_DESIGN_TOKENS.colorVariants.borderStrong;
  if (slot.id === 'slot:hero:visual') return TEMPLATE_DESIGN_TOKENS.colorVariants.borderSuccess;
  if (slot.id === 'slot:math:box') return TEMPLATE_DESIGN_TOKENS.colorVariants.borderInfo;
  if (slot.type === 'pill' || slot.type === 'cta') return TEMPLATE_DESIGN_TOKENS.colorVariants.transparent;
  return TEMPLATE_DESIGN_TOKENS.colors.border;
}
