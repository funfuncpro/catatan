import { useContext, createMemo } from "solid-js";
import { CursorContext } from "~/context/cursor";
import { NotesContext } from "~/context/notes";
import { ConnectionContext } from "~/context/connection";
import { YataContext } from "~/context/yata";

export default function StatusLine() {
  const cursorContext = useContext(CursorContext);
  const notesContext = useContext(NotesContext);
  const connectionContext = useContext(ConnectionContext);
  const yataContext = useContext(YataContext);

  const noteIdDisplay = createMemo(() => {
    return notesContext?.notesID() || "Loading...";
  });

  const cursorPositionDisplay = createMemo(() => {
    const afterElement = cursorContext?.afterElement() ?? null;
    const offset = cursorContext?.cursorOffset() ?? 0;

    const absolutePos =
      yataContext?.elementToPosition(afterElement, offset) ?? 0;

    const text = yataContext?.getText() ?? "";
    const textBeforeCursor = text.slice(0, absolutePos);

    const lines = textBeforeCursor.split("\n");
    const line = lines.length;

    const column = (lines[lines.length - 1]?.length ?? 0) + 1;

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
