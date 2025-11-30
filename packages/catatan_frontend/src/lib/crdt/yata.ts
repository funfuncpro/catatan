import { CRDT } from "~/types/crdt";

// ============================================================================
// Internal State Interface
// ============================================================================

interface YataState {
  noteId: string;
  writerId: string;
  clock: number;
  elements: Map<string, CRDT.Element>;
  stateVector: CRDT.StateVector;
}

// ============================================================================
// Public Interface
// ============================================================================

export interface YataDocument {
  // Read operations
  toList: () => CRDT.Element[];
  toListWithDeleted: () => CRDT.Element[];
  toText: () => string;
  getStateVector: () => CRDT.StateVector;

  // Write operations
  insert: (
    origin: CRDT.ElementId | null,
    rightOrigin: CRDT.ElementId | null,
    content: string,
  ) => CRDT.Element;
  delete: (elementId: string) => CRDT.Element | null;
  integrate: (element: CRDT.Element) => void;
  integrateFromServer: (serialized: CRDT.SerializedElement) => void;
  markDeletedFromServer: (elementId: string, deletedAt: string) => void;

  // Position/element conversion
  positionToElement: (pos: number) => CRDT.Cursor;
  elementToPosition: (
    afterElement: CRDT.ElementId | null,
    offset: number,
  ) => number;
  elementAtPosition: (pos: number) => CRDT.Element | null;
  getInsertPosition: (pos: number) => {
    origin: CRDT.ElementId | null;
    rightOrigin: CRDT.ElementId | null;
  };
  getDeleteTarget: (pos: number) => string | null;
  getDelta: (clientStateVector: CRDT.StateVector) => CRDT.Element[];

  // Utility
  clone: () => YataDocument;
}

// ============================================================================
// Pure Helper Functions (Internal)
// ============================================================================

const incrementClock = (state: YataState): number => {
  state.clock += 1;
  return state.clock;
};

const generateId = (state: YataState): CRDT.ElementId => {
  return [state.writerId, state.clock];
};

const updateStateVector = (
  state: YataState,
  writerId: string,
  clock: number,
): void => {
  const current = state.stateVector[writerId] ?? 0;
  if (clock > current) {
    state.stateVector[writerId] = clock;
  }
};

const mergeDeleted = (
  existing: CRDT.Element,
  incoming: CRDT.Element,
): CRDT.Element => {
  let deletedAt: string | null = null;

  if (existing.deletedAt && incoming.deletedAt) {
    deletedAt =
      existing.deletedAt < incoming.deletedAt
        ? existing.deletedAt
        : incoming.deletedAt;
  } else {
    deletedAt = existing.deletedAt || incoming.deletedAt;
  }

  return { ...existing, deletedAt };
};

const buildOriginMap = (
  elements: CRDT.Element[],
): Map<string | null, CRDT.Element[]> => {
  const map = new Map<string | null, CRDT.Element[]>();

  for (const el of elements) {
    const originKey = CRDT.ElementId.encode(el.origin);
    const existing = map.get(originKey) ?? [];
    existing.push(el);
    map.set(originKey, existing);
  }

  return map;
};

const isReachable = (
  elementsMap: Map<string, CRDT.Element>,
  element: CRDT.Element,
  targetId: CRDT.ElementId | null,
): boolean => {
  if (targetId === null) return false;
  if (CRDT.ElementId.equals(element.id, targetId)) return true;
  if (element.rightOrigin === null) return false;
  if (CRDT.ElementId.equals(element.rightOrigin, targetId)) return true;

  const next = elementsMap.get(CRDT.ElementId.encode(element.rightOrigin)!);
  if (!next) return false;

  return isReachable(elementsMap, next, targetId);
};

const compareRightOrigins = (
  elementsMap: Map<string, CRDT.Element>,
  rightA: CRDT.ElementId,
  rightB: CRDT.ElementId,
): boolean => {
  const aElement = elementsMap.get(CRDT.ElementId.encode(rightA)!);
  const bElement = elementsMap.get(CRDT.ElementId.encode(rightB)!);

  if (!aElement || !bElement) {
    return CRDT.ElementId.compare(rightA, rightB) < 0;
  }

  // Check if a's right_origin is reachable from b's right_origin
  if (isReachable(elementsMap, aElement, rightB)) return true;
  if (isReachable(elementsMap, bElement, rightA)) return false;

  return CRDT.ElementId.compare(rightA, rightB) < 0;
};

/**
 * Compare two elements with the same origin
 */
