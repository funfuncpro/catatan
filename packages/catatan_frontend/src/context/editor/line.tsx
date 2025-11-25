import { createContext } from "solid-js";
import { Cursor } from "~/components/canvas-editor/operation/cursor";

export function getCursorPosition(cursor: Cursor) {
  return `${cursor.selection.anchor.path}:${cursor.selection.anchor.offset}`;
}
