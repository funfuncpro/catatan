import { Notes } from "~/types/note";
import { Actor } from "~/types/actor";
import { websocketConnectFn, PhoenixChannel } from "./websocket";

/** Response received when joining the notes channel */
export interface JoinResponse {
  my_writer_id: string;
  writers: Actor.WritersMap;
}

/** Presence state event payload from server */
export interface PresenceStatePayload {
  event: "presence_state";
  writers: Actor.WritersMap;
}

/** Callbacks for notes channel events */
export interface NotesChannelCallbacks {
  setIsConnected: (connected: boolean) => void;
  onJoinSuccess?: (response: JoinResponse) => void;
  onPresenceState?: (payload: PresenceStatePayload) => void;
}

export async function createNotesChannel({
  noteID,
  setIsConnected,
  onJoinSuccess,
  onPresenceState,
}: NotesChannelCallbacks & { noteID: string }): Promise<
  PhoenixChannel | undefined
> {
  const connectionKey = `notes:${noteID}`;
  const url = `${import.meta.env.VITE_API_URL}/socket/notes/websocket`;

  try {
    const channel = await websocketConnectFn(url, connectionKey, {
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
    });

    // Register event handler for presence_state updates
    if (channel && onPresenceState) {
      channel.on<PresenceStatePayload>("presence_state", (payload) => {
        console.log("Presence state update:", payload);
        onPresenceState(payload);
      });
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
