import { Accessor, createContext, createSignal, JSX } from "solid-js";
import { Actor } from "~/types/actor";

export interface WriterContextValue {
  writer: Actor.Writer;
  collaborators: Accessor<Record<string, Actor.Writer>>;

  addCollaborator: (collaborator: Actor.Writer) => void;
  updateCollaborator: (collaborator: Actor.Writer) => void;
  removeCollaborator: (collaboratorId: string) => void;
}

export const WriterContext = createContext<WriterContextValue>();
export function WriterContextProvider(props: {
  children: JSX.Element;
  writer: Actor.Writer;
}) {
  const [collaborators, setCollaborators] = createSignal<
    Record<string, Actor.Writer>
  >({});
  let value: WriterContextValue = {
    writer: props.writer,
    collaborators,
    addCollaborator: (collaborator: Actor.Writer) => {
      setCollaborators((prev) => ({
        ...prev,
        [collaborator.id]: collaborator,
      }));
    },
    updateCollaborator: (collaborator: Actor.Writer) => {
      if (!collaborators()[collaborator.id])
        throw new Error("Collaborator not found");
      setCollaborators((prev) => ({
        ...prev,
        [collaborator.id]: collaborator,
      }));
    },
    removeCollaborator: (collaboratorId: string) => {
      setCollaborators((prev) => {
        const updated = { ...prev };
        delete updated[collaboratorId];
        return updated;
      });
    },
  };

  return (
    <WriterContext.Provider value={value}>
      {props.children}
    </WriterContext.Provider>
  );
}
