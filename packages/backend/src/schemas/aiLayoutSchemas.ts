import { z } from 'zod';

export const canvasElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['rect', 'text', 'circle', 'image', 'line', 'arrow']),
  label: z.string().default(''),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fill: z.string().default('#000000'),
  rotation: z.number().default(0),
  zIndex: z.number().default(0),
});

export const aiLayoutRequestSchema = z
  .object({
    elements: z.array(canvasElementSchema).max(100),
    instruction: z.string().min(1).max(10_000),
    canvasWidth: z.number().positive().max(20_000),
    canvasHeight: z.number().positive().max(20_000),
    doc: z.string().min(1).optional().default('default'),
    mapName: z.string().min(1).optional().default('objects'),
  })
  .strict();

export const aiLayoutCreateSchema = z
  .object({
    kind: z.enum(['rect', 'circle', 'text', 'line', 'arrow']),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    label: z.string().default(''),
    fill: z.string().default('#000000'),
  })
  .strict();

export const aiLayoutResponseSchema = z
  .object({
    elements: z
      .array(
        z
          .object({
            id: z.string().min(1),
            x: z.number(),
            y: z.number(),
            width: z.number().positive(),
            height: z.number().positive(),
          })
          .strict(),
      )
      .max(100),
    creates: z.array(aiLayoutCreateSchema).max(20),
    reasoning: z.string().default(''),
  })
  .strict();

export type AiLayoutRequest = z.infer<typeof aiLayoutRequestSchema>;
export type AiLayoutResponse = z.infer<typeof aiLayoutResponseSchema>;
