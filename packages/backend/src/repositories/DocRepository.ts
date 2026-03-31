import type { DocName, DocUpdateBytes } from '../types/yjs.js';

export interface DocRepository {
  load(docName: DocName): Promise<DocUpdateBytes | null>;
  save(docName: DocName, bytes: DocUpdateBytes): Promise<void>;
}
