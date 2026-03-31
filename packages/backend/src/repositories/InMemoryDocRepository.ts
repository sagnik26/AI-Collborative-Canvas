import type { DocRepository } from "./DocRepository.js";
import type { DocName, DocUpdateBytes } from "../types/yjs.js";

export class InMemoryDocRepository implements DocRepository {
  private readonly stateByDoc = new Map<DocName, DocUpdateBytes>();

  async load(docName: DocName) {
    return this.stateByDoc.get(docName) ?? null;
  }

  async save(docName: DocName, bytes: DocUpdateBytes) {
    this.stateByDoc.set(docName, bytes);
  }
}

