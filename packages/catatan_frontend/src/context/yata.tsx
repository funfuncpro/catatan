import { Accessor, createContext, createSignal, JSX } from "solid-js";
import { CRDT, createYataDocument, YataDocument } from "~/lib/crdt";
import { PhoenixChannel } from "~/lib/websocket";

export interface YataContextValue {
  document: Accessor<YataDocument | null>;
  initializeDocument: (noteId: string, writerId: string) => void;
  insertAtPosition: (
    pos: number,
    content: string,
  ) => Promise<CRDT.Element | null>;
  deleteAtPosition: (pos: number) => Promise<boolean>;
  deleteBatchAtPosition: (pos: number, count: number) => Promise<boolean>;
  integrateRemoteElement: (element: CRDT.SerializedElement) => void;
  markRemoteDeleted: (elementId: string, deletedAt: string) => void;
  markRemoteDeletedBatch: (elementIds: string[], deletedAt: string) => void;
  syncWithServer: () => Promise<void>;
  getText: () => string;
  positionToElement: (pos: number) => CRDT.Cursor;
  elementToPosition: (
    afterElement: CRDT.ElementId | null,
    offset: number,
  ) => number;
  getInsertPosition: (pos: number) => {
    origin: CRDT.ElementId | null;
    rightOrigin: CRDT.ElementId | null;
  };
  setChannel: (channel: PhoenixChannel | null) => void;
}

export const YataContext = createContext<YataContextValue>();

export function YataContextProvider(props: { children: JSX.Element }) {
  const [document, setDocument] = createSignal<YataDocument | null>(null);
  const [channel, setChannel] = createSignal<PhoenixChannel | null>(null);

  const initializeDocument = (noteId: string, writerId: string) => {
    const doc = createYataDocument(noteId, writerId);
    setDocument(doc);
  };

  const insertAtPosition = async (
    pos: number,
    content: string,
  ): Promise<CRDT.Element | null> => {
    const doc = document();
    const ch = channel();

    if (!doc || !ch) {
      console.error("Cannot insert: document or channel not initialized");
      return null;
    }

    const { origin, rightOrigin } = doc.getInsertPosition(pos);

    try {
      const response = await ch.push("insert", {
        content,
        origin,
        right_origin: rightOrigin,
      });

      if (response && typeof response === "object" && "element" in response) {
        const serverElement = response.element as CRDT.SerializedElement;

        const newDoc = doc.clone();
        newDoc.integrateFromServer(serverElement);
        setDocument(newDoc);

        const elements = newDoc.toList();
        return (
          elements.find(
            (el) =>
              el.id[0] === serverElement.id[0] &&
              el.id[1] === serverElement.id[1],
          ) ?? null
        );
      }

      return null;
    } catch (error) {
      console.error("Failed to insert:", error);
      return null;
    }
  };

  const deleteAtPosition = async (pos: number): Promise<boolean> => {
    const doc = document();
    const ch = channel();

    if (!doc || !ch) {
      console.error("Cannot delete: document or channel not initialized");
      return false;
    }

    const elementId = doc.getDeleteTarget(pos);
    if (!elementId) {
      console.warn("No element to delete at position:", pos);
      return false;
    }

    try {
      await ch.push("delete", { element_id: elementId });

      const newDoc = doc.clone();
      newDoc.delete(elementId);
      setDocument(newDoc);

      return true;
    } catch (error) {
      console.error("Failed to delete:", error);
      return false;
    }
  };

  const integrateRemoteElement = (element: CRDT.SerializedElement) => {
    const doc = document();
    if (!doc) return;

    const newDoc = doc.clone();
    newDoc.integrateFromServer(element);
    setDocument(newDoc);
  };

  const markRemoteDeleted = (elementId: string, deletedAt: string) => {
    const doc = document();
    if (!doc) return;

    const newDoc = doc.clone();
    newDoc.markDeletedFromServer(elementId, deletedAt);
    setDocument(newDoc);
  };

  const markRemoteDeletedBatch = (elementIds: string[], deletedAt: string) => {
    const doc = document();
    if (!doc) return;

    const newDoc = doc.clone();
    for (const elementId of elementIds) {
      newDoc.markDeletedFromServer(elementId, deletedAt);
    }
    setDocument(newDoc);
  };

  const deleteBatchAtPosition = async (
    pos: number,
    count: number,
  ): Promise<boolean> => {
    const doc = document();
    const ch = channel();

    if (!doc || !ch) {
      console.error("Cannot delete batch: document or channel not initialized");
      return false;
    }

    const elementIds = doc.getDeleteTargetRange(pos, count);
    if (elementIds.length === 0) {
      console.warn("No elements to delete at position:", pos);
      return false;
    }

    try {
      await ch.push("delete_batch", { element_ids: elementIds });

      const newDoc = doc.clone();
      for (const elementId of elementIds) {
        newDoc.delete(elementId);
      }
      setDocument(newDoc);

      return true;
    } catch (error) {
      console.error("Failed to delete batch:", error);
      return false;
    }
  };

  const syncWithServer = async () => {
    const doc = document();
    const ch = channel();

    if (!doc || !ch) return;

    try {
      const stateVector = doc.getStateVector();
      const response = await ch.push("sync", { state_vector: stateVector });

      if (response && typeof response === "object" && "elements" in response) {
        const elements = response.elements as CRDT.SerializedElement[];

        const newDoc = doc.clone();
        for (const el of elements) {
          newDoc.integrateFromServer(el);
        }
        setDocument(newDoc);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
    }
  };

  const getText = (): string => {
    const doc = document();
    return doc?.toText() ?? "";
  };

  const positionToElement = (pos: number): CRDT.Cursor => {
    const doc = document();
    if (!doc) return { afterElement: null, offset: 0 };
    return doc.positionToElement(pos);
  };

  const elementToPosition = (
    afterElement: CRDT.ElementId | null,
    offset: number,
  ): number => {
    const doc = document();
    if (!doc) return 0;
    return doc.elementToPosition(afterElement, offset);
  };

  const getInsertPosition = (
    pos: number,
  ): { origin: CRDT.ElementId | null; rightOrigin: CRDT.ElementId | null } => {
    const doc = document();
    if (!doc) return { origin: null, rightOrigin: null };
    return doc.getInsertPosition(pos);
  };

  const contextValue: YataContextValue = {
    document,
    initializeDocument,
    insertAtPosition,
    deleteAtPosition,
    deleteBatchAtPosition,
    integrateRemoteElement,
    markRemoteDeleted,
    markRemoteDeletedBatch,
    syncWithServer,
    getText,
    positionToElement,
    elementToPosition,
    getInsertPosition,
    setChannel,
  };

  return (
    <YataContext.Provider value={contextValue}>
      {props.children}
    </YataContext.Provider>
  );
}
