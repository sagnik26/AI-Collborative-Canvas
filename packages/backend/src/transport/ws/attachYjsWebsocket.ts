import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { createYjsWsController } from '../../controllers/yjsWsController.js';
import type { YjsCollabService } from '../../services/YjsCollabService.js';

export function attachYjsWebsocket(server: Server, collab: YjsCollabService) {
  const wss = new WebSocketServer({ server, path: '/yjs' });
  const handler = createYjsWsController(collab);
  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    handler(conn, req);
  });
  return wss;
}
