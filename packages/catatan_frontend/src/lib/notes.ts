import { Notes } from "~/types/note";
import { Actor } from "~/types/actor";
import { CRDT } from "~/lib/crdt";
import { websocketConnectFn, PhoenixChannel } from "./websocket";
import { tokenStorage } from "./auth";

/** Response received when joining the notes channel */
export interface JoinResponse {
  my_writer_id: string;
  writers: Actor.WritersMap;
  permission: "read" | "write";
}

/** Presence state event payload from server */
export interface PresenceStatePayload {
  event: "presence_state";
  writers: Actor.WritersMap;
}

/** Remote insert event payload from server */
export interface RemoteInsertPayload {
  element: CRDT.SerializedElement;
}

/** Remote delete event payload from server */
export interface RemoteDeletePayload {
  element_id: string;
  deleted_at: string;
}

/** Remote batch delete event payload from server */
export interface RemoteDeleteBatchPayload {
  element_ids: string[];
  deleted_at: string;
}

/** Callbacks for notes channel events */
export interface NotesChannelCallbacks {
  setIsConnected: (connected: boolean) => void;
  onJoinSuccess?: (response: JoinResponse) => void;
  onPresenceState?: (payload: PresenceStatePayload) => void;
  onRemoteInsert?: (payload: RemoteInsertPayload) => void;
  onRemoteDelete?: (payload: RemoteDeletePayload) => void;
  onRemoteDeleteBatch?: (payload: RemoteDeleteBatchPayload) => void;
}

export async function createNotesChannel({
  noteID,
  setIsConnected,
  onJoinSuccess,
  onPresenceState,
  onRemoteInsert,
  onRemoteDelete,
  onRemoteDeleteBatch,
}: NotesChannelCallbacks & { noteID: string }): Promise<
  PhoenixChannel | undefined
> {
  const connectionKey = `notes:${noteID}`;
  const url = `${import.meta.env.VITE_API_URL}/socket/notes/websocket`;

  // Get token for authentication
  const token = tokenStorage.getAccessToken() || "";

  try {
    const channel = await websocketConnectFn(
      url,
      connectionKey,
      {
        onJoin(response) {
          console.log("Connected to notes channel:", response);
          setIsConnected(true);

          // The server returns { my_writer_id: string, writers: { id: Writer, ... } }
          const joinResponse = response as unknown as JoinResponse;

          if (joinResponse.writers && joinResponse.my_writer_id) {
            onJoinSuccess?.(joinResponse);
          }
        },

        onJoinError: (error) => {
          console.error("Failed to join WebSocket channel:", error);
          setIsConnected(false);
        },
        onError: (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
        },
        onClose: (event) => {
          console.log("WebSocket closed:", event.code);
          setIsConnected(false);
        },
      },
      undefined,
      undefined,
      {
        params: { token },
      },
    );

    // Register event handlers
    if (channel) {
      // Presence state updates
      if (onPresenceState) {
        channel.on<PresenceStatePayload>("presence_state", (payload) => {
          console.log("Presence state update:", payload);
          onPresenceState(payload);
        });
      }

      // Remote insert events (when another client inserts)
      if (onRemoteInsert) {
        channel.on<RemoteInsertPayload>("remote_insert", (payload) => {
          console.log("Remote insert:", payload);
          onRemoteInsert(payload);
        });
      }

      // Remote delete events (when another client deletes)
      if (onRemoteDelete) {
        channel.on<RemoteDeletePayload>("remote_delete", (payload) => {
          console.log("Remote delete:", payload);
          onRemoteDelete(payload);
        });
      }

      // Remote batch delete events (when another client deletes multiple elements)
      if (onRemoteDeleteBatch) {
        channel.on<RemoteDeleteBatchPayload>(
          "remote_delete_batch",
          (payload) => {
            console.log("Remote delete batch:", payload);
            onRemoteDeleteBatch(payload);
          },
        );
      }
    }

    return channel;
  } catch (err) {
    console.error("Error connecting to notes channel:", err);
  }
}

export async function createNewNote() {
  return fetch(`${import.meta.env.VITE_API_URL}/api/v1/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("response was not ok");
      }
      let result = await response.json();
      if (result.success && result.data) {
        return {
          data: result.data as Notes,
          error: null,
        };
      }
      throw new Error(result.message || "Failed to create note");
    })
    .catch((error) => {
      console.error("Failed to create note:", error);
      return {
        data: null,
        error: error.message ?? "Failed to create note",
      };
    });
}

export async function claimNote(noteId: string) {
  const token = tokenStorage.getAccessToken();
  if (!token) return { error: "Not authenticated" };

  return fetch(`${import.meta.env.VITE_API_URL}/api/v1/notes/${noteId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to claim note");
      }
      return await response.json();
    })
    .catch((error) => {
      console.error("Failed to claim note:", error);
      return {
        success: false,
        message: error.message,
      };
    });
}
