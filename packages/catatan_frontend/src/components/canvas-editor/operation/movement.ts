// ============================================================================
// Cursor Movement Operations
// ============================================================================

import * as Doc from "./document";
import type { EditorState } from ".";
import { hasSelection, getSelection } from ".";
import { findWordBoundary } from "./helper";

// ============================================================================
// Basic Movement
// ============================================================================

/**
 * Move cursor left
 */
export const moveLeft = (state: EditorState): EditorState => {
  if (hasSelection(state)) {
    const { start } = getSelection(state);
    return { ...state, cursor: start, anchor: null };
  }
  return {
    ...state,
    cursor: Math.max(0, state.cursor - 1),
    anchor: null,
  };
};

/**
 * Move cursor right
 */
export const moveRight = (state: EditorState): EditorState => {
  if (hasSelection(state)) {
    const { end } = getSelection(state);
    return { ...state, cursor: end, anchor: null };
  }
  return {
    ...state,
    cursor: Math.min(Doc.length(state.doc), state.cursor + 1),
    anchor: null,
  };
};

/**
 * Move cursor up
 */
export const moveUp = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  if (line === 0) return { ...state, cursor: 0, anchor: null };

  const lineStart = Doc.lineToPos(state.doc, line);
  const col = state.cursor - lineStart;

  const prevLineStart = Doc.lineToPos(state.doc, line - 1);
  const prevLineEnd = lineStart - 1;
  const prevLineLen = prevLineEnd - prevLineStart;

  return {
    ...state,
    cursor: prevLineStart + Math.min(col, prevLineLen),
    anchor: null,
  };
};

/**
 * Move cursor down
 */
export const moveDown = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const totalLines = Doc.lineCount(state.doc);

  if (line >= totalLines - 1) {
    return { ...state, cursor: Doc.length(state.doc), anchor: null };
  }

  const lineStart = Doc.lineToPos(state.doc, line);
  const col = state.cursor - lineStart;

  const nextLineStart = Doc.lineToPos(state.doc, line + 1);
  const { end: nextLineEnd } = Doc.lineRange(state.doc, line + 1);
  const nextLineLen = nextLineEnd - nextLineStart;

  return {
    ...state,
    cursor: nextLineStart + Math.min(col, nextLineLen),
    anchor: null,
  };
};

// ============================================================================
// Line Movement
// ============================================================================

/**
 * Move to line start
 */
export const moveToLineStart = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  return { ...state, cursor: Doc.lineToPos(state.doc, line), anchor: null };
};

/**
 * Move to line end
 */
export const moveToLineEnd = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const { end } = Doc.lineRange(state.doc, line);
  return { ...state, cursor: end, anchor: null };
};

// ============================================================================
// Word Movement
// ============================================================================

/**
 * Move word left
 */
export const moveWordLeft = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  return {
    ...state,
    cursor: findWordBoundary(text, state.cursor, "left"),
    anchor: null,
  };
};

/**
 * Move word right
 */
export const moveWordRight = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  return {
    ...state,
    cursor: findWordBoundary(text, state.cursor, "right"),
    anchor: null,
  };
};

// ============================================================================
// Document Movement
// ============================================================================

/**
 * Move to document start
 */
export const moveToStart = (state: EditorState): EditorState => ({
  ...state,
  cursor: 0,
  anchor: null,
});

/**
 * Move to document end
 */
export const moveToEnd = (state: EditorState): EditorState => ({
  ...state,
  cursor: Doc.length(state.doc),
  anchor: null,
});
