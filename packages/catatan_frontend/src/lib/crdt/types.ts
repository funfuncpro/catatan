export type ElementId = [string, number];
export type StateVector = Record<string, number>;

export interface Element {
  id: ElementId;
  origin: ElementId | null;
  rightOrigin: ElementId | null;
  content: string;
  deletedAt: string | null;
}

export interface SerializedElement {
  id: [string, number];
  origin: [string, number] | null;
  right_origin: [string, number] | null;
  content: string;
  deleted_at: string | null;
}

export interface YataCursor {
  afterElement: ElementId | null;
  offset: number;
}

export const ElementIdUtils = {
  encode(id: ElementId | null): string | null {
    if (id === null) return null;
    return `${id[0]}:${id[1]}`;
  },

  decode(key: string | null): ElementId | null {
    if (key === null) return null;
    const [writerId, clockStr] = key.split(":");
    return [writerId, parseInt(clockStr, 10)];
  },

  equals(a: ElementId | null, b: ElementId | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a[0] === b[0] && a[1] === b[1];
  },

  compare(a: ElementId, b: ElementId): number {
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0].localeCompare(b[0]);
  },
};

export function deserializeElement(serialized: SerializedElement): Element {
  return {
    id: serialized.id,
    origin: serialized.origin,
    rightOrigin: serialized.right_origin,
    content: serialized.content,
    deletedAt: serialized.deleted_at,
  };
}

export function serializeElement(element: Element): SerializedElement {
  return {
    id: element.id,
    origin: element.origin,
    right_origin: element.rightOrigin,
    content: element.content,
    deleted_at: element.deletedAt,
  };
}
