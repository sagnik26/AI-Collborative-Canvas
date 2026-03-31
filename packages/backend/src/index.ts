import { createServer } from 'node:http';
import { setPersistence } from 'y-websocket/bin/utils';
import { InMemoryDocRepository } from './repositories/InMemoryDocRepository.js';
import { YjsPersistenceRepository } from './repositories/YjsPersistenceRepository.js';
import { YjsCollabService } from './services/YjsCollabService.js';
import { createApp } from './transport/http/createApp.js';
import { attachYjsWebsocket } from './transport/ws/attachYjsWebsocket.js';

const port = Number(process.env.PORT ?? 4000);

const app = createApp();
const server = createServer(app);

const docRepo = new InMemoryDocRepository();
const persistence = new YjsPersistenceRepository(
  docRepo,
).asYWebsocketPersistence();
setPersistence(persistence);

const collab = new YjsCollabService();
attachYjsWebsocket(server, collab);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Yjs WebSocket listening on ws://localhost:${port}/yjs`);
});
