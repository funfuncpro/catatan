// ============================================================================
// Indentation Operations
// ============================================================================

import * as Doc from "./document";
import type { EditorState } from ".";
import { hasSelection, getSelection, insertText } from ".";

// ============================================================================
// Constants
// ============================================================================

const INDENT = "  "; // 2 spaces

// ============================================================================
// Tab/Indent Operations
// ============================================================================

/**
 * Insert tab/indent at cursor or indent selected lines
 */
export const insertTab = (state: EditorState): EditorState => {
  // If no selection, just insert spaces at cursor
  if (!hasSelection(state)) {
    return insertText(state, INDENT);
  }

  // With selection, indent all lines in selection
  const { start, end } = getSelection(state);
  const startLine = Doc.posToLine(state.doc, start);
  const endLine = Doc.posToLine(state.doc, end);

  let newDoc = state.doc;
  let cursorOffset = 0;
  let anchorOffset = 0;

  // Indent each line from bottom to top (to preserve positions)
  for (let i = endLine; i >= startLine; i--) {
    const lineStart = Doc.lineToPos(newDoc, i);
    newDoc = Doc.insertAt(newDoc, lineStart, INDENT);

    // Adjust cursor/anchor for insertions
    if (lineStart <= state.cursor) {
      cursorOffset += INDENT.length;
    }
    if (state.anchor !== null && lineStart <= state.anchor) {
      anchorOffset += INDENT.length;
    }
  }

  return {
    doc: newDoc,
    cursor: state.cursor + cursorOffset,
    anchor: state.anchor !== null ? state.anchor + anchorOffset : null,
  };
};

/**
 * Remove indent from current line or selected lines
 */
export const removeTab = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  const startLine = Doc.posToLine(
    state.doc,
    hasSelection(state) ? start : state.cursor,
  );
  const endLine = Doc.posToLine(
    state.doc,
    hasSelection(state) ? end : state.cursor,
  );

  let newDoc = state.doc;
  let cursorOffset = 0;
  let anchorOffset = 0;

  // Dedent each line from bottom to top (to preserve positions)
  for (let i = endLine; i >= startLine; i--) {
    const lineStart = Doc.lineToPos(newDoc, i);
    const lineText = Doc.getLine(newDoc, i);

    // Check how many leading spaces to remove (up to INDENT.length)
    let spacesToRemove = 0;
    for (let j = 0; j < Math.min(INDENT.length, lineText.length); j++) {
      if (lineText[j] === " ") {
        spacesToRemove++;
      } else {
        break;
      }
    }

    if (spacesToRemove > 0) {
      newDoc = Doc.deleteRange(newDoc, lineStart, lineStart + spacesToRemove);

      // Adjust cursor/anchor for deletions
      if (state.cursor > lineStart) {
        cursorOffset -= Math.min(spacesToRemove, state.cursor - lineStart);
      }
      if (state.anchor !== null && state.anchor > lineStart) {
        anchorOffset -= Math.min(spacesToRemove, state.anchor - lineStart);
      }
    }
  }

  return {
    doc: newDoc,
    cursor: Math.max(0, state.cursor + cursorOffset),
    anchor:
      state.anchor !== null ? Math.max(0, state.anchor + anchorOffset) : null,
  };
};