const compareConflicting = (
  elementsMap: Map<string, CRDT.Element>,
  a: CRDT.Element,
  b: CRDT.Element,
): boolean => {
  // Same element
  if (CRDT.ElementId.equals(a.id, b.id)) return true;

  // a's right_origin is b
  if (CRDT.ElementId.equals(a.rightOrigin, b.id)) return true;

  // b's right_origin is a
  if (CRDT.ElementId.equals(b.rightOrigin, a.id)) return false;

  // Both have null right_origin
  if (a.rightOrigin === null && b.rightOrigin === null) {
    return CRDT.ElementId.compare(a.id, b.id) < 0;
  }

  // One has null right_origin
  if (a.rightOrigin === null) return false;
  if (b.rightOrigin === null) return true;

  // Compare right_origins
  return compareRightOrigins(elementsMap, a.rightOrigin, b.rightOrigin);
};

/**
 * Sort conflicting elements (elements with the same origin) using YATA rules.
 *
 * YATA conflict resolution:
 * 1. Compare right_origins: element with right_origin further right comes first
 * 2. If right_origins are equal or incomparable, use ID as tiebreaker
 */
const sortConflicting = (
  elementsMap: Map<string, CRDT.Element>,
  elements: CRDT.Element[],
): CRDT.Element[] => {
  return [...elements].sort((a, b) => {
    if (compareConflicting(elementsMap, a, b)) return -1;
    return 1;
  });
};

const buildSortedList = (
  elementsMap: Map<string, CRDT.Element>,
  heads: CRDT.Element[],
  originMap: Map<string | null, CRDT.Element[]>,
): CRDT.Element[] => {
  const result: CRDT.Element[] = [];
  const queue = [...heads];

  while (queue.length > 0) {
    const element = queue.shift()!;
    result.push(element);

    // Find children (elements that have this element as origin)
    const childKey = CRDT.ElementId.encode(element.id);
    const children = originMap.get(childKey) ?? [];
    const sortedChildren = sortConflicting(elementsMap, children);

    // Add children to front of queue (depth-first)
    queue.unshift(...sortedChildren);
  }

  return result;
};

// ============================================================================
// Factory Function
// ============================================================================

