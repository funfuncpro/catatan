import {
  createContext,
  createSignal,
  Accessor,
  Setter,
  onMount,
} from "solid-js";
import * as Solid from "solid-js";

export interface EditorContextValue {
  markdown: Accessor<string>;
  setMarkdown: Setter<string>;
  text: Accessor<string>;
  setText: Setter<string>;
  isDirty: Accessor<boolean>;
  setIsDirty: Setter<boolean>;
  lastChanged: Accessor<Date | null>;
  lastSaved: Accessor<Date | null>;
  setLastSaved: Setter<Date | null>;
  setLastChanged: Setter<Date | null>;
  handleSave: Accessor<(() => Promise<void>) | null>;
  setHandleSave: Setter<(() => Promise<void>) | null>;
  noteId: Accessor<string | null>;
  setNoteId: Setter<string | null>;
}

export const EditorContext = createContext<EditorContextValue>();

export function EditorContextProvider(props: { children: Solid.JSX.Element }) {
  const [markdown, setMarkdown] = createSignal("");
  const [text, setText] = createSignal("");
  const [isDirty, setIsDirty] = createSignal(false);
  const [lastChanged, setLastChanged] = createSignal<Date | null>(null);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [handleSave, setHandleSave] = createSignal<
    (() => Promise<void>) | null
  >(null);
  const [noteId, setNoteId] = createSignal<string | null>(null);

  const contextValue: EditorContextValue = {
    markdown,
    setMarkdown,
    text,
    setText,
    isDirty,
    setIsDirty,
    lastChanged,
    setLastChanged,
    lastSaved,
    setLastSaved,
    handleSave,
    setHandleSave,
    noteId,
    setNoteId,
  };

  onMount(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/notes`,
        {
          method: "POST",
        },
      );
      const result = await response.json();
      if (result.success && result.data) {
        setNoteId(result.data.note_id);
        setMarkdown(result.data.content || "");
      }
    } catch (error) {
      console.error("Failed to fetch note:", error);
    }
  });

  return (
    <EditorContext.Provider value={contextValue}>
      {props.children}
    </EditorContext.Provider>
  );
}
