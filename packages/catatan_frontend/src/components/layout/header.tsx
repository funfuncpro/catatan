import { Link } from "@tanstack/solid-router";
import { createSignal, Show, useContext, For } from "solid-js";
import { EditorContext } from "~/context/editor-client";
import { ShareModal } from "./share-modal";
import { Toast } from "~/components/ui/toast";

export function Header() {
  const context = useContext(EditorContext);
  const [isSharing, setIsSharing] = createSignal(false);
  const [shareLink, setShareLink] = createSignal<string | null>(null);
  const [shareError, setShareError] = createSignal<string | null>(null);
  const [showConfigModal, setShowConfigModal] = createSignal(false);
  const [accessType, setAccessType] = createSignal<"public" | "restricted">("public",);
  const [allowedEmails, setAllowedEmails] = createSignal<string[]>([]);
  const [toasts, setToasts] = createSignal<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  let toastIdCounter = 0;

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++toastIdCounter;
    setToasts([...toasts(), { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(toasts().filter((t) => t.id !== id));
  };

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
      console.log("SHARED NOTE_ID: ", currentNoteId)

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/shares`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            note_id: currentNoteId,
            access_type: accessType(),
            allowed_emails: allowedEmails(),
          }),
        },
      );

      const result = await response.json();
      console.log("Share result:", result);

      if (result.success && result.data?.url) {
        setShareLink(result.data.url);
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
      showToast("Link copied to clipboard!", "success");
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
      </header>

      <ShareModal
        shareLink={shareLink()}
        shareError={shareError()}
        showConfigModal={showConfigModal()}
        accessType={accessType()}
        allowedEmails={allowedEmails()}
        onClose={closeModal}
        onCopy={copyToClipboard}
      />

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
    </>
  );
}
