import {
  RootNode,
  NodePath,
  getNodeAtPath,
  isElementNode,
  isTextNode,
} from "./node";

export interface Point {
  readonly path: NodePath;
  readonly offset: number;
}

export const createPoint = (path: NodePath, offset: number): Point => ({
  path,
  offset,
});

export const isPointEqual = (a: Point, b: Point): boolean =>
  a.offset === b.offset &&
  a.path.length === b.path.length &&
  a.path.every((v, i) => v === b.path[i]);

export interface Selection {
  readonly anchor: Point;
  readonly focus: Point;
}

export const createSelection = (anchor: Point, focus: Point): Selection => ({
  anchor,
  focus,
});

export const createCollapsedSelection = (point: Point): Selection => ({
  anchor: point,
  focus: point,
});

export const isSelectionCollapsed = (selection: Selection): boolean =>
  isPointEqual(selection.anchor, selection.focus);

export interface Cursor {
  readonly selection: Selection;
}

export const createCursor = (selection: Selection): Cursor => ({
  selection,
});

export const createCursorAtStart = (): Cursor =>
  createCursor(createCollapsedSelection(createPoint([0], 0)));

export const createCursorAt = (path: NodePath, offset: number): Cursor =>
  createCursor(createCollapsedSelection(createPoint(path, offset)));

export const getContentLength = (root: RootNode, path: NodePath): number => {
  const node = getNodeAtPath(root, path);
  if (!node) return 0;
  if (isTextNode(node)) return node.text.length;
  if (isElementNode(node)) return node.children.length;
  return 0;
};

export const findNextTextPath = (
  root: RootNode,
  currentPath: NodePath,
): NodePath | null => {
  const findNext = (path: NodePath): NodePath | null => {
    if (path.length === 0) return null;

    const parentPath = path.slice(0, -1);
    const currentIndex = path[path.length - 1];
    const parent = getNodeAtPath(root, parentPath);

    if (!parent || !isElementNode(parent)) return null;

    if (currentIndex + 1 < parent.children.length) {
      const nextPath = [...parentPath, currentIndex + 1];
      const nextNode = getNodeAtPath(root, nextPath);

      if (nextNode && isTextNode(nextNode)) {
        return nextPath;
      }

      if (nextNode && isElementNode(nextNode)) {
        return findFirstTextPath(root, nextPath);
      }
    }

    return findNext(parentPath);
  };

  return findNext(currentPath);
};

export const findPrevTextPath = (
  root: RootNode,
  currentPath: NodePath,
): NodePath | null => {
  const findPrev = (path: NodePath): NodePath | null => {
    if (path.length === 0) return null;

    const parentPath = path.slice(0, -1);
    const currentIndex = path[path.length - 1];
    const parent = getNodeAtPath(root, parentPath);

    if (!parent || !isElementNode(parent)) return null;

    if (currentIndex > 0) {
      const prevPath = [...parentPath, currentIndex - 1];
      const prevNode = getNodeAtPath(root, prevPath);

      if (prevNode && isTextNode(prevNode)) {
        return prevPath;
      }

      if (prevNode && isElementNode(prevNode)) {
        return findLastTextPath(root, prevPath);
      }
    }

    return findPrev(parentPath);
  };

  return findPrev(currentPath);
};

export const findFirstTextPath = (
  root: RootNode,
  startPath: NodePath,
): NodePath | null => {
  const node = getNodeAtPath(root, startPath);
  if (!node) return null;

  if (isTextNode(node)) return startPath;

  if (isElementNode(node)) {
    for (let i = 0; i < node.children.length; i++) {
      const found = findFirstTextPath(root, [...startPath, i]);
      if (found) return found;
    }
  }

  return null;
};

export const findLastTextPath = (
  root: RootNode,
  startPath: NodePath,
): NodePath | null => {
  const node = getNodeAtPath(root, startPath);
  if (!node) return null;

  if (isTextNode(node)) return startPath;

  if (isElementNode(node)) {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const found = findLastTextPath(root, [...startPath, i]);
      if (found) return found;
    }
  }

  return null;
};

export const moveCursorLeft = (cursor: Cursor, root: RootNode): Cursor => {
  const { anchor } = cursor.selection;

  if (anchor.offset > 0) {
    return createCursorAt(anchor.path, anchor.offset - 1);
  }

  const prevPath = findPrevTextPath(root, anchor.path);
  if (prevPath) {
    const length = getContentLength(root, prevPath);
    return createCursorAt(prevPath, length);
  }

  return cursor;
};

export const moveCursorRight = (cursor: Cursor, root: RootNode): Cursor => {
  const { anchor } = cursor.selection;
  const contentLength = getContentLength(root, anchor.path);

  if (anchor.offset < contentLength) {
    return createCursorAt(anchor.path, anchor.offset + 1);
  }

  const nextPath = findNextTextPath(root, anchor.path);
  if (nextPath) {
    return createCursorAt(nextPath, 0);
  }

  return cursor;
};

export const moveCursorToLineStart = (cursor: Cursor): Cursor => {
  return createCursorAt(cursor.selection.anchor.path, 0);
};

export const moveCursorToLineEnd = (cursor: Cursor, root: RootNode): Cursor => {
  const length = getContentLength(root, cursor.selection.anchor.path);
  return createCursorAt(cursor.selection.anchor.path, length);
};

export const extendSelectionLeft = (cursor: Cursor, root: RootNode): Cursor => {
  const { anchor, focus } = cursor.selection;

  if (focus.offset > 0) {
    return createCursor(
      createSelection(anchor, createPoint(focus.path, focus.offset - 1)),
    );
  }

  const prevPath = findPrevTextPath(root, focus.path);
  if (prevPath) {
    const length = getContentLength(root, prevPath);
    return createCursor(createSelection(anchor, createPoint(prevPath, length)));
  }

  return cursor;
};

export const extendSelectionRight = (
  cursor: Cursor,
  root: RootNode,
): Cursor => {
  const { anchor, focus } = cursor.selection;
  const contentLength = getContentLength(root, focus.path);

  if (focus.offset < contentLength) {
    return createCursor(
      createSelection(anchor, createPoint(focus.path, focus.offset + 1)),
    );
  }

  const nextPath = findNextTextPath(root, focus.path);
  if (nextPath) {
    return createCursor(createSelection(anchor, createPoint(nextPath, 0)));
  }

  return cursor;
};

export const collapseSelection = (
  cursor: Cursor,
  toAnchor: boolean = true,
): Cursor => {
  return createCursor(
    createCollapsedSelection(
      toAnchor ? cursor.selection.anchor : cursor.selection.focus,
    ),
  );
};
