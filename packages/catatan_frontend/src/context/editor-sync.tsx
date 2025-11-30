import {
  Accessor,
  createContext,
  createSignal,
  JSX,
  onCleanup,
  useContext,
} from "solid-js";
import { YataContext } from "./yata";

export type SyncOperation =
  | { type: "insert"; pos: number; content: string }
  | { type: "delete"; pos: number; count: number };

interface PendingInsert {
  pos: number;
  content: string;
}

export interface EditorSyncContextValue {
  pendingRemoteOps: Accessor<SyncOperation[]>;
  clearPendingOps: () => void;
  syncLocalInsert: (pos: number, content: string) => Promise<void>;
  syncLocalDelete: (pos: number, count: number) => Promise<void>;
  syncLocalDeleteByIds: (elementIds: string[]) => Promise<void>;
  getDeleteTargetRange: (pos: number, count: number) => string[];
  pushRemoteOp: (op: SyncOperation) => void;
}

export const EditorSyncContext = createContext<EditorSyncContextValue>();

// Batch consecutive inserts within this window (ms)
const INSERT_BATCH_DELAY = 50;

export function EditorSyncContextProvider(props: { children: JSX.Element }) {
  const yataContext = useContext(YataContext);

  const [pendingRemoteOps, setPendingRemoteOps] = createSignal<SyncOperation[]>(
    [],
  );

  // Queue for batching inserts
  let pendingInserts: PendingInsert[] = [];
  let insertBatchTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessingInserts = false;

  // Cleanup timer on unmount
  onCleanup(() => {
    if (insertBatchTimer) {
      clearTimeout(insertBatchTimer);
    }
  });

  const clearPendingOps = () => {
    setPendingRemoteOps([]);
  };

  const pushRemoteOp = (op: SyncOperation) => {
    setPendingRemoteOps((prev) => [...prev, op]);
  };

  // Process batched inserts sequentially
  const processPendingInserts = async () => {
    if (isProcessingInserts || pendingInserts.length === 0) return;

    isProcessingInserts = true;

    // Take all pending inserts
    const insertsToProcess = [...pendingInserts];
    pendingInserts = [];

    // Merge consecutive inserts at adjacent positions
    const mergedInserts: PendingInsert[] = [];
    for (const insert of insertsToProcess) {
      const last = mergedInserts[mergedInserts.length - 1];
      if (last && insert.pos === last.pos + last.content.length) {
        // Adjacent insert - merge content
        last.content += insert.content;
      } else {
        mergedInserts.push({ ...insert });
      }
    }

    // Process merged inserts sequentially
    for (const insert of mergedInserts) {
      if (!yataContext) continue;

      try {
        // For multi-character inserts, we still need to insert char by char
        // because YATA requires each character to have its own element
        for (let i = 0; i < insert.content.length; i++) {
          await yataContext.insertAtPosition(insert.pos + i, insert.content[i]);
        }
      } catch (error) {
        console.error("Failed to sync batched insert:", error);
      }
    }

    isProcessingInserts = false;

    // Check if more inserts came in while processing
    if (pendingInserts.length > 0) {
      processPendingInserts();
    }
  };

  const syncLocalInsert = async (pos: number, content: string) => {
    if (!yataContext) {
      console.warn("Cannot sync insert: YATA context not available");
      return;
    }

    // Add to pending batch
    pendingInserts.push({ pos, content });

    // Reset the batch timer
    if (insertBatchTimer) {
      clearTimeout(insertBatchTimer);
    }

    // Schedule batch processing after delay
    insertBatchTimer = setTimeout(() => {
      insertBatchTimer = null;
      processPendingInserts();
    }, INSERT_BATCH_DELAY);
  };

  const syncLocalDelete = async (pos: number, count: number) => {
    if (!yataContext) {
      console.warn("Cannot sync delete: YATA context not available");
      return;
    }

    // Flush any pending inserts first to maintain order
    if (pendingInserts.length > 0) {
      if (insertBatchTimer) {
        clearTimeout(insertBatchTimer);
        insertBatchTimer = null;
      }
      await processPendingInserts();
    }

    try {
      // Use batch delete for efficiency - single network call instead of multiple
      await yataContext.deleteBatchAtPosition(pos, count);
    } catch (error) {
      console.error("Failed to sync local delete:", error);
    }
  };

  const syncLocalDeleteByIds = async (elementIds: string[]) => {
    if (!yataContext) {
      console.warn("Cannot sync delete: YATA context not available");
      return;
    }

    // Flush any pending inserts first to maintain order
    if (pendingInserts.length > 0) {
      if (insertBatchTimer) {
        clearTimeout(insertBatchTimer);
        insertBatchTimer = null;
      }
      await processPendingInserts();
    }

    try {
      await yataContext.deleteBatchByIds(elementIds);
    } catch (error) {
      console.error("Failed to sync local delete by IDs:", error);
    }
  };

  const getDeleteTargetRange = (pos: number, count: number): string[] => {
    if (!yataContext) {
      console.warn("Cannot get delete targets: YATA context not available");
      return [];
    }
    return yataContext.getDeleteTargetRange(pos, count);
  };

  const contextValue: EditorSyncContextValue = {
    pendingRemoteOps,
    clearPendingOps,
    syncLocalInsert,
    syncLocalDelete,
    syncLocalDeleteByIds,
    getDeleteTargetRange,
    pushRemoteOp,
  };

  return (
    <EditorSyncContext.Provider value={contextValue}>
      {props.children}
    </EditorSyncContext.Provider>
  );
}
