import { Accessor, createContext, JSX, Setter } from "solid-js";
import { Cursor } from "~/components/canvas-editor/operation/cursor";
import { getCursorPosition } from "./line";

export interface EditorContextValue {
  isConnected: Accessor<boolean>;
  setCursor: (cursor: Cursor) => Cursor;
  getCursorPosition: (cursor: Cursor) => string;
}

export const EditorContext = createContext<EditorContextValue>();

export function EditorContextProvider(props: { children: JSX.Element }) {
  let value = {
    isConnected: () => false,
    setCursor: (cursor: Cursor) => {
      return cursor;
    },
    getCursorPosition: getCursorPosition,
  } satisfies EditorContextValue;

  return (
    <EditorContext.Provider value={value}>
      {props.children}
    </EditorContext.Provider>
  );
}
