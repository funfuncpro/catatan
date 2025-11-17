import { useServerFn } from "@tanstack/solid-start";
import {
  createContext,
  createSignal,
  Accessor,
  Setter,
  onMount,
  createEffect,
  onCleanup,
} from "solid-js";
import * as Solid from "solid-js";
import { updateEditorSessionFn } from "./editor";
import {
  websocketConnectFn,
  PhoenixChannel,
  NoteUpdatedPayload,
} from "~/lib/websocket";

export interface EditorContextValue {
  markdown: Accessor<string>;
  setMarkdown: Setter<string>;
  text: Accessor<string>;
  setText: Setter<string>;
  isDirty: Accessor<boolean>;
  setIsDirty: Setter<boolean>;
  lastChanged: Accessor<Date | null>;
  lastSaved: Accessor<Date | null>;
  setLastSaved: Setter<Date | null>;
  setLastChanged: Setter<Date | null>;
  handleSave: Accessor<(() => Promise<void>) | null>;
  setHandleSave: Setter<(() => Promise<void>) | null>;
  noteId: Accessor<string | null>;
  setNoteId: Setter<string | null>;
  isLoading: Accessor<boolean>;
  setIsLoading: Setter<boolean>;
  error: Accessor<string | null>;
  setError: Setter<string | null>;
  channel: Accessor<PhoenixChannel | null>;
  setChannel: Setter<PhoenixChannel | null>;
  isConnected: Accessor<boolean>;
  setIsConnected: Setter<boolean>;
}

export const EditorContext = createContext<EditorContextValue>();

export function EditorContextProvider(props: {
  children: Solid.JSX.Element;
  note?: { noteId: string; content: string; clock: any } | null;
}) {
  const [markdown, setMarkdown] = createSignal("");
  const [text, setText] = createSignal("");
  const [isDirty, setIsDirty] = createSignal(false);
  const [lastChanged, setLastChanged] = createSignal<Date | null>(null);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [handleSave, setHandleSave] = createSignal<
    (() => Promise<void>) | null
  >(null);
  const [noteId, setNoteId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [channel, setChannel] = createSignal<PhoenixChannel | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);

  const updateEditorSession = useServerFn(updateEditorSessionFn);

  const contextValue: EditorContextValue = {
    markdown,
    setMarkdown,
    text,
    setText,
    isDirty,
    setIsDirty,
    lastChanged,
    setLastChanged,
    lastSaved,
    setLastSaved,
    handleSave,
    setHandleSave,
    noteId,
    setNoteId,
    isLoading,
    setIsLoading,
    error,
    setError,
    channel,
    setChannel,
    isConnected,
    setIsConnected,
  };

  async function createNewNote() {
    return fetch(`${import.meta.env.VITE_API_URL}/api/v1/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("response was not ok");
        }
        let result = await response.json();
        if (result.success && result.data) {
          setNoteId(result.data.note_id);
          setMarkdown(result.data.content || "");
          setIsLoading(false);
          await updateEditorSession({
            data: {
              noteId: result.data.note_id,
            },
          });
          return;
        }
        throw new Error(result.message || "Failed to create note");
      })
      .catch((error) => {
        console.error("Failed to create note:", error);
        setError("Failed to create note");
        setIsLoading(false);
        return;
      });
  }

  // Connect WebSocket when noteId changes
  createEffect(() => {
    const currentNoteId = noteId();
    if (!currentNoteId) return;

    console.log("Connecting WebSocket for note:", currentNoteId);

    const connectWS = async () => {
      try {
        const wsChannel = await websocketConnectFn(
          currentNoteId,
          {
            onJoin: (response) => {
              console.log("WebSocket connected to note:", response.body);
              setIsConnected(true);
              // Update markdown from server if different
              if (response.body && response.body !== markdown()) {
                setMarkdown(response.body);
              }
            },
            onJoinError: (error) => {
              console.error("Failed to join WebSocket channel:", error);
              setIsConnected(false);
            },
            onError: (error) => {
              console.error("WebSocket error:", error);
              setIsConnected(false);
            },
            onClose: (event) => {
              console.log("WebSocket closed:", event.code);
              setIsConnected(false);
            },
          },
          {
            note_updated: (data: NoteUpdatedPayload) => {
              console.log("Note updated by another client:", data);
              // Update markdown without triggering dirty state
              setMarkdown(data.body);
              setIsDirty(false);
              setLastSaved(new Date());
            },
          },
        );

        setChannel(wsChannel);

        onCleanup(() => {
          console.log("Cleaning up WebSocket connection");
          wsChannel.disconnect();
          setChannel(null);
          setIsConnected(false);
        });
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        setIsConnected(false);
      }
    };

    connectWS();
  });

  onMount(async () => {
    setIsLoading(true);
    setError(null);

    if (props.note) {
      console.log("Loading note from server:", props.note.noteId);
      setNoteId(props.note.noteId);
      setMarkdown(props.note.content || "");
      setIsLoading(false);
      return;
    }
    await createNewNote();
  });

  return (
    <EditorContext.Provider value={contextValue}>
      {props.children}
    </EditorContext.Provider>
  );
}
