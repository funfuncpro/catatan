import type { KeyBinding } from "./type";
import { matchesKey } from "./type";
import * as Doc from "./document";
import * as Node from "./node";

// Re-export modules as namespaces
export { Doc, Node };

// Re-export from selection
export { getSelectedText, cut } from "./selection";

export interface EditorState {
  readonly doc: Doc.Document;
  readonly cursor: number;
  readonly anchor: number | null;
}

/**
 * Create initial state
 */
export const createState = (text: string = ""): EditorState => ({
  doc: Doc.fromText(text),
  cursor: 0,
  anchor: null,
});

// ============================================================================
// Selection Utilities
// ============================================================================

/**
 * Get selection range (start, end)
 */
export const getSelection = (
  state: EditorState,
): { start: number; end: number } => {
  if (state.anchor === null) {
    return { start: state.cursor, end: state.cursor };
  }
  return {
    start: Math.min(state.cursor, state.anchor),
    end: Math.max(state.cursor, state.anchor),
  };
};

/**
 * Check if has selection
 */
export const hasSelection = (state: EditorState): boolean =>
  state.anchor !== null && state.anchor !== state.cursor;

// ============================================================================
// Word Boundary Detection (needed here to avoid circular imports)
// ============================================================================

/**
 * Find word boundary in given direction
 */
const findWordBoundary = (
  text: string,
  pos: number,
  direction: "left" | "right",
): number => {
  const isWordChar = (c: string) => /\w/.test(c);

  if (direction === "right") {
    let p = pos;
    while (p < text.length && !isWordChar(text[p])) p++;
    while (p < text.length && isWordChar(text[p])) p++;
    return p;
  }

  let p = Math.max(0, pos - 1);
  while (p > 0 && !isWordChar(text[p])) p--;
  while (p > 0 && isWordChar(text[p - 1])) p--;
  return p;
};

// ============================================================================
// Text Operations - O(log n)
// ============================================================================

/**
 * Insert text at cursor
 */
export const insertText = (state: EditorState, text: string): EditorState => {
  const { start, end } = getSelection(state);

  // Replace selection if exists, otherwise insert
  const newDoc =
    start !== end
      ? Doc.replaceRange(state.doc, start, end, text)
      : Doc.insertAt(state.doc, state.cursor, text);

  return {
    doc: newDoc,
    cursor: start + text.length,
    anchor: null,
  };
};

/**
 * Delete backward (backspace)
 */
export const deleteBackward = (state: EditorState): EditorState => {
  if (hasSelection(state)) {
    const { start, end } = getSelection(state);
    return {
      doc: Doc.deleteRange(state.doc, start, end),
      cursor: start,
      anchor: null,
    };
  }

  if (state.cursor === 0) return state;

  return {
    doc: Doc.deleteAt(state.doc, state.cursor - 1),
    cursor: state.cursor - 1,
    anchor: null,
  };
};

/**
 * Delete forward (delete key)
 */
export const deleteForward = (state: EditorState): EditorState => {
  if (hasSelection(state)) {
    const { start, end } = getSelection(state);
    return {
      doc: Doc.deleteRange(state.doc, start, end),
      cursor: start,
      anchor: null,
    };
  }

  if (state.cursor >= Doc.length(state.doc)) return state;

  return {
    doc: Doc.deleteAt(state.doc, state.cursor),
    cursor: state.cursor,
    anchor: null,
  };
};

/**
 * Insert line break
 */
export const insertLineBreak = (state: EditorState): EditorState =>
  insertText(state, "\n");

/**
 * Delete word backward
 */
export const deleteWordBackward = (state: EditorState): EditorState => {
  if (hasSelection(state)) return deleteBackward(state);

  const text = Doc.getText(state.doc);
  const start = findWordBoundary(text, state.cursor, "left");

  return {
    doc: Doc.deleteRange(state.doc, start, state.cursor),
    cursor: start,
    anchor: null,
  };
};

/**
 * Delete word forward
 */
export const deleteWordForward = (state: EditorState): EditorState => {
  if (hasSelection(state)) return deleteForward(state);

  const text = Doc.getText(state.doc);
  const end = findWordBoundary(text, state.cursor, "right");

  return {
    doc: Doc.deleteRange(state.doc, state.cursor, end),
    cursor: state.cursor,
    anchor: null,
  };
};

/**
 * Delete entire current line
 */
export const deleteLine = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const lineCount = Doc.lineCount(state.doc);
  const { start, end } = Doc.lineRange(state.doc, line);

  // If this is the only line, just clear it
  if (lineCount === 1) {
    return {
      doc: Doc.deleteRange(state.doc, start, end),
      cursor: 0,
      anchor: null,
    };
  }

  // If last line, delete including the preceding newline
  if (line === lineCount - 1) {
    const deleteStart = start - 1;
    return {
      doc: Doc.deleteRange(state.doc, deleteStart, end),
      cursor: deleteStart,
      anchor: null,
    };
  }

  // Otherwise, delete including the trailing newline
  return {
    doc: Doc.deleteRange(state.doc, start, end + 1),
    cursor: start,
    anchor: null,
  };
};

