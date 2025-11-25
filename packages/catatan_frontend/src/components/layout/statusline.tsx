import { useContext, createMemo } from "solid-js";
import { EditorContext } from "~/context/editor-client";
import { CursorContext } from "~/context/cursor-context";

export default function StatusLine() {
  const editorContext = useContext(EditorContext);
  const cursorContext = useContext(CursorContext);

  const formatLastUpdated = createMemo(() => {
    const lastSaved = editorContext?.lastSaved();
    if (!lastSaved) return "Not saved yet";

    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return "Saved just now";
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `Saved ${Math.floor(diff / 3600)} hours ago`;

    return `Saved on ${lastSaved.toLocaleDateString()} at ${lastSaved.toLocaleTimeString()}`;
  });

  const noteIdDisplay = createMemo(() => {
    return editorContext?.noteId() || "Loading...";
  });

  const cursorPositionDisplay = createMemo(() => {
    const line = cursorContext?.line() ?? 1;
    const column = cursorContext?.column() ?? 1;
    return `${line}:${column}`;
  });

  return (
    <div class="fixed bottom-0 left-0 right-0 z-20 border-t bg-background h-8 flex flex-row items-center px-4 justify-between">
      <div class="flex items-center gap-4">
        <div class="text-sm text-muted-foreground">
          Last updated: {formatLastUpdated()}
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
