import { Show, For, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

interface ShareModalProps {
  isOpen: boolean;
  isLoading: boolean;
  shareLink: string | null;
  shareError: string | null;
  isAuthenticated: boolean;
  
  // State
  accessType: "public" | "private";
  permissionLevel: "read" | "write";
  allowedEmails: string[];
  
  // Actions
  setAccessType: (type: "public" | "private") => void;
  setPermissionLevel: (level: "read" | "write") => void;
  setAllowedEmails: (emails: string[]) => void;
  onGenerate: () => void;
  onClose: () => void;
  onCopy: () => void;
}

export function ShareModal(props: ShareModalProps) {
  const [emailInput, setEmailInput] = createSignal("");

  const handleAddEmail = (e: Event) => {
    e.preventDefault();
    const email = emailInput().trim();
    if (email && !props.allowedEmails.includes(email)) {
      props.setAllowedEmails([...props.allowedEmails, email]);
      setEmailInput("");
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    props.setAllowedEmails(props.allowedEmails.filter(email => email !== emailToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail(e);
    }
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
          onClick={(e) => {
            // Ensure we only close if clicking the backdrop directly
            if (e.target === e.currentTarget) {
              props.onClose();
            }
          }}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CONFIGURATION VIEW */}
            <Show when={!props.shareLink && !props.shareError}>
              <h2 class="text-xl font-semibold mb-6">Share Note</h2>
              
              <div class="space-y-6">
                {/* Access Type */}
                <div>
                  <label class="block text-sm font-medium mb-2 text-muted">Access Type</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => props.setAccessType("public")}
                      class={`flex-1 py-2 px-4 rounded text-sm font-medium border transition-colors ${
                        props.accessType === "public"
                          ? "bg-primary text-background border-primary"
                          : "bg-secondary text-muted border-custom hover:border-primary/50"
                      }`}
                    >
                      Public
                    </button>
                    <div class="flex-1 relative group">
                      <button
                        type="button"
                        onClick={() => props.isAuthenticated && props.setAccessType("private")}
                        disabled={!props.isAuthenticated}
                        class={`w-full h-full py-2 px-4 rounded text-sm font-medium border transition-colors ${
                          props.accessType === "private"
                            ? "bg-primary text-background border-primary"
                            : "bg-secondary text-muted border-custom"
                        } ${!props.isAuthenticated ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}`}
                      >
                        Private
                      </button>
                      <Show when={!props.isAuthenticated}>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-background bg-foreground rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Login required for private shares
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>

                {/* Permission Level */}
                <div>
                  <label class="block text-sm font-medium mb-2 text-muted">Permission</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => props.setPermissionLevel("read")}
                      class={`flex-1 py-2 px-4 rounded text-sm font-medium border transition-colors ${
                        props.permissionLevel === "read"
                          ? "bg-primary text-background border-primary"
                          : "bg-secondary text-muted border-custom hover:border-primary/50"
                      }`}
                    >
                      Read Only
                    </button>
                    <button
                      type="button"
                      onClick={() => props.setPermissionLevel("write")}
                      class={`flex-1 py-2 px-4 rounded text-sm font-medium border transition-colors ${
                        props.permissionLevel === "write"
                          ? "bg-primary text-background border-primary"
                          : "bg-secondary text-muted border-custom hover:border-primary/50"
                      }`}
                    >
                      Read & Write
                    </button>
                  </div>
                </div>

                {/* Allowed Emails (Private Only) */}
                <Show when={props.accessType === "private"}>
                  <div>
                    <label class="block text-sm font-medium mb-2 text-muted">Allowed Emails</label>
                    <div class="space-y-3">
                      <div class="flex gap-2">
                        <input
                          type="email"
                          value={emailInput()}
                          onInput={(e) => setEmailInput(e.currentTarget.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="user@example.com"
                          class="flex-1 px-3 py-2 bg-secondary border border-custom rounded text-sm focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={handleAddEmail}
                          disabled={!emailInput().trim()}
                          class="px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-80 text-sm font-medium disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      
                      <Show when={props.allowedEmails.length > 0}>
                        <div class="flex flex-wrap gap-2 p-3 bg-secondary/50 rounded border border-custom/50 max-h-32 overflow-y-auto">
                          <For each={props.allowedEmails}>
                            {(email) => (
                              <div class="flex items-center gap-2 px-2 py-1 bg-background border border-custom rounded text-xs">
                                <span>{email}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmail(email)}
                                  class="text-muted hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>

                <button
                  type="button"
                  onClick={props.onGenerate}
                  disabled={props.isLoading || (props.accessType === "private" && props.allowedEmails.length === 0)}
                  class="w-full py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {props.isLoading ? "Generating..." : "Generate Share Link"}
                </button>
              </div>
            </Show>

            {/* SUCCESS VIEW */}
            <Show when={props.shareLink}>
              <h2 class="text-xl font-semibold mb-4">Share Link Created</h2>
              <p class="text-muted text-sm mb-4">
                Anyone with access can view this note:
              </p>

              <Show when={props.accessType === "private" && props.allowedEmails.length > 0}>
                <div class="mb-4 p-3 bg-secondary border border-custom rounded">
                  <p class="text-xs text-muted mb-2">Allowed emails:</p>
                  <div class="flex flex-wrap gap-2">
                    <For each={props.allowedEmails}>
                      {(email) => (
                        <span class="px-2 py-1 bg-primary text-background rounded text-xs">
                          {email}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <div class="flex gap-2 mb-4">
                <input
                  type="text"
                  value={props.shareLink!}
                  readonly
                  class="flex-1 px-3 py-2 bg-secondary border border-custom rounded text-sm"
                />
                <button
                  type="button"
                  onClick={props.onCopy}
                  class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium"
                >
                  Copy
                </button>
              </div>

              <button
                type="button"
                onClick={props.onClose}
                class="w-full px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
              >
                Close
              </button>
            </Show>

            {/* ERROR VIEW */}
            <Show when={props.shareError}>
              <h2 class="text-xl font-semibold mb-4 text-red-500">
                Error Creating Share
              </h2>
              <p class="text-muted text-sm mb-4">{props.shareError}</p>
              <div class="flex gap-2">
                 <button
                  type="button"
                  onClick={() => props.onClose()} // Or reset error
                  class="flex-1 px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
