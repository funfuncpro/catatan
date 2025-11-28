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

export interface ConnectionContextValue {
  isConnected: Accessor<boolean>;
  channel: Accessor<PhoenixChannel | null>;
  setIsConnected: Setter<boolean>;
  activeWriterId: Accessor<string | null>;
  sendCursorPosition: (x: number, y: number) => void;
}

export const ConnectionContext = createContext<ConnectionContextValue>();

export function ConnectionContextProvider(props: { children: JSX.Element }) {
  const [isConnected, setIsConnected] = createSignal<boolean>(false);
  const [channel, setChannel] = createSignal<PhoenixChannel | null>(null);
  const [activeWriterId, setActiveWriterId] = createSignal<string | null>(null);

  const notesContext = useContext(NotesContext);
  const cursorContext = useContext(CursorContext);
  const writerContext = useContext(WriterContext);

  /** Send local cursor position to server */
  const sendCursorPosition = (x: number, y: number) => {
    const ch = channel();
    if (ch && isConnected()) {
      ch.push("cursor_move", { x, y }).catch((err) => {
        console.error("Failed to send cursor position:", err);
      });
    }
  };

  const contextValue: ConnectionContextValue = {
    isConnected,
    setIsConnected,
    channel,
    activeWriterId,
    sendCursorPosition,
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

      // Initialize writer context with all writers from join response
      if (writerContext) {
        writerContext.initializeFromJoinResponse(my_writer_id, writers);
      }

      // Initialize remote cursors (excluding our own)
      if (cursorContext) {
        const remoteCursors: Record<string, { x: number; y: number }> = {};
        for (const [id, writer] of Object.entries(writers)) {
          if (id !== my_writer_id) {
            remoteCursors[id] = writer.cursor;
          }
        }
        cursorContext.setRemoteCursors(remoteCursors);
      }
    };

    const handlePresenceState = (payload: PresenceStatePayload) => {
      const { writers } = payload;
      const currentWriterId = activeWriterId();

      if (!currentWriterId) return;

      // Update collaborators in writer context
      if (writerContext) {
        const otherWriters = { ...writers };
        delete otherWriters[currentWriterId];
        writerContext.setCollaborators(otherWriters);
      }

      // Update remote cursors
      if (cursorContext) {
        const remoteCursors: Record<string, { x: number; y: number }> = {};
        for (const [id, writer] of Object.entries(writers)) {
          if (id !== currentWriterId) {
            remoteCursors[id] = writer.cursor;
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

  return (
    <ConnectionContext.Provider value={contextValue}>
      {props.children}
    </ConnectionContext.Provider>
  );
}
