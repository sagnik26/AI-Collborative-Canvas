import type { z } from 'zod';
import {
  aiLayoutRequestSchema,
  aiLayoutResponseSchema,
} from '../schemas/aiLayoutSchemas.js';

export type AiLayoutRequest = z.infer<typeof aiLayoutRequestSchema>;
export type AiLayoutResponse = z.infer<typeof aiLayoutResponseSchema>;

