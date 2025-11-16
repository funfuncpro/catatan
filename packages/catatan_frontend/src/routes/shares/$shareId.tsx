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
      
      const token = localStorage.getItem("catatan_access_token");
      console.log("Token from localStorage:", token ? `${token.substring(0, 20)}...` : "null");
      
      const headers: HeadersInit = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        console.log("Authorization header added:", headers["Authorization"].substring(0, 30));
      } else {
        console.log("No token found in localStorage");
      }

      console.log("Request headers:", headers);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/shares/${shareId}`,
        { headers }
      );

      const result = await response.json();
      console.log("Shared note result:", result);

      if (response.status === 403 || response.status === 404) {
        // Show generic "not found" for both unauthorized and not found
        setError("Share not found");
        setIsLoading(false);
        return;
      }

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
            <div class="text-xl font-semibold text-red-500">404</div>
            <div class="text-lg text-muted">Share not found</div>
            <p class="text-muted text-sm text-center max-w-md">
              The share link you're looking for doesn't exist or may have been removed.
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
