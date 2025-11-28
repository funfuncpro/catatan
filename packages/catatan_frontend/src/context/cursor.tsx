import { createContext, createSignal, Accessor, Setter } from "solid-js";
import * as Solid from "solid-js";
import { Actor } from "~/types/actor";

export interface CursorContextValue {
  // Local cursor position (line/column in editor)
  line: Accessor<number>;
  column: Accessor<number>;
  setLine: Setter<number>;
  setColumn: Setter<number>;

  // Remote cursors from collaborators (keyed by writer ID)
  remoteCursors: Accessor<Record<string, Actor.Cursor>>;
  setRemoteCursors: Setter<Record<string, Actor.Cursor>>;
  updateRemoteCursor: (writerId: string, cursor: Actor.Cursor) => void;
  removeRemoteCursor: (writerId: string) => void;
}

export const CursorContext = createContext<CursorContextValue>();

export function CursorContextProvider(props: { children: Solid.JSX.Element }) {
  const [line, setLine] = createSignal(1);
  const [column, setColumn] = createSignal(1);

  // Remote cursors: { writerId: { x, y } }
  const [remoteCursors, setRemoteCursors] = createSignal<
    Record<string, Actor.Cursor>
  >({});

  const updateRemoteCursor = (writerId: string, cursor: Actor.Cursor) => {
    setRemoteCursors((prev) => ({
      ...prev,
      [writerId]: cursor,
    }));
  };

  const removeRemoteCursor = (writerId: string) => {
    setRemoteCursors((prev) => {
      const updated = { ...prev };
      delete updated[writerId];
      return updated;
    });
  };

  const contextValue: CursorContextValue = {
    line,
    column,
    setLine,
    setColumn,
    remoteCursors,
    setRemoteCursors,
    updateRemoteCursor,
    removeRemoteCursor,
  };

  return (
    <CursorContext.Provider value={contextValue}>
      {props.children}
    </CursorContext.Provider>
  );
}