// ============================================================================
// Key Binding Factory
// ============================================================================

/**
 * Create a key binding configuration
 */
const key = (
  k: string,
  op: (s: EditorState) => EditorState,
  opts: Partial<KeyBinding<EditorState>> = {},
): KeyBinding<EditorState> => ({
  key: k,
  preventDefault: true,
  operation: op,
  ...opts,
});

// ============================================================================
// Import operations from other modules (after EditorState is defined)
// ============================================================================

// Movement operations
import {
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  moveWordLeft,
  moveWordRight,
  moveToStart,
  moveToEnd,
} from "./movement";

// Selection operations
import {
  selectLeft,
  selectRight,
  selectUp,
  selectDown,
  selectWordLeft,
  selectWordRight,
  selectAll,
} from "./selection";

// Indentation operations
import { insertTab, removeTab } from "./indentation";

// Toggle operations
import { toggleBold, toggleItalic, toggleCode } from "./toggle";

// ============================================================================
// Key Bindings Configuration
// ============================================================================

/**
 * Create default key bindings
 */
export const createBindings = (): KeyBinding<EditorState>[] => [
  // Word movement (Alt + Arrow)
  key("ArrowLeft", moveWordLeft, { altKey: true }),
  key("ArrowRight", moveWordRight, { altKey: true }),

  // Line/Document movement (Cmd + Arrow)
  key("ArrowLeft", moveToLineStart, { metaKey: true }),
  key("ArrowRight", moveToLineEnd, { metaKey: true }),
  key("ArrowUp", moveToStart, { metaKey: true }),
  key("ArrowDown", moveToEnd, { metaKey: true }),

  // Word selection (Alt + Shift + Arrow)
  key("ArrowLeft", selectWordLeft, { altKey: true, shiftKey: true }),
  key("ArrowRight", selectWordRight, { altKey: true, shiftKey: true }),

  // Line selection (Cmd + Shift + Arrow)
  key("ArrowLeft", selectWordLeft, { metaKey: true, shiftKey: true }),
  key("ArrowRight", selectWordRight, { metaKey: true, shiftKey: true }),

  // Basic selection (Shift + Arrow)
  key("ArrowLeft", selectLeft, { shiftKey: true }),
  key("ArrowRight", selectRight, { shiftKey: true }),
  key("ArrowUp", selectUp, { shiftKey: true }),
  key("ArrowDown", selectDown, { shiftKey: true }),

  // Select all (Cmd + A)
  key("a", selectAll, { metaKey: true }),

  // Basic navigation
  key("ArrowLeft", moveLeft),
  key("ArrowRight", moveRight),
  key("ArrowUp", moveUp),
  key("ArrowDown", moveDown),

  // Emacs-style navigation (Ctrl + A/E)
  key("a", moveToLineStart, { ctrlKey: true }),
  key("e", moveToLineEnd, { ctrlKey: true }),

  // Delete operations
  key("Backspace", deleteBackward),
  key("Delete", deleteForward),
  key("Backspace", deleteWordBackward, { altKey: true }),
  key("Delete", deleteWordForward, { altKey: true }),
  key("Backspace", deleteLine, { metaKey: true }),
  key("Backspace", deleteLine, { ctrlKey: true, shiftKey: true }),

  // Line break
  key("Enter", insertLineBreak),

  // Indentation
  key("Tab", insertTab),
  key("Tab", removeTab, { shiftKey: true }),

  // Formatting
  key("b", toggleBold, { metaKey: true }),
  key("i", toggleItalic, { metaKey: true }),
  key("e", toggleCode, { metaKey: true, shiftKey: true }),
];

// ============================================================================
// Keyboard Event Handler
// ============================================================================

/**
 * Check if keyboard event is a printable character
 */
const isPrintableKey = (e: KeyboardEvent): boolean =>
  e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;

/**
 * Handle keyboard events and return new state
 */
export const handleKeyEvent = (
  e: KeyboardEvent,
  state: EditorState,
): { state: EditorState; handled: boolean } => {
  const bindings = createBindings();

  // Check key bindings first
  for (const binding of bindings) {
    if (matchesKey(e, binding)) {
      if (binding.preventDefault) {
        e.preventDefault();
      }
      return { state: binding.operation(state), handled: true };
    }
  }

  // Handle printable characters
  if (isPrintableKey(e)) {
    e.preventDefault();
    return { state: insertText(state, e.key), handled: true };
  }

  return { state, handled: false };
};
