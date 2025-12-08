import { Link } from "@tanstack/solid-router";
import { Show, createSignal, useContext } from "solid-js";
import { useAuth } from "~/context/auth";
import { login, tokenStorage } from "~/lib/auth";
import { ShareModal } from "./share-modal";
import { NotesContext } from "~/context/notes";

export function Header() {
  const auth = useAuth();
  const notesContext = useContext(NotesContext);
  
  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = createSignal(false);
  const [shareAccessType, setShareAccessType] = createSignal<"public" | "private">("public");
  const [sharePermissionLevel, setSharePermissionLevel] = createSignal<"read" | "write">("read");
  const [shareAllowedEmails, setShareAllowedEmails] = createSignal<string[]>([]);
  const [shareLink, setShareLink] = createSignal<string | null>(null);
  const [shareError, setShareError] = createSignal<string | null>(null);
  const [isShareLoading, setIsShareLoading] = createSignal(false);

  const handleGenerateShare = async () => {
    const noteId = notesContext?.notesID();
    if (!noteId) {
      setShareError("Note ID not found. Please try again.");
      return;
    }

    setIsShareLoading(true);
    setShareError(null);

    try {
      const token = tokenStorage.getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log("Generating share for note:", noteId, "Access:", shareAccessType());

      const response = await fetch("http://localhost:8000/api/v1/shares", {
        method: "POST",
        headers,
        body: JSON.stringify({
          note_id: noteId,
          access_type: shareAccessType(),
          permission_level: sharePermissionLevel(),
          allowed_emails: shareAccessType() === "private" ? shareAllowedEmails() : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create share link");
      }

      console.log("Share created successfully:", data);
      setShareLink(data.data.url);
    } catch (error) {
      console.error("Share creation error:", error);
      setShareError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink()) {
      navigator.clipboard.writeText(shareLink()!);
      // Optional: Show toast
    }
  };

  const closeShareModal = () => {
    console.log("Closing share modal");
    setIsShareModalOpen(false);
    // Reset state on close if desired, or keep for next time
    setShareLink(null); 
    setShareError(null);
  };

  const testAuth = async () => {
    console.log("testAuth called");
    const token = localStorage.getItem("catatan_access_token");
    if (!token) {
      console.error("No access token found");
      return;
    }

    try {
      console.log("Sending request to /api/v1/test-auth");
      const response = await fetch("http://localhost:8000/api/v1/test-auth", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log("Test auth response:", data);
    } catch (error) {
      console.error("Test auth error:", error);
    }
  };

  return (
    <>
      <header class="fixed flex flex-row justify-between bg-background backdrop-blur-md w-full items-center py-4 lg:px-10 px-5 border-b z-20">
        <Link to="/">
          <span class="text-lg tracking-wide font-medium select-none">
            Catatan.
          </span>
        </Link>

        <div class="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              console.log("Opening share modal");
              setIsShareModalOpen(true);
            }}
            class="px-4 py-2 text-sm font-medium bg-primary text-background hover:bg-opacity-90 transition-colors rounded shadow-sm"
          >
            Share
          </button>

          <Show
            when={auth.isAuthenticated()}
            fallback={
              <button
                onClick={() => login(notesContext?.notesID())}
                class="px-4 py-2 text-sm font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity rounded"
              >
                Login
              </button>
            }
          >
            <div class="flex items-center gap-4">
              <button
                onClick={testAuth}
                class="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                {auth.user()?.email}
              </button>
              <button
                onClick={() => auth.logout()}
                class="px-4 py-2 text-sm font-medium border border-custom hover:bg-secondary transition-colors rounded"
              >
                Logout
              </button>
            </div>
          </Show>
        </div>
      </header>

      <ShareModal
        isOpen={isShareModalOpen()}
        isLoading={isShareLoading()}
        shareLink={shareLink()}
        shareError={shareError()}
        accessType={shareAccessType()}
        permissionLevel={sharePermissionLevel()}
        allowedEmails={shareAllowedEmails()}
        setAccessType={setShareAccessType}
        setPermissionLevel={setSharePermissionLevel}
        setAllowedEmails={setShareAllowedEmails}
        onGenerate={handleGenerateShare}
        onClose={closeShareModal}
        onCopy={handleCopyLink}
        isAuthenticated={auth.isAuthenticated()}
      />
    </>
  );
}
