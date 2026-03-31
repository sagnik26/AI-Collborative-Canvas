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

  // Not typed upstream, but exported by y-websocket and needed for server-side writes.
  export function getYDoc(docName: string): import('yjs').Doc;

  export function setupWSConnection(
    conn: import('ws').WebSocket,
    req: import('node:http').IncomingMessage,
    opts?: { docName?: string; gc?: boolean },
  ): void;
}
