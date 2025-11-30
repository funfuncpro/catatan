import { createContext, createSignal, Accessor, Setter } from "solid-js";
import * as Solid from "solid-js";
import { Actor } from "~/types/actor";

export interface CursorContextValue {
  afterElement: Accessor<Actor.ElementId>;
  cursorOffset: Accessor<number>;
  setAfterElement: Setter<Actor.ElementId>;
  setCursorOffset: Setter<number>;

  remoteCursors: Accessor<Record<string, Actor.Cursor>>;
  setRemoteCursors: Setter<Record<string, Actor.Cursor>>;

  updateRemoteCursor: (writerId: string, cursor: Actor.Cursor) => void;
  removeRemoteCursor: (writerId: string) => void;

  updateFromPosition: (
    pos: number,
    positionToElement: (pos: number) => {
      afterElement: Actor.ElementId;
      offset: number;
    },
  ) => void;
}

export const CursorContext = createContext<CursorContextValue>();

export function CursorContextProvider(props: { children: Solid.JSX.Element }) {
  const [afterElement, setAfterElement] = createSignal<Actor.ElementId>(null);
  const [cursorOffset, setCursorOffset] = createSignal<number>(0);

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

  const updateFromPosition = (
    pos: number,
    positionToElement: (pos: number) => {
      afterElement: Actor.ElementId;
      offset: number;
    },
  ) => {
    const { afterElement: newAfterElement, offset } = positionToElement(pos);
    setAfterElement(newAfterElement);
    setCursorOffset(offset);
  };

  const contextValue: CursorContextValue = {
    afterElement,
    cursorOffset,
    setAfterElement,
    setCursorOffset,
    remoteCursors,
    setRemoteCursors,
    updateRemoteCursor,
    removeRemoteCursor,
    updateFromPosition,
  };

  return (
    <CursorContext.Provider value={contextValue}>
      {props.children}
    </CursorContext.Provider>
  );
}
