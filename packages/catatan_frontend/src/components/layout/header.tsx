import { Link } from "@tanstack/solid-router";
import { createSignal, Show, useContext } from "solid-js";
import { EditorContext } from "~/context/editor";
import { useAuth } from "~/context/auth";
import { login } from "~/lib/auth";

export function Header() {
  const context = useContext(EditorContext);
  const auth = useAuth();
  const [isSharing, setIsSharing] = createSignal(false);
  const [shareLink, setShareLink] = createSignal<string | null>(null);
  const [shareError, setShareError] = createSignal<string | null>(null);

  const handleShare = async () => {
    if (!context?.noteId()) {
      setShareError("No note to share");
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareLink(null);

    try {
      const currentNoteId = context.noteId();
      
      // Step 1: Get all sessions to find the session_id for our current note
      const sessionsResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/sessions`,
        {
          credentials: "include",
        }
      );
      
      const sessionsResult = await sessionsResponse.json();
      console.log("Sessions result:", sessionsResult);
      
      if (!sessionsResult.success || !sessionsResult.data?.sessions) {
        setShareError("Failed to retrieve sessions");
        setIsSharing(false);
        return;
      }
      
      // Find the session that corresponds to our current note
      const currentSession = sessionsResult.data.sessions.find(
        (session: any) => session.note?.note_id === currentNoteId
      );
      
      if (!currentSession) {
        setShareError("Could not find session for current note");
        setIsSharing(false);
        return;
      }
      
      console.log("Found session for note:", currentSession.session_id);
      
      // Step 2: Activate this session so the backend knows which note to share
      const activateResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/sessions/${currentSession.session_id}/activate`,
        {
          method: "PUT",
          credentials: "include",
        }
      );
      
      const activateResult = await activateResponse.json();
      console.log("Activate session result:", activateResult);
      
      if (!activateResult.success) {
        setShareError("Failed to activate session");
        setIsSharing(false);
        return;
      }
      
      // Step 3: Now create the share link (backend will use active_session cookie)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/shares`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      const result = await response.json();
      console.log("Share result:", result);

      if (result.success && result.data?.share_id) {
        const link = `${window.location.origin}/shares/${result.data.share_id}`;
        setShareLink(link);
      } else {
        setShareError(result.message || "Failed to create share link");
      }
    } catch (err) {
      console.error("Failed to create share:", err);
      setShareError("Failed to connect to the server");
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareLink()) {
      await navigator.clipboard.writeText(shareLink()!);
      // Could add a toast notification here
      alert("Link copied to clipboard!");
    }
  };

  const closeModal = () => {
    setShareLink(null);
    setShareError(null);
  };

  return (
    <>
      <header class="fixed flex flex-row justify-between bg-background backdrop-blur-md w-full items-center py-4 lg:px-10 px-5 border-b z-20">
        <Link to="/">
          <span class="text-lg tracking-wide font-medium select-none">
            Catatan.
          </span>
        </Link>

        <div class="flex items-center gap-3">
          {/* Auth buttons */}
          <Show
            when={auth.isAuthenticated()}
            fallback={
              <button
                onClick={() => login()}
                class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium transition-colors"
              >
                Login
              </button>
            }
          >
            <Link
              to="/profile"
              class="px-3 py-1.5 text-sm text-muted hover:text-primary transition-colors"
            >
              {auth.user()?.email}
            </Link>
            <button
              onClick={() => auth.logout()}
              class="px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </Show>

          {/* Share button - only show if there's a note context */}
          <Show when={context?.noteId()}>
            <button
              onClick={handleShare}
              disabled={isSharing()}
              class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSharing() ? "Creating link..." : "Share"}
            </button>
          </Show>
        </div>
      </header>

      {/* Share modal */}
      <Show when={shareLink() || shareError()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={shareLink()}>
              <h2 class="text-xl font-semibold mb-4">Share Link Created</h2>
              <p class="text-muted text-sm mb-4">
                Anyone with this link can view your note (read-only):
              </p>
              <div class="flex gap-2 mb-4">
                <input
                  type="text"
                  value={shareLink()!}
                  readonly
                  class="flex-1 px-3 py-2 bg-secondary border border-custom rounded text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </Show>

            <Show when={shareError()}>
              <h2 class="text-xl font-semibold mb-4 text-red-500">
                Error Creating Share
              </h2>
              <p class="text-muted text-sm mb-4">{shareError()}</p>
            </Show>

            <button
              onClick={closeModal}
              class="w-full px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
