import { createEffect, createSignal, onMount, Show } from "solid-js";

export default function Command() {
  let rootElement!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  let [open, setOpen] = createSignal(false);
  let [search, setSearch] = createSignal("");

  const closeCommand = () => setOpen(false);
  onMount(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(!open());
      }
      if (event.key === "Escape" && open()) {
        closeCommand();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  });

  createEffect(() => {
    if (open()) {
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === rootElement) {
      closeCommand();
    }
  };

  return (
    <Show when={open()}>
      <div
        ref={rootElement}
        class="fixed inset-0 z-50 flex items-center justify-center"
        onClick={handleBackdropClick}
      >
        <div
          class="bg-secondary shadow-xl w-full max-w-2xl mx-4 border border-custom"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="p-4">
            <input
              type="text"
              placeholder="Type a command or search..."
              class="w-full px-4 py-3 bg-tertiary border border-custom focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base placeholder:text-muted"
            />
          </div>
          <div class="border-t border-custom max-h-96 overflow-y-auto">
            <div class="p-2">
              <div class="px-3 py-2 text-sm text-muted">No results</div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
