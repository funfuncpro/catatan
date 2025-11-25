import { KeyBinding } from "./type";
import * as Doc from "./document";

// ============================================================================
// Editor State
// ============================================================================

export interface EditorState {
  readonly doc: Doc.Document;
  readonly cursor: number; // Absolute position in document
  readonly anchor: number | null; // Selection anchor (null if collapsed)
}

/** Create initial state */
export const createState = (text: string = ""): EditorState => ({
  doc: Doc.fromText(text),
  cursor: 0,
  anchor: null,
});

/** Get selection range (start, end) */
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

/** Check if has selection */
export const hasSelection = (state: EditorState): boolean =>
  state.anchor !== null && state.anchor !== state.cursor;

// ============================================================================
// Text Operations - O(log n)
// ============================================================================

/** Insert text at cursor */
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

/** Delete backward (backspace) */
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

/** Delete forward (delete key) */
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

/** Insert line break */
export const insertLineBreak = (state: EditorState): EditorState =>
  insertText(state, "\n");

/** Delete word backward */
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

/** Delete word forward */
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

/** Delete entire current line (Cmd+Backspace on Mac, Ctrl+Backspace on Windows) */
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
    const deleteStart = start - 1; // Include newline before this line
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
// Indentation Operations
// ============================================================================

const INDENT = "  "; // 2 spaces

/** Insert tab/indent at cursor or indent selected lines */
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

/** Remove indent from current line or selected lines */
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

// ============================================================================
// Cursor Movement - O(1) to O(n) depending on operation
// ============================================================================

/** Move cursor left */
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

/** Move cursor right */
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

/** Move cursor up */
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

/** Move cursor down */
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

/** Move to line start */
export const moveToLineStart = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  return { ...state, cursor: Doc.lineToPos(state.doc, line), anchor: null };
};

/** Move to line end */
export const moveToLineEnd = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const { end } = Doc.lineRange(state.doc, line);
  return { ...state, cursor: end, anchor: null };
};

/** Move word left */
export const moveWordLeft = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  return {
    ...state,
    cursor: findWordBoundary(text, state.cursor, "left"),
    anchor: null,
  };
};

/** Move word right */
export const moveWordRight = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  return {
    ...state,
    cursor: findWordBoundary(text, state.cursor, "right"),
    anchor: null,
  };
};

/** Move to document start */
export const moveToStart = (state: EditorState): EditorState => ({
  ...state,
  cursor: 0,
  anchor: null,
});

/** Move to document end */
export const moveToEnd = (state: EditorState): EditorState => ({
  ...state,
  cursor: Doc.length(state.doc),
  anchor: null,
});

// ============================================================================
// Selection Operations
// ============================================================================

/** Extend selection left */
export const selectLeft = (state: EditorState): EditorState => ({
  ...state,
  cursor: Math.max(0, state.cursor - 1),
  anchor: state.anchor ?? state.cursor,
});

/** Extend selection right */
export const selectRight = (state: EditorState): EditorState => ({
  ...state,
  cursor: Math.min(Doc.length(state.doc), state.cursor + 1),
  anchor: state.anchor ?? state.cursor,
});

/** Extend selection up */
export const selectUp = (state: EditorState): EditorState => {
  const moved = moveUp({ ...state, anchor: null });
  return {
    ...state,
    cursor: moved.cursor,
    anchor: state.anchor ?? state.cursor,
  };
};

/** Extend selection down */
export const selectDown = (state: EditorState): EditorState => {
  const moved = moveDown({ ...state, anchor: null });
  return {
    ...state,
    cursor: moved.cursor,
    anchor: state.anchor ?? state.cursor,
  };
};

/** Select word at cursor */
export const selectWord = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const start = findWordBoundary(text, state.cursor, "left");
  const end = findWordBoundary(text, state.cursor, "right");

  return { ...state, cursor: end, anchor: start };
};

/** Select current line */
export const selectLine = (state: EditorState): EditorState => {
  const line = Doc.posToLine(state.doc, state.cursor);
  const { start, end } = Doc.lineRange(state.doc, line);

  return { ...state, cursor: end, anchor: start };
};

