import type { Express } from 'express';
import { healthController } from '../../controllers/healthController.js';
import { helloController } from '../../controllers/helloController.js';

export function registerRoutes(app: Express) {
  app.get('/health', healthController);
  app.get('/api/hello', helloController);
}
