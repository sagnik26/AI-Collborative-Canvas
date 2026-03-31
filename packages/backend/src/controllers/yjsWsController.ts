import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { YjsCollabService } from "../services/YjsCollabService.js";

export function createYjsWsController(collab: YjsCollabService) {
  return (conn: WebSocket, req: IncomingMessage) => {
    collab.handleConnection(conn, req);
  };
}

