import { useServerFn } from "@tanstack/solid-start";
import {
  Accessor,
  createContext,
  createSignal,
  JSX,
  onMount,
  Setter,
} from "solid-js";
import { createNewNote } from "~/lib/notes";
import { updateEditorSessionFn } from "./editor";

export interface NotesContextValue {
  notesID: Accessor<string | null>;
  setNotesID: Setter<string | null>;
}

export const NotesContext = createContext<NotesContextValue>();

export function NotesContextProvider(props: {
  children: JSX.Element;
  noteID: string | null;
}) {
  const [notesID, setNotesID] = createSignal<string | null>(props.noteID);
  const updateEditorSession = useServerFn(updateEditorSessionFn);

  const ctxValue: NotesContextValue = {
    notesID,
    setNotesID,
  };

  onMount(async () => {
    if (!props.noteID) {
      let { error, data } = await createNewNote();
      if (!error && data) {
        await updateEditorSession({
          data: {
            noteId: data.note_id,
          },
        });
        setNotesID(data.note_id);
      }
    }
  });

  return (
    <NotesContext.Provider value={ctxValue}>
      {props.children}
    </NotesContext.Provider>
  );
}
