import {
  Accessor,
  createContext,
  createEffect,
  createSignal,
  JSX,
  onCleanup,
  Setter,
  useContext,
} from "solid-js";
import { NotesContext } from "./notes";
import {
  createNotesChannel,
  JoinResponse,
  PresenceStatePayload,
} from "~/lib/notes";
import { PhoenixChannel } from "~/lib/websocket";
import { CursorContext } from "./cursor";
import { WriterContext } from "./writer";
import { generateColorFromId } from "~/lib/cursor";
import { Actor } from "~/types/actor";

export interface ConnectionContextValue {
  isConnected: Accessor<boolean>;
  channel: Accessor<PhoenixChannel | null>;
  setIsConnected: Setter<boolean>;
  activeWriterId: Accessor<string | null>;
}

export const ConnectionContext = createContext<ConnectionContextValue>();

export function ConnectionContextProvider(props: { children: JSX.Element }) {
  const [isConnected, setIsConnected] = createSignal<boolean>(false);
  const [channel, setChannel] = createSignal<PhoenixChannel | null>(null);
  const [activeWriterId, setActiveWriterId] = createSignal<string | null>(null);

  const notesContext = useContext(NotesContext);
  const cursorContext = useContext(CursorContext);
  const writerContext = useContext(WriterContext);

  const contextValue: ConnectionContextValue = {
    isConnected,
    setIsConnected,
    channel,
    activeWriterId,
  };

  createEffect(() => {
    const noteID = notesContext?.notesID();

    if (!noteID) {
      setIsConnected(false);
      return;
    }

    let channelInstance: PhoenixChannel | null = null;

    const handleJoinSuccess = (response: JoinResponse) => {
      const { my_writer_id, writers } = response;
      setActiveWriterId(my_writer_id);

      if (writerContext) {
        writerContext.initializeFromJoinResponse(my_writer_id, writers);
      }

      if (cursorContext) {
        const remoteCursors: Record<string, Actor.Cursor> = {};
        for (const [id, writer] of Object.entries(writers)) {
          if (id !== my_writer_id) {
            remoteCursors[id] = {
              ...writer.cursor,
              color: generateColorFromId(id),
            };
          }
        }
        cursorContext.setRemoteCursors(remoteCursors);
      }
    };

    const handlePresenceState = (payload: PresenceStatePayload) => {
      const { writers } = payload;
      const currentWriterId = activeWriterId();

      if (!currentWriterId) return;

      if (writerContext) {
        const otherWriters = { ...writers };
        delete otherWriters[currentWriterId];
        writerContext.setCollaborators(otherWriters);
      }

      if (cursorContext) {
        const remoteCursors: Record<string, Actor.Cursor> = {};
        for (const [id, writer] of Object.entries(writers)) {
          if (id !== currentWriterId) {
            remoteCursors[id] = {
              ...writer.cursor,
              color: generateColorFromId(id),
            };
          }
        }
        cursorContext.setRemoteCursors(remoteCursors);
      }
    };

    createNotesChannel({
      noteID,
      setIsConnected(connected) {
        setIsConnected(connected);
      },
      onJoinSuccess: handleJoinSuccess,
      onPresenceState: handlePresenceState,
    })
      .then((ch) => {
        if (ch) {
          channelInstance = ch;
          setChannel(ch);
        }
      })
      .catch((e) => {
        console.error("Failed to connect to notes channel", e);
        setIsConnected(false);
      });

    onCleanup(() => {
      if (channelInstance) {
        channelInstance.leave?.().catch(() => {});
        setChannel(null);
        setActiveWriterId(null);
      }
    });
  });

  createEffect(() => {
    const line = cursorContext?.line();
    const column = cursorContext?.column();
    const ch = channel();
    if (ch && isConnected() && line !== undefined && column !== undefined) {
      ch.push("cursor_move", { x: column, y: line }).catch((err) => {
        console.error("Failed to send cursor position:", err);
      });
    }
  });

  return (
    <ConnectionContext.Provider value={contextValue}>
      {props.children}
    </ConnectionContext.Provider>
  );
}
