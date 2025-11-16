import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";

export const Route = createFileRoute("/shares/$shareId")({
  component: SharedNote,
});

function SharedNote() {
  const params = Route.useParams();
  const [noteContent, setNoteContent] = createSignal<string>("");
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
          <div class="max-w-4xl mx-auto">
            {/* Read-only banner */}
            <div class="bg-secondary border border-custom px-4 py-2 mb-4 rounded text-sm text-muted">
              📖 You're viewing a shared note (read-only)
            </div>
            
            {/* Editor in read-only mode */}
            <Editor readOnly={true} initialContent={noteContent()} />
            
            {/* Footer with metadata */}
            <div class="mt-8 pt-4 border-t border-custom text-sm text-muted text-center">
              <p>
                Created: {new Date(noteData()?.created_at).toLocaleDateString()}
                {" • "}
                Last updated: {new Date(noteData()?.updated_at).toLocaleDateString()}
              </p>
              <p class="mt-2">
                Powered by <span class="font-semibold">Catatan</span>
              </p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
