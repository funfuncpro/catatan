import { KeyBinding, matchesKey } from "./type";
import {
  EditorState,
  createBindings,
  insertText,
  isPrintableKey,
} from "./typing";

export const defaultBindings = createBindings();

export const findBinding = (
  event: KeyboardEvent,
  bindings: KeyBinding<EditorState>[] = defaultBindings,
): KeyBinding<EditorState> | undefined =>
  bindings.find((binding) => matchesKey(event, binding));

export const handleKeyEvent = (
  event: KeyboardEvent,
  state: EditorState,
  bindings: KeyBinding<EditorState>[] = defaultBindings,
): { state: EditorState; handled: boolean } => {
  // First check for bound keys
  const binding = findBinding(event, bindings);

  if (binding) {
    if (binding.preventDefault) {
      event.preventDefault();
    }
    return { state: binding.operation(state), handled: true };
  }

  // Then handle printable characters (handles shift automatically)
  if (isPrintableKey(event)) {
    event.preventDefault();
    return { state: insertText(state, event.key), handled: true };
  }

  return { state, handled: false };
};

export * as Node from "./node";
export * as Cursor from "./cursor";
export * as Rope from "./rope";
export * as Doc from "./document";
export * as Markdown from "./markdown";

export { matchesKey } from "./type";
export type { KeyBinding, MeasureTextFn } from "./type";

export {
  type EditorState,
  createState,
  createBindings,
  insertText,
  deleteBackward,
  deleteForward,
  deleteLine,
  insertLineBreak,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  moveWordLeft,
  moveWordRight,
  selectAll,
  toggleBold,
  toggleItalic,
  toggleCode,
  hasSelection,
  getSelection,
  isPrintableKey,
  getSelectedText,
  cut,
  insertTab,
  removeTab,
} from "./typing";
