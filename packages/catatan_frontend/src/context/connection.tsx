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
  RemoteInsertPayload,
  RemoteDeletePayload,
  RemoteDeleteBatchPayload,
} from "~/lib/notes";
import { PhoenixChannel } from "~/lib/websocket";
import { CursorContext } from "./cursor";
import { WriterContext } from "./writer";
import { YataContext } from "./yata";
import { EditorSyncContext } from "./editor-sync";
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
  const yataContext = useContext(YataContext);
  const editorSyncContext = useContext(EditorSyncContext);

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

      if (yataContext) {
        yataContext.initializeDocument(noteID, my_writer_id);
      }

      if (writerContext) {
        writerContext.initializeFromJoinResponse(my_writer_id, writers);
      }

      if (cursorContext) {
        const remoteCursors: Record<string, Actor.Cursor> = {};
        for (const [id, writer] of Object.entries(writers)) {
          if (id !== my_writer_id) {
            remoteCursors[id] = {
              after_element: writer.cursor.after_element,
              offset: writer.cursor.offset,
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
              after_element: writer.cursor.after_element,
              offset: writer.cursor.offset,
              color: generateColorFromId(id),
            };
          }
        }
        cursorContext.setRemoteCursors(remoteCursors);
      }
    };

    const handleRemoteInsert = (payload: RemoteInsertPayload) => {
      if (!yataContext) return;
      const textBefore = yataContext.getText();
      yataContext.integrateRemoteElement(payload.element);
      const textAfter = yataContext.getText();
      const elementId = payload.element.id;
      const pos = yataContext.elementToPosition(elementId, 0);

      if (editorSyncContext && textAfter.length > textBefore.length) {
        editorSyncContext.pushRemoteOp({
          type: "insert",
          pos,
          content: payload.element.content,
        });
      }
    };

    const handleRemoteDelete = (payload: RemoteDeletePayload) => {
      if (!yataContext) return;

      // Skip if element is already deleted locally (e.g., this is our own delete echoed back)
      if (yataContext.isElementDeleted(payload.element_id)) {
        return;
      }

      const elementIdParts = payload.element_id.split(":");
      if (elementIdParts.length !== 2) {
        console.warn("Invalid element_id format:", payload.element_id);
        return;
      }

      const elementId: [string, number] = [
        elementIdParts[0],
        parseInt(elementIdParts[1], 10),
      ];

      const pos = yataContext.elementToPosition(elementId, 0);

      yataContext.markRemoteDeleted(payload.element_id, payload.deleted_at);

      if (editorSyncContext && pos >= 0) {
        editorSyncContext.pushRemoteOp({
          type: "delete",
          pos,
          count: 1,
        });
      }
    };

    const handleRemoteDeleteBatch = (payload: RemoteDeleteBatchPayload) => {
      if (!yataContext) return;

      const { element_ids, deleted_at } = payload;
      if (element_ids.length === 0) return;

      // Filter out elements that are already deleted locally
      const elementsToDelete = element_ids.filter(
        (id) => !yataContext.isElementDeleted(id),
      );

      if (elementsToDelete.length === 0) {
        // All elements already deleted locally, skip
        return;
      }

      // Get position of first element before marking deleted
      const firstElementIdParts = elementsToDelete[0].split(":");
      if (firstElementIdParts.length !== 2) {
        console.warn("Invalid element_id format:", elementsToDelete[0]);
        return;
      }

      const firstElementId: [string, number] = [
        firstElementIdParts[0],
        parseInt(firstElementIdParts[1], 10),
      ];

      const pos = yataContext.elementToPosition(firstElementId, 0);

      // Mark all elements as deleted in a single update
      yataContext.markRemoteDeletedBatch(elementsToDelete, deleted_at);

      if (editorSyncContext && pos >= 0) {
        editorSyncContext.pushRemoteOp({
          type: "delete",
          pos,
          count: elementsToDelete.length,
        });
      }
    };

    createNotesChannel({
      noteID,
      setIsConnected(connected) {
        setIsConnected(connected);
      },
      onJoinSuccess: handleJoinSuccess,
      onPresenceState: handlePresenceState,
      onRemoteInsert: handleRemoteInsert,
      onRemoteDelete: handleRemoteDelete,
      onRemoteDeleteBatch: handleRemoteDeleteBatch,
    })
      .then((ch) => {
        if (ch) {
          channelInstance = ch;
          setChannel(ch);

          if (yataContext) {
            yataContext.setChannel(ch);
          }

          if (yataContext) {
            yataContext.syncWithServer();
          }
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
      if (yataContext) {
        yataContext.setChannel(null);
      }
    });
  });

  createEffect(() => {
    const afterElement = cursorContext?.afterElement();
    const offset = cursorContext?.cursorOffset();
    const ch = channel();

    if (ch && isConnected() && afterElement !== undefined) {
      ch.push(
        "cursor_move",
        {
          after_element: afterElement,
          offset: offset ?? 0,
        },
        { expectReply: false },
      );
    }
  });

  return (
    <ConnectionContext.Provider value={contextValue}>
      {props.children}
    </ConnectionContext.Provider>
  );
}
