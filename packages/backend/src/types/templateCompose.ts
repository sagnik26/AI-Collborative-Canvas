import type { z } from 'zod';
import {
  templateComposeEventSchema,
  templateComposeModelResponseSchema,
  templateComposeRequestSchema,
} from '../schemas/templateComposeSchemas.js';
import { templateComposeStreamLineSchema } from '../schemas/templateComposeStreamSchemas.js';

export type TemplateComposeRequest = z.infer<typeof templateComposeRequestSchema>;
export type TemplateComposeModelResponse = z.infer<
  typeof templateComposeModelResponseSchema
>;
export type TemplateComposeEvent = z.infer<typeof templateComposeEventSchema>;

export type TemplateComposeStreamLine = z.infer<
  typeof templateComposeStreamLineSchema
>;

