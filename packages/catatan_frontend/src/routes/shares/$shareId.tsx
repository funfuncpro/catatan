import { createFileRoute } from "@tanstack/solid-router";
import {
  createSignal,
  onMount,
  Show,
  onCleanup,
  createEffect,
  useContext,
  For,
} from "solid-js";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";
import {
  websocketConnectFn,
  PhoenixChannel,
  NoteUpdatedPayload,
} from "~/lib/websocket";
import { EditorContext, EditorContextValue } from "~/context/editor-client";
import { Toast } from "~/components/ui/toast";

export const Route = createFileRoute("/shares/$shareId")({
  component: SharedNote,
});

function SharedNoteProvider(props: {
  children: any;
  noteId: string;
  shareId: string;
  initialContent: string;
  permissionLevel: "read" | "write";
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
              // Update markdown for shared view
              setMarkdown(data.body);
              setLastSaved(new Date());
            },
          },
          { share_id: props.shareId }, // Pass share_id for permission check
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

function SharedNoteContent(props: { noteData: any; permissionLevel: "read" | "write" }) {
  const context = useContext(EditorContext);
  const [toasts, setToasts] = createSignal<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  let toastIdCounter = 0;

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++toastIdCounter;
    setToasts([...toasts(), { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(toasts().filter((t) => t.id !== id));
  };

  // Listen for WebSocket errors from the editor
  createEffect(() => {
    const currentChannel = context?.channel();
    if (currentChannel && props.permissionLevel === "read") {
      // Monitor for any write attempts that might fail
      // This is a safeguard in case the editor tries to write despite being marked readonly
      console.log("Monitoring channel for permission errors on read-only share");
    }
  });

  return (
    <div class="max-w-4xl mx-auto">
      {/* Permission banner */}
      <div class="bg-secondary border border-custom px-4 py-2 mb-4 rounded text-sm text-muted flex items-center justify-between">
        <span>
          {props.permissionLevel === "write"
            ? "✏️ You can edit this shared note"
            : "📖 You're viewing a shared note (read-only)"}
        </span>
        <Show when={context?.isConnected()}>
          <span class="text-green-500 flex items-center gap-1 text-xs">
            <span>●</span>
            <span>Live updates enabled</span>
          </span>
        </Show>
      </div>

      {/* Editor with dynamic readonly based on permission */}
      <Editor readOnly={props.permissionLevel === "read"} />

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

      {/* Toast notifications */}
      <For each={toasts()}>
        {(toast) => (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        )}
      </For>
    </div>
  );
}

function SharedNote() {
  const params = Route.useParams();
  const [noteContent, setNoteContent] = createSignal<string>("");
  const [noteId, setNoteId] = createSignal<string>("");
  const [shareId, setShareId] = createSignal<string>("");
  const [permissionLevel, setPermissionLevel] = createSignal<"read" | "write">("read");
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
        setShareId(shareId);
        setPermissionLevel(result.data.permission_level || "read");
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
            shareId={shareId()}
            initialContent={noteContent()}
            permissionLevel={permissionLevel()}
          >
            <SharedNoteContent noteData={noteData()} permissionLevel={permissionLevel()} />
          </SharedNoteProvider>
        </Show>
      </div>
    </div>
  );
}
