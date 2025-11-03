import { createFileRoute } from "@tanstack/solid-router";
import { createEffect, onMount, useContext } from "solid-js";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";
import StatusLine from "~/components/layout/statusline";
import { EditorContextProvider, EditorContext } from "~/context/editor";

export const Route = createFileRoute("/")({
  component: Login,
});

function EditorComp() {
  const context = useContext(EditorContext);

  createEffect(() => {
    if (!context) return;
    console.log(context.lastSaved());
  });

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
          method: "PATCH",
          body: JSON.stringify({
            content: context?.markdown(),
          }),
        },
      );
      if (result.ok) {
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

  return <Editor />;
}

function Login() {
  return (
    <div class="flex flex-col relative w-full text-base ">
      <Header />
      <div class="relative w-full my-16">
        <EditorContextProvider>
          <EditorComp />
          <StatusLine />
        </EditorContextProvider>
      </div>
    </div>
  );
}