/** Select all */
export const selectAll = (state: EditorState): EditorState => ({
  ...state,
  cursor: Doc.length(state.doc),
  anchor: 0,
});

/** Collapse selection */
export const collapseSelection = (state: EditorState): EditorState => ({
  ...state,
  anchor: null,
});

// ============================================================================
// Formatting Operations - O(log n)
// ============================================================================

/** Toggle bold on selection */
export const toggleBold = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "bold") };
};

/** Toggle italic on selection */
export const toggleItalic = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "italic") };
};

/** Toggle code on selection */
export const toggleCode = (state: EditorState): EditorState => {
  const { start, end } = getSelection(state);
  if (start === end) return state;

  return { ...state, doc: Doc.toggleFormat(state.doc, start, end, "code") };
};

// ============================================================================
// Helpers
// ============================================================================

/** Find word boundary */
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
// Key Bindings
// ============================================================================

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

/** Check if key is printable character */
export const isPrintableKey = (e: KeyboardEvent): boolean =>
  e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;

/** All bindings (non-printable keys only) */
export const createBindings = (): KeyBinding<EditorState>[] => [
  // Word navigation (alt + arrow)
  key("ArrowLeft", moveWordLeft, { altKey: true }),
  key("ArrowRight", moveWordRight, { altKey: true }),

  // Line navigation (meta + arrow)
  key("ArrowLeft", moveToLineStart, { metaKey: true }),
  key("ArrowRight", moveToLineEnd, { metaKey: true }),
  key("ArrowUp", moveToStart, { metaKey: true }),
  key("ArrowDown", moveToEnd, { metaKey: true }),

  // Word selection (alt + shift + arrow)
  key("ArrowLeft", (s) => selectWordLeft(s), { altKey: true, shiftKey: true }),
  key("ArrowRight", (s) => selectWordRight(s), {
    altKey: true,
    shiftKey: true,
  }),

  key("ArrowLeft", (s) => selectWordLeft(s), { metaKey: true, shiftKey: true }),
  key("ArrowRight", (s) => selectWordRight(s), {
    metaKey: true,
    shiftKey: true,
  }),

  // Selection (shift + arrow)
  key("ArrowLeft", selectLeft, { shiftKey: true }),
  key("ArrowRight", selectRight, { shiftKey: true }),
  key("ArrowUp", selectUp, { shiftKey: true }),
  key("ArrowDown", selectDown, { shiftKey: true }),

  // Select all
  key("a", selectAll, { metaKey: true }),

  // Basic navigation
  key("ArrowLeft", moveLeft),
  key("ArrowRight", moveRight),
  key("ArrowUp", moveUp),
  key("ArrowDown", moveDown),

  // Emacs-style
  key("a", moveToLineStart, { ctrlKey: true }),
  key("e", moveToLineEnd, { ctrlKey: true }),

  // Deletion
  key("Backspace", deleteBackward),
  key("Delete", deleteForward),
  key("Backspace", deleteWordBackward, { altKey: true }),
  key("Delete", deleteWordForward, { altKey: true }),
  key("Backspace", deleteLine, { metaKey: true }), // Mac: Cmd+Backspace
  key("Backspace", deleteLine, { ctrlKey: true, shiftKey: true }), // Windows/Linux: Ctrl+Shift+Backspace

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

/** Extend selection by word left */
const selectWordLeft = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const newCursor = findWordBoundary(text, state.cursor, "left");
  return {
    ...state,
    cursor: newCursor,
    anchor: state.anchor ?? state.cursor,
  };
};

/** Extend selection by word right */
const selectWordRight = (state: EditorState): EditorState => {
  const text = Doc.getText(state.doc);
  const newCursor = findWordBoundary(text, state.cursor, "right");
  return {
    ...state,
    cursor: newCursor,
    anchor: state.anchor ?? state.cursor,
  };
};

// ============================================================================
// Clipboard Operations
// ============================================================================

/** Get selected text */
export const getSelectedText = (state: EditorState): string => {
  if (!hasSelection(state)) return "";
  const { start, end } = getSelection(state);
  return Doc.slice(state.doc, start, end);
};

/** Cut selection (returns selected text and new state) */
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
