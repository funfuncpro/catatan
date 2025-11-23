import { createFileRoute } from "@tanstack/solid-router";
import {
  createSignal,
  onMount,
  Show,
  onCleanup,
  createEffect,
  useContext,
} from "solid-js";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";
import {
  websocketConnectFn,
  PhoenixChannel,
  NoteUpdatedPayload,
} from "~/lib/websocket";
import { EditorContext, EditorContextValue } from "~/context/editor-client";

export const Route = createFileRoute("/shares/$shareId")({
  component: SharedNote,
});

function SharedNoteProvider(props: {
  children: any;
  noteId: string;
  initialContent: string;
}) {
  const [markdown, setMarkdown] = createSignal(props.initialContent);
  const [text, setText] = createSignal("");
  const [isDirty, setIsDirty] = createSignal(false);
  const [lastChanged, setLastChanged] = createSignal<Date | null>(null);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(new Date());
  const [handleSave, setHandleSave] = createSignal<
    (() => Promise<void>) | null
  >(null);
  const [noteId, setNoteId] = createSignal<string | null>(props.noteId);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [channel, setChannel] = createSignal<PhoenixChannel | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);

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

  // Connect WebSocket for real-time updates
  createEffect(() => {
    const currentNoteId = noteId();
    if (!currentNoteId) return;

    console.log("Connecting WebSocket for shared note:", currentNoteId);

    const connectWS = async () => {
      try {
        const wsChannel = await websocketConnectFn(
          currentNoteId,
          {
            onJoin: (response) => {
              console.log(
                "WebSocket connected to shared note:",
                response.body,
              );
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
              console.log("Shared note updated by another client:", data);
              // Update markdown for read-only view
              setMarkdown(data.body);
              setLastSaved(new Date());
            },
          },
        );

        setChannel(wsChannel);

        onCleanup(() => {
          console.log("Cleaning up WebSocket connection for shared note");
          wsChannel.disconnect();
          setChannel(null);
          setIsConnected(false);
        });
      } catch (error) {
        console.error("Failed to connect WebSocket for shared note:", error);
        setIsConnected(false);
      }
    };

    connectWS();
  });

  return (
    <EditorContext.Provider value={contextValue}>
      {props.children}
    </EditorContext.Provider>
  );
}

function SharedNoteContent(props: { noteData: any }) {
  const context = useContext(EditorContext);

  return (
    <div class="max-w-4xl mx-auto">
      {/* Read-only banner */}
      <div class="bg-secondary border border-custom px-4 py-2 mb-4 rounded text-sm text-muted flex items-center justify-between">
        <span>📖 You're viewing a shared note (read-only)</span>
        <Show when={context?.isConnected()}>
          <span class="text-green-500 flex items-center gap-1 text-xs">
            <span>●</span>
            <span>Live updates enabled</span>
          </span>
        </Show>
      </div>

      {/* Editor in read-only mode */}
      <Editor readOnly={true} />

      {/* Footer with metadata */}
      <div class="mt-8 pt-4 border-t border-custom text-sm text-muted text-center">
        <p>
          Created: {new Date(props.noteData?.created_at).toLocaleDateString()}
          {" • "}
          Last updated:{" "}
          {new Date(props.noteData?.updated_at).toLocaleDateString()}
        </p>
        <p class="mt-2">
          Powered by <span class="font-semibold">Catatan</span>
        </p>
      </div>
    </div>
  );
}

function SharedNote() {
  const params = Route.useParams();
  const [noteContent, setNoteContent] = createSignal<string>("");
  const [noteId, setNoteId] = createSignal<string>("");
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [noteData, setNoteData] = createSignal<any>(null);

  onMount(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const shareId = params().shareId;
      console.log("Fetching shared note:", shareId);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/shares/${shareId}`,
      );

      const result = await response.json();
      console.log("Shared note result:", result);

      if (result.success && result.data) {
        setNoteContent(result.data.content || "");
        setNoteId(result.data.note_id);
        setNoteData(result.data);
        setIsLoading(false);
      } else {
        setError(result.message || "Failed to load shared note");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Failed to fetch shared note:", err);
      setError("Failed to connect to the server");
      setIsLoading(false);
    }
  });

  return (
    <div class="flex flex-col relative w-full text-base">
      <Header />
      <div class="relative w-full my-16">
        <Show when={isLoading()}>
          <div class="flex items-center justify-center min-h-[50vh]">
            <div class="text-muted">Loading shared note...</div>
          </div>
        </Show>

        <Show when={error()}>
          <div class="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <div class="text-red-500">Error: {error()}</div>
            <p class="text-muted text-sm">
              This share link may be invalid or expired.
            </p>
          </div>
        </Show>

        <Show when={!isLoading() && !error()}>
          <SharedNoteProvider
            noteId={noteId()}
            initialContent={noteContent()}
          >
            <SharedNoteContent noteData={noteData()} />
          </SharedNoteProvider>
        </Show>
      </div>
    </div>
  );
}
