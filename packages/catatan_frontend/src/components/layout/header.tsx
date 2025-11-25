import { Link } from "@tanstack/solid-router";
import { createSignal, Show, useContext, For } from "solid-js";
import { EditorContext } from "~/context/editor-client";
import { Toast } from "~/components/ui/toast";
import { ShareModal } from "./share-modal";

export function Header() {
  const context = useContext(EditorContext);
  const [isSharing, setIsSharing] = createSignal(false);
  const [shareLink, setShareLink] = createSignal<string | null>(null);
  const [shareError, setShareError] = createSignal<string | null>(null);
  const [showConfigModal, setShowConfigModal] = createSignal(false);
  const [showShareConfig, setShowShareConfig] = createSignal(false);
  const [accessType, setAccessType] = createSignal<"public" | "restricted">(
    "public",
  );
  const [permissionLevel, setPermissionLevel] = createSignal<"read" | "write">(
    "read",
  );
  const [allowedEmails, setAllowedEmails] = createSignal<string[]>([]);
  const [toasts, setToasts] = createSignal<
    Array<{ id: number; message: string; type: "success" | "error" | "info" }>
  >([]);
  let toastIdCounter = 0;

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    const id = ++toastIdCounter;
    setToasts([...toasts(), { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(toasts().filter((t) => t.id !== id));
  };

  const openShareConfig = () => {
    if (!context?.noteId()) {
      setShareError("No note to share");
      return;
    }
    setShowShareConfig(true);
  };

  const handleShare = async () => {
    setShowShareConfig(false);
    setIsSharing(true);
    setShareError(null);
    setShareLink(null);

    try {
      const currentNoteId = context?.noteId();
      console.log("SHARED NOTE_ID: ", currentNoteId);

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
            permission_level: permissionLevel(),
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
    setShowShareConfig(false);
  };

  const closeConfigModal = () => {
    setShowShareConfig(false);
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
            onClick={openShareConfig}
            disabled={isSharing()}
            class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {isSharing() ? "Creating link..." : "Share"}
          </button>
        </Show>
      </header>

      {/* Share configuration modal */}
      <Show when={showShareConfig()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeConfigModal}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4">Share Settings</h2>

            {/* Permission Level */}
            <div class="mb-6">
              <label class="block text-sm font-medium mb-3">Permission</label>
              <div class="flex gap-3">
                <button
                  onClick={() => setPermissionLevel("read")}
                  class={`flex-1 px-4 py-3 rounded border transition-all ${
                    permissionLevel() === "read"
                      ? "border-primary bg-primary bg-opacity-10 font-medium"
                      : "border-custom hover:border-primary hover:border-opacity-50"
                  }`}
                >
                  Read Only
                </button>
                <button
                  onClick={() => setPermissionLevel("write")}
                  class={`flex-1 px-4 py-3 rounded border transition-all ${
                    permissionLevel() === "write"
                      ? "border-primary bg-primary bg-opacity-10 font-medium"
                      : "border-custom hover:border-primary hover:border-opacity-50"
                  }`}
                >
                  Can Edit
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div class="flex gap-2">
              <button
                onClick={closeConfigModal}
                class="flex-1 px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                class="flex-1 px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      </Show>

      <ShareModal
        shareLink={shareLink()}
        shareError={shareError()}
        showConfigModal={showConfigModal()}
        accessType={accessType()}
        permissionLevel={permissionLevel()}
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