export function createYataDocument(
  noteId: string,
  writerId: string,
): YataDocument {
  const state: YataState = {
    noteId,
    writerId,
    clock: 0,
    elements: new Map(),
    stateVector: {},
  };

  const toListWithDeleted = (): CRDT.Element[] => {
    const allElements = Array.from(state.elements.values());
    const originMap = buildOriginMap(allElements);
    const heads = originMap.get(null) ?? [];
    const sortedHeads = sortConflicting(state.elements, heads);
    return buildSortedList(state.elements, sortedHeads, originMap);
  };

  const toList = (): CRDT.Element[] => {
    return toListWithDeleted().filter((el) => el.deletedAt === null);
  };

  const toText = (): string => {
    return toList()
      .map((el) => el.content)
      .join("");
  };

  const getStateVector = (): CRDT.StateVector => {
    return { ...state.stateVector };
  };

  const insert = (
    origin: CRDT.ElementId | null,
    rightOrigin: CRDT.ElementId | null,
    content: string,
  ): CRDT.Element => {
    incrementClock(state);
    const id = generateId(state);

    const element: CRDT.Element = {
      id,
      origin,
      rightOrigin,
      content,
      deletedAt: null,
    };

    const key = CRDT.ElementId.encode(id)!;
    state.elements.set(key, element);
    updateStateVector(state, state.writerId, state.clock);

    return element;
  };

  const deleteElement = (elementId: string): CRDT.Element | null => {
    const element = state.elements.get(elementId);
    if (!element) return null;

    const deletedAt = new Date().toISOString();
    const updatedElement: CRDT.Element = { ...element, deletedAt };
    state.elements.set(elementId, updatedElement);

    return updatedElement;
  };

  const integrate = (element: CRDT.Element): void => {
    const key = CRDT.ElementId.encode(element.id)!;
    const [writerId, clock] = element.id;

    const existing = state.elements.get(key);
    if (existing) {
      const merged = mergeDeleted(existing, element);
      state.elements.set(key, merged);
    } else {
      state.elements.set(key, element);
      updateStateVector(state, writerId, clock);
    }
  };

  const integrateFromServer = (serialized: CRDT.SerializedElement): void => {
    const element = CRDT.deserializeElement(serialized);
    integrate(element);
  };

  const markDeletedFromServer = (
    elementId: string,
    deletedAt: string,
  ): void => {
    const element = state.elements.get(elementId);
    if (element && !element.deletedAt) {
      state.elements.set(elementId, { ...element, deletedAt });
    }
  };

  // ============================================================================
  // Position-Element Conversion (Critical for Cursor System)
  // ============================================================================

  /**
   * Convert an absolute text position to a YATA element reference.
   *
   * This is used when the local cursor moves - we need to convert the
   * position to an element reference for sending to other clients.
   */
  const positionToElement = (pos: number): CRDT.Cursor => {
    if (pos <= 0) {
      return { afterElement: null, offset: 0 };
    }

    const elements = toList();
    let currentPos = 0;

    for (const el of elements) {
      const len = el.content.length;

      if (currentPos + len >= pos) {
        // Cursor is within or at end of this element
        const offset = pos - currentPos;
        return { afterElement: el.id, offset };
      }

      currentPos += len;
    }

    // Past end of document - return last element
    if (elements.length > 0) {
      const lastEl = elements[elements.length - 1];
      return { afterElement: lastEl.id, offset: lastEl.content.length };
    }

    return { afterElement: null, offset: 0 };
  };

  /**
   * Convert a YATA element reference to an absolute text position.
   *
   * This is used when receiving remote cursor positions - we need to
   * convert the element reference to a position for rendering.
   */
  const elementToPosition = (
    afterElement: CRDT.ElementId | null,
    offset: number,
  ): number => {
    if (afterElement === null) {
      return Math.max(0, offset);
    }

    const elements = toList();
    let pos = 0;

    for (const el of elements) {
      if (CRDT.ElementId.equals(el.id, afterElement)) {
        return pos + Math.min(offset, el.content.length);
      }
      pos += el.content.length;
    }

    // Element not found - return end of document
    return pos;
  };

  /**
   * Find the element at a given position.
   */
  const elementAtPosition = (pos: number): CRDT.Element | null => {
    const elements = toList();
    let currentPos = 0;

    for (const el of elements) {
      const len = el.content.length;
      if (currentPos + len > pos) {
        return el;
      }
      currentPos += len;
    }

    return elements[elements.length - 1] ?? null;
  };

  /**
   * Get origin and right_origin for inserting at a given position.
   *
   * This is the key function for local insertions - given a cursor position,
   * determine what the origin and right_origin should be for the new element.
   */
  const getInsertPosition = (
    pos: number,
  ): { origin: CRDT.ElementId | null; rightOrigin: CRDT.ElementId | null } => {
    const elements = toList();

    if (elements.length === 0) {
      return { origin: null, rightOrigin: null };
    }

    if (pos <= 0) {
      // Insert at start - no origin, first element is right_origin
      return { origin: null, rightOrigin: elements[0].id };
    }

    let currentPos = 0;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const len = el.content.length;

      if (currentPos + len >= pos) {
        const offset = pos - currentPos;

        if (offset === 0) {
          const prevEl = i > 0 ? elements[i - 1] : null;
          return {
            origin: prevEl?.id ?? null,
            rightOrigin: el.id,
          };
        } else if (offset >= len) {
          const nextEl = i + 1 < elements.length ? elements[i + 1] : null;
          return {
            origin: el.id,
            rightOrigin: nextEl?.id ?? null,
          };
        } else {
          return {
            origin: el.id,
            rightOrigin: i + 1 < elements.length ? elements[i + 1].id : null,
          };
        }
      }

      currentPos += len;
    }

    const lastEl = elements[elements.length - 1];
    return { origin: lastEl.id, rightOrigin: null };
  };

  const getDeleteTarget = (pos: number): string | null => {
    const elements = toList();
    let currentPos = 0;

    for (const el of elements) {
      const len = el.content.length;
      if (currentPos + len > pos) {
        return CRDT.ElementId.encode(el.id);
      }
      currentPos += len;
    }

    return null;
  };

  const getDelta = (clientStateVector: CRDT.StateVector): CRDT.Element[] => {
    const delta: CRDT.Element[] = [];

    for (const element of state.elements.values()) {
      const [writerId, clock] = element.id;
      const clientClock = clientStateVector[writerId] ?? 0;

      if (clock > clientClock) {
        delta.push(element);
      }
    }

    return delta;
  };

  const clone = (): YataDocument => {
    const cloned = createYataDocument(state.noteId, state.writerId);

    // Copy internal state
    for (const [, element] of state.elements) {
      cloned.integrate({ ...element });
    }

    return cloned;
  };

  return {
    toList,
    toListWithDeleted,
    toText,
    getStateVector,
    insert,
    delete: deleteElement,
    integrate,
    integrateFromServer,
    markDeletedFromServer,
    positionToElement,
    elementToPosition,
    elementAtPosition,
    getInsertPosition,
    getDeleteTarget,
    getDelta,
    clone,
  };
}
