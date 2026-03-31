import { createRequire } from 'node:module';
import type * as Y from 'yjs';
import type { YjsPersistence } from 'y-websocket/bin/utils';
import type { DocRepository } from './DocRepository.js';

const require = createRequire(import.meta.url);
// Ensure we use the same Yjs instance as y-websocket (CJS) to avoid double-import issues.
const Yjs = require('yjs') as typeof Y;

export class YjsPersistenceRepository {
  constructor(private readonly repo: DocRepository) {}

  asYWebsocketPersistence(): YjsPersistence {
    return {
      provider: this.repo,
      bindState: async (docName, ydoc) => {
        const existing = await this.repo.load(docName);
        if (existing) {
          Yjs.applyUpdate(ydoc, existing);
        }

        ydoc.on('update', async () => {
          await this.repo.save(docName, Yjs.encodeStateAsUpdate(ydoc));
        });
      },
      writeState: async (docName, ydoc) => {
        await this.repo.save(docName, Yjs.encodeStateAsUpdate(ydoc));
      },
    };
  }
}
