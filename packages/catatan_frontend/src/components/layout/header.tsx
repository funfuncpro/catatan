import { Link } from "@tanstack/solid-router";
import { createSignal, Show, useContext } from "solid-js";
import { EditorContext } from "~/context/editor";
import { useAuth } from "~/context/auth";
import { login } from "~/lib/auth";
import { EmailTagInput } from "~/components/ui/email-tag-input";

export function Header() {
  const context = useContext(EditorContext);
  const auth = useAuth();
  const [isSharing, setIsSharing] = createSignal(false);
  const [shareLink, setShareLink] = createSignal<string | null>(null);
  const [shareError, setShareError] = createSignal<string | null>(null);
  const [accessType, setAccessType] = createSignal<"public" | "restricted">("public");
  const [allowedEmails, setAllowedEmails] = createSignal<string[]>([]);
  const [showConfigModal, setShowConfigModal] = createSignal(false);

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
      
      // Step 3: Create the share link with access control settings
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/shares`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            access_type: accessType(),
            allowed_emails: accessType() === "restricted" ? allowedEmails() : [],
          }),
        }
      );

      const result = await response.json();
      console.log("Share result:", result);

      if (result.success && result.data?.share_id) {
        const link = `${window.location.origin}/shares/${result.data.share_id}`;
        setShareLink(link);
        setShowConfigModal(false);
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

  const openConfigModal = () => {
    setShowConfigModal(true);
    setAccessType("public");
    setAllowedEmails([]);
  };

  const closeModal = () => {
    setShareLink(null);
    setShareError(null);
    setShowConfigModal(false);
    setAccessType("public");
    setAllowedEmails([]);
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
              onClick={openConfigModal}
              class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium transition-colors"
            >
              Share
            </button>
          </Show>
        </div>
      </header>

      {/* Share configuration modal */}
      <Show when={showConfigModal()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4">Create Share Link</h2>

            {/* Access Type Toggle */}
            <div class="mb-4">
              <label class="block text-sm font-medium mb-2">Access Type</label>
              <div class="flex gap-2">
                <button
                  onClick={() => setAccessType("public")}
                  class={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
                    accessType() === "public"
                      ? "bg-primary text-background"
                      : "bg-secondary border border-custom hover:bg-opacity-90"
                  }`}
                >
                  Public
                </button>
                <button
                  onClick={() => setAccessType("restricted")}
                  class={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
                    accessType() === "restricted"
                      ? "bg-primary text-background"
                      : "bg-secondary border border-custom hover:bg-opacity-90"
                  }`}
                >
                  Restricted
                </button>
              </div>
            </div>

            {/* Email Input for Restricted Access */}
            <Show when={accessType() === "restricted"}>
              <div class="mb-4">
                <label class="block text-sm font-medium mb-2">
                  Allowed Emails
                </label>
                <EmailTagInput
                  emails={allowedEmails()}
                  onEmailsChange={setAllowedEmails}
                  placeholder="Enter email addresses..."
                />
                <p class="text-xs text-muted mt-1">
                  Press Enter or comma to add emails. Only these users can access.
                </p>
              </div>
            </Show>

            <p class="text-muted text-sm mb-4">
              {accessType() === "public"
                ? "Anyone with this link will be able to view your note (read-only)"
                : "Only users with allowed emails will be able to view this note"}
            </p>

            <div class="flex gap-2">
              <button
                onClick={closeModal}
                class="flex-1 px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing() || (accessType() === "restricted" && allowedEmails().length === 0)}
                class="flex-1 px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSharing() ? "Creating..." : "Create Link"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Share success modal */}
      <Show when={shareLink() && !showConfigModal()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4">Share Link Created</h2>

            <p class="text-muted text-sm mb-4">
              {accessType() === "public"
                ? "Anyone with this link can view your note (read-only):"
                : `Only these ${allowedEmails().length} email(s) can view this note:`}
            </p>

            <Show when={accessType() === "restricted" && allowedEmails().length > 0}>
              <div class="mb-4 p-3 bg-secondary border border-custom rounded">
                <p class="text-xs text-muted mb-2">Allowed emails:</p>
                <div class="flex flex-wrap gap-2">
                  {allowedEmails().map((email) => (
                    <span class="px-2 py-1 bg-primary text-background rounded text-xs">
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            </Show>

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

            <button
              onClick={closeModal}
              class="w-full px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* Error modal */}
      <Show when={shareError()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4 text-red-500">
              Error Creating Share
            </h2>
            <p class="text-muted text-sm mb-4">{shareError()}</p>

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
