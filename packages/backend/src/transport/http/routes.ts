import type { Express } from 'express';
import { aiLayoutController } from '../../controllers/aiLayoutController.js';
import { healthController } from '../../controllers/healthController.js';
import { templateComposeController } from '../../controllers/templateComposeController.js';

export function registerRoutes(app: Express) {
  app.get('/health', healthController);
  app.post('/ai/layout', aiLayoutController);
  app.post('/ai/compose-template', templateComposeController);
}
