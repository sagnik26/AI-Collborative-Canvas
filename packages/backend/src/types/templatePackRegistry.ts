import { TEMPLATE_THEMES_BY_PACK } from '../constants/templatePackRegistry.js';

export type TemplatePackId = keyof typeof TEMPLATE_THEMES_BY_PACK;
export type TemplatePackTheme = (typeof TEMPLATE_THEMES_BY_PACK)[TemplatePackId][number];

