declare module 'y-websocket/bin/utils' {
  export type YjsPersistence = {
    bindState: (
      docName: string,
      ydoc: import('yjs').Doc,
    ) => void | Promise<void>;
    writeState: (docName: string, ydoc: import('yjs').Doc) => Promise<void>;
    provider: unknown;
  };

  export function setPersistence(persistence: YjsPersistence | null): void;

  export function setupWSConnection(
    conn: import('ws').WebSocket,
    req: import('node:http').IncomingMessage,
    opts?: { docName?: string; gc?: boolean },
  ): void;
}
