import { createFileRoute } from "@tanstack/solid-router";
import { onMount, useContext, Show } from "solid-js";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";
import StatusLine from "~/components/layout/statusline";
import { EditorContextProvider, EditorContext } from "~/context/editor-client";
import { getEditorSessionFn } from "~/context/editor";

export const Route = createFileRoute("/")({
  component: Login,
  loader: async () => {
    const noteData = await getEditorSessionFn();
    return { noteData };
  },
});

function EditorComp() {
  const context = useContext(EditorContext);
  onMount(() => {
    context?.setHandleSave(() => async () => {
      const noteId = context?.noteId();
      if (!noteId) {
        console.error("No note ID available for saving");
        return;
      }

      let result = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/notes/${noteId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: context?.markdown(),
          }),
        },
      );
      const data = await result.json();
      if (data.success) {
        context?.setLastSaved(new Date());
      }
    });

    addEventListener("keydown", async (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        const saveHandler = context?.handleSave();
        if (saveHandler) {
          await saveHandler();
        }
      }
    });
  });

  return (
    <>
      <Show when={context?.isLoading()}>
        <div class="flex items-center justify-center min-h-[50vh]">
          <div class="text-muted">Loading note...</div>
        </div>
      </Show>

      <Show when={context?.error()}>
        <div class="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div class="text-red-500">Error: {context?.error()}</div>
          <button
            onClick={() => window.location.reload()}
            class="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
          >
            Retry
          </button>
        </div>
      </Show>

      <Show when={!context?.isLoading() && !context?.error()}>
        <Editor />
      </Show>
    </>
  );
}

function Login() {
  const loaderData = Route.useLoaderData();

  return (
    <div class="flex flex-col relative w-full text-base ">
      <EditorContextProvider note={loaderData().noteData}>
        <Header />
        <div class="relative w-full my-16">
          <EditorComp />
          <StatusLine />
        </div>
      </EditorContextProvider>
    </div>
  );
}
