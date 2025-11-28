import { Accessor, createContext, createSignal, JSX, Setter } from "solid-js";
import { Actor } from "~/types/actor";

export interface WriterContextValue {
  writer: Accessor<Actor.Writer | null>;
  setWriter: Setter<Actor.Writer | null>;

  collaborators: Accessor<Record<string, Actor.Writer>>;
  setCollaborators: Setter<Record<string, Actor.Writer>>;
  addCollaborator: (collaborator: Actor.Writer) => void;
  updateCollaborator: (collaborator: Actor.Writer) => void;
  removeCollaborator: (collaboratorId: string) => void;

  /** Initialize from join response - sets current writer and all collaborators */
  initializeFromJoinResponse: (
    myWriterId: string,
    writers: Actor.WritersMap,
  ) => void;
}

export const WriterContext = createContext<WriterContextValue>();

export function WriterContextProvider(props: {
  children: JSX.Element;
  writer?: Actor.Writer | null;
}) {
  const [writer, setWriter] = createSignal<Actor.Writer | null>(
    props.writer ?? null,
  );
  const [collaborators, setCollaborators] = createSignal<
    Record<string, Actor.Writer>
  >({});

  const addCollaborator = (collaborator: Actor.Writer) => {
    setCollaborators((prev) => ({
      ...prev,
      [collaborator.id]: collaborator,
    }));
  };

  const updateCollaborator = (collaborator: Actor.Writer) => {
    setCollaborators((prev) => ({
      ...prev,
      [collaborator.id]: collaborator,
    }));
  };

  const removeCollaborator = (collaboratorId: string) => {
    setCollaborators((prev) => {
      const updated = { ...prev };
      delete updated[collaboratorId];
      return updated;
    });
  };

  const initializeFromJoinResponse = (
    myWriterId: string,
    writers: Actor.WritersMap,
  ) => {
    // Extract current user's writer
    const myWriter = writers[myWriterId];
    if (myWriter) {
      setWriter(myWriter);
    }

    // Set all other writers as collaborators (excluding self)
    const otherWriters = { ...writers };
    delete otherWriters[myWriterId];
    setCollaborators(otherWriters);
  };

  const value: WriterContextValue = {
    writer,
    setWriter,
    collaborators,
    setCollaborators,
    addCollaborator,
    updateCollaborator,
    removeCollaborator,
    initializeFromJoinResponse,
  };

  return (
    <WriterContext.Provider value={value}>
      {props.children}
    </WriterContext.Provider>
  );
}
