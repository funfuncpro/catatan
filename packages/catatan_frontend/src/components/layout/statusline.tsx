import { useContext, createMemo, onMount } from "solid-js";
import { EditorContext } from "~/context/editor";

export default function StatusLine() {
  const context = useContext(EditorContext);

  const formatLastUpdated = createMemo(() => {
    const lastSaved = context?.lastSaved();
    if (!lastSaved) return "Not saved yet";

    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return "Saved just now";
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `Saved ${Math.floor(diff / 3600)} hours ago`;

    return `Saved on ${lastSaved.toLocaleDateString()} at ${lastSaved.toLocaleTimeString()}`;
  });

  const noteIdDisplay = createMemo(() => {
    return context?.noteId() || "Loading...";
  });

  onMount(() => {
    console.log(context);
  });

  return (
    <div class="fixed bottom-0 left-0 right-0 z-20 border-t bg-background h-8 flex flex-row items-center px-4 justify-between">
      <div class="text-sm text-muted-foreground">
        Last updated: {formatLastUpdated()}
      </div>
      <div class="text-sm text-muted-foreground">ID: {noteIdDisplay()}</div>
    </div>
  );
}
