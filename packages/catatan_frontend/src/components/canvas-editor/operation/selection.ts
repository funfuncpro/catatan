// ============================================================================
// Selection Operations
// ============================================================================

import * as Doc from "./document";
import type { EditorState } from ".";
import { hasSelection, getSelection } from ".";
import { moveUp, moveDown } from "./movement";
import { findWordBoundary } from "./helper";

// ============================================================================
// Basic Selection Extension
// ============================================================================

/**
 * Extend selection left
 */
export const selectLeft = (state: EditorState): EditorState => ({
  ...state,
  cursor: Math.max(0, state.cursor - 1),
  anchor: state.anchor ?? state.cursor,
});

/**
 * Extend selection right
 */
export const selectRight = (state: EditorState): EditorState => ({
  ...state,
  cursor: Math.min(Doc.length(state.doc), state.cursor + 1),
  anchor: state.anchor ?? state.cursor,
});

/**
 * Extend selection up
 */
export const selectUp = (state: EditorState): EditorState => {
  const moved = moveUp({ ...state, anchor: null });
  return {
    ...state,
    cursor: moved.cursor,
    anchor: state.anchor ?? state.cursor,
  };
};

/**
 * Extend selection down
 */
export const selectDown = (state: EditorState): EditorState => {
  const moved = moveDown({ ...state, anchor: null });
  return {
    ...state,
    cursor: moved.cursor,
    anchor: state.anchor ?? state.cursor,
  };
};

// ============================================================================
// Word Selection
// ============================================================================

/**
 * Select word at cursor
 */
export const selectWord = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const start = findWordBoundary(text, state.cursor, "left");
  const end = findWordBoundary(text, state.cursor, "right");

  return { ...state, cursor: end, anchor: start };
};

/**
 * Extend selection word left
 */
export const selectWordLeft = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const newCursor = findWordBoundary(text, state.cursor, "left");
  return {
    ...state,
    cursor: newCursor,
    anchor: state.anchor ?? state.cursor,
  };
};

/**
 * Extend selection word right
 */
export const selectWordRight = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const newCursor = findWordBoundary(text, state.cursor, "right");
  return {
    ...state,
    cursor: newCursor,
    anchor: state.anchor ?? state.cursor,
  };
};

// ============================================================================
// Line/All Selection
// ============================================================================

/**
 * Select current line
 */
export const selectLine = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const { start, end } = Doc.lineRange(state.doc, line);

  return { ...state, cursor: end, anchor: start };
};

/**
 * Select all content
 */
export const selectAll = (state: EditorState): EditorState => ({
  ...state,
  cursor: Doc.length(state.doc),
  anchor: 0,
});

// ============================================================================
// Selection Utilities
// ============================================================================

/**
 * Get selected text content
 */
export const getSelectedText = (state: EditorState): string => {
  if (!hasSelection(state)) return "";
  const { start, end } = getSelection(state);
  return Doc.slice(state.doc, start, end);
};

/**
 * Cut selected text and return it
 */
export const cut = (
  state: EditorState,
): { text: string; state: EditorState } => {
  const text = getSelectedText(state);
  if (!text) return { text: "", state };

  const { start } = getSelection(state);
  return {
    text,
    state: {
      doc: Doc.deleteRange(state.doc, start, start + text.length),
      cursor: start,
      anchor: null,
    },
  };
};
