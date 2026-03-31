import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

export class YjsCollabService {
  getDocName(req: IncomingMessage) {
    const url = new URL(req.url ?? '/yjs', 'http://localhost');
    return url.searchParams.get('doc') ?? 'default';
  }

  handleConnection(conn: WebSocket, req: IncomingMessage) {
    const docName = this.getDocName(req);
    setupWSConnection(conn, req, { docName });
  }
}
