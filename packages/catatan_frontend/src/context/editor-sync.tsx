import {
  Accessor,
  createContext,
  createSignal,
  JSX,
  useContext,
} from "solid-js";
import { YataContext } from "./yata";

export type SyncOperation =
  | { type: "insert"; pos: number; content: string }
  | { type: "delete"; pos: number; count: number };

export interface EditorSyncContextValue {
  pendingRemoteOps: Accessor<SyncOperation[]>;
  clearPendingOps: () => void;
  syncLocalInsert: (pos: number, content: string) => Promise<void>;
  syncLocalDelete: (pos: number, count: number) => Promise<void>;
  pushRemoteOp: (op: SyncOperation) => void;
}

export const EditorSyncContext = createContext<EditorSyncContextValue>();

export function EditorSyncContextProvider(props: { children: JSX.Element }) {
  const yataContext = useContext(YataContext);

  const [pendingRemoteOps, setPendingRemoteOps] = createSignal<SyncOperation[]>(
    [],
  );

  const clearPendingOps = () => {
    setPendingRemoteOps([]);
  };

  const pushRemoteOp = (op: SyncOperation) => {
    setPendingRemoteOps((prev) => [...prev, op]);
  };

  const syncLocalInsert = async (pos: number, content: string) => {
    if (!yataContext) {
      console.warn("Cannot sync insert: YATA context not available");
      return;
    }

    try {
      await yataContext.insertAtPosition(pos, content);
    } catch (error) {
      console.error("Failed to sync local insert:", error);
      // TODO: Handle conflict/rollback if needed
    }
  };

  const syncLocalDelete = async (pos: number, count: number) => {
    if (!yataContext) {
      console.warn("Cannot sync delete: YATA context not available");
      return;
    }

    try {
      // Use batch delete for efficiency - single network call instead of multiple
      await yataContext.deleteBatchAtPosition(pos, count);
    } catch (error) {
      console.error("Failed to sync local delete:", error);
      // TODO: Handle conflict/rollback if needed
    }
  };

  const contextValue: EditorSyncContextValue = {
    pendingRemoteOps,
    clearPendingOps,
    syncLocalInsert,
    syncLocalDelete,
    pushRemoteOp,
  };

  return (
    <EditorSyncContext.Provider value={contextValue}>
      {props.children}
    </EditorSyncContext.Provider>
  );
}
