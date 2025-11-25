import { createFileRoute } from "@tanstack/solid-router";
import { CanvasEditor } from "~/components/canvas-editor/index";
import { Header } from "~/components/layout/header-new";
import StatusLine from "~/components/layout/statusline";
import { ConnectionContextProvider } from "~/context/connection";
import { CursorContextProvider } from "~/context/cursor";
import { getEditorSessionFn } from "~/context/editor";
import { NotesContextProvider } from "~/context/notes";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async () => {
    const noteData = await getEditorSessionFn();
    return { noteData };
  },
});

function Index() {
  const loaderData = Route.useLoaderData();

  return (
    <div class="flex flex-col relative w-full text-base ">
      <NotesContextProvider noteID={loaderData().noteData?.noteId}>
        <ConnectionContextProvider>
          <CursorContextProvider>
            <Header />
            <div class="relative w-full my-16">
              <CanvasEditor />
              <StatusLine />
            </div>
          </CursorContextProvider>
        </ConnectionContextProvider>
      </NotesContextProvider>
    </div>
  );
}
