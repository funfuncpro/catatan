import { createServerFn } from "@tanstack/solid-start";
import { useEditorSession } from "./editor.session";

export const getEditorSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await useEditorSession();
    if (!session.data?.note_id) return null;
    return fetch(
      `${import.meta.env.VITE_API_URL}/api/v1/notes/${session.data.note_id}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch note data");
        try {
          const data = await response.json();
          return {
            clock: data.data.clock,
            noteId: data.data.note_id,
            content: data.data.content || "",
          };
        } catch {
          return null;
        }
      })
      .catch(() => null);
  },
);

export const updateEditorSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { noteId: string }) => data)
  .handler(async ({ data }) => {
    const session = await useEditorSession();
    try {
      await session.update({ note_id: data.noteId });
      return { success: true };
    } catch {
      return { success: false };
    }
  });

export const clearEditorSessionFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useEditorSession();
    await session.clear();
    return { success: true };
  },
);
