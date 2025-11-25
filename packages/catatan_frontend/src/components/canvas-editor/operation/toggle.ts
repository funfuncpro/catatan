// ============================================================================
// Text Format Toggle Operations
// ============================================================================

import * as Doc from "./document";
import type { EditorState } from "./index";
import { getSelection } from "./index";

// ============================================================================
// Format Toggles
// ============================================================================

/**
 * Toggle bold format on selection
 */
export const toggleBold = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "bold") };
};

/**
 * Toggle italic format on selection
 */
export const toggleItalic = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "italic") };
};

/**
 * Toggle code format on selection
 */
export const toggleCode = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "code") };
};
