import * as Y from 'yjs';

export function hasText(value: string) {
  return value.trim().length > 0;
}

export function cloneYMap<T>(ymap: Y.Map<T>) {
  const out = new Map<string, T>();
  ymap.forEach((v, k) => out.set(k, v));
  return out;
}

