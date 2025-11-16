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
  isLoading: Accessor<boolean>;
  setIsLoading: Setter<boolean>;
  error: Accessor<string | null>;
  setError: Setter<string | null>;
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
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

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
    isLoading,
    setIsLoading,
    error,
    setError,
  };

  onMount(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if this tab has a stored note ID in sessionStorage (per-tab)
      const storedNoteId = sessionStorage.getItem("current_note_id");
      
      if (storedNoteId) {
        // Try to fetch the existing note for this tab
        console.log("Attempting to load existing note for this tab:", storedNoteId);
        try {
          const getResponse = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/notes/${storedNoteId}`,
            {
              credentials: "include",
            },
          );
          
          if (getResponse.ok) {
            const getResult = await getResponse.json();
            if (getResult.success && getResult.data) {
              console.log("Successfully loaded existing note:", getResult.data.note_id);
              setNoteId(getResult.data.note_id);
              setMarkdown(getResult.data.content || "");
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log("Failed to load existing note, will create new one:", err);
          // Clear invalid note ID from storage
          sessionStorage.removeItem("current_note_id");
        }
      }
      
      // If no stored note ID or fetch failed, create a new note
      console.log("Creating new note for this tab...");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/notes`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      
      const result = await response.json();
      console.log("Create note result:", result);
      
      // API returns "success" as boolean, not "status" as string
      if (result.success && result.data) {
        setNoteId(result.data.note_id);
        setMarkdown(result.data.content || "");
        // Store the note ID in sessionStorage (unique per tab)
        sessionStorage.setItem("current_note_id", result.data.note_id);
        setIsLoading(false);
      } else {
        setError(result.message || "Failed to load note");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch note:", error);
      setError("Failed to connect to the server");
      setIsLoading(false);
    }
  });

  return (
    <EditorContext.Provider value={contextValue}>
      {props.children}
    </EditorContext.Provider>
  );
}
