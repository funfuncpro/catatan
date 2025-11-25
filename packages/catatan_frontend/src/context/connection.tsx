import {
  Accessor,
  createContext,
  createEffect,
  createSignal,
  JSX,
  Setter,
  useContext,
} from "solid-js";
import { NotesContext } from "./notes";
import { createNotesChannel } from "~/lib/notes";

export interface ConnectionContextValue {
  isConnected: Accessor<boolean>;
  setIsConnected: Setter<boolean>;
}

export const ConnectionContext = createContext<ConnectionContextValue>();

export function ConnectionContextProvider(props: { children: JSX.Element }) {
  const [isConnected, setIsConnected] = createSignal<boolean>(false);

  const notesContext = useContext(NotesContext);
  const contextValue: ConnectionContextValue = {
    isConnected,
    setIsConnected,
  };

  createEffect(() => {
    const noteID = notesContext?.notesID();

    if (!noteID) {
      setIsConnected(false);
      return;
    }

    let channel: Awaited<ReturnType<typeof createNotesChannel>> | null = null;

    createNotesChannel({
      noteID,
      setIsConnected(connected) {
        setIsConnected(connected);
      },
    })
      .then((ch) => {
        channel = ch;
      })
      .catch((e) => {
        console.error("Failed to connect to notes channel", e);
        setIsConnected(false);
      });

    return () => {
      if (channel && typeof channel === "object" && "close" in channel) {
        (channel as any).close?.();
      }
    };
  });

  return (
    <ConnectionContext.Provider value={contextValue}>
      {props.children}
    </ConnectionContext.Provider>
  );
}
