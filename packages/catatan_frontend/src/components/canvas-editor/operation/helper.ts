// ============================================================================
// Helper Utilities
// ============================================================================

import type { KeyBinding } from "./type";
import type { EditorState } from ".";

// ============================================================================
// Selection Helpers
// ============================================================================

/**
 * Collapse selection to cursor position
 */
export const collapseSelection = (state: EditorState): EditorState => ({
  ...state,
  anchor: null,
});

// ============================================================================
// Word Boundary Detection
// ============================================================================

/**
 * Find word boundary in given direction
 * @param text - The text to search
 * @param pos - Current position
 * @param direction - Direction to search ("left" or "right")
 * @returns Position of word boundary
 */
export const findWordBoundary = (
  text: string,
  pos: number,
  direction: "left" | "right",
): number => {
  const isWordChar = (c: string) => /\w/.test(c);

  if (direction === "right") {
    let p = pos;
    // Skip non-word characters
    while (p < text.length && !isWordChar(text[p])) p++;
    // Skip word characters
    while (p < text.length && isWordChar(text[p])) p++;
    return p;
  }

  // Direction is "left"
  let p = Math.max(0, pos - 1);
  // Skip non-word characters
  while (p > 0 && !isWordChar(text[p])) p--;
  // Skip word characters
  while (p > 0 && isWordChar(text[p - 1])) p--;
  return p;
};

// ============================================================================
// Key Binding Factory
// ============================================================================

/**
 * Create a key binding configuration
 * @param k - Key name
 * @param op - Operation to perform
 * @param opts - Additional options (metaKey, altKey, ctrlKey, shiftKey)
 */
export const key = (
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
// Keyboard Event Helpers
// ============================================================================

/**
 * Check if keyboard event is a printable character
 */
export const isPrintableKey = (e: KeyboardEvent): boolean =>
  e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
