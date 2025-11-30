import { createFileRoute } from "@tanstack/solid-router";
import { CanvasEditor } from "~/components/canvas-editor/index";
import { Header } from "~/components/layout/header";
import StatusLine from "~/components/layout/statusline";
import { ConnectionContextProvider } from "~/context/connection";
import { CursorContextProvider } from "~/context/cursor";
import { getEditorSessionFn } from "~/context/editor";
import { EditorSyncContextProvider } from "~/context/editor-sync";
import { NotesContextProvider } from "~/context/notes";
import { WriterContextProvider } from "~/context/writer";
import { YataContextProvider } from "~/context/yata";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async () => {
    const noteData = await getEditorSessionFn();
    console.log(noteData);
    return { noteData };
  },
});

function Index() {
  const loaderData = Route.useLoaderData();

  return (
    <div class="flex flex-col relative w-full text-base ">
      <NotesContextProvider noteID={loaderData().noteData?.noteId}>
        <YataContextProvider>
          <CursorContextProvider>
            <EditorSyncContextProvider>
              <WriterContextProvider>
                <ConnectionContextProvider>
                  <Header />
                  <div class="relative w-full my-16">
                    <CanvasEditor
                      initialContent={loaderData().noteData?.content ?? ""}
                    />
                    <StatusLine />
                  </div>
                </ConnectionContextProvider>
              </WriterContextProvider>
            </EditorSyncContextProvider>
          </CursorContextProvider>
        </YataContextProvider>
      </NotesContextProvider>
    </div>
  );
}
