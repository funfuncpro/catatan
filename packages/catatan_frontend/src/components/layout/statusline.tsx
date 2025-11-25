import { useContext, createMemo } from "solid-js";
import { EditorContext } from "~/context/editor-client";
import { CursorContext } from "~/context/cursor";
import { NotesContext } from "~/context/notes";
import { ConnectionContext } from "~/context/connection";

export default function StatusLine() {
  const cursorContext = useContext(CursorContext);
  const notesContext = useContext(NotesContext);
  const connectionContext = useContext(ConnectionContext);

  const noteIdDisplay = createMemo(() => {
    return notesContext?.notesID() || "Loading...";
  });

  const cursorPositionDisplay = createMemo(() => {
    const line = cursorContext?.line() ?? 1;
    const column = cursorContext?.column() ?? 1;
    return `${line}:${column}`;
  });

  const connectionStatus = createMemo(() => {
    const isConnected = connectionContext?.isConnected();
    return isConnected
      ? {
          label: "Connected",
          class: "text-green-500",
        }
      : {
          label: "Disconnected",
          class: "text-red-500",
        };
  });

  return (
    <div class="fixed bottom-0 left-0 right-0 z-20 border-t bg-background h-8 flex flex-row items-center px-4 justify-between">
      <div class="flex items-center gap-4">
        <div class={`text-sm font-medium ${connectionStatus().class}`}>
          {connectionStatus().label}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="text-sm text-muted-foreground">
          {cursorPositionDisplay()}
        </div>
        <div class="text-sm text-muted-foreground">ID: {noteIdDisplay()}</div>
      </div>
    </div>
  );
}
