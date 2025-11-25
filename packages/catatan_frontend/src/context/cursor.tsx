import { createContext, createSignal, Accessor, Setter } from "solid-js";
import * as Solid from "solid-js";

export interface CursorContextValue {
  line: Accessor<number>;
  column: Accessor<number>;
  setLine: Setter<number>;
  setColumn: Setter<number>;
}

export const CursorContext = createContext<CursorContextValue>();

export function CursorContextProvider(props: { children: Solid.JSX.Element }) {
  const [line, setLine] = createSignal(1);
  const [column, setColumn] = createSignal(1);

  const contextValue: CursorContextValue = {
    line,
    column,
    setLine,
    setColumn,
  };

  return (
    <CursorContext.Provider value={contextValue}>
      {props.children}
    </CursorContext.Provider>
  );
}
