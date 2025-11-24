import { Show, For } from "solid-js";

interface ShareModalProps {
  shareLink: string | null;
  shareError: string | null;
  showConfigModal: boolean;
  accessType: "public" | "restricted";
  permissionLevel: "read" | "write";
  allowedEmails: string[];
  onClose: () => void;
  onCopy: () => void;
}

export function ShareModal(props: ShareModalProps) {
  return (
    <>
      {/* Share success modal */}
      <Show when={props.shareLink && !props.showConfigModal}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={props.onClose}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4">Share Link Created</h2>

            <p class="text-muted text-sm mb-4">
              Anyone with this link can access your note:
            </p>

            <Show
              when={
                props.accessType === "restricted" &&
                props.allowedEmails.length > 0
              }
            >
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
                onClick={props.onCopy}
                class="px-4 py-2 bg-primary text-background rounded hover:bg-opacity-90 text-sm font-medium"
              >
                Copy
              </button>
            </div>

            <button
              onClick={props.onClose}
              class="w-full px-4 py-2 bg-secondary border border-custom rounded hover:bg-opacity-90 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      {/* Error modal */}
      <Show when={props.shareError}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={props.onClose}
        >
          <div
            class="bg-background border border-custom rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold mb-4 text-red-500">
              Error Creating Share
            </h2>
            <p class="text-muted text-sm mb-4">{props.shareError}</p>

            <button
              onClick={props.onClose}
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
